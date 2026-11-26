import json
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import Field, field_validator
from sqlmodel import select

from app.access import ADMIN, CONSUMER, DB, GROWER, Consumer, Grower, User, audit
from app.auth import Input
from app.listings.models import ProductListing, get_utc_now_iso
from app.models import Account, Order, OrderItem, SalesMemo

router = APIRouter(prefix="/api/v1", tags=["orders & memos"])


class CheckoutLine(Input):
    listing_id: str = Field(min_length=1, max_length=64)
    quantity_kg: float = Field(gt=0, allow_inf_nan=False)


class CheckoutInput(Input):
    items: list[CheckoutLine] = Field(min_length=1, max_length=50)
    order_tier: Literal["B2C", "B2B"] = "B2C"
    fulfillment_type: Literal["pickup", "delivery"] = "pickup"
    distance_km: float = Field(default=0.0, ge=0.0, le=500.0, allow_inf_nan=False)
    notes: str = Field(default="", max_length=500)

    @field_validator("notes", mode="before")
    @classmethod
    def clean_notes(cls, value):
        return value.strip() if isinstance(value, str) else value


def serialize_order(db, order: Order, items: Optional[list[OrderItem]] = None):
    if items is None:
        items = db.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    return {
        **order.model_dump(),
        "items": [item.model_dump() for item in items],
    }


def serialize_memo(memo: SalesMemo):
    data = memo.model_dump(exclude={"items_json"})
    try:
        data["items"] = json.loads(memo.items_json or "[]")
    except ValueError:
        data["items"] = []
    return data


def period_bounds(period_type: str, period_key: str, tz_offset_minutes: int = 0) -> tuple[int, int]:
    offset = timedelta(minutes=max(-720, min(840, tz_offset_minutes)))
    if period_type == "daily":
        try:
            day = date.fromisoformat(period_key)
        except ValueError:
            raise HTTPException(422, "Daily period_key must be YYYY-MM-DD.")
        start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc) - offset
        end = start + timedelta(days=1)
        return int(start.timestamp()), int(end.timestamp())
    if period_type == "monthly":
        parts = period_key.split("-")
        if len(parts) != 2 or not (parts[0].isdigit() and parts[1].isdigit()):
            raise HTTPException(422, "Monthly period_key must be YYYY-MM.")
        year, month = int(parts[0]), int(parts[1])
        if not 1 <= month <= 12:
            raise HTTPException(422, "Invalid month in period_key.")
        start = datetime(year, month, 1, tzinfo=timezone.utc) - offset
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - offset
        else:
            end = datetime(year, month + 1, 1, tzinfo=timezone.utc) - offset
        return int(start.timestamp()), int(end.timestamp())
    raise HTTPException(422, "period_type must be daily or monthly.")


def aggregate_grower_sales(db, farmer: Account, period_type: str, period_key: str, tz_offset_minutes: int = 0):
    start_ts, end_ts = period_bounds(period_type, period_key, tz_offset_minutes)
    rows = db.exec(
        select(OrderItem, Order)
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            OrderItem.farmer_id == farmer.id,
            Order.created_at >= start_ts,
            Order.created_at < end_ts,
        )
        .order_by(Order.created_at.desc(), OrderItem.id)
    ).all()
    order_ids = set()
    total_qty = 0.0
    gross_sales = 0.0
    breakdown = []
    for item, order in rows:
        order_ids.add(order.id)
        total_qty += item.quantity_kg
        gross_sales += item.line_total
        breakdown.append({
            "order_id": order.id,
            "receipt_number": order.receipt_number,
            "consumer_name": order.consumer_name,
            "commodity_name": item.commodity_name,
            "category": item.category,
            "hub_name": item.hub_name,
            "quantity_kg": round(item.quantity_kg, 3),
            "unit_price": round(item.unit_price, 2),
            "line_total": round(item.line_total, 2),
            "created_at": order.created_at,
        })
    return {
        "farmer_id": farmer.id,
        "farmer_name": farmer.name,
        "farmer_email": farmer.email,
        "period_type": period_type,
        "period_key": period_key,
        "total_orders": len(order_ids),
        "total_items_sold": len(breakdown),
        "total_qty_kg": round(total_qty, 3),
        "gross_sales": round(gross_sales, 2),
        "items": breakdown,
    }


