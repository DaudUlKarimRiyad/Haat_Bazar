# Haat_Bazar (হাট বাজার) 🌾🛒

<p align="center">
  <img src="image_0.jpg" alt="Haat_Bazar Banner - Bridging Farmers and Buyers directly" width="100%">
</p>

<p align="center">
  <strong>Direct Farm-to-Consumer & Wholesale Agricultural Supply Chain Disintermediation</strong>
</p>

<p align="center">
  <!-- Languages & Runtimes -->
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python Badge">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Badge">
  <!-- Frameworks & UI -->
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI Badge">
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native Badge">
  <!-- Data & Caching -->
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL Badge">
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis Badge">
  <!-- Infrastructure -->
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Badge">
  <img src="https://img.shields.io/badge/Apache_Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white" alt="Apache Kafka Badge">
</p>

---

## Submission build

Haat_Bazar lets growers manage private produce batches and share batches with a cooperative. The React client and FastAPI API share one origin. Sign in at `/signin`, manage devices and passwords at `/account`, and open `/admin` with an administrator account. Interactive API documentation is at `/api/docs`.

### Instructor accounts

The provisioning command below creates these accounts and five sample batches. Use the email as the login ID. The private submission form and instructor PDF carry the passwords.

| Account ID | Login email | Role | Demonstration |
| --- | --- | --- | --- |
| demo-admin1 | admin1@haat.example | admin | User management, moderation, audit and CSV exports |
| demo-admin2 | admin2@haat.example | admin | Protected administrator account |
| demo-grower1 | grower1@haat.example | user | Owns the Bogura Growers Cooperative |
| demo-grower2 | grower2@haat.example | user | Creates and edits cooperative batches |
| demo-grower3 | grower3@haat.example | user | Reads and assigns cooperative batches |

Open **Groups → Bogura Growers Cooperative** to compare permissions across accounts. A private batch is visible to its creator. Group access follows current membership, including for the original creator of a shared batch. Owners can rename and delete shared batches and manage members. Administrators moderate across accounts through their dashboard. Deleting a group also deletes its shared batches.

### Run locally

From the repository root, create a virtual environment, install the requirements and configure the variables in [.env.example](.env.example) in a private `.env` file. Generate two independent random values for `JWT_SECRET` and `PASSWORD_PEPPER` using `openssl rand -hex 32` twice. Keep the pepper stable across deployments.

```sh
python3 -m venv venv
venv/bin/python -m pip install -r backend/requirements.txt
venv/bin/python backend/provision.py --demo
venv/bin/python -m uvicorn main:app --app-dir backend --reload
```

The provisioner prompts privately for five passwords on first use. Subsequent runs preserve existing credentials. The development database defaults to SQLite. Start the frontend in a second terminal and open the localhost URL printed by Vite.

```sh
npm ci --prefix frontend
npm run dev --prefix frontend
```

### Deploy and verify on Vercel

1. Use the repository root as the Vercel project root. The two services and SPA deep-link rewrites are in [vercel.json](vercel.json). The frontend calls the relative `/api/v1` path.
2. Configure a hosted PostgreSQL `DATABASE_URL` with TLS, `FRONTEND_ORIGIN` equal to the exact public HTTPS frontend origin, and the two server secrets. Vercel must use hosted PostgreSQL. Use separate databases and secrets for previews that need writable demo data.
3. From a trusted terminal with the same backend settings, run `venv/bin/python backend/provision.py --demo` once against the target database. Only verified account owners should receive private legacy records. Existing unowned SQL rows are available through admin moderation. To copy old Firestore documents into SQL, install `google-cloud-firestore` in the provisioning environment, set `FIREBASE_CREDENTIALS_PATH` to the private service-account file, and run `venv/bin/python backend/provision.py --import-firestore`. Repeated imports skip existing IDs.
4. Deploy the project, open `/api/health` and `/api/docs`, and sign in as a grower. Reload a group deep link, create a batch, sign out, and compare access from a second account. Verify moderation, filtered exports and immediate session revocation with an admin. Reload after a redeploy to verify persistence.

### Automated checks

```sh
venv/bin/python -m pip install pytest httpx
venv/bin/python -m pytest -q backend/tests
npm run build --prefix frontend
```

The tests use a disposable SQLite database and fresh signing secrets. Login issues a 15-minute access JWT and a rotating HttpOnly cookie. Password changes, bans, role changes and session revocation invalidate existing access on the next protected request. The dashboard records failed logins by account and IP.

