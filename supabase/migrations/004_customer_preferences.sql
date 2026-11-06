-- Migration 004: Customer Preferences & 30-Day Returning Customer Sessions
-- Compatible with PostgreSQL & Supabase

-- Add food_preference column to customers table if it doesn't already exist
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'customers' and column_name = 'food_preference'
  ) then
    alter table public.customers add column food_preference text default 'ALL';
  end if;
end $$;

-- Index for phone queries
create index if not exists idx_customers_phone_number on public.customers(phone_number);

