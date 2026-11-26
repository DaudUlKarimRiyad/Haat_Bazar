from typing import Optional

from sqlmodel import col, func, select

from app.access import ADMIN, CONSUMER, visible_groups
from app.listings.models import ProductListing, get_utc_now_iso
from app.models import SharedBatch

class ListingRepository:
    """All lookups use the same ownership, marketplace, and admin scope."""
    def __init__(self, session, user):
        self.session = session
        self.user = user

    def scope(self):
        if self.user.role == ADMIN:
            return select(ProductListing)
        if self.user.role == CONSUMER:
            return select(ProductListing).where(ProductListing.is_active == True)
        shared = select(SharedBatch.listing_id)
        return select(ProductListing).where(
            ((ProductListing.farmer_id == self.user.id) & ProductListing.id.not_in(shared)) |
            ProductListing.id.in_(shared.where(SharedBatch.group_id.in_(visible_groups(self.user)))))

    def get_by_id(self, listing_id, lock=False):
        query = self.scope().where(ProductListing.id == listing_id)
        return self.session.exec(query.with_for_update() if lock else query).first()

    def list_all(self, offset, limit, category: Optional[str], search: Optional[str]):
        query = self.scope()
        if category and category.upper() != "ALL":
            query = query.where(ProductListing.category == category)
        if search:
            query = query.where(col(ProductListing.commodity_name).icontains(search, autoescape=True) |
                                col(ProductListing.farmer_name).icontains(search, autoescape=True) |
                                col(ProductListing.hub_name).icontains(search, autoescape=True))
        total = self.session.exec(select(func.count()).select_from(query.subquery())).one()
        rows = self.session.exec(query.order_by(ProductListing.created_at.desc(), ProductListing.id)
                                 .offset(offset).limit(limit)).all()
        return rows, total
