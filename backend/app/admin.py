import csv
import io
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import Field, StringConstraints
from typing_extensions import Annotated
from sqlalchemy import or_
from sqlmodel import func, select

from app.access import (ADMIN, Admin, DB, audit, public_account, public_session, revoke_all, visible_groups)
from app.auth import Input
from app.groups import delete_group
from app.listings.models import ProductListing
from app.models import Account, Activity, GrowerGroup, LoginSession, now

router = APIRouter(prefix="/api/v1/admin", tags=["administration"])
Resource = Literal["users", "records", "groups", "activity"]
MODELS = {"users": Account, "records": ProductListing, "groups": GrowerGroup, "activity": Activity}
SEARCH = {
    "users": [Account.email, Account.name, Account.id],
    "records": [ProductListing.commodity_name, ProductListing.farmer_name, ProductListing.hub_name, ProductListing.id, ProductListing.farmer_id],
    "groups": [GrowerGroup.name, GrowerGroup.owner_id, GrowerGroup.id],
    "activity": [Activity.event, Activity.actor, Activity.target, Activity.detail, Activity.ip, Activity.browser],
}
ORDER = {"users": Account.created, "records": ProductListing.created_at, "groups": GrowerGroup.created, "activity": Activity.time}

class Filters:
    def __init__(self, search: str = "", role: Optional[Literal["user", "admin"]] = None,
                 status: Optional[Literal["active", "banned", "inactive"]] = None, category: str = "",
                 event: str = "", owner: str = "", ip: str = "", since: Optional[int] = None,
                 until: Optional[int] = None):
        self.search, self.role, self.status, self.category = search, role, status, category
        self.event, self.owner, self.ip, self.since, self.until = event, owner, ip, since, until

    def query(self, resource):
        query = select(MODELS[resource])
        if self.search:
            query = query.where(or_(*(field.icontains(self.search, autoescape=True) for field in SEARCH[resource])))
        if resource == "users":
            if self.role:
                query = query.where(Account.role == self.role)
            if self.status:
                query = query.where(Account.banned == (self.status == "banned"))
        if resource == "records":
            if self.category:
                query = query.where(ProductListing.category == self.category)
            if self.status:
                query = query.where(ProductListing.is_active == (self.status == "active"))
            if self.owner:
                query = query.where(ProductListing.farmer_id == self.owner)
        if resource == "groups" and self.owner:
            query = query.where(GrowerGroup.owner_id == self.owner)
        if resource == "activity":
            if self.event:
                query = query.where(Activity.event == self.event)
            if self.ip:
                query = query.where(Activity.ip == self.ip)
            if self.since is not None:
                query = query.where(Activity.time >= self.since)
            if self.until is not None:
                query = query.where(Activity.time <= self.until)
        return query

def count(db, query):
    return db.exec(select(func.count()).select_from(query.subquery())).one()

@router.get("/overview")
def overview(db: DB, admin: Admin):
    since = now() - 7*86400
    return {"users": count(db, select(Account)), "banned": count(db, select(Account).where(Account.banned == True)),
            "records": count(db, select(ProductListing)), "groups": count(db, select(GrowerGroup)),
            "new_users": count(db, select(Account).where(Account.created >= since)),
            "new_records": count(db, select(ProductListing).where(ProductListing.created_at >= datetime.fromtimestamp(since, timezone.utc).isoformat())),
            "new_groups": count(db, select(GrowerGroup).where(GrowerGroup.created >= since))}

@router.get("/security")
def security(db: DB, admin: Admin):
    def failures(column):
        total = func.count()
        rows = db.exec(select(column, total).where(Activity.event == "failed_login").group_by(column)
                       .order_by(total.desc(), column))
        return [{"value": value, "attempts": n} for value, n in rows]
    return {"by_ip": failures(Activity.ip), "by_account": failures(Activity.target)}

