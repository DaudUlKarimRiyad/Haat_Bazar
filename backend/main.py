import logging
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import BACKEND_DIR, FIREBASE_CREDENTIALS_PATH
from app.database import create_db_and_tables
from app.firebase import get_firestore_client
from app.listings.router import router as listings_router
from app.listings.service import ListingNotFoundError, ListingRuleError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("haat_bazar")

app = FastAPI(
    title="Haat_Bazar (হাট বাজার) REST API",
    description="Agricultural Supply Chain Disintermediation Marketplace API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

# Enable CORS for frontend during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Header Middleware: indicates which active database backend served the request
@app.middleware("http")
async def add_database_backend_header(request: Request, call_next):
    response = await call_next(request)
    from app.listings.repository import _probe_firestore
    backend = "Firestore" if _probe_firestore() else "SQLite"
    response.headers["X-Database-Backend"] = backend
    return response

# Exception Handlers
@app.exception_handler(ListingNotFoundError)
async def listing_not_found_handler(request: Request, exc: ListingNotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": str(exc)},
    )

@app.exception_handler(ListingRuleError)
async def listing_rule_handler(request: Request, exc: ListingRuleError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc)},
    )

@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Internal server error: {type(exc).__name__} ({str(exc)})"},
    )

# Include Feature Routers
app.include_router(listings_router)

# Run at import so it also works on serverless hosts (Vercel) and TestClient
create_db_and_tables()

@app.get("/api/health")
def health() -> dict:
    from app.firebase import get_firebase_status, get_firestore_client
    firestore_client = get_firestore_client()
    has_firestore = firestore_client is not None
    status_info = get_firebase_status()
    return {
        "status": "ok",
        "service": "Haat_Bazar Agricultural Marketplace API",
        "mode": "Firestore Cloud" if has_firestore else "SQLite Resilient Local",
        "firebase_active": has_firestore,
        "firebase_configured": status_info["has_credentials"],
        "firebase_source": status_info["source"],
        "firebase_error": status_info["error"],
    }

# Production SPA serving: serve frontend/dist if available
FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
