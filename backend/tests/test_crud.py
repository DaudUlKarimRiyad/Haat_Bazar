import pytest
from fastapi.testclient import TestClient

import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "service" in data

def test_read_listings_list():
    res = client.get("/api/v1/listings")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    assert len(data["items"]) >= 1

def test_create_read_update_delete_lifecycle():
    # 1. CREATE
    payload = {
        "commodity_name": "Rangpur Sweet Potato (মিষ্টি আলু)",
        "category": "Tubers",
        "farmer_name": "Tariqul Islam",
        "hub_name": "Rangpur Mithapukur Hub",
        "total_yield_kg": 1500.0,
        "available_qty_kg": 1200.0,
        "farmer_unit_price": 32.0,
        "b2c_moq_kg": 3.0,
        "b2b_moq_kg": 60.0,
        "grade": "GRADE_A",
        "harvest_date": "2026-11-04",
        "description": "High beta-carotene organic sweet potatoes.",
        "is_active": True,
    }
    create_res = client.post("/api/v1/listings", json=payload)
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()
    listing_id = created["id"]
    assert created["commodity_name"] == payload["commodity_name"]
    assert created["farmer_unit_price"] == 32.0

    # 2. READ SINGLE
    get_res = client.get(f"/api/v1/listings/{listing_id}")
    assert get_res.status_code == 200
    single = get_res.json()
    assert single["id"] == listing_id
    assert single["farmer_name"] == "Tariqul Islam"

    # 3. UPDATE (PATCH)
    patch_payload = {
        "farmer_unit_price": 35.0,
        "available_qty_kg": 1100.0,
        "description": "Updated price after grading.",
    }
    patch_res = client.patch(f"/api/v1/listings/{listing_id}", json=patch_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["farmer_unit_price"] == 35.0
    assert updated["available_qty_kg"] == 1100.0

    # 4. DELETE
    del_res = client.delete(f"/api/v1/listings/{listing_id}")
    assert del_res.status_code == 204

    # 5. VERIFY DELETED
    verify_res = client.get(f"/api/v1/listings/{listing_id}")
    assert verify_res.status_code == 404

def test_business_rules_validation():
    # Attempt available_qty > total_yield
    invalid_payload = {
        "commodity_name": "Invalid Batch",
        "category": "Vegetables",
        "farmer_name": "Test Farmer",
        "hub_name": "Bogura Hub",
        "total_yield_kg": 100.0,
        "available_qty_kg": 200.0, # exceeds yield!
        "farmer_unit_price": 40.0,
        "b2c_moq_kg": 2.0,
        "b2b_moq_kg": 50.0,
        "grade": "GRADE_A",
        "harvest_date": "2026-11-04",
        "is_active": True,
    }
    res = client.post("/api/v1/listings", json=invalid_payload)
    assert res.status_code in [422, 409]
    assert "exceed" in res.json()["detail"].lower()
