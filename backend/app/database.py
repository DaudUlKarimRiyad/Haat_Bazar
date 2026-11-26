import threading

from sqlalchemy import event, update
from sqlalchemy.orm import Session as SASession
from sqlalchemy.pool import NullPool
from sqlmodel import Session, SQLModel, create_engine

from app.config import DATABASE_URL, FIRESTORE_SYNC_ENABLED, ensure_configured
from app import models
from app.listings.models import ProductListing

_init_lock = threading.Lock()
_initialized = False

if DATABASE_URL.startswith("sqlite:"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def sqlite_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
else:
    engine = create_engine(DATABASE_URL, poolclass=NullPool)

@event.listens_for(SASession, "after_flush")
def _collect_firestore_ops(session, _flush_context):
    if not FIRESTORE_SYNC_ENABLED or session.info.get("skip_firestore_sync"):
        return
    from app.firebase import collection_for, doc_id_for, serialize_instance

    pending = session.info.setdefault("_pending_firestore_ops", {})
    for obj in list(session.new) + list(session.dirty):
        if obj in session.deleted:
            continue
        col = collection_for(obj)
        if col and (obj in session.new or session.is_modified(obj, include_collections=False)):
            did = doc_id_for(obj)
            pending[(col, did)] = ("set", col, did, serialize_instance(obj))
    for obj in session.deleted:
        col = collection_for(obj)
        if col:
            did = doc_id_for(obj)
            pending[(col, did)] = ("delete", col, did, None)


@event.listens_for(SASession, "after_commit")
def _flush_firestore_ops(session):
    pending = session.info.pop("_pending_firestore_ops", None)
    extra = session.info.pop("firestore_ops", None)
    if not FIRESTORE_SYNC_ENABLED or session.info.get("skip_firestore_sync"):
        return
    ops = list(pending.values()) if pending else []
    if extra:
        ops.extend(extra)
    if ops:
        from app.firebase import sync_operations
        sync_operations(ops)


@event.listens_for(SASession, "after_rollback")
def _discard_firestore_ops(session):
    session.info.pop("_pending_firestore_ops", None)
    session.info.pop("firestore_ops", None)


def create_db_and_tables():
    global _initialized
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.execute(update(models.Account).where(models.Account.role == "user").values(role="grower"))
        session.commit()
        if FIRESTORE_SYNC_ENABLED:
            from app.firebase import hydrate_sql_from_firestore
            hydrate_sql_from_firestore(session)
    _initialized = True


def ensure_initialized():
    global _initialized
    ensure_configured()
    if _initialized:
        return
    with _init_lock:
        if not _initialized:
            create_db_and_tables()


def get_session():
    ensure_initialized()
    with Session(engine) as session:
        yield session

def sample_listings():
    return [
        ProductListing(
            id="a1b2c3d4-0001-4000-8000-000000000001",
            farmer_name="Md. Rafiqul Islam",
            hub_name="Bogura Central Hub",
            commodity_name="Diamant Potato (ডায়মন্ড আলু)",
            category="Tubers",
            total_yield_kg=2500.0,
            available_qty_kg=2100.0,
            farmer_unit_price=28.0,
            b2c_moq_kg=5.0,
            b2b_moq_kg=100.0,
            grade="GRADE_A",
            harvest_date="2026-11-02",
            description="Premium Diamant variety, stored in temperature-controlled collection center. Optimal starch content.",
            is_active=True,
            created_at="2026-11-01T08:30:00Z",
            updated_at="2026-11-02T10:15:00Z",
        ),
        ProductListing(
            id="a1b2c3d4-0002-4000-8000-000000000002",
            farmer_name="Abdul Karim Mia",
            hub_name="Rajshahi Godagari Hub",
            commodity_name="Roma Tomato (টমেটো)",
            category="Vegetables",
            total_yield_kg=850.0,
            available_qty_kg=620.0,
            farmer_unit_price=45.0,
            b2c_moq_kg=2.0,
            b2b_moq_kg=40.0,
            grade="GRADE_A",
            harvest_date="2026-11-03",
            description="Firm red tomatoes, harvested at color stage 5. Ideal for household and commercial catering.",
            is_active=True,
            created_at="2026-11-02T06:00:00Z",
            updated_at="2026-11-03T07:45:00Z",
        ),
        ProductListing(
            id="a1b2c3d4-0003-4000-8000-000000000003",
            farmer_name="Subol Chandra Roy",
            hub_name="Dinajpur Sadar Hub",
            commodity_name="Miniket Rice / Paddy (মিনিকেট ধান)",
            category="Grains",
            total_yield_kg=5000.0,
            available_qty_kg=4500.0,
            farmer_unit_price=62.0,
            b2c_moq_kg=10.0,
            b2b_moq_kg=250.0,
            grade="GRADE_A",
            harvest_date="2026-10-28",
            description="Aman harvest, moisture content verified at 12%. Premium polished slender grain.",
            is_active=True,
            created_at="2026-10-29T11:00:00Z",
            updated_at="2026-10-30T14:20:00Z",
        ),
        ProductListing(
            id="a1b2c3d4-0004-4000-8000-000000000004",
            farmer_name="Golam Mostafa",
            hub_name="Faridpur Modhukhali Hub",
            commodity_name="Deshi Onion (দেশি পেঁয়াজ)",
            category="Spices",
            total_yield_kg=1800.0,
            available_qty_kg=1200.0,
            farmer_unit_price=85.0,
            b2c_moq_kg=3.0,
            b2b_moq_kg=50.0,
            grade="GRADE_B",
            harvest_date="2026-11-01",
            description="Sun-cured local Taherpuri variety, sharp pungency and extended shelf life.",
            is_active=True,
            created_at="2026-11-01T09:15:00Z",
            updated_at="2026-11-02T16:00:00Z",
        ),
        ProductListing(
            id="a1b2c3d4-0005-4000-8000-000000000005",
            farmer_name="Nazrul Islam",
            hub_name="Bogura Shibganj Hub",
            commodity_name="Green Chili (কাঁচামরিচ)",
            category="Spices",
            total_yield_kg=400.0,
            available_qty_kg=280.0,
            farmer_unit_price=110.0,
            b2c_moq_kg=0.5,
            b2b_moq_kg=10.0,
            grade="GRADE_A",
            harvest_date="2026-11-03",
            description="Freshly plucked spicy green chilies. Crisp and high capsaicin level.",
            is_active=True,
            created_at="2026-11-03T04:45:00Z",
            updated_at="2026-11-03T08:00:00Z",
        ),
    ]
