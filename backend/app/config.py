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
FIREBASE_JSON_CONTENT = (
    os.getenv("FIREBASE_CREDENTIALS_JSON")
    or os.getenv("FIREBASE_SERVICE_ACCOUNT")
    or os.getenv("FIREBASE_CREDENTIALS")
    or os.getenv("FIREBASE_CONFIG_JSON")
    or os.getenv("FIREBASE_KEY")
)

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

# Detect serverless read-only environment (e.g. Vercel, AWS Lambda)
IS_SERVERLESS = bool(
    os.getenv("VERCEL")
    or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
    or not os.access(str(ROOT_DIR), os.W_OK)
)

# Normalize SQLite database URL — serverless environments require /tmp writable directory
_raw_db_url = os.getenv("DATABASE_URL")
if not _raw_db_url:
    if IS_SERVERLESS:
        DATABASE_URL = "sqlite:////tmp/haat_bazar.db"
    else:
        DATABASE_URL = f"sqlite:///{ROOT_DIR / 'haat_bazar.db'}"
elif _raw_db_url.startswith("sqlite:///") and not _raw_db_url.startswith("sqlite:////"):
    # Relative sqlite path
    _rel = _raw_db_url[len("sqlite:///"):]
    if IS_SERVERLESS:
        DATABASE_URL = f"sqlite:////tmp/{Path(_rel).name if _rel else 'haat_bazar.db'}"
    else:
        _abs = str(ROOT_DIR / _rel) if _rel else str(ROOT_DIR / "haat_bazar.db")
        DATABASE_URL = f"sqlite:///{_abs}"
else:
    # If explicit non-/tmp sqlite path is passed but running on read-only serverless filesystem
    if IS_SERVERLESS and _raw_db_url.startswith("sqlite:////") and not _raw_db_url.startswith("sqlite:////tmp/"):
        DATABASE_URL = "sqlite:////tmp/haat_bazar.db"
    else:
        DATABASE_URL = _raw_db_url

FIRESTORE_COLLECTION = os.getenv("FIRESTORE_COLLECTION", "product_listings")
