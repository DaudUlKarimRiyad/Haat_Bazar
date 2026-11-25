import os
import secrets
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

test_dir = tempfile.TemporaryDirectory()
os.environ.update(DATABASE_URL="sqlite:///" + test_dir.name + "/test.db",
                  JWT_SECRET=secrets.token_hex(32), PASSWORD_PEPPER=secrets.token_hex(32),
                  ENVIRONMENT="test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.database import engine
from sqlmodel import SQLModel
from main import app

@pytest.fixture(autouse=True)
def database():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)

@pytest.fixture
def client():
    with TestClient(app) as http:
        yield http

@pytest.fixture
def account():
    def register(name):
        http = TestClient(app)
        password = secrets.token_urlsafe(16)
        result = http.post("/api/v1/auth/signup", json={"name": name, "email": name+"@example.test", "password": password})
        assert result.status_code == 201, result.text
        http.headers["Authorization"] = "Bearer " + result.json()["access_token"]
        return http, result.json()["user"], password
    return register
