from fastapi import HTTPException

from app.access import CREATE, OWNER, UPDATE, group_access
from app.listings.models import ProductListing, get_utc_now_iso
from app.listings.repository import ListingRepository
from app.listings.schemas import ListingRead
from app.models import Member, SharedBatch, GrowerGroup

class ListingService:
    def __init__(self, db, user):
        self.db = db
        self.user = user
        self.repo = ListingRepository(db, user)

    def get(self, listing_id, lock=False):
        item = self.repo.get_by_id(listing_id, lock)
        if not item:
            raise HTTPException(404, "Batch not found.")
        return item

    def describe(self, item):
        read = ListingRead.model_validate(item)
        share = self.db.get(SharedBatch, item.id)
        if share:
            group = self.db.get(GrowerGroup, share.group_id)
            owner = group.owner_id == self.user.id
            member = self.db.get(Member, (group.id, self.user.id))
            read.group_id = group.id
            read.assignee = share.assignee
            read.can_update = owner or bool(member and member.update_batches)
            read.can_delete = owner
        return read

    @staticmethod
    def validate(data):
        if data.available_qty_kg > data.total_yield_kg:
            raise HTTPException(422, "Available quantity cannot exceed total batch yield.")
        if data.b2b_moq_kg < data.b2c_moq_kg:
            raise HTTPException(422, "Wholesale MOQ must be at least the retail MOQ.")

    def create(self, data):
        if data.group_id:
            group_access(self.db, self.user, data.group_id, CREATE, lock=True)
        self.validate(data)
        item = ProductListing(**data.model_dump(exclude={"group_id"}), farmer_id=self.user.id)
        self.db.add(item)
        self.db.flush()
        if data.group_id:
            self.db.add(SharedBatch(listing_id=item.id, group_id=data.group_id))
        self.db.commit()
        return self.describe(item)

    def update(self, listing_id, data):
        item = self.get(listing_id, lock=True)
        share = self.db.get(SharedBatch, item.id)
        patch = data.model_dump(exclude_unset=True)
        if share:
            permission = OWNER if patch.get("commodity_name", item.commodity_name) != item.commodity_name else UPDATE
            group_access(self.db, self.user, share.group_id, permission, lock=True)
        for field, value in patch.items():
            setattr(item, field, value)
        self.validate(item)
        item.updated_at = get_utc_now_iso()
        self.db.commit()
        return self.describe(item)
