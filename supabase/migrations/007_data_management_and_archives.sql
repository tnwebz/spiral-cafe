-- ==============================================================================
-- Migration 007: Spiral Cafe Data Management, Archiving & Permanent Analytics
-- ==============================================================================

-- 1. Permanent Daily Analytics Summaries (Preserves lifetime business metrics)
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

create index if not exists idx_analytics_daily_date on public.analytics_daily_summaries(date);

-- 2. Permanent Product Sold Summaries (Preserves product-level sales history)
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

create index if not exists idx_analytics_prod_date on public.analytics_product_summaries(date);
create index if not exists idx_analytics_prod_cat on public.analytics_product_summaries(category_name);
create index if not exists idx_analytics_prod_name on public.analytics_product_summaries(product_name);

-- 3. Data Archives Audit Registry (Authoritative track of all verified exports)
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

create index if not exists idx_archives_registry_status on public.data_archives_registry(export_status);
create index if not exists idx_archives_registry_dates on public.data_archives_registry(start_date, end_date);

-- 4. PostgreSQL Database Storage Measurement RPC Function
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

-- Grant execution to authenticated & service_role
grant execute on function public.get_database_storage_stats() to service_role;
grant execute on function public.get_database_storage_stats() to anon;
grant execute on function public.get_database_storage_stats() to authenticated;