@router.post("/orders", status_code=201)
def checkout(data: CheckoutInput, consumer: Consumer, request: Request, db: DB):
    merged: dict[str, float] = {}
    for line in data.items:
        merged[line.listing_id] = round(merged.get(line.listing_id, 0.0) + line.quantity_kg, 3)

    keys = sorted(merged)
    listings = db.exec(
        select(ProductListing).where(ProductListing.id.in_(keys)).order_by(ProductListing.id).with_for_update()
    ).all()
    by_id = {row.id: row for row in listings}
    if len(by_id) != len(keys):
        raise HTTPException(404, "One or more selected products no longer exist.")

    order_items: list[OrderItem] = []
    subtotal = 0.0
    total_qty = 0.0
    now_iso = get_utc_now_iso()

    for listing_id in keys:
        listing = by_id[listing_id]
        qty = merged[listing_id]
        if not listing.is_active:
            raise HTTPException(422, f"{listing.commodity_name} is currently inactive.")
        moq = listing.b2c_moq_kg if data.order_tier == "B2C" else listing.b2b_moq_kg
        if qty < moq:
            raise HTTPException(
                422,
                f"Minimum purchaseable quantity for {listing.commodity_name} ({data.order_tier}) is {moq} kg.",
            )
        if qty > listing.available_qty_kg:
            raise HTTPException(
                409,
                f"Only {listing.available_qty_kg} kg available for {listing.commodity_name}.",
            )
        line_total = round(qty * listing.farmer_unit_price, 2)
        subtotal = round(subtotal + line_total, 2)
        total_qty = round(total_qty + qty, 3)
        listing.available_qty_kg = round(listing.available_qty_kg - qty, 3)
        listing.updated_at = now_iso
        order_items.append(
            OrderItem(
                order_id="",
                listing_id=listing.id,
                farmer_id=listing.farmer_id,
                farmer_name=listing.farmer_name,
                commodity_name=listing.commodity_name,
                category=listing.category,
                hub_name=listing.hub_name,
                quantity_kg=qty,
                unit_price=listing.farmer_unit_price,
                moq_kg=moq,
                line_total=line_total,
            )
        )

    alpha = 0.05 if data.order_tier == "B2C" else 0.025
    s_min = 20.0 if data.order_tier == "B2C" else 100.0
    service_fee = round(max(s_min, subtotal * alpha), 2)
    if data.fulfillment_type == "pickup":
        delivery_fee = 0.0
    else:
        b_base = 40.0 if data.order_tier == "B2C" else 250.0
        c_weight = 1.5 if data.order_tier == "B2C" else 0.8
        delivery_fee = round(b_base + data.distance_km * 2.5 + total_qty * c_weight, 2)
    total_amount = round(subtotal + service_fee + delivery_fee, 2)

    receipt_number = f"RCP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    order = Order(
        receipt_number=receipt_number,
        consumer_id=consumer.id,
        consumer_name=consumer.name,
        consumer_email=consumer.email,
        order_tier=data.order_tier,
        fulfillment_type=data.fulfillment_type,
        distance_km=data.distance_km if data.fulfillment_type == "delivery" else 0.0,
        notes=data.notes,
        subtotal=subtotal,
        service_fee=service_fee,
        delivery_fee=delivery_fee,
        total_amount=total_amount,
    )
    db.add(order)
    db.flush()
    for item in order_items:
        item.order_id = order.id
        db.add(item)
    audit(db, request, "checkout", consumer.id, order.id, f"{receipt_number} · ৳{total_amount}")
    db.commit()
    db.refresh(order)
    return serialize_order(db, order)


