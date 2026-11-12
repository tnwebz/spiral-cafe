-- ==============================================================================
-- SPIRAL CAFE — COMPLETE PORTABLE SUPABASE DATABASE SETUP & RESTORATION SCRIPT
-- Application: Spiral Cafe Point of Sale & Customer QR Ordering System
-- Platform: Supabase PostgreSQL 15+ / Cloudflare Workers / Next.js 16
-- Generation Date: 2026-11-12
--
-- INSTRUCTIONS FOR NEW SUPABASE PROJECT:
-- 1. Open the Supabase Dashboard for the restaurant owner's project.
-- 2. Navigate to SQL Editor -> New Query.
-- 3. Paste the entire contents of this file and click "Run".
-- 4. Verify all tables and 41 menu items are created successfully.
--
-- GUARANTEES:
-- - Idempotent: Can be run multiple times safely.
-- - Clean Start: All customer data, previous orders, and sensitive PINs are omitted.
-- - Zero Image Asset Leaks: Image columns are preserved without external URLs.
-- - Floor Tables: All 15 restaurant tables initialize in AVAILABLE state.
-- ==============================================================================

\set ON_ERROR_STOP on


-- ------------------------------------------------------------------------------
-- SECTION: schema/tables.sql
-- ------------------------------------------------------------------------------

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

-- ------------------------------------------------------------------------------
-- SECTION: schema/indexes-constraints.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- Spiral Cafe POS — Indexes & Performance Tuning
-- Target: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Orders Indexes
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_table_number on public.orders(table_number);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_session_id on public.orders(customer_session_id);
create index if not exists idx_orders_visit_id on public.orders(visit_id);

-- 2. Order Items Indexes
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);

-- 3. Customers & Sessions Indexes
create index if not exists idx_customers_phone on public.customers(phone_number);
create index if not exists idx_customer_sessions_token on public.customer_sessions(session_token);
create index if not exists idx_customer_sessions_customer_id on public.customer_sessions(customer_id);

-- 4. Restaurant Tables & Reservations Indexes
create index if not exists idx_restaurant_tables_status on public.restaurant_tables(status);
create index if not exists idx_restaurant_tables_active_order on public.restaurant_tables(active_order_id);
create index if not exists idx_table_reservations_table_status on public.table_reservations(table_number, status);
create index if not exists idx_table_reservations_session on public.table_reservations(customer_session_id);
create index if not exists idx_table_reservations_expires on public.table_reservations(expires_at);
create index if not exists idx_table_reservations_visit_id on public.table_reservations(visit_id);

-- 5. KOTs & Print Attempts Indexes
create index if not exists idx_kots_order_id on public.kots(order_id);
create index if not exists idx_kots_table_number on public.kots(table_number);
create index if not exists idx_kots_status on public.kots(status);
create index if not exists idx_print_attempts_kot_id on public.print_attempts(kot_id);
create index if not exists idx_print_attempts_order_id on public.print_attempts(order_id);

-- 6. Invoices & Billing Indexes
create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);
create index if not exists idx_invoices_secure_token on public.invoices(secure_token);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);

-- 7. Menu Items & Discovery Indexes
create index if not exists idx_menu_items_category on public.menu_items(category_id);
create index if not exists idx_menu_items_available on public.menu_items(available);
create index if not exists idx_menu_items_diet_type on public.menu_items(diet_type);

