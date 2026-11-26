"""Provision the schema; optionally create the instructor demonstration once."""
import argparse
import getpass
import os
from sqlmodel import Session, select
from app.access import hash_password
from app.database import create_db_and_tables, engine, sample_listings
from app.firebase import hydrate_sql_from_firestore, migrate_sql_to_firestore
from app.listings.models import ProductListing
from app.models import Account, GrowerGroup, Member, Order, OrderItem, SharedBatch

DEMOS = [
    ("admin1", "Admin One", "admin"),
    ("admin2", "Admin Two", "admin"),
    ("grower1", "Rafiq", "grower"),
    ("grower2", "Karim", "grower"),
    ("grower3", "Mina", "grower"),
    ("consumer1", "Anika", "consumer"),
    ("consumer2", "Sajid", "consumer"),
]

def seed(db):
    users = []
    for login, name, role in DEMOS:
        email = login + "@haat.example"
        user = db.get(Account, "demo-" + login)
        if user:
            if user.email != email:
                raise ValueError("Demo ID belongs to another account.")
            if user.role != role:
                user.role = role
        else:
            if db.exec(select(Account).where(Account.email == email)).first():
                raise ValueError("Demo email already registered. Resolve the conflict before seeding.")
            password = os.getenv("DEMO_" + login.upper() + "_PASSWORD") or getpass.getpass(email + " password: ")
            if not 12 <= len(password) <= 256:
                raise ValueError("Demo passwords must be 12 to 256 characters.")
            user = Account(id="demo-" + login, email=email, role=role, name=name, password_hash=hash_password(password))
            db.add(user)
        users.append(user)
    db.flush()
    group = db.get(GrowerGroup, "demo-cooperative")
    if not group:
        group = GrowerGroup(id="demo-cooperative", owner_id=users[2].id, name="Bogura Growers Cooperative")
        db.add(group)
        db.flush()
        db.add(Member(group_id=group.id, user_id=users[3].id, create_batches=True, update_batches=True))
        db.add(Member(group_id=group.id, user_id=users[4].id, assign_batches=True))
    for i, listing in enumerate(sample_listings()):
        listing.id = "demo-batch-" + str(i+1)
        if not db.get(type(listing), listing.id):
            listing.farmer_id = users[2+i%3].id
            db.add(listing)
            db.flush()
            if i == 0:
                db.add(SharedBatch(listing_id=listing.id, group_id=group.id))
    if not db.get(Order, "demo-order-1") and len(users) >= 6:
        sample = sample_listings()[0]
        qty = 10.0
        subtotal = round(qty * sample.farmer_unit_price, 2)
        service_fee = round(max(20.0, subtotal * 0.05), 2)
        order = Order(
            id="demo-order-1",
            receipt_number="RCP-DEMO-0001",
            consumer_id=users[5].id,
            consumer_name=users[5].name,
            consumer_email=users[5].email,
            order_tier="B2C",
            fulfillment_type="pickup",
            notes="Morning hub pickup",
            subtotal=subtotal,
            service_fee=service_fee,
            delivery_fee=0.0,
            total_amount=round(subtotal + service_fee, 2),
        )
        db.add(order)
        db.flush()
        db.add(OrderItem(
            id="demo-order-item-1",
            order_id=order.id,
            listing_id="demo-batch-1",
            farmer_id=users[2].id,
            farmer_name=sample.farmer_name,
            commodity_name=sample.commodity_name,
            category=sample.category,
            hub_name=sample.hub_name,
            quantity_kg=qty,
            unit_price=sample.farmer_unit_price,
            moq_kg=sample.b2c_moq_kg,
            line_total=subtotal,
        ))
    db.commit()

def import_firestore(db):
    """Copy legacy documents once; only admins can see rows without confirmed ownership."""
    from google.cloud import firestore
    from google.oauth2.service_account import Credentials

    path = os.getenv("FIREBASE_CREDENTIALS_PATH") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    credentials = Credentials.from_service_account_file(path) if path else None
    source = firestore.Client(credentials=credentials, project=credentials.project_id if credentials else None)
    for doc in source.collection(os.getenv("FIRESTORE_COLLECTION", "product_listings")).stream():
        if not db.get(ProductListing, doc.id):
            record = doc.to_dict()
            record.update(id=doc.id, farmer_id=None)
            db.add(ProductListing.model_validate(record))
    db.commit()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--import-firestore", action="store_true")
    parser.add_argument("--export-firestore", action="store_true")
    parser.add_argument("--hydrate-firestore", action="store_true")
    args = parser.parse_args()
    create_db_and_tables()
    if args.import_firestore:
        with Session(engine) as session:
            import_firestore(session)
    if args.hydrate_firestore:
        with Session(engine) as session:
            print("Hydrated from Firestore:", hydrate_sql_from_firestore(session))
    if args.demo:
        with Session(engine) as session:
            seed(session)
    if args.export_firestore:
        with Session(engine) as session:
            print("Migrated to Firestore:", migrate_sql_to_firestore(session))
