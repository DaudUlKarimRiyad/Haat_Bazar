import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlmodel import Session, col, func, select

from app.config import FIRESTORE_COLLECTION
from app.firebase import get_firestore_client
from app.listings.models import ProductListing

logger = logging.getLogger("haat_bazar.repository")

def get_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

class BaseListingRepository(ABC):
    @abstractmethod
    def create(self, listing: ProductListing) -> ProductListing:
        pass

    @abstractmethod
    def get_by_id(self, listing_id: str) -> Optional[ProductListing]:
        pass

    @abstractmethod
    def list_all(
        self,
        offset: int = 0,
        limit: int = 20,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[ProductListing], int]:
        pass

    @abstractmethod
    def update(self, listing_id: str, patch_data: dict) -> Optional[ProductListing]:
        pass

    @abstractmethod
    def delete(self, listing_id: str) -> bool:
        pass


class FirestoreListingRepository(BaseListingRepository):
    """
    CRUD Repository implementation targeting Firebase Firestore.
    Uses the project service account credentials JSON.
    """
    def __init__(self, client):
        self.client = client
        self.collection = client.collection(FIRESTORE_COLLECTION)
        logger.info("Using Firebase Firestore collection: '%s'", FIRESTORE_COLLECTION)

    def create(self, listing: ProductListing) -> ProductListing:
        doc_ref = self.collection.document(listing.id)
        data = listing.model_dump()
        doc_ref.set(data)
        logger.info("Created Firestore document #%s (%s)", listing.id, listing.commodity_name)
        return listing

    def get_by_id(self, listing_id: str) -> Optional[ProductListing]:
        doc = self.collection.document(listing_id).get()
        if not doc.exists:
            return None
        return ProductListing(**doc.to_dict())

    def list_all(
        self,
        offset: int = 0,
        limit: int = 20,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[ProductListing], int]:
        query = self.collection

        if category and category.upper() != "ALL":
            query = query.where("category", "==", category)

        docs = list(query.stream())
        all_items = [ProductListing(**d.to_dict()) for d in docs]

        # Client-side filtering for search query if provided
        if search:
            q = search.lower()
            all_items = [
                i for i in all_items
                if q in i.commodity_name.lower() or q in i.farmer_name.lower() or q in i.hub_name.lower()
            ]

        # Sort newest first by created_at
        all_items.sort(key=lambda x: x.created_at or "", reverse=True)

        total = len(all_items)
        paged = all_items[offset : offset + limit]
        return paged, total

    def update(self, listing_id: str, patch_data: dict) -> Optional[ProductListing]:
        doc_ref = self.collection.document(listing_id)
        doc = doc_ref.get()
        if not doc.exists:
            return None

        current_data = doc.to_dict()
        patch_data["updated_at"] = get_utc_now()
        current_data.update(patch_data)
        doc_ref.set(current_data)

        logger.info("Updated Firestore document #%s", listing_id)
        return ProductListing(**current_data)

    def delete(self, listing_id: str) -> bool:
        doc_ref = self.collection.document(listing_id)
        doc = doc_ref.get()
        if not doc.exists:
            return False
        doc_ref.delete()
        logger.info("Deleted Firestore document #%s", listing_id)
        return True


class SQLiteListingRepository(BaseListingRepository):
    """
    CRUD Repository implementation targeting local SQLite via SQLModel.
    Provides immediate zero-dependency resilience and local development support.
    """
    def __init__(self, session: Session):
        self.session = session

    def create(self, listing: ProductListing) -> ProductListing:
        self.session.add(listing)
        self.session.commit()
        self.session.refresh(listing)
        return listing

    def get_by_id(self, listing_id: str) -> Optional[ProductListing]:
        return self.session.get(ProductListing, listing_id)

    def list_all(
        self,
        offset: int = 0,
        limit: int = 20,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[ProductListing], int]:
        statement = select(ProductListing)

        if category and category.upper() != "ALL":
            statement = statement.where(ProductListing.category == category)

        if search:
            pattern = f"%{search}%"
            statement = statement.where(
                col(ProductListing.commodity_name).ilike(pattern)
                | col(ProductListing.farmer_name).ilike(pattern)
                | col(ProductListing.hub_name).ilike(pattern)
            )

        # Count total
        count_statement = select(func.count()).select_from(statement.subquery())
        total = self.session.exec(count_statement).one()

        # Order and paginate
        statement = (
            statement.order_by(col(ProductListing.created_at).desc())
            .offset(offset)
            .limit(limit)
        )
        items = list(self.session.exec(statement).all())
        return items, total

    def update(self, listing_id: str, patch_data: dict) -> Optional[ProductListing]:
        listing = self.get_by_id(listing_id)
        if not listing:
            return None

        for key, value in patch_data.items():
            if value is not None and hasattr(listing, key):
                setattr(listing, key, value)

        listing.updated_at = get_utc_now()
        self.session.add(listing)
        self.session.commit()
        self.session.refresh(listing)
        return listing

    def delete(self, listing_id: str) -> bool:
        listing = self.get_by_id(listing_id)
        if not listing:
            return False
        self.session.delete(listing)
        self.session.commit()
        return True


def get_repository(session: Session) -> BaseListingRepository:
    """
    Repository Provider:
    Attempts to initialize Firebase Firestore using the credentials JSON.
    If Firestore is available, returns FirestoreListingRepository.
    Otherwise, gracefully falls back to SQLiteListingRepository.
    """
    firestore_client = get_firestore_client()
    if firestore_client is not None:
        try:
            # Check if Firestore API is enabled by doing a lightweight test
            firestore_client.collection(FIRESTORE_COLLECTION).limit(1).get()
            return FirestoreListingRepository(firestore_client)
        except Exception as e:
            logger.warning(
                "Firebase Firestore API not yet enabled on Google Cloud (%s). Operating in SQLite mode.",
                e,
            )

    return SQLiteListingRepository(session)