## Original project design

The original design below describes the broader marketplace and planned infrastructure. The submission implements produce listings, the pricing calculator, accounts, groups and administration.

## 1. Project Overview & Socio-Economic Context

**Haat_Bazar (হাট বাজার)** is an agricultural disintermediation marketplace connecting rural producers directly with retail households (B2C) and commercial bulk wholesalers (B2B). 

### 1.1 Structural Agri-Market Breakdown
In traditional fresh-produce markets across South Asia:
* **Multi-Layered Intermediaries:** Produce traverses 4 to 6 informal handling layers ($\text{Farmer} \rightarrow \text{Dalal / Local Middleman} \rightarrow \text{Bepari} \rightarrow \text{Aratdar} \rightarrow \text{Paikar/Wholesaler} \rightarrow \text{Retailer}$).
* **Margin Compression:** Farmers capture merely $20\% \text{ to } 35\%$ of the consumer retail rupee/taka, with middle layers taking over $50\%$.
* **Post-Harvest Loss (PHL):** Transit fragmentation and uncoordinated logistics account for $25\% \text{ to } 40\%$ spoilage in perishable perishables.
* **Distress Selling:** Due to zero real-time market discovery, individual farmers often sell below cost during peak localized harvests.

### 1.2 The Haat_Bazar Solution
* **Verified Direct Sourcing:** Eliminates informal commission agents; farmers list pre-harvest and harvest batches directly.
* **Middleman Revenue Realignment:** The platform monetizes strictly via a transparent platform service fee and a distance/weight-tiered logistics fee.
* **Loss-Prevention Guard (Dynamic MOQ):** Enforces algorithmic Minimum Order Quantities (MOQ) and Minimum Order Values (MOV) to ensure unit transport economics are consistently preserved.

---

## 2. System Architecture & Workflows

```
                               +-----------------------------+
                               |     Client Applications     |
                               | - Farmer App (Offline-First)|
                               | - Consumer & B2B Web/App    |
                               | - Hub Manager Android/PWA   |
                               +--------------+--------------+
                                              |
                                              v
                               +-----------------------------+
                               |       API Gateway Layer     |
                               |   (Auth, Throttling, Proxy) |
                               +--------------+--------------+
                                              |
        +----------------------+--------------+---------------+----------------------+
        |                      |                              |                      |
        v                      v                              v                      v
+-------+-------+      +-------+-------+              +-------+-------+      +-------+-------+
|  Product &    |      |  Checkout &   |              | Dynamic Hub & |      | Financial &   |
|  Inventory    |      |  MOQ Guard    |              | Route Dispatch|      | Escrow Engine |
+-------+-------+      +-------+-------+              +-------+-------+      +-------+-------+
        |                      |                              |                      |
        +----------------------+--------------+---------------+----------------------+
                                              |
                                              v
                               +-----------------------------+
                               |         Data Engine         |
                               | - PostgreSQL + PostGIS      |
                               | - Redis (Locks & Caching)   |
                               | - Apache Kafka Event Stream |
                               +-----------------------------+
```

### 2.1 Core Actors & Operations
1. **Farmers:** Upload harvest timelines, estimated yields, and reservation prices. Physical handoff occurs at designated rural collection hubs.
2. **Consumers (B2C):** Purchase fresh household baskets, adhering to aggregate basket minimum thresholds to make last-mile drops economical.
3. **Wholesalers (B2B):** Procure bulk tonnage for institutional demand (restaurants, hypermarkets, industrial kitchens) at tiered volume rates.
4. **Haat Hubs (Micro-Fulfillment Centers):** Decentralized rural points that handle weighing, automated digital grading (Classes A, B, C), crate packing, and dispatch consolidation.

---

## 3. Mathematical & Pricing Engine

### 3.1 Order Total & Fee Mechanics

The farmer payout ($P_{\text{farmer}}$) is computed purely on accepted unit weight:

$$
P_{\text{farmer}} = \sum_{i=1}^{n} \left( Q_i \times U_i \right)
$$

Where:
* $Q_i$ = Quantity of item $i$ in base units ($\text{kg}$, crates, or dozens).
* $U_i$ = Farmer base price per unit.

The total price billed to the buyer ($P_{\text{buyer}}$) is:

$$
P_{\text{buyer}} = P_{\text{farmer}} + F_{\text{service}} + F_{\text{delivery}}
$$

