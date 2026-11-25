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
    role: str = "user"
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
