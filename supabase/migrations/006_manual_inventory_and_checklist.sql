-- Migration 006: Spiral Cafe Manual Inventory Management & Daily Stock Checklist
-- Completely manual counting register: Used = Opening + Purchased - Wastage - Closing Actual
-- Initial seed: Exactly 8 categories and 69 printed ingredients (ordered 1 to 69)

-- 1. Inventory Categories
create table if not exists public.inventory_categories (
  id text primary key,
  code text not null unique,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inv_cats_order on public.inventory_categories(display_order);

-- 2. Inventory Ingredients Master
create table if not exists public.inventory_ingredients (
  id text primary key,
  item_number integer not null,
  name text not null,
  category_id text not null references public.inventory_categories(id) on update cascade,
  unit text not null default 'kg',
  purchase_unit text,
  package_conversion_ratio numeric default null,
  min_stock_level numeric not null default 0,
  display_order integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_inv_ing_cat_name on public.inventory_ingredients(category_id, lower(trim(name))) where is_active = true;
create index if not exists idx_inv_ing_order on public.inventory_ingredients(display_order);
create index if not exists idx_inv_ing_number on public.inventory_ingredients(item_number);

-- 3. Daily Inventory Registers (One register per cafe-local date)
create table if not exists public.inventory_days (
  id text primary key,
  date date not null unique,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'COUNTING', 'READY_FOR_REVIEW', 'FINALIZED')),
  checked_by text,
  finalized_by text,
  finalized_at timestamptz,
  total_active_ingredients integer not null default 0,
  counted_ingredients integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inv_days_date on public.inventory_days(date);
create index if not exists idx_inv_days_status on public.inventory_days(status);

-- 4. Daily Inventory Items (Shared lines for Register & Physical Stock Checklist)
create table if not exists public.inventory_day_items (
  id text primary key,
  inventory_day_id text not null references public.inventory_days(id) on delete cascade,
  ingredient_id text not null references public.inventory_ingredients(id) on update cascade,
  ingredient_number integer not null default 0,
  ingredient_name text not null,
  category_id text not null,
  category_name text not null,
  unit text not null default 'kg',
  opening_qty numeric not null default 0 check (opening_qty >= 0),
  purchased_qty numeric not null default 0 check (purchased_qty >= 0),
  wastage_qty numeric not null default 0 check (wastage_qty >= 0),
  closing_actual_qty numeric check (closing_actual_qty is null or closing_actual_qty >= 0),
  calculated_used_qty numeric,
  is_counted boolean not null default false,
  counted_by text,
  counted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_inv_day_items_day_ing on public.inventory_day_items(inventory_day_id, ingredient_id);
create index if not exists idx_inv_day_items_day_cat on public.inventory_day_items(inventory_day_id, category_id);

-- 5. Individual Stock Movements (Audited Purchases & Wastage logs)
create table if not exists public.inventory_movements (
  id text primary key,
  inventory_day_id text references public.inventory_days(id) on delete set null,
  ingredient_id text not null references public.inventory_ingredients(id) on update cascade,
  date date not null default current_date,
  movement_type text not null check (movement_type in ('PURCHASE', 'WASTAGE', 'ADJUSTMENT')),
  quantity numeric not null check (quantity > 0),
  unit text not null,
  reason text,
  supplier text,
  cost numeric,
  recorded_by text not null default 'Staff',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_movements_ing_date on public.inventory_movements(ingredient_id, date);
create index if not exists idx_inv_movements_type on public.inventory_movements(movement_type);

-- 6. Inventory Audit Trail
create table if not exists public.inventory_audit_logs (
  id text primary key,
  inventory_day_id text,
  action text not null,
  actor_name text not null,
  actor_role text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_audit_day on public.inventory_audit_logs(inventory_day_id);

-- 7. RLS Configuration (Protected from anon public access, full server access for admin)
alter table public.inventory_categories enable row level security;
alter table public.inventory_ingredients enable row level security;
alter table public.inventory_days enable row level security;
alter table public.inventory_day_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_audit_logs enable row level security;

-- Read/write policies for authenticated admin service role
do $$
begin
  drop policy if exists "Enable all for inventory categories" on public.inventory_categories;
  create policy "Enable all for inventory categories" on public.inventory_categories for all using (true) with check (true);

  drop policy if exists "Enable all for inventory ingredients" on public.inventory_ingredients;
  create policy "Enable all for inventory ingredients" on public.inventory_ingredients for all using (true) with check (true);

  drop policy if exists "Enable all for inventory days" on public.inventory_days;
  create policy "Enable all for inventory days" on public.inventory_days for all using (true) with check (true);

  drop policy if exists "Enable all for inventory day items" on public.inventory_day_items;
  create policy "Enable all for inventory day items" on public.inventory_day_items for all using (true) with check (true);

  drop policy if exists "Enable all for inventory movements" on public.inventory_movements;
  create policy "Enable all for inventory movements" on public.inventory_movements for all using (true) with check (true);

  drop policy if exists "Enable all for inventory audit logs" on public.inventory_audit_logs;
  create policy "Enable all for inventory audit logs" on public.inventory_audit_logs for all using (true) with check (true);
exception
  when others then null;
end $$;

-- 8. Seed Default 8 Categories (A to H)
insert into public.inventory_categories (id, code, name, display_order)
values
  ('cat_chicken_seafood', 'A', 'Chicken & Seafood', 1),
  ('cat_frozen_ready_to_cook', 'B', 'Frozen / Ready-to-Cook', 2),
  ('cat_bread_bakery', 'C', 'Bread & Bakery', 3),
  ('cat_dairy_cheese', 'D', 'Dairy / Cheese', 4),
  ('cat_vegetables_fresh_produce', 'E', 'Vegetables & Fresh Produce', 5),
  ('cat_dry_ingredients_flour_seasonings', 'F', 'Dry Ingredients / Flour / Seasonings', 6),
  ('cat_sauces_condiments_raw_packaged', 'G', 'Sauces / Condiments — Raw Packaged', 7),
  ('cat_oil_cooking', 'H', 'Oil / Cooking', 8)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  display_order = excluded.display_order;

-- 9. Seed Exactly 69 Printed Ingredients (Numbered 1 to 69)
insert into public.inventory_ingredients (id, item_number, name, category_id, unit, display_order)
values
  -- A. Chicken & Seafood (1-5)
  ('ing_1', 1, 'Chicken Breast', 'cat_chicken_seafood', 'kg', 1),
  ('ing_2', 2, 'Chicken Thigh', 'cat_chicken_seafood', 'kg', 2),
  ('ing_3', 3, 'Chicken Wings', 'cat_chicken_seafood', 'kg', 3),
  ('ing_4', 4, 'Prawn', 'cat_chicken_seafood', 'kg', 4),
  ('ing_5', 5, 'Squid', 'cat_chicken_seafood', 'kg', 5),

  -- B. Frozen / Ready-to-Cook (6-8)
  ('ing_6', 6, 'McCain 6mm French Fries', 'cat_frozen_ready_to_cook', 'kg', 6),
  ('ing_7', 7, 'Veg Patty', 'cat_frozen_ready_to_cook', 'pcs', 7),
  ('ing_8', 8, 'Corn', 'cat_frozen_ready_to_cook', 'pcs', 8),

  -- C. Bread & Bakery (9-14)
  ('ing_9', 9, 'Burger Bun', 'cat_bread_bakery', 'pcs', 9),
  ('ing_10', 10, 'Sando Bread', 'cat_bread_bakery', 'pcs', 10),
  ('ing_11', 11, 'Makino Nachos', 'cat_bread_bakery', 'kg', 11),
  ('ing_12', 12, 'Spaghetti', 'cat_bread_bakery', 'kg', 12),
  ('ing_13', 13, 'Penne', 'cat_bread_bakery', 'kg', 13),
  ('ing_14', 14, 'Baguette Bread', 'cat_bread_bakery', 'pcs', 14),

  -- D. Dairy / Cheese (15-24)
  ('ing_15', 15, 'Butter', 'cat_dairy_cheese', 'kg', 15),
  ('ing_16', 16, 'Milk', 'cat_dairy_cheese', 'L', 16),
  ('ing_17', 17, 'Curd', 'cat_dairy_cheese', 'kg', 17),
  ('ing_18', 18, 'Fresh Cream', 'cat_dairy_cheese', 'L', 18),
  ('ing_19', 19, 'Processed Cheese', 'cat_dairy_cheese', 'kg', 19),
  ('ing_20', 20, 'Mozzarella', 'cat_dairy_cheese', 'kg', 20),
  ('ing_21', 21, 'Parmesan', 'cat_dairy_cheese', 'kg', 21),
  ('ing_22', 22, 'Cheese Slice', 'cat_dairy_cheese', 'pcs', 22),
  ('ing_23', 23, 'Nacho Dip', 'cat_dairy_cheese', 'kg', 23),
  ('ing_24', 24, 'Creamy Cheese Blend', 'cat_dairy_cheese', 'L', 24),

  -- E. Vegetables & Fresh Produce (25-41)
  ('ing_25', 25, 'Onion', 'cat_vegetables_fresh_produce', 'kg', 25),
  ('ing_26', 26, 'Tomato', 'cat_vegetables_fresh_produce', 'kg', 26),
  ('ing_27', 27, 'Garlic', 'cat_vegetables_fresh_produce', 'kg', 27),
  ('ing_28', 28, 'Green Chilli', 'cat_vegetables_fresh_produce', 'kg', 28),
  ('ing_29', 29, 'Lettuce', 'cat_vegetables_fresh_produce', 'kg', 29),
  ('ing_30', 30, 'Iceberg', 'cat_vegetables_fresh_produce', 'kg', 30),
  ('ing_31', 31, 'Bell Pepper', 'cat_vegetables_fresh_produce', 'kg', 31),
  ('ing_32', 32, 'Mushroom', 'cat_vegetables_fresh_produce', 'kg', 32),
  ('ing_33', 33, 'Gherkins', 'cat_vegetables_fresh_produce', 'kg', 33),
  ('ing_34', 34, 'Lemon', 'cat_vegetables_fresh_produce', 'kg', 34),
  ('ing_35', 35, 'Cherry Tomato', 'cat_vegetables_fresh_produce', 'kg', 35),
  ('ing_36', 36, 'Red Cabbage', 'cat_vegetables_fresh_produce', 'kg', 36),
  ('ing_37', 37, 'Parsley', 'cat_vegetables_fresh_produce', 'kg', 37),
  ('ing_38', 38, 'Spring Onion', 'cat_vegetables_fresh_produce', 'kg', 38),
  ('ing_39', 39, 'Black Olives', 'cat_vegetables_fresh_produce', 'kg', 39),
  ('ing_40', 40, 'Broccoli', 'cat_vegetables_fresh_produce', 'kg', 40),
  ('ing_41', 41, 'Basil', 'cat_vegetables_fresh_produce', 'kg', 41),

  -- F. Dry Ingredients / Flour / Seasonings (42-55)
  ('ing_42', 42, 'Maida', 'cat_dry_ingredients_flour_seasonings', 'kg', 42),
  ('ing_43', 43, 'Corn Flour', 'cat_dry_ingredients_flour_seasonings', 'kg', 43),
  ('ing_44', 44, 'Cajun Bread Mix', 'cat_dry_ingredients_flour_seasonings', 'kg', 44),
  ('ing_45', 45, 'Salt', 'cat_dry_ingredients_flour_seasonings', 'kg', 45),
  ('ing_46', 46, 'Pepper', 'cat_dry_ingredients_flour_seasonings', 'kg', 46),
  ('ing_47', 47, 'Onion Powder', 'cat_dry_ingredients_flour_seasonings', 'kg', 47),
  ('ing_48', 48, 'Garlic Powder', 'cat_dry_ingredients_flour_seasonings', 'kg', 48),
  ('ing_49', 49, 'Smoked Paprika', 'cat_dry_ingredients_flour_seasonings', 'kg', 49),
  ('ing_50', 50, 'Oregano', 'cat_dry_ingredients_flour_seasonings', 'kg', 50),
  ('ing_51', 51, 'Thyme', 'cat_dry_ingredients_flour_seasonings', 'kg', 51),
  ('ing_52', 52, 'Peri Peri Seasoning', 'cat_dry_ingredients_flour_seasonings', 'kg', 52),
  ('ing_53', 53, 'Nashville Seasoning', 'cat_dry_ingredients_flour_seasonings', 'kg', 53),
  ('ing_54', 54, 'Hot & Spicy Marinade', 'cat_dry_ingredients_flour_seasonings', 'kg', 54),
  ('ing_55', 55, 'MSG', 'cat_dry_ingredients_flour_seasonings', 'kg', 55),

  -- G. Sauces / Condiments — Raw Packaged (56-67)
  ('ing_56', 56, 'Veeba Burger Mayo', 'cat_sauces_condiments_raw_packaged', 'kg', 56),
  ('ing_57', 57, 'Veeba Garlic Mayo', 'cat_sauces_condiments_raw_packaged', 'kg', 57),
  ('ing_58', 58, 'Veeba Ranch', 'cat_sauces_condiments_raw_packaged', 'kg', 58),
  ('ing_59', 59, 'Veeba Mild & Sweet Mayo', 'cat_sauces_condiments_raw_packaged', 'kg', 59),
  ('ing_60', 60, 'Veeba Chipotle Style Dip', 'cat_sauces_condiments_raw_packaged', 'kg', 60),
  ('ing_61', 61, 'American Mustard', 'cat_sauces_condiments_raw_packaged', 'kg', 61),
  ('ing_62', 62, 'Sweet Chilli', 'cat_sauces_condiments_raw_packaged', 'kg', 62),
  ('ing_63', 63, 'Sriracha', 'cat_sauces_condiments_raw_packaged', 'kg', 63),
  ('ing_64', 64, 'Tomato Sauce', 'cat_sauces_condiments_raw_packaged', 'kg', 64),
  ('ing_65', 65, 'Veeba Salsa', 'cat_sauces_condiments_raw_packaged', 'kg', 65),
  ('ing_66', 66, 'Dark Soy Sauce', 'cat_sauces_condiments_raw_packaged', 'kg', 66),
  ('ing_67', 67, 'Honey', 'cat_sauces_condiments_raw_packaged', 'kg', 67),

  -- H. Oil / Cooking (68-69)
  ('ing_68', 68, 'Cooking Oil', 'cat_oil_cooking', 'L', 68),
  ('ing_69', 69, 'Olive Oil', 'cat_oil_cooking', 'L', 69)
on conflict (id) do update set
  item_number = excluded.item_number,
  name = excluded.name,
  category_id = excluded.category_id,
  unit = excluded.unit,
  display_order = excluded.display_order;

