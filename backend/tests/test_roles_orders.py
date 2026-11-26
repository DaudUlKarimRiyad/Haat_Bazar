import csv
import io
import secrets
from datetime import datetime, timezone

from sqlmodel import Session
from app.database import engine, sample_listings
from app.models import Account

AUTH = "/api/v1/auth"
BATCH = "/api/v1/listings"
GROUP = "/api/v1/groups"
ORDERS = "/api/v1/orders"
MEMOS = "/api/v1/memos"
ADMIN = "/api/v1/admin"


def listing_payload(**overrides):
    item = sample_listings()[0]
    data = item.model_dump(exclude={"id", "farmer_id", "hub_id", "created_at", "updated_at"})
    data.update(overrides)
    return data


def promote_admin(client, user, password):
    with Session(engine) as db:
        db.get(Account, user["id"]).role = "admin"
        db.commit()
    res = client.post(AUTH + "/login", json={"email": user["email"], "password": password})
    client.headers["Authorization"] = "Bearer " + res.json()["access_token"]


def test_signup_roles_and_rbac_boundaries(client, account):
    # Public signup defaults to consumer and rejects admin
    pwd = secrets.token_urlsafe(16)
    res = client.post(AUTH + "/signup", json={"name": "DefaultBuyer", "email": "buyer0@example.test", "password": pwd})
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "consumer"

    admin_attempt = client.post(
        AUTH + "/signup",
        json={"name": "Hack", "email": "hack@example.test", "password": pwd, "role": "admin"},
    )
    assert admin_attempt.status_code == 422

    grower, _, _ = account("GrowerOne", role="grower")
    consumer, _, _ = account("ConsumerOne", role="consumer")

    created = grower.post(BATCH, json=listing_payload(is_active=True)).json()
    inactive = grower.post(BATCH, json=listing_payload(commodity_name="Hidden Batch", is_active=False)).json()

    # Consumer cannot mutate listings, access grower groups, memos, or admin endpoints
    assert consumer.post(BATCH, json=listing_payload()).status_code == 403
    assert consumer.patch(f"{BATCH}/{created['id']}", json={"farmer_unit_price": 10}).status_code == 403
    assert consumer.delete(f"{BATCH}/{created['id']}").status_code == 403
    assert consumer.post(GROUP, json={"name": "Nope"}).status_code == 403
    assert consumer.get(MEMOS).status_code == 403
    assert consumer.get(ADMIN + "/transactions").status_code == 403

    # Consumer sees active marketplace listings, not inactive ones
    listed = consumer.get(BATCH).json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == created["id"]
    assert listed["items"][0]["can_update"] is False
    assert listed["items"][0]["can_delete"] is False
    assert consumer.get(f"{BATCH}/{inactive['id']}").status_code == 404


