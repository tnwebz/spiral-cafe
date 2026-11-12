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