Where:
* **Service Fee ($F_{\text{service}}$):**
  $$
  F_{\text{service}} = \max\left(S_{\text{min}},\, P_{\text{farmer}} \times \alpha\right)
  $$
  * $\alpha$: Commission rate ($5\%$ for B2C; $2.5\%$ for bulk B2B).
  * $S_{\text{min}}$: Base floor administrative charge.
* **Delivery Fee ($F_{\text{delivery}}$):**
  $$
  F_{\text{delivery}} = B_{\text{base}} + \left(d \times C_{\text{dist}}\right) + \left(w \times C_{\text{weight}}\right)
  $$
  * $B_{\text{base}}$: Fixed base drop cost.
  * $d$: Geodesic travel distance between distribution node and buyer dropoff.
  * $w$: Total calculated gross weight of ordered items.
  * $C_{\text{dist}}, C_{\text{weight}}$: Dynamic transport calibration coefficients.

### 3.2 Dynamic Minimum Threshold Engine (Anti-Loss Guard)
To safeguard unit economics and prevent farmers and delivery teams from losing money on micro-deliveries, orders must pass both item and basket validation:

1. **Per-SKU Minimum Order Quantity (MOQ):**
   $$
   Q_i \ge \text{MOQ}_i
   $$
   * For fragile/high-overhead items (e.g., leafy greens: $\text{MOQ} = 1\text{ kg}$; wholesale tubers: $\text{MOQ} = 50\text{ kg}$).

2. **Basket-Level Minimum Order Value (MOV):**
   $$
   \sum_{i=1}^{n} \left( Q_i \times U_i \right) \ge \text{MOV}_{\text{tier}}
   $$
   * $\text{MOV}_{\text{B2C}} \ge \text{BDT } 500$
   * $\text{MOV}_{\text{B2B}} \ge \text{BDT } 5,000$

---

## 4. Relational Database Schema (PostgreSQL + PostGIS)

```sql
-- Role and grading enumerations
CREATE TYPE user_role AS ENUM ('FARMER', 'CONSUMER', 'WHOLESALER', 'HUB_ADMIN', 'DISPATCHER');
CREATE TYPE quality_grade AS ENUM ('GRADE_A', 'GRADE_B', 'GRADE_C_PROCESSING');
CREATE TYPE order_status AS ENUM ('PENDING', 'AGGREGATED_AT_HUB', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');
CREATE TYPE escrow_status AS ENUM ('HELD', 'DISBURSED_TO_FARMER', 'REFUNDED');

-- User Entity
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    role user_role NOT NULL,
    geo_point GEOMETRY(Point, 4326),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Regional Micro-Hubs
CREATE TABLE hubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_name VARCHAR(100) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    storage_capacity_kg NUMERIC(10, 2) NOT NULL,
    hub_admin_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Farmer Product Batch Listings
CREATE TABLE product_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    hub_id UUID REFERENCES hubs(id),
    commodity_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    total_yield_kg NUMERIC(10, 2) NOT NULL,
    available_qty_kg NUMERIC(10, 2) NOT NULL,
    farmer_unit_price NUMERIC(10, 2) NOT NULL,
    b2c_moq_kg NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
    b2b_moq_kg NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
    grade quality_grade DEFAULT 'GRADE_A',
    harvest_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Order Transactions
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES users(id),
    hub_id UUID REFERENCES hubs(id),
    order_type VARCHAR(20) NOT NULL, -- 'B2C' or 'B2B'
    farmer_payout_total NUMERIC(12, 2) NOT NULL,
    service_fee NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL,
    total_payable NUMERIC(12, 2) NOT NULL,
    order_status order_status DEFAULT 'PENDING',
    escrow_status escrow_status DEFAULT 'HELD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES product_listings(id),
    quantity_kg NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL
);
```

---

## 5. Non-Functional Specifications & Operational Rules

* **Distributed Concurrency:** High-velocity flash listings during peak harvests manage item deductions via Redis atomic decrements (`DECRBY`) coupled with Redlock to eliminate duplicate claims.
* **Low-Bandwidth Resilience:** Farmer client utilizes an offline-first SQLite cache, background sync, and SMS-fallback verification for intermittent 2G/3G connectivity in remote areas.
* **Escrow Financial Safety:** Buyer payments remain in escrow until the physical Produce Verification Scan is cleared at the local hub. Payouts trigger immediately via automated mobile payment rails.
