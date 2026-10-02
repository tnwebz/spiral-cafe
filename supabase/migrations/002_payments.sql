-- Migration 002: Payments Ledger Table
-- Provides an optional, detailed audit trail for online and offline payment attempts.
-- Does not alter the core public.orders schema.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  amount numeric(10, 2) not null,
  currency text not null default 'INR',
  status text not null default 'PENDING',
  payment_method text not null default 'ONLINE',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_provider_payment_id on public.payments(provider_payment_id);
create index if not exists idx_payments_status on public.payments(status);

-- Enable Row Level Security
alter table public.payments enable row level security;

-- Allow full access for backend service role operations
create policy "Allow service_role full access on payments"
  on public.payments
  for all
  using (true)
  with check (true);
