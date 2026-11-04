from typing import List, Optional
from pydantic import BaseModel, Field

class ListingBase(BaseModel):
    commodity_name: str = Field(..., min_length=2, max_length=100)
    category: str = Field(..., max_length=50)
    farmer_name: str = Field(..., min_length=2, max_length=120)
    hub_name: str = Field(..., max_length=120)
    total_yield_kg: float = Field(..., gt=0)
    available_qty_kg: float = Field(..., ge=0)
    farmer_unit_price: float = Field(..., gt=0)
    b2c_moq_kg: float = Field(default=1.0, ge=0.1)
    b2b_moq_kg: float = Field(default=50.0, ge=1.0)
    grade: str = Field(default="GRADE_A")
    harvest_date: str
    description: Optional[str] = ""
    is_active: bool = True

class ListingCreate(ListingBase):
    pass

class ListingUpdate(BaseModel):
    commodity_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    category: Optional[str] = None
    farmer_name: Optional[str] = None
    hub_name: Optional[str] = None
    total_yield_kg: Optional[float] = Field(default=None, gt=0)
    available_qty_kg: Optional[float] = Field(default=None, ge=0)
    farmer_unit_price: Optional[float] = Field(default=None, gt=0)
    b2c_moq_kg: Optional[float] = Field(default=None, ge=0.1)
    b2b_moq_kg: Optional[float] = Field(default=None, ge=1.0)
    grade: Optional[str] = None
    harvest_date: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ListingRead(ListingBase):
    id: str
    farmer_id: Optional[str] = None
    hub_id: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}

class ListingPage(BaseModel):
    items: List[ListingRead]
    total: int
    offset: int
    limit: int
