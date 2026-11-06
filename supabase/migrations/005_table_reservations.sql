-- Migration 005: Table Reservations, 10-Minute Lock, 5-Color Table Architecture, and Visit Isolation
-- Compatible with PostgreSQL & Supabase

-- 1. Add visit_id column to orders table if not present
alter table public.orders add column if not exists visit_id text;
create index if not exists idx_orders_visit_id on public.orders(visit_id);

-- 2. Table Reservations Table
create table if not exists public.table_reservations (
  id text primary key,
  table_number text not null,
  customer_session_id text not null,
  customer_phone text,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXPIRED', 'CONVERTED', 'RELEASED', 'TRANSFERRED')),
  visit_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_table_reservations_table_status on public.table_reservations(table_number, status);
create index if not exists idx_table_reservations_session on public.table_reservations(customer_session_id);
create index if not exists idx_table_reservations_expires on public.table_reservations(expires_at);

-- 3. Update restaurant_tables status check to include 'RESERVED'
-- Drop existing check constraint if present and replace
do $$
begin
  alter table public.restaurant_tables drop constraint if exists restaurant_tables_status_check;
  alter table public.restaurant_tables add constraint restaurant_tables_status_check check (
    status in ('AVAILABLE', 'RESERVED', 'NEW_ORDER', 'ACTION_NEEDED', 'KOT_SENT')
  );
exception
  when others then null;
end $$;

-- 4. RLS for table_reservations
alter table public.table_reservations enable row level security;

do $$
begin
  drop policy if exists "Enable all for anon reservations" on public.table_reservations;
  create policy "Enable all for anon reservations" on public.table_reservations
    for all using (true) with check (true);
exception
  when others then null;
end $$;

