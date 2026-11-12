# Spiral Cafe POS — Database Schema Inventory & Object Catalog

**Backup Date**: 2026-11-12  
**Target Platform**: PostgreSQL 15+ / Supabase  
**Total Tables Backed Up**: 16  
**Total Menu Items**: 41 across 11 categories  
**Total Restaurant Tables**: 15 floor tables  
**Transactional Data Status**: Clean / Empty (0 orders, 0 customers, 0 sessions)

---

## 1. Application Tables Specification

| # | Table Name | Type | Description | Primary Key | Foreign Keys & References |
|---|---|---|---|---|---|
| 1 | `public.cafe_config` | Singleton Configuration | Business profile, tax %, PINs, GSTIN, currency | `id` (int, default 1) | None |
| 2 | `public.menu_items` | Catalog | Live dishes, prices, veg/non-veg, ratings | `id` (text) | None |
| 3 | `public.customers` | Master Ledger | Phone-based customer records, visit frequency | `id` (text) | Unique on `phone_number` |
| 4 | `public.customer_sessions` | Session Isolation | Guest table QR visit tokens and expiry | `id` (text) | `customer_id -> customers(id)` |
| 5 | `public.orders` | Transactional | Live floor dining orders, totals, status | `id` (text) | `customer_session_id -> customer_sessions(id)`, `customer_id -> customers(id)` |
| 6 | `public.order_items` | Normalized Items | Order line items, quantities, line totals | `id` (text) | `order_id -> orders(id)` (CASCADE) |
| 7 | `public.restaurant_tables` | Operations | Floor table layout, capacities, 5-color status | `id` (text) | `active_order_id -> orders(id)` |
| 8 | `public.table_reservations` | Operations | 10-minute temporary table hold locks | `id` (text) | Index on `(table_number, status)` |
| 9 | `public.kots` | Kitchen Operations | Kitchen tickets, printing status, multiple rounds | `id` (text) | `order_id -> orders(id)` (CASCADE) |
| 10 | `public.print_attempts` | Hardware Audit | Idempotency log for thermal printer dispatches | `id` (text) | `kot_id -> kots(id)` (CASCADE) |
| 11 | `public.printer_settings` | Hardware Configuration | Kitchen Ethernet IP & Counter USB configuration | `id` (int, default 1) | None |
| 12 | `public.payments` | Gateway Ledger | Razorpay transaction records & verification status | `id` (uuid) | `order_id -> orders(id)` (CASCADE) |
| 13 | `public.invoices` | Immutable Billing | Customer receipts, tax breakdowns, secure tokens | `id` (text) | `order_id -> orders(id)`, `customer_id -> customers(id)` |
| 14 | `public.invoice_items` | Normalized Lines | Historical item snapshot at time of billing | `id` (text) | `invoice_id -> invoices(id)` (CASCADE) |
| 15 | `public.settlements` | End-of-Day Billing | Daily cash register reconciliation & audit | `id` (text) | None |
| 16 | `public.audit_logs` | Security Trail | Administrative configuration & action logs | `id` (text) | Composite index on `(entity_type, entity_id)` |

---

## 2. Row Level Security (RLS) Policies

All 16 tables have Row Level Security enabled.
- **Public Select**: Granted on `menu_items`, `cafe_config`, `restaurant_tables`, and token-gated `invoices`.
- **Public Insert/Update**: Granted on `table_reservations` to permit unauthenticated table locking during guest QR ordering.
- **Service Role**: Full read/write access granted to trusted backend Cloudflare Worker operations via `SUPABASE_SECRET_KEY`.

---

## 3. Stored Functions & Triggers

1. **`public.create_order_with_items(order_payload jsonb, items_payload jsonb) returns jsonb`**:
   - `SECURITY DEFINER` function executing atomic creation of an order header and its nested items within a single database transaction.
2. **`public.set_updated_at() returns trigger`**:
   - Automatically maintains accurate `updated_at` timestamps across all mutable tables.

---

## 4. Realtime Publications

The publication `supabase_realtime` replicates changes for:
- `public.orders` (Live POS order notifications)
- `public.order_items` (Item additions and rounds)
- `public.menu_items` (Dynamic 86-ing / item availability)
- `public.restaurant_tables` (5-color table grid state changes)
- `public.kots` (Live kitchen ticket state)
- `public.table_reservations` (Live table lock updates)
