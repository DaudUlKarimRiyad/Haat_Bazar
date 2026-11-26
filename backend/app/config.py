import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

PRODUCTION = bool(os.getenv("VERCEL")) or os.getenv("ENVIRONMENT") == "production"

_raw_cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or ""
if _raw_cred_path and not Path(_raw_cred_path).is_absolute():
    if (ROOT_DIR / _raw_cred_path).exists():
        _raw_cred_path = str(ROOT_DIR / _raw_cred_path)
    elif (BACKEND_DIR / _raw_cred_path).exists():
        _raw_cred_path = str(BACKEND_DIR / _raw_cred_path)

FIREBASE_CREDENTIALS_PATH = _raw_cred_path
FIREBASE_JSON_CONTENT = os.getenv("FIREBASE_CREDENTIALS_JSON", "")
FIRESTORE_COLLECTION = os.getenv("FIRESTORE_COLLECTION", "product_listings")
FIRESTORE_SYNC_ENABLED = os.getenv("ENVIRONMENT", "development") != "test" and bool(
    FIREBASE_CREDENTIALS_PATH or FIREBASE_JSON_CONTENT
)

_default_db = "/tmp/haat_bazar.db" if PRODUCTION else str(ROOT_DIR / "haat_bazar.db")
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{_default_db}"
for prefix in ("postgres://", "postgresql://"):
    if DATABASE_URL.startswith(prefix):
        DATABASE_URL = DATABASE_URL.replace(prefix, "postgresql+psycopg://", 1)
if DATABASE_URL.startswith("sqlite:///") and not DATABASE_URL.startswith("sqlite:////"):
    relative = DATABASE_URL[len("sqlite:///"):]
    if relative != ":memory:":
        DATABASE_URL = f"sqlite:///{ROOT_DIR / relative}"
if PRODUCTION and not DATABASE_URL.startswith("postgresql+psycopg://") and not FIRESTORE_SYNC_ENABLED:
    raise RuntimeError(
        "Set DATABASE_URL to a hosted PostgreSQL connection or configure FIREBASE_CREDENTIALS_JSON for Firestore."
    )

_vercel_host = os.getenv("VERCEL_PROJECT_PRODUCTION_URL") or os.getenv("VERCEL_URL") or ""
FRONTEND_ORIGIN = (
    os.getenv("FRONTEND_ORIGIN")
    or (f"https://{_vercel_host}" if PRODUCTION and _vercel_host else "")
    or ("" if PRODUCTION else "http://localhost:5173")
).rstrip("/")
if PRODUCTION and not FRONTEND_ORIGIN.startswith("https://"):
    raise RuntimeError("Set FRONTEND_ORIGIN to the HTTPS frontend origin.")
ALLOWED_ORIGINS = [
    origin
    for origin in dict.fromkeys(
        [
            FRONTEND_ORIGIN,
            f"https://{os.getenv('VERCEL_URL', '')}" if os.getenv("VERCEL_URL") else "",
            f"https://{os.getenv('VERCEL_PROJECT_PRODUCTION_URL', '')}"
            if os.getenv("VERCEL_PROJECT_PRODUCTION_URL")
            else "",
        ]
    )
    if origin
]

def secret(name):
    value = os.environ.get(name, "")
    if len(value) < 32:
        raise RuntimeError(f"Set {name} to an independent random secret of at least 32 characters.")
    return value

JWT_SECRET = secret("JWT_SECRET")
PASSWORD_PEPPER = secret("PASSWORD_PEPPER")
