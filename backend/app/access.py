import hashlib
import hmac
import secrets
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import update
from sqlmodel import Session, select

from app.config import JWT_SECRET, PASSWORD_PEPPER, PRODUCTION
from app.database import get_session
from app.models import Account, Activity, GrowerGroup, LoginSession, Member, now

DB = Annotated[Session, Depends(get_session)]
ADMIN = "admin"
GROWER = "grower"
CONSUMER = "consumer"
ROLES = (ADMIN, GROWER, CONSUMER)
CREATE = "create_batches"
UPDATE = "update_batches"
ASSIGN = "assign_batches"
OWNER = "owner"
READ = "read"
COOKIE = "haat_refresh"
COOKIE_PATH = "/api/v1/auth"
SESSION_TTL = 30 * 86400
bearer = HTTPBearer(auto_error=False)

def denied():
    raise HTTPException(401, "Sign in again.", headers={"WWW-Authenticate": "Bearer"})

def password_bytes(password):
    return hmac.digest(PASSWORD_PEPPER.encode(), password.encode(), "sha256").hex().encode()

def hash_password(password):
    return bcrypt.hashpw(password_bytes(password), bcrypt.gensalt()).decode()

def verify_password(password, hashed):
    return bcrypt.checkpw(password_bytes(password), hashed.encode())

def public_account(user):
    return user.model_dump(include={"id", "email", "name", "role", "banned", "ban_reason", "created"})

def public_session(session):
    return session.model_dump(exclude={"digest"})

def client_info(request):
    ip = request.client.host if request.client else "unknown"
    if PRODUCTION and request.headers.get("x-vercel-forwarded-for"):
        ip = request.headers["x-vercel-forwarded-for"].split(",")[0].strip()
    return {"ip": ip[:128], "browser": request.headers.get("user-agent", "")[:400]}

def audit(db, request, event, actor, target="", detail=""):
    db.add(Activity(event=event, actor=actor, target=target, detail=detail, **client_info(request)))

def digest(raw):
    return hashlib.sha256(raw.encode()).hexdigest()

def issue(db, response, user, session, raw):
    token = jwt.encode({"sub": user.id, "role": user.role, "sid": session.id,
                        "iat": now(), "exp": now() + 900}, JWT_SECRET, algorithm="HS256")
    response.set_cookie(COOKIE, raw, max_age=max(0, session.expires-now()), httponly=True,
                        secure=PRODUCTION, samesite="strict", path=COOKIE_PATH)
    return {"access_token": token, "token_type": "bearer", "user": public_account(user),
            "session_id": session.id}

def new_login(db, response, request, user):
    raw = secrets.token_urlsafe(48)
    session = LoginSession(user_id=user.id, digest=digest(raw), expires=now()+SESSION_TTL,
                           **client_info(request))
    db.add(session)
    db.commit()
    return issue(db, response, user, session, raw)

def identity(request: Request, db: DB, auth: HTTPAuthorizationCredentials = Depends(bearer)):
    if not auth:
        denied()
    try:
        claims = jwt.decode(auth.credentials, JWT_SECRET, algorithms=["HS256"],
                            options={"require": ["sub", "role", "sid", "exp", "iat"]})
    except jwt.InvalidTokenError:
        denied()
    session = db.get(LoginSession, claims["sid"])
    if not session or session.revoked or session.expires <= now() or session.user_id != claims["sub"]:
        denied()
    user = db.get(Account, session.user_id)
    if not user or user.banned or claims["role"] != user.role:
        denied()
    request.state.session_id = session.id
    return user

User = Annotated[Account, Depends(identity)]

def require_admin(user: User):
    if user.role != ADMIN:
        raise HTTPException(403, "Administrator access required.")
    return user

Admin = Annotated[Account, Depends(require_admin)]

def require_grower(user: User):
    if user.role not in (GROWER, ADMIN):
        raise HTTPException(403, "Grower or administrator access required.")
    return user

Grower = Annotated[Account, Depends(require_grower)]

def require_consumer(user: User):
    if user.role != CONSUMER:
        raise HTTPException(403, "Consumer account required for checkout.")
    return user

Consumer = Annotated[Account, Depends(require_consumer)]

def revoke_all(db, user_id):
    db.execute(update(LoginSession).where(LoginSession.user_id == user_id).values(revoked=True))

def group_access(db, user, group_id, permission=READ, lock=False):
    query = select(GrowerGroup).where(GrowerGroup.id == group_id)
    group = db.exec(query.with_for_update() if lock else query).first()
    if group and group.owner_id == user.id:
        return group
    member = db.get(Member, (group_id, user.id)) if group else None
    if not member:
        raise HTTPException(404, "Group not found.")
    if permission != READ and (permission == OWNER or not getattr(member, permission)):
        raise HTTPException(403, "Group permission required.")
    return group

def visible_groups(user):
    return select(GrowerGroup.id).where(
        (GrowerGroup.owner_id == user.id) |
        GrowerGroup.id.in_(select(Member.group_id).where(Member.user_id == user.id)))
