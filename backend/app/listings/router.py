from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, Request

from app.access import DB, User, OWNER, audit, group_access
from app.listings.schemas import ListingCreate, ListingPage, ListingRead, ListingUpdate
from app.listings.service import ListingService
from app.models import SharedBatch

router = APIRouter(prefix="/api/v1/listings", tags=["listings"])

def listing_service(db: DB, user: User):
    return ListingService(db, user)

Service = Annotated[ListingService, Depends(listing_service)]

@router.post("", response_model=ListingRead, status_code=201)
def create_listing(data: ListingCreate, service: Service):
    return service.create(data)

@router.get("", response_model=ListingPage)
def list_listings(service: Service, offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
                  category: Optional[str] = None, search: Optional[str] = None):
    rows, total = service.repo.list_all(offset, limit, category, search)
    return ListingPage(items=[service.describe(row) for row in rows], total=total, offset=offset, limit=limit)

@router.get("/{listing_id}", response_model=ListingRead)
def get_listing(listing_id: str, service: Service):
    return service.describe(service.get(listing_id))

@router.patch("/{listing_id}", response_model=ListingRead)
def update_listing(listing_id: str, data: ListingUpdate, service: Service):
    return service.update(listing_id, data)

@router.delete("/{listing_id}", status_code=204)
def delete_listing(listing_id: str, service: Service, db: DB, user: User, request: Request):
    item = service.get(listing_id, lock=True)
    shared = db.get(SharedBatch, listing_id)
    if shared:
        group_access(db, user, shared.group_id, OWNER, lock=True)
    audit(db, request, "delete", user.id, item.id, item.commodity_name)
    db.delete(item)
    db.commit()
