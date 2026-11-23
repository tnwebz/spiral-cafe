-- ==============================================================================
-- Migration 008: FIFO Stock Costing, Inventory Purchases, and Table Transfers
-- Spiral Cafe POS System
-- Target: PostgreSQL 15+ / Supabase
-- Idempotent & Safe for repeat execution (IF NOT EXISTS)
-- ==============================================================================

-- 1. INVENTORY MASTER CATALOG FIFO COSTING COLUMNS
-- Baseline unit cost in ₹ per counting unit (used as initial FIFO layer / standard cost)
alter table public.inventory_ingredients add column if not exists cost_per_unit numeric(12,2) default null;

-- 2. DAILY INVENTORY REGISTER VALUE ROLLUPS
-- Real-time & finalized day-level monetary valuation totals
alter table public.inventory_days add column if not exists total_closing_stock_value numeric(12,2) default 0.00;
alter table public.inventory_days add column if not exists total_used_value numeric(12,2) default 0.00;
alter table public.inventory_days add column if not exists total_wastage_value numeric(12,2) default 0.00;
alter table public.inventory_days add column if not exists total_purchase_value numeric(12,2) default 0.00;

-- 3. DAILY INVENTORY LINE ITEMS FIFO BREAKDOWN & BATCH TRACKING
-- Support for multi-layer FIFO purchase batches, historical pricing, and detailed valuation
alter table public.inventory_day_items add column if not exists unit_cost numeric(12,2) default null;
alter table public.inventory_day_items add column if not exists opening_stock_value numeric(12,2) default 0.00;
alter table public.inventory_day_items add column if not exists total_purchase_cost numeric(12,2) default 0.00;
alter table public.inventory_day_items add column if not exists closing_stock_value numeric(12,2) default 0.00;
alter table public.inventory_day_items add column if not exists used_cost numeric(12,2) default 0.00;
alter table public.inventory_day_items add column if not exists wastage_cost numeric(12,2) default 0.00;
alter table public.inventory_day_items add column if not exists used_breakdown text default null;
alter table public.inventory_day_items add column if not exists closing_breakdown text default null;
alter table public.inventory_day_items add column if not exists wastage_breakdown text default null;
alter table public.inventory_day_items add column if not exists latest_purchase_price numeric(12,2) default null;
alter table public.inventory_day_items add column if not exists avg_purchase_price numeric(12,2) default null;
alter table public.inventory_day_items add column if not exists purchase_entries jsonb default '[]'::jsonb;
alter table public.inventory_day_items add column if not exists available_batches jsonb default '[]'::jsonb;
alter table public.inventory_day_items add column if not exists closing_batches jsonb default '[]'::jsonb;

-- 4. INDIVIDUAL INVENTORY PURCHASES & FIFO BATCH AUDIT LEDGER
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

create index if not exists idx_inv_purchases_ing_date on public.inventory_purchases(ingredient_id, date);
create index if not exists idx_inv_purchases_date on public.inventory_purchases(date);

alter table public.inventory_purchases enable row level security;

do $$
begin
  drop policy if exists "Enable all for inventory purchases" on public.inventory_purchases;
  create policy "Enable all for inventory purchases" on public.inventory_purchases
    for all using (true) with check (true);
exception
  when others then null;
end $$;

-- 5. ORDERS ENHANCEMENTS (Private Orders, Multi-purpose & Financial Breakdown)
alter table public.orders add column if not exists order_type text not null default 'CUSTOMER' check (order_type in ('CUSTOMER', 'PRIVATE'));
alter table public.orders add column if not exists private_purpose text;
alter table public.orders add column if not exists private_note text;
alter table public.orders add column if not exists discount numeric(10,2) not null default 0.00;
alter table public.orders add column if not exists change_due numeric(10,2) not null default 0.00;
alter table public.orders add column if not exists customer_name text;

create index if not exists idx_orders_order_type on public.orders(order_type);

-- 6. ORDER ITEMS ENHANCEMENTS (Dine-In vs Takeaway Parcel Tagging & Cooking Rounds)
alter table public.order_items add column if not exists order_type text not null default 'DINE_IN' check (order_type in ('DINE_IN', 'TAKEAWAY'));
alter table public.order_items add column if not exists round integer not null default 1 check (round >= 1);

create index if not exists idx_order_items_order_type on public.order_items(order_type);
create index if not exists idx_order_items_round on public.order_items(round);

-- 7. TABLE TRANSFER REQUESTS (Admin Counter Approval & Customer Live Sync)
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

create index if not exists idx_table_transfers_from_to on public.table_transfer_requests(from_table, to_table);
create index if not exists idx_table_transfers_status on public.table_transfer_requests(status);
create index if not exists idx_table_transfers_session on public.table_transfer_requests(customer_session_id);

alter table public.table_transfer_requests enable row level security;

do $$
begin
  drop policy if exists "Enable all for table transfers" on public.table_transfer_requests;
  create policy "Enable all for table transfers" on public.table_transfer_requests
    for all using (true) with check (true);
exception
  when others then null;
end $$;
