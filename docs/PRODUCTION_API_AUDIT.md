# SPIRAL CAFE — PRODUCTION API & RUNTIME AUDIT REPORT

## Executive Overview
This document provides a comprehensive inventory and production-readiness audit of all 43 API routes in the Spiral Cafe Next.js 16 application running under `vinext` on Cloudflare Workers (`spiral-cafe2`).

- **Production Domain**: `https://spiralcafe-menucard.tnwebz.com`
- **Database**: Supabase PostgreSQL (`funsnqahpzsucbtxbvpo.supabase.co`)
- **Connector Service**: Local Windows ESC/POS Print Connector (`127.0.0.1:4318`)

---

## Shared Architecture & Common Fixes

### 1. Privileged Supabase Admin Client (`src/lib/supabase/admin.ts`)
* **Root Cause of 500 on `POST /api/orders`**: In Cloudflare Workers, `process.env.SUPABASE_SECRET_KEY` was missing from `wrangler.jsonc`. The previous code fell back to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which is constrained by Row-Level Security (RLS) policies. When server operations attempted to insert orders or checkouts, Supabase rejected the query with an RLS violation.
* **Resolution**:
  - Injected `SUPABASE_SECRET_KEY` into `wrangler.jsonc` runtime variables.
  - Removed all publishable/anon key fallbacks in `src/lib/supabase/admin.ts`.
  - Added fail-secure verification: if `SUPABASE_SECRET_KEY` is ever absent, the server fails with an explicit diagnostic rather than attempting an unprivileged query that breaks data integrity.

### 2. Admin Authentication Flow & Session Integrity
* **Root Cause of 401 and Redirect Failures**:
  - `localStorage` JWT storage was removed to adhere strictly to defense-in-depth and avoid exposing admin tokens to browser extensions or XSS.
  - Established HTTP-only session cookies (`spiral_admin_token`) as the authoritative session mechanism.
  - Set-Cookie attributes: `Path=/`, `HttpOnly=true`, `SameSite=Lax`, `Secure=true` in production, `Max-Age=86400`.
  - Admin login navigates via `window.location.href = "/admin"` to commit the HTTP cookie to the browser jar before loading the dashboard.
  - Admin dashboard verifies the user via `/api/auth/admin/me` directly against the server-verified cookie.

### 3. React Hydration Mismatch (#418)
* **Root Cause**: `next/font/google` in the `vinext` compatibility layer generates CSS class names via a module-scoped counter `classCounter++` (`__variable_inter_${id}`). The server instance counter incremented across requests while the browser client counter always started at 0. Because `<html className={`${inter.variable} ...`}>` rendered different class strings, React 19 failed hydration on the root `<html>` element with error `#418 (HTML)`.
* **Resolution**: Replaced dynamic variable injection with static `@import` in `src/app/globals.css` and static CSS custom property tokens (`--font-inter`, `--font-poppins`). Removed fluctuating class names from `<html ...>`. Server and client HTML trees now match identically.

### 4. Local Print Connector CORS & Chrome Local Network Access
* **Root Cause**: Modern Chrome blocks public HTTPS websites from issuing requests to `127.0.0.1` unless:
  1. The server explicitly allows the origin (no wildcards allowed when credentials or PNA are checked).
  2. The server responds to `OPTIONS` with `Access-Control-Allow-Private-Network: true`.
  3. Unauthorized origins are rejected.
* **Resolution**: `local-connector/src/main.ts` and `security.ts` now validate the calling origin against `.tnwebz.com`, return `Access-Control-Allow-Private-Network: true`, and reject unauthorized origins with `403 Forbidden`.

---

## Complete API Route Inventory (43 Routes)