@router.get("/orders")
def list_orders(user: User, db: DB):
    if user.role == CONSUMER:
        orders = db.exec(
            select(Order).where(Order.consumer_id == user.id).order_by(Order.created_at.desc(), Order.id)
        ).all()
        return [serialize_order(db, order) for order in orders]
    if user.role == ADMIN:
        orders = db.exec(select(Order).order_by(Order.created_at.desc(), Order.id)).all()
        return [serialize_order(db, order) for order in orders]
    # Grower: return orders containing items belonging to this grower (filtered to their items)
    rows = db.exec(
        select(OrderItem, Order)
        .join(Order, OrderItem.order_id == Order.id)
        .where(OrderItem.farmer_id == user.id)
        .order_by(Order.created_at.desc(), OrderItem.id)
    ).all()
    grouped: dict[str, dict] = {}
    for item, order in rows:
        entry = grouped.get(order.id)
        if not entry:
            entry = {
                **order.model_dump(),
                "items": [],
                "grower_subtotal": 0.0,
                "grower_qty_kg": 0.0,
            }
            grouped[order.id] = entry
        entry["items"].append(item.model_dump())
        entry["grower_subtotal"] = round(entry["grower_subtotal"] + item.line_total, 2)
        entry["grower_qty_kg"] = round(entry["grower_qty_kg"] + item.quantity_kg, 3)
    return list(grouped.values())


@router.get("/orders/sales/grower")
def grower_sales(user: Grower, db: DB):
    rows = db.exec(
        select(OrderItem, Order)
        .join(Order, OrderItem.order_id == Order.id)
        .where(OrderItem.farmer_id == user.id)
        .order_by(Order.created_at.desc(), OrderItem.id)
    ).all()
    items = []
    total_qty = 0.0
    total_revenue = 0.0
    order_ids = set()
    for item, order in rows:
        order_ids.add(order.id)
        total_qty = round(total_qty + item.quantity_kg, 3)
        total_revenue = round(total_revenue + item.line_total, 2)
        items.append({
            **item.model_dump(),
            "receipt_number": order.receipt_number,
            "consumer_name": order.consumer_name,
            "fulfillment_type": order.fulfillment_type,
            "created_at": order.created_at,
        })
    return {
        "total_orders": len(order_ids),
        "total_qty_kg": total_qty,
        "total_revenue": total_revenue,
        "items": items,
    }


@router.get("/orders/{order_id}")
def get_order(order_id: str, user: User, db: DB):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Receipt not found.")
    if user.role == ADMIN or order.consumer_id == user.id:
        return serialize_order(db, order)
    if user.role == GROWER:
        items = db.exec(
            select(OrderItem).where(OrderItem.order_id == order.id, OrderItem.farmer_id == user.id)
        ).all()
        if items:
            return serialize_order(db, order, items)
    raise HTTPException(404, "Receipt not found.")


@router.get("/memos")
def list_memos(
    user: Grower,
    db: DB,
    farmer_id: Optional[str] = None,
    period_type: Optional[Literal["daily", "monthly"]] = None,
    period_key: Optional[str] = None,
):
    query = select(SalesMemo)
    if user.role == GROWER:
        query = query.where(SalesMemo.farmer_id == user.id)
    elif farmer_id:
        query = query.where(SalesMemo.farmer_id == farmer_id)
    if period_type:
        query = query.where(SalesMemo.period_type == period_type)
    if period_key:
        query = query.where(SalesMemo.period_key == period_key)
    rows = db.exec(query.order_by(SalesMemo.created_at.desc(), SalesMemo.id)).all()
    return [serialize_memo(row) for row in rows]


@router.get("/memos/{memo_id}")
def get_memo(memo_id: str, user: Grower, db: DB):
    memo = db.get(SalesMemo, memo_id)
    if not memo:
        raise HTTPException(404, "Sales memo not found.")
    if user.role != ADMIN and memo.farmer_id != user.id:
        raise HTTPException(404, "Sales memo not found.")
    return serialize_memo(memo)
