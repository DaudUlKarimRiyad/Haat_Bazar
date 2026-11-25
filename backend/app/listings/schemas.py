from datetime import date
from typing import Annotated, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, AfterValidator, Field, model_validator

def calendar_date(value):
    return date.fromisoformat(value).isoformat()

HarvestDate = Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$"), AfterValidator(calendar_date)]
Grade = Literal["GRADE_A", "GRADE_B", "GRADE_C_PROCESSING"]

class ListingBase(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)
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
    category: str = Field(min_length=1, max_length=50)
    hub_name: str = Field(min_length=1, max_length=120)
    grade: Grade = "GRADE_A"
    harvest_date: HarvestDate
    description: Optional[str] = Field(default="", max_length=10000)
    group_id: Optional[str] = None

class ListingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)

    @model_validator(mode="after")
    def reject_nulls(self):
        if any(getattr(self, key) is None for key in self.model_fields_set - {"description"}):
            raise ValueError("Required listing fields cannot be cleared.")
        return self

    commodity_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    farmer_name: Optional[str] = Field(None, min_length=2, max_length=120)
    hub_name: Optional[str] = Field(None, min_length=1, max_length=120)
    total_yield_kg: Optional[float] = Field(default=None, gt=0)
    available_qty_kg: Optional[float] = Field(default=None, ge=0)
    farmer_unit_price: Optional[float] = Field(default=None, gt=0)
    b2c_moq_kg: Optional[float] = Field(default=None, ge=0.1)
    b2b_moq_kg: Optional[float] = Field(default=None, ge=1.0)
    grade: Optional[Grade] = None
    harvest_date: Optional[HarvestDate] = None
    description: Optional[str] = Field(None, max_length=10000)
    is_active: Optional[bool] = None

class ListingRead(ListingBase):
    group_id: Optional[str] = None
    assignee: Optional[str] = None
    can_update: bool = True
    can_delete: bool = True
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