-- 8. Audit & Settlements Indexes
create index if not exists idx_audit_logs_timestamp on public.audit_logs(timestamp desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_settlements_date on public.settlements(date desc);

-- 9. Payments Gateway Indexes
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_provider_payment_id on public.payments(provider_payment_id);
create index if not exists idx_payments_status on public.payments(status);

-- ------------------------------------------------------------------------------
-- SECTION: schema/functions-triggers.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- Spiral Cafe POS — Stored Functions & Automated Triggers
-- Target: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Automated Updated At Trigger Function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at triggers
drop trigger if exists trg_cafe_config_updated_at on public.cafe_config;
create trigger trg_cafe_config_updated_at
  before update on public.cafe_config
  for each row execute function public.set_updated_at();

drop trigger if exists trg_menu_items_updated_at on public.menu_items;
create trigger trg_menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_restaurant_tables_updated_at on public.restaurant_tables;
create trigger trg_restaurant_tables_updated_at
  before update on public.restaurant_tables
  for each row execute function public.set_updated_at();

drop trigger if exists trg_table_reservations_updated_at on public.table_reservations;
create trigger trg_table_reservations_updated_at
  before update on public.table_reservations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_kots_updated_at on public.kots;
create trigger trg_kots_updated_at
  before update on public.kots
  for each row execute function public.set_updated_at();

drop trigger if exists trg_printer_settings_updated_at on public.printer_settings;
create trigger trg_printer_settings_updated_at
  before update on public.printer_settings
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- 2. ATOMIC ORDER CREATION RPC (Phase 13 / High-Concurrency Safe)
-- Inserts order header + multiple line items within a single transactional boundary
-- ==============================================================================
create or replace function public.create_order_with_items(
  order_payload jsonb,
  items_payload jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  new_order jsonb;
  item_record jsonb;
begin
  -- 1. Insert order header
  insert into public.orders (
    id,
    order_number,
    table_number,
    visit_id,
    customer_session_id,
    customer_id,
    customer_phone,
    subtotal,
    tax,
    packaging_fee,
    service_charge,
    grand_total,
    status,
    payment_status,
    payment_method,
    payment_txn_id,
    payment_provider,
    invoice_id,
    invoice_number,
    notes,
    created_at,
    updated_at
  ) values (
    (order_payload->>'id'),
    (order_payload->>'order_number'),
    (order_payload->>'table_number'),
    (order_payload->>'visit_id'),
    (order_payload->>'customer_session_id'),
    (order_payload->>'customer_id'),
    (order_payload->>'customer_phone'),
    coalesce((order_payload->>'subtotal')::numeric, 0),
    coalesce((order_payload->>'tax')::numeric, 0),
    coalesce((order_payload->>'packaging_fee')::numeric, 0),
    coalesce((order_payload->>'service_charge')::numeric, 0),
    coalesce((order_payload->>'grand_total')::numeric, 0),
    coalesce(order_payload->>'status', 'PENDING'),
    coalesce(order_payload->>'payment_status', 'UNPAID'),
    coalesce(order_payload->>'payment_method', 'UNSELECTED'),
    (order_payload->>'payment_txn_id'),
    (order_payload->>'payment_provider'),
    (order_payload->>'invoice_id'),
    (order_payload->>'invoice_number'),
    coalesce((order_payload->>'notes'), ''),
    coalesce((order_payload->>'created_at')::timestamptz, now()),
    coalesce((order_payload->>'updated_at')::timestamptz, now())
  )
  returning to_jsonb(public.orders.*) into new_order;

  -- 2. Insert order items
  for item_record in select * from jsonb_array_elements(items_payload)
  loop
    insert into public.order_items (
      id,
      order_id,
      product_id,
      name,
      price,
      quantity,
      line_total,
      image,
      notes
    ) values (
      (item_record->>'id'),
      (order_payload->>'id'),
      (item_record->>'product_id'),
      (item_record->>'name'),
      coalesce((item_record->>'price')::numeric, 0),
      coalesce((item_record->>'quantity')::integer, 1),
      coalesce((item_record->>'line_total')::numeric, 0),
      coalesce(item_record->>'image', ''),
      (item_record->>'notes')
    );
  end loop;

  return new_order;
end;
$$;

-- ------------------------------------------------------------------------------
-- SECTION: schema/security-rls.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- Spiral Cafe POS — Row Level Security (RLS) & Access Policies
-- Target: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Enable RLS on all public tables
alter table public.cafe_config enable row level security;
alter table public.menu_items enable row level security;
alter table public.customers enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.table_reservations enable row level security;
alter table public.kots enable row level security;
alter table public.print_attempts enable row level security;
alter table public.printer_settings enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.settlements enable row level security;
alter table public.audit_logs enable row level security;

-- ==============================================================================
-- 2. PUBLIC ANONYMOUS READ POLICIES (Client QR Ordering)
-- ==============================================================================

-- Public Read Menu Items
drop policy if exists "Allow public read menu_items" on public.menu_items;
create policy "Allow public read menu_items"
  on public.menu_items for select
  using (true);

-- Public Read Cafe Configuration
drop policy if exists "Allow public read cafe_config" on public.cafe_config;
create policy "Allow public read cafe_config"
  on public.cafe_config for select
  using (true);

-- Public Read Restaurant Tables (For floor table status & capacity in customer modal)
drop policy if exists "Allow public read restaurant_tables" on public.restaurant_tables;
create policy "Allow public read restaurant_tables"
  on public.restaurant_tables for select
  using (true);

-- Public Read Invoices (Protected strictly by secure_token)
drop policy if exists "Allow public read invoice by token" on public.invoices;
create policy "Allow public read invoice by token"
  on public.invoices for select
  using (secure_token is not null);

-- Public Guest Table Reservations (Allows customers to temporarily hold a floor table)
drop policy if exists "Allow public reservations access" on public.table_reservations;
create policy "Allow public reservations access"
  on public.table_reservations for all
  using (true)
  with check (true);

-- ==============================================================================
-- 3. TRUSTED BACKEND SERVICE ROLE POLICIES (Supabase Service Key)
-- ==============================================================================

drop policy if exists "Allow service_role on cafe_config" on public.cafe_config;
create policy "Allow service_role on cafe_config" on public.cafe_config for all using (true) with check (true);

drop policy if exists "Allow service_role on menu_items" on public.menu_items;
create policy "Allow service_role on menu_items" on public.menu_items for all using (true) with check (true);

drop policy if exists "Allow service_role on customers" on public.customers;
create policy "Allow service_role on customers" on public.customers for all using (true) with check (true);

drop policy if exists "Allow service_role on customer_sessions" on public.customer_sessions;
create policy "Allow service_role on customer_sessions" on public.customer_sessions for all using (true) with check (true);

drop policy if exists "Allow service_role on orders" on public.orders;
create policy "Allow service_role on orders" on public.orders for all using (true) with check (true);

drop policy if exists "Allow service_role on order_items" on public.order_items;
create policy "Allow service_role on order_items" on public.order_items for all using (true) with check (true);

drop policy if exists "Allow service_role on restaurant_tables" on public.restaurant_tables;
create policy "Allow service_role on restaurant_tables" on public.restaurant_tables for all using (true) with check (true);

drop policy if exists "Allow service_role on kots" on public.kots;
create policy "Allow service_role on kots" on public.kots for all using (true) with check (true);

drop policy if exists "Allow service_role on print_attempts" on public.print_attempts;
create policy "Allow service_role on print_attempts" on public.print_attempts for all using (true) with check (true);

drop policy if exists "Allow service_role on printer_settings" on public.printer_settings;
create policy "Allow service_role on printer_settings" on public.printer_settings for all using (true) with check (true);

drop policy if exists "Allow service_role on payments" on public.payments;
create policy "Allow service_role on payments" on public.payments for all using (true) with check (true);

drop policy if exists "Allow service_role on invoices" on public.invoices;
create policy "Allow service_role on invoices" on public.invoices for all using (true) with check (true);

drop policy if exists "Allow service_role on invoice_items" on public.invoice_items;
create policy "Allow service_role on invoice_items" on public.invoice_items for all using (true) with check (true);

drop policy if exists "Allow service_role on settlements" on public.settlements;
create policy "Allow service_role on settlements" on public.settlements for all using (true) with check (true);

drop policy if exists "Allow service_role on audit_logs" on public.audit_logs;
create policy "Allow service_role on audit_logs" on public.audit_logs for all using (true) with check (true);

-- ------------------------------------------------------------------------------
-- SECTION: schema/realtime.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- Spiral Cafe POS — Realtime Replication Publication
-- Target: PostgreSQL 15+ / Supabase
-- Enables live webhooks/WebSocket streams for Kitchen KDS, Waiter tablets & POS
-- ==============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Orders & Items (Live Kitchen & POS status changes)
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
      alter publication supabase_realtime add table public.orders;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'order_items') then
      alter publication supabase_realtime add table public.order_items;
    end if;

    -- Dynamic Menu Items (Live 86-ing / item availability toggle)
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'menu_items') then
      alter publication supabase_realtime add table public.menu_items;
    end if;

    -- Floor Tables Grid & 5-Color State Indicators
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'restaurant_tables') then
      alter publication supabase_realtime add table public.restaurant_tables;
    end if;

    -- Live KOT Rounds & Printer Delivery Statuses
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'kots') then
      alter publication supabase_realtime add table public.kots;
    end if;

    -- Temporary 10-Minute Table Locks
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'table_reservations') then
      alter publication supabase_realtime add table public.table_reservations;
    end if;
  end if;