def test_consumer_checkout_moq_receipts_and_admin_memos(account):
    grower1, g1, _ = account("GrowerAlpha", role="grower")
    grower2, g2, _ = account("GrowerBeta", role="grower")
    consumer1, c1, _ = account("ConsumerAlpha", role="consumer")
    consumer2, _, _ = account("ConsumerBeta", role="consumer")
    admin, admin_user, admin_pwd = account("AdminBoss", role="grower")
    promote_admin(admin, admin_user, admin_pwd)

    # Note: promote_admin needs user dict; let's verify role change via admin
    b1 = grower1.post(BATCH, json=listing_payload(
        commodity_name="Fresh Tomato",
        category="Vegetables",
        available_qty_kg=50.0,
        total_yield_kg=50.0,
        farmer_unit_price=40.0,
        b2c_moq_kg=5.0,
        b2b_moq_kg=25.0,
    )).json()

    # Grower cannot checkout as consumer
    assert grower2.post(ORDERS, json={"items": [{"listing_id": b1["id"], "quantity_kg": 5.0}]}).status_code == 403

    # Below grower MOQ is rejected
    low_qty = consumer1.post(ORDERS, json={
        "items": [{"listing_id": b1["id"], "quantity_kg": 3.0}],
        "order_tier": "B2C",
        "fulfillment_type": "pickup",
    })
    assert low_qty.status_code == 422
    assert "minimum" in low_qty.json()["detail"].lower()

    # Exceeding available stock is rejected
    over_stock = consumer1.post(ORDERS, json={
        "items": [{"listing_id": b1["id"], "quantity_kg": 60.0}],
        "order_tier": "B2C",
        "fulfillment_type": "pickup",
    })
    assert over_stock.status_code == 409

    # Valid checkout succeeds and deducts stock
    checkout = consumer1.post(ORDERS, json={
        "items": [{"listing_id": b1["id"], "quantity_kg": 10.0}],
        "order_tier": "B2C",
        "fulfillment_type": "pickup",
        "notes": "Morning pickup",
    })
    assert checkout.status_code == 201, checkout.text
    order = checkout.json()
    assert order["consumer_id"] == c1["id"]
    assert order["subtotal"] == 400.0
    assert order["service_fee"] == 20.0
    assert order["delivery_fee"] == 0.0
    assert order["total_amount"] == 420.0
    assert order["items"][0]["quantity_kg"] == 10.0

    # Available stock updated from 50 -> 40
    updated_batch = grower1.get(f"{BATCH}/{b1['id']}").json()
    assert updated_batch["available_qty_kg"] == 40.0

    # Consumer history & receipt isolation
    assert len(consumer1.get(ORDERS).json()) == 1
    assert consumer1.get(f"{ORDERS}/{order['id']}").status_code == 200
    assert consumer2.get(f"{ORDERS}/{order['id']}").status_code == 404
    assert len(consumer2.get(ORDERS).json()) == 0

    # Grower sees their sales
    sales = grower1.get(ORDERS + "/sales/grower").json()
    assert sales["total_orders"] == 1
    assert sales["total_qty_kg"] == 10.0
    assert sales["total_revenue"] == 400.0
    assert grower2.get(ORDERS + "/sales/grower").json()["total_orders"] == 0

    # Admin monitors transactions, exports CSV, and monitors activity
    tx_page = admin.get(ADMIN + "/transactions?search=Tomato").json()
    assert tx_page["total"] == 1
    assert tx_page["items"][0]["receipt_number"] == order["receipt_number"]
    assert admin.get(f"{ORDERS}/{order['id']}").status_code == 200
    csv_rows = list(csv.DictReader(io.StringIO(admin.get(ADMIN + "/transactions/export").text)))
    assert len(csv_rows) == 1 and csv_rows[0]["receipt_number"] == order["receipt_number"]
    assert admin.get(ADMIN + "/activity?event=checkout").json()["total"] == 1

    # Admin previews and creates daily and monthly memos for grower1
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month = today[:7]
    preview = admin.get(f"{ADMIN}/memos/preview?farmer_id={g1['id']}&period_type=daily&period_key={today}").json()
    assert preview["total_orders"] == 1
    assert preview["total_qty_kg"] == 10.0
    assert preview["gross_sales"] == 400.0

    daily_memo = admin.post(ADMIN + "/memos", json={
        "farmer_id": g1["id"],
        "period_type": "daily",
        "period_key": today,
        "notes": "Daily settlement",
    })
    assert daily_memo.status_code == 201, daily_memo.text
    memo_id = daily_memo.json()["id"]

    monthly_memo = admin.post(ADMIN + "/memos", json={
        "farmer_id": g1["id"],
        "period_type": "monthly",
        "period_key": month,
        "notes": "Monthly summary",
    })
    assert monthly_memo.status_code == 201

    # Grower1 sees their memos; Grower2 does not
    assert len(grower1.get(MEMOS).json()) == 2
    assert grower1.get(f"{MEMOS}/{memo_id}").status_code == 200
    assert len(grower2.get(MEMOS).json()) == 0
    assert grower2.get(f"{MEMOS}/{memo_id}").status_code == 404

    # Admin can change user role across all 3 roles and delete a memo
    assert admin.put(f"{ADMIN}/users/{g2['id']}/role", json={"role": "consumer"}).status_code == 204
    assert admin.delete(f"{ADMIN}/memos/{memo_id}").status_code == 204
    assert len(grower1.get(MEMOS).json()) == 1
