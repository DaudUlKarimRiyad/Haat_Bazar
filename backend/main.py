import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app import admin, auth, groups, orders
from app.config import ALLOWED_ORIGINS, CONFIG_ERRORS, FIRESTORE_SYNC_ENABLED
from app.database import engine, ensure_initialized
from app.firebase import get_firebase_status, get_firestore_client
from app.listings.router import router as listings

app = FastAPI(title="Haat_Bazar API", version="2.0", docs_url="/api/docs",
              openapi_url="/api/openapi.json", redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True,
                   allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
                   allow_headers=["Authorization", "Content-Type"])

@app.middleware("http")
async def secure_response(request: Request, call_next):
    origin = request.headers.get("origin")
    same_origin = f"{request.url.scheme}://{request.url.netloc}"
    if request.method not in ("GET", "HEAD", "OPTIONS") and origin and origin != same_origin and origin not in ALLOWED_ORIGINS:
        return JSONResponse({"detail": "Untrusted origin."}, status_code=403)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response

@app.exception_handler(RequestValidationError)
async def invalid(request, exc):
    # Validation inputs can contain passwords.
    errors = [{"loc": err["loc"], "msg": err["msg"]} for err in exc.errors()]
    return JSONResponse({"detail": errors}, status_code=422)

@app.exception_handler(Exception)
async def unhandled(request, exc):
    logging.getLogger("haat_bazar").exception("Request failed on %s", request.url.path)
    return JSONResponse({"detail": "Internal server error."}, status_code=500)

for router in (auth.router, groups.router, listings, orders.router, admin.router):
    app.include_router(router)

@app.get("/api/health")
def health():
    if CONFIG_ERRORS:
        return JSONResponse(
            {"status": "misconfigured", "service": "Haat_Bazar", "errors": CONFIG_ERRORS, "firebase": get_firebase_status()},
            status_code=503,
        )
    ensure_initialized()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    if FIRESTORE_SYNC_ENABLED:
        get_firestore_client()
    return {"status": "ok", "service": "Haat_Bazar", "firebase": get_firebase_status()}
