from __future__ import annotations
import glob
import os
from pathlib import Path
from typing import Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

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
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{ROOT_DIR / 'haat_bazar.db'}")
FIRESTORE_COLLECTION = os.getenv("FIRESTORE_COLLECTION", "product_listings")
