import logging
from sqlmodel import Session, SQLModel, create_engine, select

from app.config import DATABASE_URL

logger = logging.getLogger("haat_bazar.database")

# SQLite connection args
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

def create_db_and_tables():
    # Import models so SQLModel metadata registers the table
    try:
        from app.listings.models import ProductListing
        SQLModel.metadata.create_all(engine)
        logger.info("Database tables verified.")

        # Seed initial demo batches if empty
        with Session(engine) as session:
            has_items = session.exec(select(ProductListing)).first()
            if not has_items:
                seed_initial_data(session)
    except Exception as exc:
        logger.warning("Could not initialize local SQLite tables: %s", exc)

def seed_initial_data(session: Session):
    from app.listings.models import ProductListing

    initial_items = [
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
    for item in initial_items:
        session.add(item)
    session.commit()
    logger.info("Seeded %d initial produce batch listings into database.", len(initial_items))

def get_session():
    with Session(engine) as session:
        yield session
