import uuid
from typing import Optional

from app.listings.models import ProductListing
from app.listings.repository import BaseListingRepository
from app.listings.schemas import ListingCreate, ListingPage, ListingRead, ListingUpdate

class ListingRuleError(Exception):
    """Business rule violation (e.g. invalid MOQ or available quantity exceeding yield)."""
    pass

class ListingNotFoundError(Exception):
    """Listing not found in database."""
    pass

class ListingService:
    def __init__(self, repo: BaseListingRepository):
        self.repo = repo

    def create_listing(self, data: ListingCreate) -> ProductListing:
        # Business Rule 1: Available stock cannot exceed total yield
        if data.available_qty_kg > data.total_yield_kg:
            raise ListingRuleError("Available quantity cannot exceed total batch yield.")

        # Business Rule 2: Anti-Loss Guard - B2B MOQ must be greater than or equal to B2C MOQ
        if data.b2b_moq_kg < data.b2c_moq_kg:
            raise ListingRuleError("B2B wholesale MOQ must be greater than or equal to B2C retail MOQ.")

        new_listing = ProductListing(
            id=str(uuid.uuid4()),
            commodity_name=data.commodity_name.strip(),
            category=data.category.strip(),
            farmer_name=data.farmer_name.strip(),
            hub_name=data.hub_name.strip(),
            total_yield_kg=data.total_yield_kg,
            available_qty_kg=data.available_qty_kg,
            farmer_unit_price=data.farmer_unit_price,
            b2c_moq_kg=data.b2c_moq_kg,
            b2b_moq_kg=data.b2b_moq_kg,
            grade=data.grade,
            harvest_date=data.harvest_date,
            description=data.description or "",
            is_active=data.is_active,
        )
        return self.repo.create(new_listing)

    def get_listing(self, listing_id: str) -> ProductListing:
        item = self.repo.get_by_id(listing_id)
        if not item:
            raise ListingNotFoundError(f"Produce batch listing with id '{listing_id}' not found.")
        return item

    def list_listings(
        self,
        offset: int = 0,
        limit: int = 20,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> ListingPage:
        items, total = self.repo.list_all(
            offset=offset,
            limit=limit,
            category=category,
            search=search,
        )
        return ListingPage(
            items=[ListingRead.model_validate(i) for i in items],
            total=total,
            offset=offset,
            limit=limit,
        )

    def update_listing(self, listing_id: str, data: ListingUpdate) -> ProductListing:
        existing = self.get_listing(listing_id)

        patch_dict = data.model_dump(exclude_unset=True)

        # Validate yield and available stock relationships
        target_yield = patch_dict.get("total_yield_kg", existing.total_yield_kg)
        target_available = patch_dict.get("available_qty_kg", existing.available_qty_kg)
        if target_available > target_yield:
            raise ListingRuleError("Updated available quantity cannot exceed total yield.")

        target_b2c = patch_dict.get("b2c_moq_kg", existing.b2c_moq_kg)
        target_b2b = patch_dict.get("b2b_moq_kg", existing.b2b_moq_kg)
        if target_b2b < target_b2c:
            raise ListingRuleError("B2B wholesale MOQ must be greater than or equal to B2C retail MOQ.")

        updated = self.repo.update(listing_id, patch_dict)
        if not updated:
            raise ListingNotFoundError(f"Produce batch listing with id '{listing_id}' not found.")
        return updated

    def delete_listing(self, listing_id: str) -> None:
        # Verify existence
        self.get_listing(listing_id)
        deleted = self.repo.delete(listing_id)
        if not deleted:
            raise ListingNotFoundError(f"Produce batch listing with id '{listing_id}' not found.")
