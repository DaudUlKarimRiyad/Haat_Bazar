import secrets
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from sqlalchemy import update, or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import select, func

from app.access import (COOKIE, COOKIE_PATH, DB, User, audit, client_info, denied, digest,
                        hash_password, issue, new_login, public_account, public_session,
                        revoke_all, verify_password)
from app.models import Account, Activity, LoginSession, now

router = APIRouter(prefix="/api/v1/auth", tags=["accounts"])
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Password = Annotated[str, Field(min_length=12, max_length=256)]

class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")

class Login(Input):
    email: str = Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email", mode="before")
    @classmethod
    def normalize(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

class Signup(Login):
    name: Name
    password: Password
    role: Literal["consumer", "grower"] = "consumer"

class Profile(Input):
    name: Name

class ChangePassword(Input):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: Password

@router.post("/signup", status_code=201)
def signup(data: Signup, request: Request, response: Response, db: DB):
    user = Account(name=data.name, email=data.email, password_hash=hash_password(data.password), role=data.role)
    db.add(user)
    audit(db, request, "signup", user.id, detail=data.role)
    try:
        return new_login(db, response, request, user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already registered.")

def check_attempts(db, request, target, event):
    count = db.exec(select(func.count()).select_from(Activity).where(
        Activity.event == event, Activity.time >= now()-600,
        or_(Activity.ip == client_info(request)["ip"], Activity.target == target))).one()
    if count >= 10:
        raise HTTPException(429, "Too many attempts. Try again in ten minutes.")

@router.post("/login")
def login(data: Login, request: Request, response: Response, db: DB):
    check_attempts(db, request, data.email, "failed_login")
    user = db.exec(select(Account).where(Account.email == data.email).with_for_update()).first()
    if not user or user.banned or not verify_password(data.password, user.password_hash):
        audit(db, request, "failed_login", user.id if user else "", data.email)
        db.commit()
        raise HTTPException(401, "Invalid credentials or unavailable account.")
    audit(db, request, "login", user.id, user.email)
    return new_login(db, response, request, user)

def cookie_session(request, db):
    raw = request.cookies.get(COOKIE)
    if not raw:
        denied()
    session = db.exec(select(LoginSession).where(LoginSession.digest == digest(raw),
                      LoginSession.revoked == False, LoginSession.expires > now())).first()
    if not session:
        denied()
    return session

@router.post("/refresh")
def refresh(request: Request, response: Response, db: DB):
    session = cookie_session(request, db)
    user = db.get(Account, session.user_id)
    if not user or user.banned:
        denied()
    raw = secrets.token_urlsafe(48)
    changed = db.execute(update(LoginSession).where(LoginSession.id == session.id,
        LoginSession.digest == session.digest, LoginSession.revoked == False).values(digest=digest(raw)))
    if changed.rowcount != 1:
        denied()
    db.commit()
    return issue(db, response, user, session, raw)

@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DB):
    session = cookie_session(request, db)
    session.revoked = True
    audit(db, request, "logout", session.user_id)
    db.commit()
    response.delete_cookie(COOKIE, path=COOKIE_PATH)

@router.patch("/profile")
def profile(data: Profile, user: User, request: Request, db: DB):
    user.name = data.name
    audit(db, request, "profile_update", user.id)
    db.commit()
    db.refresh(user)
    return public_account(user)

@router.put("/password", status_code=204)
def change_password(data: ChangePassword, user: User, request: Request, response: Response, db: DB):
    check_attempts(db, request, user.id, "failed_password_change")
    user = db.exec(select(Account).where(Account.id == user.id).with_for_update()
                   .execution_options(populate_existing=True)).one()
    if not verify_password(data.current_password, user.password_hash):
        audit(db, request, "failed_password_change", user.id, user.id)
        db.commit()
        raise HTTPException(400, "Current password is incorrect.")
    if data.current_password == data.new_password:
        raise HTTPException(422, "Choose a different password.")
    user.password_hash = hash_password(data.new_password)
    revoke_all(db, user.id)
    audit(db, request, "password_change", user.id)
    db.commit()
    response.delete_cookie(COOKIE, path=COOKIE_PATH)

@router.get("/sessions")
def sessions(user: User, db: DB):
    rows = db.exec(select(LoginSession).where(LoginSession.user_id == user.id,
        LoginSession.revoked == False, LoginSession.expires > now()).order_by(LoginSession.created.desc()))
    return [public_session(row) for row in rows]

@router.delete("/sessions/{session_id}", status_code=204)
def revoke(session_id: str, user: User, db: DB, request: Request):
    row = db.get(LoginSession, session_id)
    if not row or row.user_id != user.id:
        raise HTTPException(404, "Session not found.")
    row.revoked = True
    audit(db, request, "revoke_session", user.id, session_id)
    db.commit()

@router.post("/restore")
def restore(request: Request, response: Response, db: DB):
    if not request.cookies.get(COOKIE):
        return None
    try:
        return refresh(request, response, db)
    except HTTPException as exc:
        if exc.status_code != 401:
            raise
        response.delete_cookie(COOKIE, path=COOKIE_PATH)
        return None
