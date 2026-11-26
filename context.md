# Project context

This file records the working state and architecture context of the repository so work can continue cleanly across sessions.

## Project and user requests

- Repository: `/Users/daudulkarimriyad/Desktop/Haat_Bazar`.
- Initial work implemented JWT authentication, RBAC, cooperative grower groups, and an admin moderation/audit dashboard on top of the FastAPI + React (Ant Design + Vite + TypeScript) produce listing platform.
- Earlier Firestore investigation evaluated connecting `product_listings` to Firebase Firestore; full database migration and live server-side sync have now been implemented.
- Latest completed requests:
  1. Implemented **three predefined user roles** (`admin`, `grower`, `consumer`) end-to-end—covering grower product enlisting, consumer marketplace browsing, MOQ-validated checkout, purchase history & printable receipts, grower sales ledger & memos, and admin monitoring + daily/monthly grower sales memo creation.
  2. Applied a frosted-glass (glassmorphism) UI system across all frontend views and fixed navbar/toolbar alignment.
  3. Locked down live Firestore security rules (`allow read, write: if false;` for direct client access), restored `backend/app/firebase.py` with full-database SQL-to-Firestore migration + live commit mirroring + empty-DB startup hydration, and migrated the entire local SQLite database into Firebase Firestore.

## Implemented state (3-role system, checkout, receipts & memos)

### Backend (`backend/`)
- **Models (`backend/app/models.py`, `backend/app/listings/models.py`)**:
  - `Account` defaults `role` to `"consumer"`, supporting `"admin"`, `"grower"`, and `"consumer"`.
  - Added `Order`, `OrderItem`, and `SalesMemo` SQLModel tables (`orders`, `order_items`, `sales_memos`).
  - `backend/app/database.py` creates all tables and migrates any legacy `role == "user"` accounts to `"grower"`.
- **RBAC & Auth (`backend/app/access.py`, `backend/app/auth.py`, `backend/app/groups.py`)**:
  - Role constants and dependencies: `Admin` (`admin`), `Grower` (`grower` or `admin`), `Consumer` (`consumer`).
  - `POST /api/v1/auth/signup` accepts `role: Literal["consumer", "grower"] = "consumer"` and rejects `"admin"`.
  - Grower group endpoints (`/api/v1/groups/*`) require `Grower` and reject adding `consumer` accounts as cooperative members.
- **Listings Scope (`backend/app/listings/repository.py`, `service.py`, `router.py`)**:
  - `GET /api/v1/listings` and `GET /api/v1/listings/{id}` allow `admin` (all batches), `grower` (own private + visible group batches), and `consumer` (active batches read-only with `can_update=False`, `can_delete=False`).
  - `POST`, `PATCH`, `DELETE /api/v1/listings/*` require `Grower`.
- **Orders, Receipts & Memos (`backend/app/orders.py`, `backend/app/admin.py`, `backend/main.py`)**:
  - `POST /api/v1/orders` (`Consumer`): validates `is_active`, grower MOQ (`b2c_moq_kg` / `b2b_moq_kg`), and `available_qty_kg` under row lock, atomically deducts stock, calculates server-side pricing (`0` delivery fee for `pickup`), issues a unique `receipt_number`, and logs a `checkout` audit event.
  - `GET /api/v1/orders`, `GET /api/v1/orders/{order_id}`, `GET /api/v1/orders/sales/grower`: isolated consumer receipt history and grower sales ledger.
  - `GET /api/v1/admin/transactions` & `/transactions/export`: admin monitoring and CSV export across all orders.
  - `GET /api/v1/admin/memos/preview`, `POST /api/v1/admin/memos`, `DELETE /api/v1/admin/memos/{memo_id}`, `GET /api/v1/memos`, `GET /api/v1/memos/{memo_id}`: daily (`YYYY-MM-DD`) and monthly (`YYYY-MM`) grower sales aggregation, memo creation, and printable memo retrieval for admins and the owning grower.
