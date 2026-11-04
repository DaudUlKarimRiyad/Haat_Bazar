import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel

def get_utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

class ProductListing(SQLModel, table=True):
    __tablename__ = "product_listings"

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
        index=True,
    )
    farmer_id: Optional[str] = Field(default=None, nullable=True)
    farmer_name: str = Field(nullable=False, max_length=120)
    hub_id: Optional[str] = Field(default=None, nullable=True)
    hub_name: str = Field(nullable=False, max_length=120)
    commodity_name: str = Field(nullable=False, max_length=100)
    category: str = Field(nullable=False, max_length=50)
    total_yield_kg: float = Field(nullable=False, ge=0.0)
    available_qty_kg: float = Field(nullable=False, ge=0.0)
    farmer_unit_price: float = Field(nullable=False, ge=0.0)
    b2c_moq_kg: float = Field(default=1.0, ge=0.1)
    b2b_moq_kg: float = Field(default=50.0, ge=1.0)
    grade: str = Field(default="GRADE_A", max_length=30)
    harvest_date: str = Field(nullable=False, max_length=20)
    description: Optional[str] = Field(default="", nullable=True)
    is_active: bool = Field(default=True)
    created_at: str = Field(default_factory=get_utc_now_iso)
    updated_at: str = Field(default_factory=get_utc_now_iso)