| # | Endpoint | Methods | Access | Auth Mechanism | Supabase Tables | Purpose |
|---|---|---|---|---|---|---|
| 1 | `/api/admin/analytics` | GET | Admin | HMAC Cookie (`spiral_admin_token`) | `orders`, `settlements` | Sales metrics, revenue, item distribution |
| 2 | `/api/admin/analytics/private` | GET | Admin | HMAC Cookie | `orders` (type='PRIVATE') | Private counter sales reporting |
| 3 | `/api/admin/audit-logs` | GET | Admin | HMAC Cookie | `audit_logs` | Security & operational audit trail |
| 4 | `/api/admin/orders/[id]/collect-cash` | POST | Admin | HMAC Cookie | `orders`, `settlements`, `invoices` | Manual cash settlement & invoice issue |
| 5 | `/api/admin/overview` | GET | Admin | HMAC Cookie | `orders`, `tables`, `settlements` | Live active dashboard summary |
| 6 | `/api/admin/private-orders` | GET, POST | Admin | HMAC Cookie | `orders`, `order_items` | Counter orders without table assignment |
| 7 | `/api/admin/private-orders/kot` | POST | Admin | HMAC Cookie | `orders` | Generates private order KOT payload |
| 8 | `/api/admin/settings` | GET, PUT | Admin | HMAC Cookie | `cafe_config` | Tax, fees, UPI, and store profile |
| 9 | `/api/admin/settlements` | GET | Admin | HMAC Cookie | `settlements` | Historical payment settlements |
| 10 | `/api/auth/admin/login` | POST | Public | Rate Limiter (5/min per IP) | `cafe_config` | Staff PIN / Admin password login |
| 11 | `/api/auth/admin/me` | GET, POST | Admin | HMAC Cookie | None | Session verification & logout |
| 12 | `/api/config` | GET | Public | None | `cafe_config` | Public store configuration & timings |
| 13 | `/api/customers` | GET, POST | Admin | HMAC Cookie | `customers` | Customer directory & VIP notes |
| 14 | `/api/customers/identify` | POST | Customer | Session / Phone | `customers`, `customer_sessions` | Phone lookup for returning guests |
| 15 | `/api/customers/preference` | POST | Customer | Session | `customers` | Veg / Non-Veg preference persistence |
| 16 | `/api/invoices` | GET, POST | Admin | HMAC Cookie | `invoices`, `orders` | Invoice generation & history |
| 17 | `/api/invoices/by-token/[token]` | GET | Public | Secure Random Token | `invoices`, `orders` | Public guest digital invoice view |
| 18 | `/api/invoices/[id]` | GET | Admin | HMAC Cookie | `invoices` | Specific invoice details |
| 19 | `/api/invoices/[id]/sms` | POST | Admin | HMAC Cookie | `invoices`, `customers` | Send invoice link via SMS |
| 20 | `/api/kitchen/orders` | GET, PATCH | Kitchen | Cookie / Admin | `orders`, `order_items` | Kitchen Display System & status updates |
| 21 | `/api/menu/items` | GET, POST | Public (GET) / Admin (POST) | HMAC Cookie (POST) | `menu_items` | Menu catalog & item creation |
| 22 | `/api/menu/items/[id]` | GET, PUT, DELETE | Admin | HMAC Cookie | `menu_items` | Menu item update and removal |
| 23 | `/api/menu/items/[id]/toggle` | PATCH | Admin | HMAC Cookie | `menu_items` | 86-item quick stock toggle |
| 24 | `/api/orders` | GET, POST | Mixed | Customer Session / Admin Cookie | `orders`, `order_items`, `table_visits` | Order creation, add-on rounds, order lookup |
| 25 | `/api/orders/adding-food` | POST | Customer | Session | `orders` | Broadcasts "Customer Adding Food" banner |
| 26 | `/api/orders/payment-method` | POST | Customer | Session | `orders` | Select Cash or UPI at table |
| 27 | `/api/orders/[id]` | GET, PATCH, DELETE | Mixed | Session / Admin Cookie | `orders`, `order_items` | Order details, voiding, or admin status |
| 28 | `/api/payments/create` | POST | Customer | Session | `orders` | Payment order initialization |
| 29 | `/api/payments/razorpay/create` | POST | Customer | Session | `orders` | Creates Razorpay order |
| 30 | `/api/payments/razorpay/verify` | POST | Customer | Session | `orders`, `settlements` | Webhook / Signature verification |
| 31 | `/api/payments/verify` | POST | Customer | Session | `orders` | Payment status polling |
| 32 | `/api/tables` | GET, POST | Public (GET) / Admin (POST) | HMAC Cookie (POST) | `tables`, `table_visits` | Table list with live status & table creation |
| 33 | `/api/tables/kot` | GET | Admin | HMAC Cookie | `orders`, `order_items` | Formatted ESC/POS KOT data |
| 34 | `/api/tables/kot/authorize` | POST | Admin | HMAC Cookie | None (HMAC-SHA256 signature) | Authorizes local connector to print KOT |
| 35 | `/api/tables/payment` | POST | Admin | HMAC Cookie | `orders`, `settlements`, `tables` | Settle table bill and mark paid |
| 36 | `/api/tables/printer-settings` | GET, POST | Admin | HMAC Cookie | `cafe_config` | IP / Hostname settings for kitchen printer |
| 37 | `/api/tables/release` | POST | Admin | HMAC Cookie | `table_visits`, `tables` | Manually mark dining visit closed |
| 38 | `/api/tables/reserve` | POST | Customer | Session | `tables`, `table_reservations` | Reserve table before ordering |
| 39 | `/api/tables/session` | GET | Customer | Session | `table_visits`, `customer_sessions` | Sync active visit and draft cart |
| 40 | `/api/tables/status` | GET | Mixed | Public / Admin | `tables` | Table availability and occupancy |
| 41 | `/api/tables/transfer` | GET, POST | Mixed | Session / Admin Cookie | `table_transfers`, `tables` | Guest table switch request and approval |
| 42 | `/api/tables/[tableId]` | GET, PATCH | Admin | HMAC Cookie | `tables`, `orders` | Single table details and manual override |
| 43 | `/api/upload` | POST | Admin | HMAC Cookie | Supabase Storage (`spiral-cafe`) | Image upload for menu products |