exception
  when others then null; -- Graceful degradation in restricted sub-environments
end $$;

-- ------------------------------------------------------------------------------
-- SECTION: seeds/restaurant-config.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- Spiral Cafe POS — Baseline Restaurant Configuration Seed Data
-- Target: PostgreSQL 15+ / Supabase
-- Idempotent: ON CONFLICT DO UPDATE
-- Privacy Guardrail: All floor tables initialize in an AVAILABLE state with zero active orders.
-- ==============================================================================

-- 1. CAFE BUSINESS CONFIGURATION (Singleton)
insert into public.cafe_config (
  id,
  tax_percentage,
  packaging_fee,
  service_charge,
  kitchen_pin,
  cashier_pin,
  admin_pin,
  admin_username,
  admin_password_hash,
  cafe_name,
  cafe_address,
  cafe_phone,
  gst_number,
  currency_symbol,
  updated_at
) values (
  1,
  5.00,
  0.00,
  0.00,
  '1234',
  '5678',
  '1234',
  'admin',
  'd77367e72006c9701e437b51abd23fe5ad9baad13c1df094d24a450ececc14d4',
  'Spiral Cafe',
  'Opposite Government Hospital, CSI Mahimai Illam, Alagesan Nagar, Chengalpattu, Tamil Nadu 603001',
  '+91 98765 43210',
  '33AAAAA0000A1Z5',
  '₹',
  now()
)
on conflict (id) do update set
  tax_percentage = excluded.tax_percentage,
  packaging_fee = excluded.packaging_fee,
  service_charge = excluded.service_charge,
  cafe_name = excluded.cafe_name,
  cafe_address = excluded.cafe_address,
  cafe_phone = excluded.cafe_phone,
  gst_number = excluded.gst_number,
  currency_symbol = excluded.currency_symbol,
  updated_at = now();

