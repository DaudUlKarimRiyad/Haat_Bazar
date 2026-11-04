from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.database import get_session
from app.listings.models import ProductListing
from app.listings.repository import get_repository
from app.listings.service import ListingService

def get_listing_service(session: Session = Depends(get_session)) -> ListingService:
    repo = get_repository(session)
    return ListingService(repo)

ServiceDep = Annotated[ListingService, Depends(get_listing_service)]

def get_listing_by_id(listing_id: str, service: ServiceDep) -> ProductListing:
    return service.get_listing(listing_id)

ListingDep = Annotated[ProductListing, Depends(get_listing_by_id)]
