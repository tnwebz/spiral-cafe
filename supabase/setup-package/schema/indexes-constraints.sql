-- ==============================================================================
-- Spiral Cafe POS — Indexes & Performance Tuning
-- Target: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Orders Indexes
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_table_number on public.orders(table_number);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_session_id on public.orders(customer_session_id);
create index if not exists idx_orders_visit_id on public.orders(visit_id);

-- 2. Order Items Indexes
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);

-- 3. Customers & Sessions Indexes
create index if not exists idx_customers_phone on public.customers(phone_number);
create index if not exists idx_customer_sessions_token on public.customer_sessions(session_token);
create index if not exists idx_customer_sessions_customer_id on public.customer_sessions(customer_id);

-- 4. Restaurant Tables & Reservations Indexes
create index if not exists idx_restaurant_tables_status on public.restaurant_tables(status);
create index if not exists idx_restaurant_tables_active_order on public.restaurant_tables(active_order_id);
create index if not exists idx_table_reservations_table_status on public.table_reservations(table_number, status);
create index if not exists idx_table_reservations_session on public.table_reservations(customer_session_id);
create index if not exists idx_table_reservations_expires on public.table_reservations(expires_at);
create index if not exists idx_table_reservations_visit_id on public.table_reservations(visit_id);

-- 5. KOTs & Print Attempts Indexes
create index if not exists idx_kots_order_id on public.kots(order_id);
create index if not exists idx_kots_table_number on public.kots(table_number);
create index if not exists idx_kots_status on public.kots(status);
create index if not exists idx_print_attempts_kot_id on public.print_attempts(kot_id);
create index if not exists idx_print_attempts_order_id on public.print_attempts(order_id);

-- 6. Invoices & Billing Indexes
create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);
create index if not exists idx_invoices_secure_token on public.invoices(secure_token);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);

-- 7. Menu Items & Discovery Indexes
create index if not exists idx_menu_items_category on public.menu_items(category_id);
create index if not exists idx_menu_items_available on public.menu_items(available);
create index if not exists idx_menu_items_diet_type on public.menu_items(diet_type);

-- 8. Audit & Settlements Indexes
create index if not exists idx_audit_logs_timestamp on public.audit_logs(timestamp desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_settlements_date on public.settlements(date desc);

-- 9. Payments Gateway Indexes
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_provider_payment_id on public.payments(provider_payment_id);
create index if not exists idx_payments_status on public.payments(status);
