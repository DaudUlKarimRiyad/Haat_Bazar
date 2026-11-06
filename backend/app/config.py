from __future__ import annotations
import glob
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

# Load environment variables from .env file
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

# Discover Firebase Service Account JSON credentials
FIREBASE_CRED_ENV = os.getenv("FIREBASE_CREDENTIALS_PATH")
FIREBASE_JSON_CONTENT = os.getenv("FIREBASE_CREDENTIALS_JSON")

def find_firebase_credentials() -> str | None:
    if FIREBASE_CRED_ENV and os.path.exists(FIREBASE_CRED_ENV):
        return FIREBASE_CRED_ENV

    # Look in project root and backend dir for any firebase adminsdk json file
    patterns = [
        str(ROOT_DIR / "*firebase*adminsdk*.json"),
        str(ROOT_DIR / "*firebase*.json"),
        str(ROOT_DIR / "serviceAccountKey.json"),
        str(BACKEND_DIR / "*firebase*.json"),
    ]
    for pattern in patterns:
        matches = glob.glob(pattern)
        if matches:
            return matches[0]

    return None

FIREBASE_CREDENTIALS_PATH = find_firebase_credentials()

# Always use an absolute path for SQLite — the env var may carry a relative path
_raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{ROOT_DIR / 'haat_bazar.db'}")
if _raw_db_url.startswith("sqlite:///") and not _raw_db_url.startswith("sqlite:////"):
    # Relative sqlite path → make it absolute anchored at project root
    _rel = _raw_db_url[len("sqlite:///"):]
    _abs = str(ROOT_DIR / _rel) if _rel else str(ROOT_DIR / "haat_bazar.db")
    DATABASE_URL = f"sqlite:///{_abs}"
else:
    DATABASE_URL = _raw_db_url

FIRESTORE_COLLECTION = os.getenv("FIRESTORE_COLLECTION", "product_listings")
