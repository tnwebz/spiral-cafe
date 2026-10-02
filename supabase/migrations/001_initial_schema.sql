-- Spiral Cafe Initial Schema Migration
-- Designed for Supabase PostgreSQL with Realtime & RLS Readiness

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. CAFE CONFIG (Singleton Configuration)
-- ============================================================================
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

-- ============================================================================
-- 2. MENU ITEMS
-- ============================================================================
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
  image text not null,
  cloudinary_public_id text,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 3. CUSTOMERS
-- ============================================================================
create table if not exists public.customers (
  id text primary key,
  phone_number text unique not null,
  name text,
  service_sms_consent boolean not null default true,
  marketing_consent boolean not null default false,
  total_orders integer not null default 0 check (total_orders >= 0),
  total_spent numeric(10,2) not null default 0.00 check (total_spent >= 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 4. CUSTOMER SESSIONS
-- ============================================================================
create table if not exists public.customer_sessions (
  id text primary key,
  customer_id text references public.customers(id) on delete set null,
  customer_phone text,
  table_number text not null,
  session_token text unique not null,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

-- ============================================================================
-- 5. ORDERS
-- ============================================================================
create table if not exists public.orders (
  id text primary key,
  order_number text unique not null,
  table_number text not null,
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

-- ============================================================================
-- 6. ORDER ITEMS (Normalized from Order)
-- ============================================================================
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

-- ============================================================================
-- 7. INVOICES
-- ============================================================================
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

-- ============================================================================
-- 8. INVOICE ITEMS (Normalized Historical Line Items)
-- ============================================================================
create table if not exists public.invoice_items (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  product_id text,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) not null check (line_total >= 0)
);

-- ============================================================================
-- 9. SETTLEMENTS (Daily Register Closures)
-- ============================================================================
create table if not exists public.settlements (
  id text primary key,
  date text not null,
  total_orders integer not null default 0,
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

-- ============================================================================
-- 10. AUDIT LOGS
-- ============================================================================
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

-- ============================================================================
-- INDEXES
-- ============================================================================
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_table_number on public.orders(table_number);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_session_id on public.orders(customer_session_id);

create index if not exists idx_order_items_order_id on public.order_items(order_id);

create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);
create index if not exists idx_invoices_secure_token on public.invoices(secure_token);

create index if not exists idx_customers_phone on public.customers(phone_number);
create index if not exists idx_customer_sessions_token on public.customer_sessions(session_token);

create index if not exists idx_menu_items_category on public.menu_items(category_id);
create index if not exists idx_menu_items_available on public.menu_items(available);

create index if not exists idx_audit_logs_timestamp on public.audit_logs(timestamp desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

create index if not exists idx_settlements_date on public.settlements(date desc);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.cafe_config enable row level security;
alter table public.menu_items enable row level security;
alter table public.customers enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.settlements enable row level security;
alter table public.audit_logs enable row level security;

-- 1. Public Read Policies
create policy "Allow public read menu_items"
  on public.menu_items for select
  using (true);

create policy "Allow public read cafe_config"
  on public.cafe_config for select
  using (true);

create policy "Allow public read invoice by token"
  on public.invoices for select
  using (secure_token is not null);

-- 2. Service Role (Admin / Server) Full Access Policies
-- Note: Supabase service_role key automatically bypasses RLS, but explicit policies ensure consistency:
create policy "Allow full access to service_role on cafe_config" on public.cafe_config for all using (auth.role() = 'service_role');
create policy "Allow full access to service_role on menu_items" on public.menu_items for all using (auth.role() = 'service_role');
create policy "Allow full access to service_role on customers" on public.customers for all using (auth.role() = 'service_role');
create policy "Allow full access to service_role on customer_sessions" on public.customer_sessions for all using (auth.role() = 'service_role');
create policy "Allow full access to service_role on orders" on public.orders for all using (auth.role() = 'service_role');
create policy "Allow full access to service_role on order_items" on public.order_items for all using (auth.role() = 'service_role');
create policy "Allow full access to service_role on invoices" on public.invoices for all using (auth.role() = 'service_role');
create policy "Allow full access to service_role on invoice_items" on public.invoice_items for all using (auth.role() = 'service_role');
create policy "Allow full access to service_role on settlements" on public.settlements for all using (auth.role() = 'service_role');
create policy "Allow full access to service_role on audit_logs" on public.audit_logs for all using (auth.role() = 'service_role');

-- ============================================================================
-- ATOMIC ORDER CREATION RPC FUNCTION (Phase 13)
-- ============================================================================
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
  -- 1. Insert order
  insert into public.orders (
    id,
    order_number,
    table_number,
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
    (order_payload->>'notes'),
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

-- ============================================================================
-- SUPABASE REALTIME REPLICATION SETUP (Phase 10)
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
    alter publication supabase_realtime add table public.order_items;
    alter publication supabase_realtime add table public.menu_items;
  end if;
exception when others then
  null; -- Skip if already added or permission constrained in sub-environment
end;
$$;
