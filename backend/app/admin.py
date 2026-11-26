import csv
import io
import json
import secrets
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import Field, StringConstraints
from typing_extensions import Annotated
from sqlalchemy import or_
from sqlmodel import func, select

from app.access import ADMIN, CONSUMER, GROWER, Admin, DB, audit, public_account, public_session, revoke_all, visible_groups
from app.auth import Input
from app.groups import delete_group
from app.listings.models import ProductListing
from app.models import Account, Activity, GrowerGroup, LoginSession, Order, OrderItem, SalesMemo, now
from app.orders import aggregate_grower_sales, serialize_memo, serialize_order

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
    def __init__(self, search: str = "", role: Optional[Literal["admin", "grower", "consumer"]] = None,
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
    total_sales = db.exec(select(func.coalesce(func.sum(Order.total_amount), 0.0))).one()
    return {
        "users": count(db, select(Account)),
        "growers": count(db, select(Account).where(Account.role == GROWER)),
        "consumers": count(db, select(Account).where(Account.role == CONSUMER)),
        "banned": count(db, select(Account).where(Account.banned == True)),
        "records": count(db, select(ProductListing)),
        "groups": count(db, select(GrowerGroup)),
        "orders": count(db, select(Order)),
        "memos": count(db, select(SalesMemo)),
        "total_sales": round(float(total_sales or 0.0), 2),
        "new_users": count(db, select(Account).where(Account.created >= since)),
        "new_records": count(db, select(ProductListing).where(ProductListing.created_at >= datetime.fromtimestamp(since, timezone.utc).isoformat())),
        "new_groups": count(db, select(GrowerGroup).where(GrowerGroup.created >= since)),
        "new_orders": count(db, select(Order).where(Order.created_at >= since)),
    }

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
            "orders": [serialize_order(db, o) for o in db.exec(select(Order).where(Order.consumer_id == uid)
                       .order_by(Order.created_at.desc()))],
            "memos": [serialize_memo(m) for m in db.exec(select(SalesMemo).where(SalesMemo.farmer_id == uid)
                      .order_by(SalesMemo.created_at.desc()))],
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
    role: Literal["admin", "grower", "consumer"]

class MemoCreate(Input):
    farmer_id: str = Field(min_length=1, max_length=64)
    period_type: Literal["daily", "monthly"]
    period_key: str = Field(min_length=7, max_length=10)
    notes: str = Field(default="", max_length=500)
    tz_offset_minutes: int = Field(default=0, ge=-720, le=840)

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

def transaction_query(search: str = "", farmer_id: str = "", fulfillment_type: str = "",
                      since: Optional[int] = None, until: Optional[int] = None):
    query = select(Order)
    if search:
        matching_orders = select(OrderItem.order_id).where(or_(
            OrderItem.commodity_name.icontains(search, autoescape=True),
            OrderItem.farmer_name.icontains(search, autoescape=True),
        ))
        query = query.where(or_(
            Order.receipt_number.icontains(search, autoescape=True),
            Order.consumer_name.icontains(search, autoescape=True),
            Order.consumer_email.icontains(search, autoescape=True),
            Order.id.icontains(search, autoescape=True),
            Order.id.in_(matching_orders),
        ))
    if farmer_id:
        query = query.where(Order.id.in_(select(OrderItem.order_id).where(OrderItem.farmer_id == farmer_id)))
    if fulfillment_type:
        query = query.where(Order.fulfillment_type == fulfillment_type)
    if since is not None:
        query = query.where(Order.created_at >= since)
    if until is not None:
        query = query.where(Order.created_at <= until)
    return query

@router.get("/transactions")
def transactions(admin: Admin, db: DB, search: str = "", farmer_id: str = "", fulfillment_type: str = "",
                 since: Optional[int] = None, until: Optional[int] = None,
                 offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100)):
    query = transaction_query(search, farmer_id, fulfillment_type, since, until)
    rows = db.exec(query.order_by(Order.created_at.desc(), Order.id).offset(offset).limit(limit)).all()
    return {"items": [serialize_order(db, row) for row in rows], "total": count(db, query)}

@router.get("/transactions/export")
def export_transactions(admin: Admin, request: Request, db: DB, search: str = "", farmer_id: str = "",
                        fulfillment_type: str = "", since: Optional[int] = None, until: Optional[int] = None):
    query = transaction_query(search, farmer_id, fulfillment_type, since, until).order_by(Order.created_at.desc(), Order.id)
    fields = ["receipt_number", "created_at", "consumer_name", "consumer_email", "order_tier",
              "fulfillment_type", "subtotal", "service_fee", "delivery_fee", "total_amount", "status"]
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(fields)
    for row in db.exec(query):
        record = row.model_dump()
        writer.writerow([csv_cell(record[key]) for key in fields])
    audit(db, request, "export", admin.id, "transactions")
    db.commit()
    return Response(buffer.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": 'attachment; filename="transactions.csv"'})

@router.get("/memos/preview")
def preview_memo(farmer_id: str, period_type: Literal["daily", "monthly"], period_key: str,
                 admin: Admin, db: DB, tz_offset_minutes: int = Query(0, ge=-720, le=840)):
    farmer = db.get(Account, farmer_id)
    if not farmer or farmer.role not in (GROWER, ADMIN):
        raise HTTPException(404, "Grower account not found.")
    return aggregate_grower_sales(db, farmer, period_type, period_key, tz_offset_minutes)

@router.post("/memos", status_code=201)
def create_memo(data: MemoCreate, admin: Admin, request: Request, db: DB):
    farmer = db.get(Account, data.farmer_id)
    if not farmer or farmer.role not in (GROWER, ADMIN):
        raise HTTPException(404, "Grower account not found.")
    summary = aggregate_grower_sales(db, farmer, data.period_type, data.period_key, data.tz_offset_minutes)
    memo_number = f"MEMO-{data.period_key.replace('-', '')}-{secrets.token_hex(2).upper()}"
    memo = SalesMemo(
        memo_number=memo_number,
        farmer_id=farmer.id,
        farmer_name=farmer.name,
        farmer_email=farmer.email,
        period_type=data.period_type,
        period_key=data.period_key,
        total_orders=summary["total_orders"],
        total_items_sold=summary["total_items_sold"],
        total_qty_kg=summary["total_qty_kg"],
        gross_sales=summary["gross_sales"],
        notes=data.notes.strip(),
        items_json=json.dumps(summary["items"]),
        created_by=admin.id,
    )
    db.add(memo)
    audit(db, request, "create_memo", admin.id, memo.id, f"{memo_number} · {farmer.name} · {data.period_type} {data.period_key}")
    db.commit()
    db.refresh(memo)
    return serialize_memo(memo)

@router.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: str, admin: Admin, request: Request, db: DB):
    memo = db.get(SalesMemo, memo_id)
    if not memo:
        raise HTTPException(404, "Sales memo not found.")
    audit(db, request, "delete_memo", admin.id, memo.id, memo.memo_number)
    db.delete(memo)
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
