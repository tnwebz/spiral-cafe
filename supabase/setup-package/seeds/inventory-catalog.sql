-- ==============================================================================
-- Spiral Cafe POS — Master Inventory Seed Data
-- 8 Core Categories & 69 Master Ingredients (Baseline Catalog)
-- Idempotent: ON CONFLICT DO UPDATE
-- ==============================================================================

-- 1. INVENTORY MASTER CATEGORIES
INSERT INTO public.inventory_categories (id, name, display_order)
VALUES
  ('cat_chicken_seafood', 'Chicken & Seafood', 1),
  ('cat_frozen_ready_to_cook', 'Frozen / Ready-to-Cook', 2),
  ('cat_bread_bakery', 'Bread & Bakery', 3),
  ('cat_dairy_cheese', 'Dairy / Cheese', 4),
  ('cat_vegetables_fresh_produce', 'Vegetables & Fresh Produce', 5),
  ('cat_dry_ingredients_flour_seasonings', 'Dry Ingredients / Flour / Seasonings', 6),
  ('cat_sauces_condiments_raw_packaged', 'Sauces / Condiments — Raw Packaged', 7),
  ('cat_oil_cooking', 'Oil / Cooking', 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- 2. INVENTORY MASTER INGREDIENTS
INSERT INTO public.inventory_ingredients (
  id, item_number, name, category_id, unit, cost_per_unit, min_stock_level, display_order, is_active
)
VALUES
  ('ing_1', 1, 'Chicken Breast', 'cat_chicken_seafood', 'kg', 0, 5, 1, true),
  ('ing_2', 2, 'Chicken Thigh', 'cat_chicken_seafood', 'kg', 0, 3, 2, true),
  ('ing_3', 3, 'Chicken Wings', 'cat_chicken_seafood', 'kg', 0, 2, 3, true),
  ('ing_4', 4, 'Prawn', 'cat_chicken_seafood', 'kg', 0, 1, 4, true),
  ('ing_5', 5, 'Squid', 'cat_chicken_seafood', 'kg', 0, 1, 5, true),
  ('ing_6', 6, 'McCain 6mm French Fries', 'cat_frozen_ready_to_cook', 'kg', 0, 10, 6, true),
  ('ing_7', 7, 'Veg Patty', 'cat_frozen_ready_to_cook', 'pcs', 0, 15, 7, true),
  ('ing_8', 8, 'Corn', 'cat_frozen_ready_to_cook', 'pcs', 0, 10, 8, true),
  ('ing_9', 9, 'Burger Bun', 'cat_bread_bakery', 'pcs', 0, 20, 9, true),
  ('ing_10', 10, 'Sando Bread', 'cat_bread_bakery', 'pcs', 0, 15, 10, true),
  ('ing_11', 11, 'Makino Nachos', 'cat_bread_bakery', 'kg', 0, 3, 11, true),
  ('ing_12', 12, 'Spaghetti', 'cat_bread_bakery', 'kg', 0, 2, 12, true),
  ('ing_13', 13, 'Penne', 'cat_bread_bakery', 'kg', 0, 2, 13, true),
  ('ing_14', 14, 'Baguette Bread', 'cat_bread_bakery', 'pcs', 0, 10, 14, true),
  ('ing_15', 15, 'Butter', 'cat_dairy_cheese', 'kg', 0, 2, 15, true),
  ('ing_16', 16, 'Milk', 'cat_dairy_cheese', 'L', 0, 5, 16, true),
  ('ing_17', 17, 'Curd', 'cat_dairy_cheese', 'kg', 0, 3, 17, true),
  ('ing_18', 18, 'Fresh Cream', 'cat_dairy_cheese', 'L', 0, 2, 18, true),
  ('ing_19', 19, 'Processed Cheese', 'cat_dairy_cheese', 'kg', 0, 2, 19, true),
  ('ing_20', 20, 'Mozzarella', 'cat_dairy_cheese', 'kg', 0, 3, 20, true),
  ('ing_21', 21, 'Parmesan', 'cat_dairy_cheese', 'kg', 0, 1, 21, true),
  ('ing_22', 22, 'Cheese Slice', 'cat_dairy_cheese', 'pcs', 0, 20, 22, true),
  ('ing_23', 23, 'Nacho Dip', 'cat_dairy_cheese', 'kg', 0, 1, 23, true),
  ('ing_24', 24, 'Creamy Cheese Blend', 'cat_dairy_cheese', 'L', 0, 2, 24, true),
  ('ing_25', 25, 'Onion', 'cat_vegetables_fresh_produce', 'kg', 0, 5, 25, true),
  ('ing_26', 26, 'Tomato', 'cat_vegetables_fresh_produce', 'kg', 0, 5, 26, true),
  ('ing_27', 27, 'Garlic', 'cat_vegetables_fresh_produce', 'kg', 0, 2, 27, true),
  ('ing_28', 28, 'Green Chilli', 'cat_vegetables_fresh_produce', 'kg', 0, 1, 28, true),
  ('ing_29', 29, 'Lettuce', 'cat_vegetables_fresh_produce', 'kg', 0, 2, 29, true),
  ('ing_30', 30, 'Iceberg', 'cat_vegetables_fresh_produce', 'kg', 0, 2, 30, true),
  ('ing_31', 31, 'Bell Pepper', 'cat_vegetables_fresh_produce', 'kg', 0, 2, 31, true),
  ('ing_32', 32, 'Mushroom', 'cat_vegetables_fresh_produce', 'kg', 0, 2, 32, true),
  ('ing_33', 33, 'Gherkins', 'cat_vegetables_fresh_produce', 'kg', 0, 1, 33, true),
  ('ing_34', 34, 'Lemon', 'cat_vegetables_fresh_produce', 'kg', 0, 1, 34, true),
  ('ing_35', 35, 'Cherry Tomato', 'cat_vegetables_fresh_produce', 'kg', 0, 1, 35, true),
  ('ing_36', 36, 'Red Cabbage', 'cat_vegetables_fresh_produce', 'kg', 0, 1, 36, true),
  ('ing_37', 37, 'Parsley', 'cat_vegetables_fresh_produce', 'kg', 0, 0.5, 37, true),
  ('ing_38', 38, 'Spring Onion', 'cat_vegetables_fresh_produce', 'kg', 0, 1, 38, true),
  ('ing_39', 39, 'Black Olives', 'cat_vegetables_fresh_produce', 'kg', 0, 1, 39, true),
  ('ing_40', 40, 'Broccoli', 'cat_vegetables_fresh_produce', 'kg', 0, 2, 40, true),
  ('ing_41', 41, 'Basil', 'cat_vegetables_fresh_produce', 'kg', 0, 0.5, 41, true),
  ('ing_42', 42, 'Maida', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 10, 42, true),
  ('ing_43', 43, 'Corn Flour', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 5, 43, true),
  ('ing_44', 44, 'Cajun Bread Mix', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 3, 44, true),
  ('ing_45', 45, 'Salt', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 5, 45, true),
  ('ing_46', 46, 'Pepper', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 2, 46, true),
  ('ing_47', 47, 'Onion Powder', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 1, 47, true),
  ('ing_48', 48, 'Garlic Powder', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 1, 48, true),
  ('ing_49', 49, 'Smoked Paprika', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 1, 49, true),
  ('ing_50', 50, 'Oregano', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 1, 50, true),
  ('ing_51', 51, 'Thyme', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 0.5, 51, true),
  ('ing_52', 52, 'Peri Peri Seasoning', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 1, 52, true),
  ('ing_53', 53, 'Nashville Seasoning', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 1, 53, true),
  ('ing_54', 54, 'Hot & Spicy Marinade', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 2, 54, true),
  ('ing_55', 55, 'MSG', 'cat_dry_ingredients_flour_seasonings', 'kg', 0, 1, 55, true),
  ('ing_56', 56, 'Veeba Burger Mayo', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 3, 56, true),
  ('ing_57', 57, 'Veeba Garlic Mayo', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 2, 57, true),
  ('ing_58', 58, 'Veeba Ranch', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 2, 58, true),
  ('ing_59', 59, 'Veeba Mild & Sweet Mayo', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 2, 59, true),
  ('ing_60', 60, 'Veeba Chipotle Style Dip', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 2, 60, true),
  ('ing_61', 61, 'American Mustard', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 1, 61, true),
  ('ing_62', 62, 'Sweet Chilli', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 2, 62, true),
  ('ing_63', 63, 'Sriracha', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 2, 63, true),
  ('ing_64', 64, 'Tomato Sauce', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 5, 64, true),
  ('ing_65', 65, 'Veeba Salsa', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 2, 65, true),
  ('ing_66', 66, 'Dark Soy Sauce', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 1, 66, true),
  ('ing_67', 67, 'Honey', 'cat_sauces_condiments_raw_packaged', 'kg', 0, 1, 67, true),
  ('ing_68', 68, 'Cooking Oil', 'cat_oil_cooking', 'L', 0, 15, 68, true),
  ('ing_69', 69, 'Olive Oil', 'cat_oil_cooking', 'L', 0, 2, 69, true)
ON CONFLICT (id) DO UPDATE SET
  item_number = EXCLUDED.item_number,
  name = EXCLUDED.name,
  category_id = EXCLUDED.category_id,
  unit = EXCLUDED.unit,
  cost_per_unit = EXCLUDED.cost_per_unit,
  min_stock_level = EXCLUDED.min_stock_level,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;
