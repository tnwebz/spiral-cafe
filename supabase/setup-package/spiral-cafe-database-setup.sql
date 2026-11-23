-- ==============================================================================
-- SPIRAL CAFE POS — CONSOLIDATED MASTER SUPABASE DATABASE SETUP SCRIPT
-- Version: 2.0 (Full FIFO Costing, QR Ordering, Table Transfers, Archives)
-- Target Engine: PostgreSQL 15+ / Supabase
-- Execution: Can be run all-at-once in Supabase SQL Editor on a clean project.
-- Idempotency: Completely safe to run multiple times (IF NOT EXISTS / DO NOTHING).
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 2. CORE CONFIGURATION & MENU TABLES
-- ==============================================================================

-- 2.1 Cafe Configuration Singleton
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

-- 2.2 Menu Items Catalog
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

-- 2.3 Customers Ledger
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

-- 2.4 Customer Visit Sessions (QR Guest Isolation)
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
-- 3. ORDERS & ORDER ITEMS
-- ==============================================================================

-- 3.1 Orders Ledger (Customer Dine-In, Takeaway & Private Orders)
create table if not exists public.orders (
  id text primary key,
  order_number text unique not null,
  table_number text not null,
  visit_id text,
  customer_session_id text references public.customer_sessions(id) on delete set null,
  customer_id text references public.customers(id) on delete set null,
  customer_phone text,
  customer_name text,
  order_type text not null default 'CUSTOMER' check (order_type in ('CUSTOMER', 'PRIVATE')),
  private_purpose text,
  private_note text,
  subtotal numeric(10,2) not null default 0.00,
  tax numeric(10,2) not null default 0.00,
  packaging_fee numeric(10,2) not null default 0.00,
  service_charge numeric(10,2) not null default 0.00,
  discount numeric(10,2) not null default 0.00,
  grand_total numeric(10,2) not null default 0.00,
  change_due numeric(10,2) not null default 0.00,
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

-- 3.2 Order Items Line Ledger
create table if not exists public.order_items (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  order_type text not null default 'DINE_IN' check (order_type in ('DINE_IN', 'TAKEAWAY')),
  round integer not null default 1 check (round >= 1),
  image text default '',
  notes text
);

-- ==============================================================================
-- 4. TABLES, RESERVATIONS & TRANSFERS
-- ==============================================================================

-- 4.1 Restaurant Tables (Floor Management & 5-Color System)
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

-- 4.2 Table Reservations (10-Minute Hold & Customer Session Lock)
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

-- 4.3 Table Transfer Requests (Customer Request & Admin Counter Approval)
create table if not exists public.table_transfer_requests (
  id text primary key,
  from_table text not null,
  to_table text not null,
  customer_session_id text not null,
  customer_phone text,
  order_count integer not null default 0,
  current_bill numeric(10,2) not null default 0.00,
  requested_at timestamptz not null default now(),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  decision_by text,
  decision_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 5. KOT & HARDWARE PRINTER LOGGING
-- ==============================================================================

-- 5.1 Kitchen Order Tickets (KOT Lifecycle)
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

-- 5.2 Hardware Print Attempts Ledger
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

-- 5.3 Hardware Printer Settings Singleton
create table if not exists public.printer_settings (
  id integer primary key default 1 check (id = 1),
  printer_model text not null default 'CN811-UEWB',
  interface_type text not null default 'ETHERNET' check (interface_type in ('ETHERNET', 'WIFI', 'USB', 'BLUETOOTH')),
  ip_address text not null default '192.168.1.50',
  port integer not null default 9100,
  paper_width_mm integer not null default 80,
  qz_printer_name text not null default 'CN811-UEWB',
  terminal_name text not null default 'Billing 1',
  auto_cut boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 6. BILLING, PAYMENTS & AUDIT TRAILS
-- ==============================================================================

-- 6.1 Online & Digital Payments Ledger
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

-- 6.2 Invoices (Immutable Billing Records)
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

-- 6.3 Invoice Items (Immutable Snapshots)
create table if not exists public.invoice_items (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  product_id text,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) not null check (line_total >= 0)
);

-- 6.4 Register Closures & Cash Settlements
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

-- 6.5 System & Order Audit Logs
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

-- ==============================================================================
-- 7. INVENTORY MANAGEMENT & FIFO COSTING
-- ==============================================================================

-- 7.1 Inventory Categories (A through H)
create table if not exists public.inventory_categories (
  id text primary key,
  code text not null unique,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7.2 Inventory Ingredients Master Catalog (69 Items with Baseline FIFO Cost)
create table if not exists public.inventory_ingredients (
  id text primary key,
  item_number integer not null,
  name text not null,
  category_id text not null references public.inventory_categories(id) on update cascade,
  unit text not null default 'kg',
  cost_per_unit numeric(12,2) default null,
  purchase_unit text,
  package_conversion_ratio numeric default null,
  min_stock_level numeric not null default 0,
  display_order integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7.3 Daily Inventory Registers (One register per cafe date)
create table if not exists public.inventory_days (
  id text primary key,
  date date not null unique,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'COUNTING', 'READY_FOR_REVIEW', 'FINALIZED')),
  checked_by text,
  finalized_by text,
  finalized_at timestamptz,
  total_active_ingredients integer not null default 0,
  counted_ingredients integer not null default 0,
  total_closing_stock_value numeric(12,2) default 0.00,
  total_used_value numeric(12,2) default 0.00,
  total_wastage_value numeric(12,2) default 0.00,
  total_purchase_value numeric(12,2) default 0.00,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7.4 Daily Inventory Line Items (Register & Physical Checklist with FIFO Valuation)
create table if not exists public.inventory_day_items (
  id text primary key,
  inventory_day_id text not null references public.inventory_days(id) on delete cascade,
  ingredient_id text not null references public.inventory_ingredients(id) on update cascade,
  ingredient_number integer not null default 0,
  ingredient_name text not null,
  category_id text not null,
  category_name text not null,
  unit text not null default 'kg',
  opening_qty numeric not null default 0 check (opening_qty >= 0),
  purchased_qty numeric not null default 0 check (purchased_qty >= 0),
  wastage_qty numeric not null default 0 check (wastage_qty >= 0),
  closing_actual_qty numeric check (closing_actual_qty is null or closing_actual_qty >= 0),
  calculated_used_qty numeric,
  unit_cost numeric(12,2) default null,
  opening_stock_value numeric(12,2) default 0.00,
  total_purchase_cost numeric(12,2) default 0.00,
  closing_stock_value numeric(12,2) default 0.00,
  used_cost numeric(12,2) default 0.00,
  wastage_cost numeric(12,2) default 0.00,
  used_breakdown text default null,
  closing_breakdown text default null,
  wastage_breakdown text default null,
  latest_purchase_price numeric(12,2) default null,
  avg_purchase_price numeric(12,2) default null,
  purchase_entries jsonb default '[]'::jsonb,
  available_batches jsonb default '[]'::jsonb,
  closing_batches jsonb default '[]'::jsonb,
  is_counted boolean not null default false,
  counted_by text,
  counted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7.5 Inventory Purchases Ledger (FIFO Batches with Historical Unit Prices)
create table if not exists public.inventory_purchases (
  id text primary key,
  ingredient_id text not null references public.inventory_ingredients(id) on update cascade,
  ingredient_name text,
  date date not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  price_per_unit numeric not null check (price_per_unit >= 0),
  total_cost numeric not null check (total_cost >= 0),
  supplier text,
  recorded_by text default 'Staff',
  notes text,
  created_at timestamptz not null default now()
);

-- 7.6 Individual Stock Movements (Purchases, Wastage & Manual Adjustments)
create table if not exists public.inventory_movements (
  id text primary key,
  inventory_day_id text references public.inventory_days(id) on delete set null,
  ingredient_id text not null references public.inventory_ingredients(id) on update cascade,
  date date not null default current_date,
  movement_type text not null check (movement_type in ('PURCHASE', 'WASTAGE', 'ADJUSTMENT')),
  quantity numeric not null check (quantity > 0),
  unit text not null,
  reason text,
  supplier text,
  cost numeric,
  recorded_by text not null default 'Staff',
  notes text,
  created_at timestamptz not null default now()
);

-- 7.7 Inventory Audit Trail
create table if not exists public.inventory_audit_logs (
  id text primary key,
  inventory_day_id text,
  action text not null,
  actor_name text not null,
  actor_role text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 8. DATA MANAGEMENT, ARCHIVING & PERMANENT ANALYTICS SUMMARIES
-- ==============================================================================

-- 8.1 Permanent Daily Analytics Summaries (Lifetime Business Metrics)
create table if not exists public.analytics_daily_summaries (
  date date primary key,
  total_orders integer not null default 0 check (total_orders >= 0),
  completed_orders integer not null default 0 check (completed_orders >= 0),
  cancelled_orders integer not null default 0 check (cancelled_orders >= 0),
  gross_sales numeric(12,2) not null default 0.00 check (gross_sales >= 0),
  net_sales numeric(12,2) not null default 0.00 check (net_sales >= 0),
  tax_collected numeric(12,2) not null default 0.00 check (tax_collected >= 0),
  packaging_fees numeric(12,2) not null default 0.00 check (packaging_fees >= 0),
  service_charges numeric(12,2) not null default 0.00 check (service_charges >= 0),
  discounts numeric(12,2) not null default 0.00 check (discounts >= 0),
  cash_sales numeric(12,2) not null default 0.00 check (cash_sales >= 0),
  online_sales numeric(12,2) not null default 0.00 check (online_sales >= 0),
  unpaid_sales numeric(12,2) not null default 0.00 check (unpaid_sales >= 0),
  customer_orders_count integer not null default 0 check (customer_orders_count >= 0),
  customer_sales numeric(12,2) not null default 0.00 check (customer_sales >= 0),
  private_orders_count integer not null default 0 check (private_orders_count >= 0),
  private_sales numeric(12,2) not null default 0.00 check (private_sales >= 0),
  takeaway_orders_count integer not null default 0 check (takeaway_orders_count >= 0),
  takeaway_sales numeric(12,2) not null default 0.00 check (takeaway_sales >= 0),
  dine_in_orders_count integer not null default 0 check (dine_in_orders_count >= 0),
  dine_in_sales numeric(12,2) not null default 0.00 check (dine_in_sales >= 0),
  archived_at timestamptz not null default now(),
  archive_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8.2 Permanent Product Sales Summaries (Lifetime Product Analytics)
create table if not exists public.analytics_product_summaries (
  id text primary key,
  date date not null references public.analytics_daily_summaries(date) on delete cascade,
  product_id text not null,
  product_name text not null,
  category_name text not null,
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  total_revenue numeric(12,2) not null default 0.00 check (total_revenue >= 0),
  unit_price numeric(10,2) not null default 0.00 check (unit_price >= 0),
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

-- 8.3 Data Archives Registry (Verified Export & Encrypted Backup Ledger)
create table if not exists public.data_archives_registry (
  id text primary key,
  archive_filename text not null,
  start_date date not null,
  end_date date not null,
  eligible_orders_count integer not null default 0,
  order_items_count integer not null default 0,
  invoices_count integer not null default 0,
  settlements_count integer not null default 0,
  total_revenue numeric(12,2) not null default 0.00,
  checksum_sha256 text not null,
  encryption_algorithm text not null default 'AES-GCM-256',
  export_status text not null default 'EXPORTED' check (export_status in ('EXPORTED', 'VERIFIED', 'PURGED', 'RESTORED')),
  exported_by text not null default 'Admin',
  exported_at timestamptz not null default now(),
  verified_at timestamptz,
  purged_at timestamptz,
  manifest_preview jsonb default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 9. PERFORMANCE INDEXES
-- ==============================================================================
create index if not exists idx_orders_table_status on public.orders(table_number, status);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_created_at on public.orders(created_at);
create index if not exists idx_orders_session on public.orders(customer_session_id);
create index if not exists idx_orders_visit_id on public.orders(visit_id);
create index if not exists idx_orders_order_type on public.orders(order_type);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);
create index if not exists idx_order_items_order_type on public.order_items(order_type);
create index if not exists idx_order_items_round on public.order_items(round);

create index if not exists idx_invoices_order on public.invoices(order_id);
create index if not exists idx_invoices_table on public.invoices(table_number);
create index if not exists idx_invoices_created on public.invoices(created_at);
create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id);

create index if not exists idx_settlements_date on public.settlements(date);
create index if not exists idx_payments_order on public.payments(order_id);

create index if not exists idx_table_reservations_table_status on public.table_reservations(table_number, status);
create index if not exists idx_table_reservations_session on public.table_reservations(customer_session_id);
create index if not exists idx_table_reservations_expires on public.table_reservations(expires_at);

create index if not exists idx_table_transfers_from_to on public.table_transfer_requests(from_table, to_table);
create index if not exists idx_table_transfers_status on public.table_transfer_requests(status);
create index if not exists idx_table_transfers_session on public.table_transfer_requests(customer_session_id);

create index if not exists idx_kots_order_id on public.kots(order_id);
create index if not exists idx_kots_table_number on public.kots(table_number);
create index if not exists idx_kots_status on public.kots(status);
create index if not exists idx_print_attempts_kot_id on public.print_attempts(kot_id);

create index if not exists idx_inv_cats_order on public.inventory_categories(display_order);
create unique index if not exists idx_inv_ing_cat_name on public.inventory_ingredients(category_id, lower(trim(name))) where is_active = true;
create index if not exists idx_inv_ing_order on public.inventory_ingredients(display_order);
create index if not exists idx_inv_ing_number on public.inventory_ingredients(item_number);

create index if not exists idx_inv_days_date on public.inventory_days(date);
create index if not exists idx_inv_days_status on public.inventory_days(status);
create unique index if not exists idx_inv_day_items_day_ing on public.inventory_day_items(inventory_day_id, ingredient_id);
create index if not exists idx_inv_day_items_day_cat on public.inventory_day_items(inventory_day_id, category_id);

create index if not exists idx_inv_purchases_ing_date on public.inventory_purchases(ingredient_id, date);
create index if not exists idx_inv_purchases_date on public.inventory_purchases(date);

create index if not exists idx_inv_movements_ing_date on public.inventory_movements(ingredient_id, date);
create index if not exists idx_inv_movements_type on public.inventory_movements(movement_type);
create index if not exists idx_inv_audit_day on public.inventory_audit_logs(inventory_day_id);

create index if not exists idx_analytics_daily_date on public.analytics_daily_summaries(date);
create index if not exists idx_analytics_prod_date on public.analytics_product_summaries(date);
create index if not exists idx_analytics_prod_cat on public.analytics_product_summaries(category_name);
create index if not exists idx_analytics_prod_name on public.analytics_product_summaries(product_name);

create index if not exists idx_archives_registry_status on public.data_archives_registry(export_status);
create index if not exists idx_archives_registry_dates on public.data_archives_registry(start_date, end_date);

-- ==============================================================================
-- 10. DATABASE FUNCTIONS & AUTOMATIC TRIGGERS
-- ==============================================================================

-- 10.1 Auto-update updated_at timestamp function
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply triggers
do $$
begin
  drop trigger if exists trg_cafe_config_updated_at on public.cafe_config;
  create trigger trg_cafe_config_updated_at before update on public.cafe_config for each row execute function public.set_updated_at();

  drop trigger if exists trg_menu_items_updated_at on public.menu_items;
  create trigger trg_menu_items_updated_at before update on public.menu_items for each row execute function public.set_updated_at();

  drop trigger if exists trg_orders_updated_at on public.orders;
  create trigger trg_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

  drop trigger if exists trg_customers_updated_at on public.customers;
  create trigger trg_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();

  drop trigger if exists trg_restaurant_tables_updated_at on public.restaurant_tables;
  create trigger trg_restaurant_tables_updated_at before update on public.restaurant_tables for each row execute function public.set_updated_at();

  drop trigger if exists trg_table_reservations_updated_at on public.table_reservations;
  create trigger trg_table_reservations_updated_at before update on public.table_reservations for each row execute function public.set_updated_at();

  drop trigger if exists trg_table_transfers_updated_at on public.table_transfer_requests;
  create trigger trg_table_transfers_updated_at before update on public.table_transfer_requests for each row execute function public.set_updated_at();

  drop trigger if exists trg_kots_updated_at on public.kots;
  create trigger trg_kots_updated_at before update on public.kots for each row execute function public.set_updated_at();

  drop trigger if exists trg_inventory_categories_updated_at on public.inventory_categories;
  create trigger trg_inventory_categories_updated_at before update on public.inventory_categories for each row execute function public.set_updated_at();

  drop trigger if exists trg_inventory_ingredients_updated_at on public.inventory_ingredients;
  create trigger trg_inventory_ingredients_updated_at before update on public.inventory_ingredients for each row execute function public.set_updated_at();

  drop trigger if exists trg_inventory_days_updated_at on public.inventory_days;
  create trigger trg_inventory_days_updated_at before update on public.inventory_days for each row execute function public.set_updated_at();

  drop trigger if exists trg_inventory_day_items_updated_at on public.inventory_day_items;
  create trigger trg_inventory_day_items_updated_at before update on public.inventory_day_items for each row execute function public.set_updated_at();

  drop trigger if exists trg_analytics_daily_updated_at on public.analytics_daily_summaries;
  create trigger trg_analytics_daily_updated_at before update on public.analytics_daily_summaries for each row execute function public.set_updated_at();
exception
  when others then null;
end $$;

-- 10.2 Database Storage Measurement RPC Function
create or replace function public.get_database_storage_stats()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_db_size bigint;
  v_tables jsonb;
begin
  select pg_database_size(current_database()) into v_db_size;

  select jsonb_agg(
    jsonb_build_object(
      'table_name', t.table_name,
      'total_bytes', pg_total_relation_size('"' || t.table_schema || '"."' || t.table_name || '"'),
      'table_bytes', pg_relation_size('"' || t.table_schema || '"."' || t.table_name || '"'),
      'index_bytes', pg_indexes_size('"' || t.table_schema || '"."' || t.table_name || '"'),
      'estimated_rows', coalesce(s.n_live_tup, 0)
    ) order by pg_total_relation_size('"' || t.table_schema || '"."' || t.table_name || '"') desc
  )
  into v_tables
  from information_schema.tables t
  left join pg_stat_user_tables s on s.schemaname = t.table_schema and s.relname = t.table_name
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE';

  return jsonb_build_object(
    'database_size_bytes', v_db_size,
    'measured_at', now(),
    'tables', coalesce(v_tables, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_database_storage_stats() to service_role;
grant execute on function public.get_database_storage_stats() to anon;
grant execute on function public.get_database_storage_stats() to authenticated;

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.cafe_config enable row level security;
alter table public.menu_items enable row level security;
alter table public.customers enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.table_reservations enable row level security;
alter table public.table_transfer_requests enable row level security;
alter table public.kots enable row level security;
alter table public.print_attempts enable row level security;
alter table public.printer_settings enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.settlements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.inventory_categories enable row level security;
alter table public.inventory_ingredients enable row level security;
alter table public.inventory_days enable row level security;
alter table public.inventory_day_items enable row level security;
alter table public.inventory_purchases enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_audit_logs enable row level security;
alter table public.analytics_daily_summaries enable row level security;
alter table public.analytics_product_summaries enable row level security;
alter table public.data_archives_registry enable row level security;

-- Permissive service role and application policies
do $$
begin
  -- cafe_config
  drop policy if exists "Enable all for cafe_config" on public.cafe_config;
  create policy "Enable all for cafe_config" on public.cafe_config for all using (true) with check (true);

  -- menu_items
  drop policy if exists "Enable all for menu_items" on public.menu_items;
  create policy "Enable all for menu_items" on public.menu_items for all using (true) with check (true);

  -- customers
  drop policy if exists "Enable all for customers" on public.customers;
  create policy "Enable all for customers" on public.customers for all using (true) with check (true);

  -- customer_sessions
  drop policy if exists "Enable all for customer_sessions" on public.customer_sessions;
  create policy "Enable all for customer_sessions" on public.customer_sessions for all using (true) with check (true);

  -- orders
  drop policy if exists "Enable all for orders" on public.orders;
  create policy "Enable all for orders" on public.orders for all using (true) with check (true);

  -- order_items
  drop policy if exists "Enable all for order_items" on public.order_items;
  create policy "Enable all for order_items" on public.order_items for all using (true) with check (true);

  -- restaurant_tables
  drop policy if exists "Enable all for restaurant_tables" on public.restaurant_tables;
  create policy "Enable all for restaurant_tables" on public.restaurant_tables for all using (true) with check (true);

  -- table_reservations
  drop policy if exists "Enable all for table_reservations" on public.table_reservations;
  create policy "Enable all for table_reservations" on public.table_reservations for all using (true) with check (true);

  -- table_transfer_requests
  drop policy if exists "Enable all for table_transfer_requests" on public.table_transfer_requests;
  create policy "Enable all for table_transfer_requests" on public.table_transfer_requests for all using (true) with check (true);

  -- kots
  drop policy if exists "Enable all for kots" on public.kots;
  create policy "Enable all for kots" on public.kots for all using (true) with check (true);

  -- print_attempts
  drop policy if exists "Enable all for print_attempts" on public.print_attempts;
  create policy "Enable all for print_attempts" on public.print_attempts for all using (true) with check (true);

  -- printer_settings
  drop policy if exists "Enable all for printer_settings" on public.printer_settings;
  create policy "Enable all for printer_settings" on public.printer_settings for all using (true) with check (true);

  -- payments
  drop policy if exists "Enable all for payments" on public.payments;
  create policy "Enable all for payments" on public.payments for all using (true) with check (true);

  -- invoices
  drop policy if exists "Enable all for invoices" on public.invoices;
  create policy "Enable all for invoices" on public.invoices for all using (true) with check (true);

  -- invoice_items
  drop policy if exists "Enable all for invoice_items" on public.invoice_items;
  create policy "Enable all for invoice_items" on public.invoice_items for all using (true) with check (true);

  -- settlements
  drop policy if exists "Enable all for settlements" on public.settlements;
  create policy "Enable all for settlements" on public.settlements for all using (true) with check (true);

  -- audit_logs
  drop policy if exists "Enable all for audit_logs" on public.audit_logs;
  create policy "Enable all for audit_logs" on public.audit_logs for all using (true) with check (true);

  -- inventory_categories
  drop policy if exists "Enable all for inventory_categories" on public.inventory_categories;
  create policy "Enable all for inventory_categories" on public.inventory_categories for all using (true) with check (true);

  -- inventory_ingredients
  drop policy if exists "Enable all for inventory_ingredients" on public.inventory_ingredients;
  create policy "Enable all for inventory_ingredients" on public.inventory_ingredients for all using (true) with check (true);

  -- inventory_days
  drop policy if exists "Enable all for inventory_days" on public.inventory_days;
  create policy "Enable all for inventory_days" on public.inventory_days for all using (true) with check (true);

  -- inventory_day_items
  drop policy if exists "Enable all for inventory_day_items" on public.inventory_day_items;
  create policy "Enable all for inventory_day_items" on public.inventory_day_items for all using (true) with check (true);

  -- inventory_purchases
  drop policy if exists "Enable all for inventory_purchases" on public.inventory_purchases;
  create policy "Enable all for inventory_purchases" on public.inventory_purchases for all using (true) with check (true);

  -- inventory_movements
  drop policy if exists "Enable all for inventory_movements" on public.inventory_movements;
  create policy "Enable all for inventory_movements" on public.inventory_movements for all using (true) with check (true);

  -- inventory_audit_logs
  drop policy if exists "Enable all for inventory_audit_logs" on public.inventory_audit_logs;
  create policy "Enable all for inventory_audit_logs" on public.inventory_audit_logs for all using (true) with check (true);

  -- analytics_daily_summaries
  drop policy if exists "Enable all for analytics_daily_summaries" on public.analytics_daily_summaries;
  create policy "Enable all for analytics_daily_summaries" on public.analytics_daily_summaries for all using (true) with check (true);

  -- analytics_product_summaries
  drop policy if exists "Enable all for analytics_product_summaries" on public.analytics_product_summaries;
  create policy "Enable all for analytics_product_summaries" on public.analytics_product_summaries for all using (true) with check (true);

  -- data_archives_registry
  drop policy if exists "Enable all for data_archives_registry" on public.data_archives_registry;
  create policy "Enable all for data_archives_registry" on public.data_archives_registry for all using (true) with check (true);
exception
  when others then null;
end $$;

-- ==============================================================================
-- 12. SUPABASE REALTIME REPLICATION PUBLICATION
-- ==============================================================================
do $$
begin
  alter publication supabase_realtime add table public.orders;
  alter publication supabase_realtime add table public.order_items;
  alter publication supabase_realtime add table public.restaurant_tables;
  alter publication supabase_realtime add table public.table_reservations;
  alter publication supabase_realtime add table public.table_transfer_requests;
  alter publication supabase_realtime add table public.kots;
  alter publication supabase_realtime add table public.print_attempts;
exception
  when others then null;
end $$;
