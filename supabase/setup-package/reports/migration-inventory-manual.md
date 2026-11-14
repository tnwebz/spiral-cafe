# Spiral Cafe — Database Migration Review Report: Manual Inventory & Daily Stock Checklist

**Migration Identifier:** `006_manual_inventory_and_checklist.sql`  
**Target Project:** Supabase PostgreSQL Database  
**Author:** Spiral Cafe Engineering Team  
**Architecture Guardrail:** Completely Manual Stock Counting (Zero POS/KOT Automatic Deduction)  

---

## 1. Migration Overview

This migration provisions the schema required to digitize Spiral Cafe's physical handwritten daily inventory notebook and daily stock checklist.

### Core Business Logic:
1. **Manual Stock Formula:**
   $$\text{Used} = \text{Opening} + \text{Purchased} - \text{Wastage} - \text{Closing Actual}$$
2. **Carry-Forward Rule:**
   Tomorrow's Opening balance automatically inherits the previous finalized day's recorded Closing Actual.
3. **Zero Automatic Deduction Guarantee:**
   Under no circumstances does customer ordering, POS billing, kitchen KOT dispatch, or recipe logic deduct or alter inventory quantities. Inventory is derived exclusively from staff physical counts.
4. **Resilient Dual-Mode Operation:**
   The application codebase (`menu-card/src/lib/inventory.ts`) includes a resilient abstraction layer. If migration `006` is not yet applied to a new database, the application functions seamlessly using an audited JSON store with the exact 8 categories and 69 ingredients, and automatically switches to PostgreSQL once this script is executed.

---

## 2. Database Schema Components

### Tables Created:
1. `public.inventory_categories`
   - Primary key: `id` (text)
   - Columns: `code` (A-H), `name`, `display_order`, `is_active`, `created_at`, `updated_at`
   - Purpose: Stores the 8 physical register categories.
2. `public.inventory_ingredients`
   - Primary key: `id` (text)
   - Columns: `item_number` (1-69), `name`, `category_id`, `unit` (kg, L, pcs), `purchase_unit`, `package_conversion_ratio`, `min_stock_level`, `display_order`, `is_active`, `notes`
   - Purpose: Master catalog of cafe ingredients and alert thresholds.
3. `public.inventory_days`
   - Primary key: `id` (text)
   - Columns: `date` (unique date), `status` (`DRAFT`, `COUNTING`, `READY_FOR_REVIEW`, `FINALIZED`), `checked_by`, `finalized_by`, `finalized_at`, `total_active_ingredients`, `counted_ingredients`, `notes`
   - Purpose: Day-level register tracking one entry per cafe date.
4. `public.inventory_day_items`
   - Primary key: `id` (text)
   - Columns: `inventory_day_id`, `ingredient_id`, `ingredient_number`, `ingredient_name`, `category_id`, `category_name`, `unit`, `opening_qty`, `purchased_qty`, `wastage_qty`, `closing_actual_qty`, `calculated_used_qty`, `is_counted`, `counted_by`, `counted_at`, `notes`
   - Purpose: Individual ingredient row on the daily register, shared in real-time with the Mobile Stock Checklist.
5. `public.inventory_movements`
   - Primary key: `id` (text)
   - Columns: `inventory_day_id`, `ingredient_id`, `date`, `movement_type` (`PURCHASE`, `WASTAGE`, `ADJUSTMENT`), `quantity`, `unit`, `reason`, `supplier`, `cost`, `recorded_by`, `notes`
   - Purpose: Audited historical log for vendor deliveries and kitchen scrap.
6. `public.inventory_audit_logs`
   - Primary key: `id` (text)
   - Columns: `inventory_day_id`, `action`, `actor_name`, `actor_role`, `payload` (jsonb), `created_at`
   - Purpose: Audit trail for register finalizations and overrides.

---

## 3. Seed Data Summary

The migration pre-seeds:
- **8 Categories (A to H):**
  1. `A` — Chicken & Seafood
  2. `B` — Frozen / Ready-to-Cook
  3. `C` — Bread & Bakery
  4. `D` — Dairy / Cheese
  5. `E` — Vegetables & Fresh Produce
  6. `F` — Dry Ingredients / Flour / Seasonings
  7. `G` — Sauces / Condiments — Raw Packaged
  8. `H` — Oil / Cooking
- **69 Default Ingredients (Items 1 through 69):**
  Numbered exactly according to the cafe's physical register sheet, with designated units (`kg`, `pcs`, `L`).

---

## 4. Manual Execution Instructions (Supabase SQL Editor)

When ready to apply this migration to your Supabase project:

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Navigate to **SQL Editor** in the left sidebar.
4. Open or copy the raw SQL script from:
   `menu-card/supabase/migrations/006_manual_inventory_and_checklist.sql`
5. Paste into the SQL Editor and click **Run**.
6. The query will execute idempotently (`if not exists` and `on conflict do update`).
7. Verify successful execution:
   ```sql
   select count(*) from public.inventory_categories; -- returns 8
   select count(*) from public.inventory_ingredients;  -- returns 69
   ```

---

## 5. Regression Test Verification

The migration logic, calculation formulas, and carry-forward rules have been verified via automated test runner:
- `DEFAULT_CATEGORIES` (8) & `DEFAULT_INGREDIENTS` (69): **PASSED**
- Used calculation (`Used = Opening + Purchased - Wastage - Closing Actual`): **PASSED**
- Distinct `0` vs `null` handling: **PASSED**
- Carry-forward of closing actual to tomorrow's opening: **PASSED**
- Mobile checklist count sync: **PASSED**
- CSV export generation: **PASSED**
- TypeScript type checking: **0 errors**
- Vinext client/server build: **0 errors**

