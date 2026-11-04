from typing import Annotated, Optional

from fastapi import APIRouter, Query, status

from app.listings.dependencies import ListingDep, ServiceDep
from app.listings.models import ProductListing
from app.listings.schemas import ListingCreate, ListingPage, ListingRead, ListingUpdate

router = APIRouter(prefix="/api/v1/listings", tags=["listings"])

# CREATE: Add a new produce batch listing
@router.post("", response_model=ListingRead, status_code=status.HTTP_201_CREATED)
def create_listing(data: ListingCreate, service: ServiceDep) -> ProductListing:
    return service.create_listing(data)

# READ LIST: Get batch listings with pagination and filters
@router.get("", response_model=ListingPage)
def list_listings(
    service: ServiceDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
) -> ListingPage:
    return service.list_listings(
        offset=offset,
        limit=limit,
        category=category,
        search=search,
    )

# READ SINGLE: Get full details of one produce batch
@router.get("/{listing_id}", response_model=ListingRead)
def get_listing(listing: ListingDep) -> ProductListing:
    return listing

# UPDATE: Modify pricing, available volume, grade, or status
@router.patch("/{listing_id}", response_model=ListingRead)
def update_listing(
    listing_id: str,
    data: ListingUpdate,
    service: ServiceDep,
) -> ProductListing:
    return service.update_listing(listing_id, data)

# DELETE: Remove batch listing
@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(listing_id: str, service: ServiceDep) -> None:
    service.delete_listing(listing_id)