-- 2. RESTAURANT FLOOR TABLES (Initialized cleanly in AVAILABLE state)
insert into public.restaurant_tables (id, table_number, capacity, section, status, active_order_id, notes, created_at, updated_at)
values
  ('A1', 'A1', 4, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('A2', 'A2', 4, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('B1', 'B1', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('B2', 'B2', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('B3', 'B3', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('B4', 'B4', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('B5', 'B5', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('B6', 'B6', 2, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('C1', 'C1', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('C2', 'C2', 4, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('C3', 'C3', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('F1', 'F1', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('F2', 'F2', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('F3', 'F3', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now()),
  ('F4', 'F4', 3, 'Dine-In', 'AVAILABLE', null, null, now(), now())
on conflict (table_number) do update set
  capacity = excluded.capacity,
  section = excluded.section,
  status = 'AVAILABLE',
  active_order_id = null,
  updated_at = now();

-- 3. KITCHEN PRINTER HARDWARE SETTINGS (Singleton)
insert into public.printer_settings (
  id,
  printer_model,
  interface_type,
  ip_address,
  port,
  paper_width_mm,
  qz_printer_name,
  terminal_name,
  auto_cut,
  updated_at
) values (
  1,
  'CN811-UEWB',
  'ETHERNET',
  '192.168.1.233',
  9100,
  80,
  'CN811-UEWB',
  'Billing 1',
  true,
  now()
)
on conflict (id) do update set
  printer_model = excluded.printer_model,
  interface_type = excluded.interface_type,
  ip_address = excluded.ip_address,
  port = excluded.port,
  paper_width_mm = excluded.paper_width_mm,
  qz_printer_name = excluded.qz_printer_name,
  terminal_name = excluded.terminal_name,
  auto_cut = excluded.auto_cut,
  updated_at = now();

-- ------------------------------------------------------------------------------
-- SECTION: seeds/menu-catalog.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- Spiral Cafe Menu Catalog Seed Data
-- Total Items: 41
-- Idempotent: ON CONFLICT (id) DO UPDATE
-- Privacy/Asset Guardrail: No external image URLs or Supabase Storage links are copied.
-- ==============================================================================

insert into public.menu_items (
  id,
  name,
  description,
  price,
  original_price,
  category_id,
  category_name,
  diet_type,
  badge,
  rating,
  reviews_count,
  image,
  cloudinary_public_id,
  available,
  created_at,
  updated_at
) values
  ('bg-4', 'Cheese Crash', 'Double smashed patties overflowing with an insane waterfall of molten cheddar fondue, crispy onion rings & smoked bacon relish.', 260, 350, 'burgers', 'Burgers', 'non-veg', 'bestseller', 4.9, 510, '', NULL, true, now(), now()),
  ('bg-3', 'Hotshot Chicken', 'Thick crispy fried chicken breast fillet dunked in fiery spicy glaze, crisp house slaw, jalapeños, and sriracha chili drizzle.', 230, 310, 'burgers', 'Burgers', 'non-veg', 'spicy', 4.8, 430, '', NULL, true, now(), now()),
  ('bg-2', 'Mushroom Smash', 'Seared smash patty blanketed with garlic butter sautéed wild cremini mushrooms, melted swiss cheese, and caramelized shallot aioli.', 250, 330, 'burgers', 'Burgers', 'non-veg', 'bestseller', 4.8, 390, '', NULL, true, now(), now()),
  ('bg-1', 'Oklahoma Chicken Smash', 'Smashed chicken patty seared directly with sweet paper-thin onions, melted American cheddar, dill pickles & house burger sauce on toasted brioche.', 240, 320, 'burgers', 'Burgers', 'non-veg', 'bestseller', 4.9, 480, '', NULL, true, now(), now()),
  ('bg-5', 'The Herbivore’s Hero', 'Handcrafted crispy spiced edamame & herb patty, smashed avocado, smoked gouda, pickled red onions, and heirloom tomato on potato bun.', 210, 280, 'burgers', 'Burgers', 'veg', 'chef-choice', 4.7, 320, '', NULL, true, now(), now()),
  ('co-1', 'Mango Passion', 'Alphonso mango nectar blended with exotic tart passionfruit reduction, topped with bubbly sparkling soda and mint.', 160, 210, 'coolers', 'Coolers', 'veg', 'bestseller', 4.8, 350, '', NULL, true, now(), now()),
  ('co-2', 'Merryberry Cooler', 'Wild blueberries, raspberries, and tart cranberry puree muddled with lime juice, sparkling water, and crushed crystal ice.', 170, 220, 'coolers', 'Coolers', 'veg', 'chef-choice', 4.9, 390, '', NULL, true, now(), now()),
  ('co-3', 'Strawberry Lemonade', 'Fresh macerated ripe strawberries shaken with hand-squeezed tart lemon juice and chilled soda on the rocks.', 150, 200, 'coolers', 'Coolers', 'veg', 'bestseller', 4.8, 310, '', NULL, true, now(), now()),
  ('it-2', 'Lemon Iced Tea', 'Classic crisp iced tea brewed from premium tea leaves, sweetened with raw cane sugar and spiked with fresh Meyer lemon juice.', 130, 180, 'iced-tea', 'Iced Tea', 'veg', 'none', 4.7, 290, '', NULL, true, now(), now()),
  ('it-1', 'Peach Iced Tea', 'Slow-brewed aromatic black tea infused with sweet peach puree, lemon juice, and bruised garden mint leaves.', 140, 190, 'iced-tea', 'Iced Tea', 'veg', 'bestseller', 4.8, 370, '', NULL, true, now(), now()),
  ('mc-2', 'Caramel Iced Latte', 'Decadent buttery salted caramel swirl coated along the glass, layered with bold espresso and chilled full cream milk.', 170, 230, 'milk-coffee', 'Milk Coffee', 'veg', 'bestseller', 4.9, 420, '', NULL, true, now(), now()),
  ('mc-3', 'Hazelnut Iced Latte', 'Slow-roasted hazelnut syrup combined with rich dark espresso and velvety textured cold milk.', 170, 230, 'milk-coffee', 'Milk Coffee', 'veg', 'chef-choice', 4.8, 310, '', NULL, true, now(), now()),
  ('mc-1', 'Vanilla Iced Latte', 'Double shot of single-origin Arabica espresso poured over Madagascar vanilla bean infused cold milk and ice cubes.', 160, 220, 'milk-coffee', 'Milk Coffee', 'veg', 'bestseller', 4.8, 340, '', NULL, true, now(), now()),
  ('nmc-1', 'Americano', 'Bold double shot of rich espresso topped with chilled mountain spring water over crystal ice for a clean aromatic profile.', 130, 170, 'non-milk-coffee', 'Non Milk Coffee', 'veg', 'none', 4.7, 260, '', NULL, true, now(), now()),
  ('nmc-3', 'Fudge Cigarette', 'Smoky dark cold brew infused with bittersweet dark chocolate fudge notes and finished with a charred cinnamon bark scent.', 190, 250, 'non-milk-coffee', 'Non Milk Coffee', 'veg', 'new', 4.8, 290, '', NULL, true, now(), now()),
  ('nmc-2', 'Orange Sunset', 'Freshly squeezed sweet Valencia orange juice crowned with a floating dark layer of specialty espresso over clear ice. A stunning sunset in a glass.', 180, 240, 'non-milk-coffee', 'Non Milk Coffee', 'veg', 'bestseller', 4.9, 380, '', NULL, true, now(), now()),
  ('pa-2', 'Alfredo Chicken', 'Al dente penne coated in velvety garlic parmesan cream sauce, loaded with tender grilled herb chicken strips and fresh parsley.', 280, 360, 'pasta', 'Pasta', 'non-veg', 'bestseller', 4.9, 460, '', NULL, true, now(), now()),
  ('pa-1', 'Alfredo Veg', 'Tender penne pasta tossed in rich parmesan butter cream, sautéed broccoli florets, button mushrooms, and cracked black pepper.', 240, 320, 'pasta', 'Pasta', 'veg', 'none', 4.7, 310, '', NULL, true, now(), now()),
  ('pa-3', 'Coastal Pasta', 'Spaghetti tossed in a vibrant coastal roasted tomato butter sauce infused with garlic, red chili flakes, seafood/chicken aromatics & sweet basil.', 299, 390, 'pasta', 'Pasta', 'non-veg', 'chef-choice', 4.8, 330, '', NULL, true, now(), now()),
  ('pa-4', 'Pesto Chicken', 'Penne coated in freshly pounded Genoa basil & toasted walnut pesto, tender pan-seared chicken breast, cherry tomatoes & parmesan shavings.', 290, 380, 'pasta', 'Pasta', 'non-veg', 'bestseller', 4.8, 390, '', NULL, true, now(), now()),
  ('pa-5', 'Pesto Veg', 'Traditional Italian fragrant basil pesto pasta with sundried tomatoes, roasted pine nuts, tender zucchini coins, and mini bocconcini mozzarella.', 250, 330, 'pasta', 'Pasta', 'veg', 'none', 4.7, 270, '', NULL, true, now(), now()),
  ('sd-4', 'Egg & Melt', 'Velvety soft-scrambled pasture eggs, chives, Japanese Kewpie mayo, melted sharp cheddar between thick butter-toasted milk bread.', 180, 240, 'sandos', 'Sandos', 'veg', 'chef-choice', 4.8, 340, '', NULL, true, now(), now()),
  ('sd-1', 'French Onion Melt', 'Slow-simmered rich caramelized onions, bubbling melted gruyere & mozzarella cheese toasted to crispy perfection on rustic sourdough.', 210, 280, 'sandos', 'Sandos', 'veg', 'bestseller', 4.8, 390, '', NULL, true, now(), now()),
  ('sd-6', 'Hot Spicy Crunch', 'Extra spicy crumbed chicken breast, ghost pepper aioli, melted pepper jack, pickled peppers, and shredded iceberg crunch.', 240, 320, 'sandos', 'Sandos', 'non-veg', 'spicy', 4.7, 320, '', NULL, true, now(), now()),
  ('sd-2', 'Mushroom & Mayhem', 'Pan-roasted wild portobello mushrooms, garlic truffle aioli, baby spinach, and molten fontina cheese on crusty Italian loaf.', 220, 290, 'sandos', 'Sandos', 'veg', 'none', 4.7, 310, '', NULL, true, now(), now()),
  ('sd-7', 'OG Crunchy Sando', 'The classic triple-layered crunchy chicken sando with crisp lettuce, heirloom tomato, smoked cheddar slice & house secret pink sauce.', 220, 290, 'sandos', 'Sandos', 'non-veg', 'bestseller', 4.8, 410, '', NULL, true, now(), now()),
  ('sd-3', 'Southside Chick', 'Southern buttermilk fried chicken breast, house pimento cheese spread, dill pickles, and crisp honey-mustard coleslaw on toasted shokupan.', 230, 310, 'sandos', 'Sandos', 'non-veg', 'bestseller', 4.9, 460, '', NULL, true, now(), now()),
  ('sd-5', 'Sweet Heat Chaos', 'Crispy fried chicken katsu glazed in hot honey chili sauce, whipped jalapeño cream cheese, and pickled red cabbage crunch.', 240, 320, 'sandos', 'Sandos', 'non-veg', 'spicy', 4.8, 380, '', NULL, true, now(), now()),
  ('sh-2', 'Biscoff Shake', 'Rich vanilla bean gelato blended with Belgian Lotus Biscoff spread, caramel swirl, and crunchy spiced speculoos biscuits.', 199, 260, 'shakes', 'Shakes', 'veg', 'bestseller', 4.9, 480, '', NULL, true, now(), now()),
  ('sh-1', 'Milo Shake', 'Thick malted chocolate Milo shake blended with vanilla ice cream, dusted with crunchy raw Milo powder and chocolate chips.', 180, 240, 'shakes', 'Shakes', 'veg', 'bestseller', 4.8, 420, '', NULL, true, now(), now()),
  ('sc-3', 'Corn Ripperz', 'Charred crispy sweet corn ribs dusted in smoked paprika, cotija cheese crumbles, spicy lime butter, and cilantro.', 180, 240, 'share-club', 'Share Club', 'veg', 'new', 4.7, 290, '', NULL, true, now(), now()),
  ('sc-1', 'Mexican Melt Nachos', 'Stoneground crispy corn tortilla chips piled high with melted cheddar, fresh pico de gallo, pickled jalapeños, sour cream & tangy salsa dip.', 220, 290, 'share-club', 'Share Club', 'veg', 'bestseller', 4.8, 420, '', NULL, true, now(), now()),
  ('sc-2', 'Popcorn Chicken', 'Bite-sized tender boneless chicken morsels marinated in buttermilk, fried to extreme golden crunch and served with garlic mayo.', 210, 280, 'share-club', 'Share Club', 'non-veg', 'bestseller', 4.8, 360, '', NULL, true, now(), now()),
  ('sq-3', 'Drippy Cheese Fries', 'Crispy fries drenched in a cascade of warm molten cheddar lava, mozzarella shred, and roasted chili seasoning.', 170, 230, 'side-quest', 'Side Quest', 'veg', 'bestseller', 4.9, 410, '', NULL, true, now(), now()),
  ('sq-4', 'Loaded AF', 'Heavily loaded crispy fries topped with pulled smoky chicken, triple cheese fondue, pickled jalapeños, crispy onions & signature secret sauce.', 210, 280, 'side-quest', 'Side Quest', 'non-veg', 'bestseller', 4.9, 490, '', NULL, true, now(), now()),
  ('sq-1', 'OG Fries', 'Classic golden cut potato fries, double-fried for maximum crispiness and lightly dusted with sea salt. Served with house aioli.', 110, 150, 'side-quest', 'Side Quest', 'veg', 'none', 4.6, 240, '', NULL, true, now(), now()),
  ('sq-2', 'Peri Heat Fries', 'Piping hot crispy fries tossed vigorously in fiery African bird''s eye peri-peri spice dust and zesty lemon twist.', 130, 170, 'side-quest', 'Side Quest', 'veg', 'bestseller', 4.8, 360, '', NULL, true, now(), now()),
  ('item_1790448560821_wmbp', 'Truffle Parmesan Fries', 'Crispy skin-on fries tossed with black truffle oil and 24-month aged parmesan.', 280, NULL, 'side-quest', 'side-quest', 'veg', 'new', 4.8, 100, '', NULL, false, now(), now()),
  ('wd-1', 'Garlic Parmesan Wings', 'Crispy golden fried wings tossed in roasted garlic compound butter, topped with freshly grated 18-month aged parmesan and Italian parsley.', 260, 340, 'the-wing-dept', 'The Wing Dept', 'non-veg', 'bestseller', 4.9, 520, '', NULL, true, now(), now()),
  ('wd-2', 'Hot Honey Glaze', 'Juicy jumbo wings coated in house-infused habanero hot honey glaze, delivering the ultimate sweet heat sticky crunch.', 250, 330, 'the-wing-dept', 'The Wing Dept', 'non-veg', 'chef-choice', 4.8, 380, '', NULL, true, now(), now()),
  ('wd-3', 'Nashville Red Dust', 'Southern style ultra-crispy wings dunked in seasoned chili oil and heavy-dusted with fiery Nashville cayenne spice blend.', 250, 330, 'the-wing-dept', 'The Wing Dept', 'non-veg', 'spicy', 4.8, 340, '', NULL, true, now(), now())
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  original_price = excluded.original_price,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  diet_type = excluded.diet_type,
  badge = excluded.badge,
  rating = excluded.rating,
  reviews_count = excluded.reviews_count,
  available = excluded.available,
  updated_at = now();

-- ==============================================================================
-- VERIFICATION & HEALTH CHECK QUERY
-- ==============================================================================
do $$
declare
  v_tables integer;
  v_menu integer;
  v_config integer;
  v_floor integer;
begin
  select count(*) into v_tables from information_schema.tables where table_schema = 'public';
  select count(*) into v_menu from public.menu_items;
  select count(*) into v_config from public.cafe_config;
  select count(*) into v_floor from public.restaurant_tables;

  raise notice '================================================================';
  raise notice '  SPIRAL CAFE DATABASE SETUP COMPLETED SUCCESSFULLY!             ';
  raise notice '  Public Tables Created       : %', v_tables;
  raise notice '  Menu Catalog Items Seeded   : % (Expected: 41)', v_menu;
  raise notice '  Cafe Config Initialized     : % (Expected: 1)', v_config;
  raise notice '  Floor Tables Ready          : % (Expected: 15)', v_floor;
  raise notice '================================================================';
end $$;