- **Demo Seeding (`backend/provision.py`)**:
  - Seeds `demo-admin1`, `demo-admin2` (`admin`), `demo-grower1`..`demo-grower3` (`grower`), and `demo-consumer1`, `demo-consumer2` (`consumer`), along with sample listings, `demo-cooperative`, and `demo-order-1`. Local `haat_bazar.db` has been provisioned with all 3 demo user types.
- **API Contract & Tests**:
  - Updated `postman/Haat_Bazar_API.postman_collection.json`.
  - Tests in `backend/tests/test_crud.py`, `backend/tests/test_access.py`, and `backend/tests/test_roles_orders.py` (10/10 passing via `venv/bin/python -m pytest -v backend/tests`).

### Frontend (`frontend/`)
- Updated `frontend/src/services/http.ts`, `api.ts`, `types/order.ts`, `context/CartContext.tsx`, `App.tsx`, and `layouts/AppLayout.tsx` with role-aware menus and route guards.
- Updated `Account.tsx` signup form with a `consumer` / `grower` account type selector.
- Updated `HomePage/index.tsx`, `ListingCard.tsx`, and `ListingDetailsPage/index.tsx` so consumers shop active produce, match grower MOQs, add to cart, or quick-checkout, while growers/admins manage batches.
- Added `ConsumerOrders.tsx` (`/cart`, `/orders`, `/orders/:orderId`) with checkout and printable receipts (`@media print` in `frontend/src/index.css`).
- Added `GrowerSales.tsx` (`/sales`, `/memos/:memoId`) with grower sales ledger and printable daily/monthly memos.
- Updated `Admin.tsx` with 3-role filtering/role-editing, **Transactions** tab (search, filters, CSV export, receipt view), **Grower Memos** tab (daily/monthly sales preview, memo creation, print/delete), and user-detail order/memo sections.
- Verified with `frontend/node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit && npm --prefix frontend run build`.

## Firestore migration & live sync state

- `backend/app/firebase.py` & `backend/app/config.py` support `FIREBASE_CREDENTIALS_PATH` (resolved relative to repo root) and `FIREBASE_CREDENTIALS_JSON` (with `clean_private_key()` PEM repair).
- `backend/requirements.txt` includes `firebase-admin>=7.0.0` and `google-cloud-firestore>=2.20.0`.
- `backend/app/database.py` registers SQLAlchemy `after_flush` / `after_commit` / `after_rollback` listeners to automatically mirror creates, updates, and deletes across all 10 tables (`account`, `loginsession`, `activity`, `growergroup`, `member`, `product_listings`, `sharedbatch`, `orders`, `order_items`, `sales_memos`) to Firestore whenever `ENVIRONMENT != "test"` and credentials are present.
- `create_db_and_tables()` automatically hydrates an empty SQL database from Firestore on startup (`hydrate_sql_from_firestore`).
- `backend/provision.py --export-firestore` performs an idempotent full-database export from SQL to Firestore (and `--hydrate-firestore` restores from Firestore to SQL).
- Live Firestore security rules were updated to `allow read, write: if false;` across all collections so only the FastAPI server (Admin SDK) can read/write sensitive tables (`account`, `loginsession`, `orders`, etc.).
- Never print, copy into this document, commit, or expose service-account credentials.

## Working constraints

- Workspace root: `/Users/daudulkarimriyad/Desktop/Haat_Bazar`.
- Do not commit changes unless the user explicitly asks.
- Do not expose service-account secrets, tokens, or demo passwords in git-tracked files (`README.md`, `context.md`, source code).

## Potential next steps

1. When deploying to Vercel, set `DATABASE_URL` (PostgreSQL), `FRONTEND_ORIGIN`, `JWT_SECRET`, `PASSWORD_PEPPER`, and `FIREBASE_CREDENTIALS_JSON` (or `FIREBASE_CREDENTIALS_PATH`).
2. Run `provision.py --demo --export-firestore` when provisioning a fresh hosted database if needed.
