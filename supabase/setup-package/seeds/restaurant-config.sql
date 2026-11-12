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