@router.get("/users/{uid}/detail")
def user_detail(uid: str, admin: Admin, db: DB):
    user = db.get(Account, uid)
    if not user:
        raise HTTPException(404, "Account not found.")
    return {"user": public_account(user),
            "records": db.exec(select(ProductListing).where(ProductListing.farmer_id == uid)).all(),
            "groups": db.exec(select(GrowerGroup).where(GrowerGroup.id.in_(visible_groups(user)))).all(),
            "sessions": [public_session(s) for s in db.exec(select(LoginSession).where(LoginSession.user_id == uid)
                         .order_by(LoginSession.created.desc()))],
            "activity": db.exec(select(Activity).where(or_(Activity.actor == uid, Activity.target.in_([uid, user.email])))
                             .order_by(Activity.time.desc()).limit(50)).all()}

class Selection(Input):
    ids: list[str] = Field(min_length=1, max_length=100)

class Ban(Selection):
    banned: bool
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]

class Role(Input):
    role: Literal["admin", "user"]

def locked(db, model, ids):
    keys = sorted(set(ids))
    rows = db.exec(select(model).where(model.id.in_(keys)).order_by(model.id).with_for_update()).all()
    if len(rows) != len(keys):
        raise HTTPException(404, "One or more selected items no longer exist.")
    return rows

@router.post("/users/status", status_code=204)
def status(data: Ban, admin: Admin, request: Request, db: DB):
    rows = locked(db, Account, data.ids)
    if data.banned and any(user.role == ADMIN for user in rows):
        raise HTTPException(403, "Administrator accounts are protected from bans.")
    for user in rows:
        user.banned = data.banned
        user.ban_reason = data.reason if data.banned else ""
        if data.banned:
            revoke_all(db, user.id)
        audit(db, request, "ban" if data.banned else "unban", admin.id, user.id, data.reason)
    db.commit()

@router.put("/users/{uid}/role", status_code=204)
def role(uid: str, data: Role, admin: Admin, request: Request, db: DB):
    if uid == admin.id:
        raise HTTPException(403, "You cannot change your own role.")
    user, = locked(db, Account, [uid])
    if user.banned and data.role == ADMIN:
        raise HTTPException(422, "Unban the account before promotion.")
    user.role = data.role
    revoke_all(db, uid)
    audit(db, request, "role_change", admin.id, uid, data.role)
    db.commit()

@router.post("/users/{uid}/revoke", status_code=204)
def revoke(uid: str, admin: Admin, request: Request, db: DB):
    locked(db, Account, [uid])
    revoke_all(db, uid)
    audit(db, request, "revoke_sessions", admin.id, uid)
    db.commit()

@router.post("/{resource}/delete", status_code=204)
def moderate(resource: Literal["records", "groups"], data: Selection, admin: Admin, request: Request, db: DB):
    for row in locked(db, MODELS[resource], data.ids):
        audit(db, request, "delete", admin.id, row.id, resource)
        if resource == "groups":
            delete_group(db, row)
        else:
            db.delete(row)
    db.commit()

def serialize(row):
    return public_account(row) if isinstance(row, Account) else row.model_dump()

def csv_cell(value):
    value = "" if value is None else str(value)
    if value.lstrip().startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")):
        return "'" + value
    return value

@router.get("/{resource}/export")
def export(resource: Literal["users", "records", "activity"], admin: Admin, request: Request,
           db: DB, filters: Filters = Depends()):
    query = filters.query(resource).order_by(ORDER[resource].desc(), MODELS[resource].id)
    fields = [field for field in MODELS[resource].model_fields if field != "password_hash"]
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(fields)
    for row in db.exec(query):
        record = serialize(row)
        writer.writerow([csv_cell(record[key]) for key in fields])
    audit(db, request, "export", admin.id, resource)
    db.commit()
    return Response(buffer.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="{resource}.csv"'})

@router.get("/{resource}")
def collection(resource: Resource, admin: Admin, db: DB, filters: Filters = Depends(),
               offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100)):
    query = filters.query(resource)
    rows = db.exec(query.order_by(ORDER[resource].desc(), MODELS[resource].id).offset(offset).limit(limit))
    return {"items": [serialize(row) for row in rows], "total": count(db, query)}
