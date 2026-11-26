from typing import Optional
from uuid import uuid4
import time
from sqlmodel import Field, SQLModel

def uid():
    return str(uuid4())

def now():
    return int(time.time())

class Account(SQLModel, table=True):
    id: str = Field(default_factory=uid, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    password_hash: str
    role: str = "consumer"
    banned: bool = False
    ban_reason: str = ""
    created: int = Field(default_factory=now)

class LoginSession(SQLModel, table=True):
    id: str = Field(default_factory=uid, primary_key=True)
    user_id: str = Field(foreign_key="account.id", index=True)
    digest: str = Field(unique=True)
    created: int = Field(default_factory=now)
    expires: int
    revoked: bool = False
    ip: str
    browser: str

class Activity(SQLModel, table=True):
    id: str = Field(default_factory=uid, primary_key=True)
    time: int = Field(default_factory=now, index=True)
    event: str = Field(index=True)
    actor: str = Field(index=True)
    target: str = Field(default="", index=True)
    detail: str = ""
    ip: str
    browser: str

class GrowerGroup(SQLModel, table=True):
    id: str = Field(default_factory=uid, primary_key=True)
    owner_id: str = Field(foreign_key="account.id", index=True)
    name: str
    created: int = Field(default_factory=now)

class Member(SQLModel, table=True):
    group_id: str = Field(foreign_key="growergroup.id", primary_key=True, ondelete="CASCADE")
    user_id: str = Field(foreign_key="account.id", primary_key=True)
    create_batches: bool = False
    update_batches: bool = False
    assign_batches: bool = False

class SharedBatch(SQLModel, table=True):
    listing_id: str = Field(foreign_key="product_listings.id", primary_key=True, ondelete="CASCADE")
    group_id: str = Field(foreign_key="growergroup.id", index=True)
    assignee: Optional[str] = Field(default=None, foreign_key="account.id")

class Order(SQLModel, table=True):
    __tablename__ = "orders"
    id: str = Field(default_factory=uid, primary_key=True)
    receipt_number: str = Field(unique=True, index=True)
    consumer_id: str = Field(foreign_key="account.id", index=True)
    consumer_name: str
    consumer_email: str
    order_tier: str = "B2C"
    fulfillment_type: str = "pickup"
    distance_km: float = 0.0
    notes: str = ""
    subtotal: float
    service_fee: float
    delivery_fee: float
    total_amount: float
    status: str = "confirmed"
    created_at: int = Field(default_factory=now, index=True)

class OrderItem(SQLModel, table=True):
    __tablename__ = "order_items"
    id: str = Field(default_factory=uid, primary_key=True)
    order_id: str = Field(foreign_key="orders.id", index=True, ondelete="CASCADE")
    listing_id: Optional[str] = Field(default=None, index=True)
    farmer_id: Optional[str] = Field(default=None, foreign_key="account.id", index=True)
    farmer_name: str
    commodity_name: str
    category: str
    hub_name: str
    quantity_kg: float
    unit_price: float
    moq_kg: float
    line_total: float

class SalesMemo(SQLModel, table=True):
    __tablename__ = "sales_memos"
    id: str = Field(default_factory=uid, primary_key=True)
    memo_number: str = Field(unique=True, index=True)
    farmer_id: str = Field(foreign_key="account.id", index=True)
    farmer_name: str
    farmer_email: str
    period_type: str = Field(index=True)
    period_key: str = Field(index=True)
    total_orders: int
    total_items_sold: int
    total_qty_kg: float
    gross_sales: float
    notes: str = ""
    items_json: str = "[]"
    created_by: str = Field(foreign_key="account.id")
    created_at: int = Field(default_factory=now, index=True)
