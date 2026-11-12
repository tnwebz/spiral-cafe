-- ==============================================================================
-- Spiral Cafe POS — Comprehensive Schema Tables DDL
-- Target: PostgreSQL 15+ / Supabase
-- Dependency Order: Strict foreign-key-safe ordering
-- ==============================================================================

-- 1. Enable Required Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 2. CAFE CONFIGURATION (Singleton)
-- ==============================================================================
create table if not exists public.cafe_config (
  id integer primary key default 1 check (id = 1),
  tax_percentage numeric(5,2) not null default 5.00,
  packaging_fee numeric(10,2) not null default 0.00,
  service_charge numeric(10,2) not null default 0.00,
  kitchen_pin text not null default '1234',
  cashier_pin text not null default '5678',
  admin_pin text not null default '1234',
  admin_username text not null default 'admin',
  admin_password_hash text not null default 'd77367e72006c9701e437b51abd23fe5ad9baad13c1df094d24a450ececc14d4',
  cafe_name text not null default 'Spiral Cafe',
  cafe_address text not null default 'Opposite Government Hospital, CSI Mahimai Illam, Alagesan Nagar, Chengalpattu, Tamil Nadu 603001',
  cafe_phone text not null default '+91 98765 43210',
  gst_number text not null default '33AAAAA0000A1Z5',
  currency_symbol text not null default '₹',
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 3. MENU CATALOG ITEMS
-- ==============================================================================
create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  description text default '',
  price numeric(10,2) not null check (price >= 0),
  original_price numeric(10,2) check (original_price is null or original_price >= 0),
  category_id text not null,
  category_name text not null,
  diet_type text not null default 'veg' check (diet_type in ('veg', 'non-veg', 'egg', 'other')),
  badge text not null default 'none' check (badge in ('none', 'bestseller', 'chef-choice', 'new', 'spicy', 'popular')),
  rating numeric(3,2) not null default 4.80 check (rating >= 0 and rating <= 5),
  reviews_count integer not null default 250 check (reviews_count >= 0),
  image text not null default '',
  cloudinary_public_id text,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 4. CUSTOMERS LEDGER
-- ==============================================================================
create table if not exists public.customers (
  id text primary key,
  phone_number text unique not null,
  name text,
  food_preference text not null default 'ALL',
  service_sms_consent boolean not null default true,
  marketing_consent boolean not null default false,
  total_orders integer not null default 0 check (total_orders >= 0),
  total_spent numeric(10,2) not null default 0.00 check (total_spent >= 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 5. CUSTOMER VISIT SESSIONS (Guest Session Isolation)
-- ==============================================================================
create table if not exists public.customer_sessions (
  id text primary key,
  customer_id text references public.customers(id) on delete set null,
  customer_phone text,
  table_number text not null,
  session_token text unique not null,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

-- ==============================================================================
-- 6. ORDERS LEDGER
-- ==============================================================================
create table if not exists public.orders (
  id text primary key,
  order_number text unique not null,
  table_number text not null,
  visit_id text,
  customer_session_id text references public.customer_sessions(id) on delete set null,
  customer_id text references public.customers(id) on delete set null,
  customer_phone text,
  subtotal numeric(10,2) not null default 0.00,
  tax numeric(10,2) not null default 0.00,
  packaging_fee numeric(10,2) not null default 0.00,
  service_charge numeric(10,2) not null default 0.00,
  grand_total numeric(10,2) not null default 0.00,
  status text not null default 'PENDING' check (status in ('PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID', 'PENDING_CASH', 'PAID', 'FAILED', 'REFUNDED')),
  payment_method text not null default 'UNSELECTED' check (payment_method in ('UNSELECTED', 'CASH', 'ONLINE')),
  payment_txn_id text,
  payment_provider text,
  invoice_id text,
  invoice_number text,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  preparing_at timestamptz,
  ready_at timestamptz,
  paid_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

-- ==============================================================================
-- 7. ORDER ITEMS (Normalized Line Items)
-- ==============================================================================
create table if not exists public.order_items (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  image text default '',
  notes text
);

-- ==============================================================================
-- 8. RESTAURANT TABLES (Floor Management & 5-Color Status System)
-- ==============================================================================
create table if not exists public.restaurant_tables (
  id text primary key,
  table_number text unique not null,
  capacity integer not null default 4 check (capacity > 0),
  section text not null default 'Dine-In',
  status text not null default 'AVAILABLE' check (
    status in ('AVAILABLE', 'RESERVED', 'NEW_ORDER', 'ACTION_NEEDED', 'KOT_SENT')
  ),
  active_order_id text references public.orders(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 9. TABLE RESERVATIONS (10-Minute Temporary Hold & Visit Mapping)
-- ==============================================================================
create table if not exists public.table_reservations (
  id text primary key,
  table_number text not null,
  customer_session_id text not null,
  customer_phone text,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'ACTIVE' check (
    status in ('ACTIVE', 'EXPIRED', 'CONVERTED', 'RELEASED', 'TRANSFERRED')
  ),
  visit_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 10. KITCHEN ORDER TICKETS (KOT Lifecycle & Multiple Rounds)
-- ==============================================================================
create table if not exists public.kots (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  order_number text not null,
  table_number text not null,
  round integer not null default 1 check (round > 0),
  items jsonb not null default '[]'::jsonb,
  status text not null default 'NOT_SENT' check (
    status in ('NOT_SENT', 'VIEWED', 'PRINTING', 'SENT_UNVERIFIED', 'PRINT_CONFIRMED', 'FAILED', 'UNKNOWN', 'MANUALLY_DELIVERED')
  ),
  terminal_name text not null default 'Billing 1',
  print_attempts integer not null default 0,
  last_attempt_at timestamptz,
  confirmed_at timestamptz,
  manually_delivered_at timestamptz,
  admin_user text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 11. PRINT ATTEMPTS AUDIT LEDGER (Hardware Delivery History)
-- ==============================================================================
create table if not exists public.print_attempts (
  id text primary key,
  kot_id text references public.kots(id) on delete cascade,
  order_id text not null,
  table_number text not null,
  round integer not null default 1,
  printer_model text not null default 'CN811-UEWB',
  printer_ip text,
  attempt_type text not null default 'PRINT' check (attempt_type in ('PRINT', 'RESEND', 'TEST')),
  status text not null check (status in ('SUCCESS', 'FAILED', 'UNKNOWN')),
  error_message text,
  raw_payload_preview text,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 12. PRINTER SETTINGS (Hardware Connection State)
-- ==============================================================================
create table if not exists public.printer_settings (
  id integer primary key default 1 check (id = 1),
  printer_model text not null default 'CN811-UEWB',
  interface_type text not null default 'ETHERNET' check (interface_type in ('ETHERNET', 'WIFI', 'USB', 'BLUETOOTH')),
  ip_address text not null default '192.168.1.233',
  port integer not null default 9100,
  paper_width_mm integer not null default 80,
  qz_printer_name text not null default 'CN811-UEWB',
  terminal_name text not null default 'Billing 1',
  auto_cut boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 13. PAYMENTS LEDGER (Online / Gateway Verification)
-- ==============================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'PENDING',
  payment_method text not null default 'ONLINE',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

-- ==============================================================================
-- 14. INVOICES (Immutable Billing Records)
-- ==============================================================================
create table if not exists public.invoices (
  id text primary key,
  invoice_number text unique not null,
  order_id text references public.orders(id) on delete set null,
  order_number text not null,
  table_number text not null,
  customer_id text references public.customers(id) on delete set null,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0.00,
  tax numeric(10,2) not null default 0.00,
  packaging_fee numeric(10,2) not null default 0.00,
  service_charge numeric(10,2) not null default 0.00,
  grand_total numeric(10,2) not null default 0.00,
  payment_method text not null default 'UNSELECTED' check (payment_method in ('UNSELECTED', 'CASH', 'ONLINE')),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID', 'PENDING_CASH', 'PAID', 'FAILED', 'REFUNDED')),
  paid_at timestamptz,
  secure_token text,
  sms_sent boolean not null default false,
  sms_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 15. INVOICE ITEMS (Immutable Item Snapshots)
-- ==============================================================================
create table if not exists public.invoice_items (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  product_id text,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) not null check (line_total >= 0)
);

-- ==============================================================================
-- 16. SETTLEMENTS (Daily Register Closures & Cash Audits)
-- ==============================================================================
create table if not exists public.settlements (
  id text primary key,
  date text not null,
  total_orders integer not null default 0 check (total_orders >= 0),
  total_sales numeric(10,2) not null default 0.00,
  cash_sales numeric(10,2) not null default 0.00,
  online_sales numeric(10,2) not null default 0.00,
  cash_counted numeric(10,2) not null default 0.00,
  cash_settled numeric(10,2) not null default 0.00,
  difference numeric(10,2) not null default 0.00,
  notes text,
  settled_by text not null,
  settled_at timestamptz not null default now()
);

-- ==============================================================================
-- 17. AUDIT LOGS (Security & Operational Event Trail)
-- ==============================================================================
create table if not exists public.audit_logs (
  id text primary key,
  admin_user text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details text not null,
  previous_value jsonb,
  new_value jsonb,
  timestamp timestamptz not null default now()
);
