-- ==============================================================================
-- Spiral Cafe POS — Realtime Replication Publication
-- Target: PostgreSQL 15+ / Supabase
-- Enables live webhooks/WebSocket streams for Kitchen KDS, Waiter tablets & POS
-- ==============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Orders & Items (Live Kitchen & POS status changes)
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
      alter publication supabase_realtime add table public.orders;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'order_items') then
      alter publication supabase_realtime add table public.order_items;
    end if;

    -- Dynamic Menu Items (Live 86-ing / item availability toggle)
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'menu_items') then
      alter publication supabase_realtime add table public.menu_items;
    end if;

    -- Floor Tables Grid & 5-Color State Indicators
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'restaurant_tables') then
      alter publication supabase_realtime add table public.restaurant_tables;
    end if;

    -- Live KOT Rounds & Printer Delivery Statuses
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'kots') then
      alter publication supabase_realtime add table public.kots;
    end if;

    -- Temporary 10-Minute Table Locks
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'table_reservations') then
      alter publication supabase_realtime add table public.table_reservations;
    end if;
  end if;
exception
  when others then null; -- Graceful degradation in restricted sub-environments
end $$;
