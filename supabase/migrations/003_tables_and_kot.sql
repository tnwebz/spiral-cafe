-- Migration 003: Restaurant Tables, KOT Lifecycle, and Printer Hardware Settings
-- Compatible with PostgreSQL & Supabase

-- 1. RESTAURANT TABLES TABLE
create table if not exists public.restaurant_tables (
  id text primary key,
  table_number text unique not null,
  capacity integer not null default 4 check (capacity > 0),
  section text not null default 'Dine-In',
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'NEW_ORDER', 'ACTION_NEEDED', 'KOT_SENT')),
  active_order_id text references public.orders(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed default restaurant tables from floor plan
insert into public.restaurant_tables (id, table_number, capacity, section)
values
  ('A1', 'A1', 4, 'Dine-In'),
  ('A2', 'A2', 4, 'Dine-In'),
  ('B1', 'B1', 3, 'Dine-In'),
  ('B2', 'B2', 3, 'Dine-In'),
  ('B3', 'B3', 3, 'Dine-In'),
  ('B4', 'B4', 3, 'Dine-In'),
  ('B5', 'B5', 3, 'Dine-In'),
  ('B6', 'B6', 2, 'Dine-In'),
  ('C1', 'C1', 3, 'Dine-In'),
  ('C2', 'C2', 4, 'Dine-In'),
  ('C3', 'C3', 3, 'Dine-In'),
  ('F1', 'F1', 3, 'Dine-In'),
  ('F2', 'F2', 3, 'Dine-In'),
  ('F3', 'F3', 3, 'Dine-In'),
  ('F4', 'F4', 3, 'Dine-In')
on conflict (table_number) do nothing;

-- 2. KITCHEN ORDER TICKETS (KOTs)
create table if not exists public.kots (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  order_number text not null,
  table_number text not null,
  round integer not null default 1,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'NOT_SENT' check (
    status in ('NOT_SENT', 'PRINTING', 'SENT_UNVERIFIED', 'PRINT_CONFIRMED', 'FAILED', 'UNKNOWN', 'MANUALLY_DELIVERED')
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

create index if not exists idx_kots_order_id on public.kots(order_id);
create index if not exists idx_kots_table_number on public.kots(table_number);
create index if not exists idx_kots_status on public.kots(status);

-- 3. PRINT ATTEMPTS AUDIT LEDGER (Idempotency and Debugging)
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

create index if not exists idx_print_attempts_kot_id on public.print_attempts(kot_id);

-- 4. KITCHEN PRINTER SETTINGS (Singleton)
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

insert into public.printer_settings (id, printer_model, interface_type, ip_address, port, paper_width_mm, qz_printer_name, terminal_name, auto_cut)
values (1, 'CN811-UEWB', 'ETHERNET', '192.168.1.50', 9100, 80, 'CN811-UEWB', 'Billing 1', true)
on conflict (id) do nothing;

-- 5. RLS POLICIES
alter table public.restaurant_tables enable row level security;
alter table public.kots enable row level security;
alter table public.print_attempts enable row level security;
alter table public.printer_settings enable row level security;

create policy "Allow service_role full access on restaurant_tables"
  on public.restaurant_tables for all using (true) with check (true);

create policy "Allow service_role full access on kots"
  on public.kots for all using (true) with check (true);

create policy "Allow service_role full access on print_attempts"
  on public.print_attempts for all using (true) with check (true);

create policy "Allow service_role full access on printer_settings"
  on public.printer_settings for all using (true) with check (true);

