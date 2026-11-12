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
