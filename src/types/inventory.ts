export interface StockBatch {
  id: string;
  ingredient_id: string;
  batch_type: "OPENING" | "PURCHASE";
  date: string; // YYYY-MM-DD
  created_at: string;
  original_qty: number;
  remaining_qty: number;
  unit: string;
  unit_cost: number;
  remaining_value: number;
  purchase_id?: string;
  supplier?: string;
  notes?: string;
}

export interface InventoryCategory {
  id: string;
  code: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryIngredient {
  id: string;
  item_number: number;
  name: string;
  category_id: string;
  unit: string;
  cost_per_unit?: number | null; // Baseline/standard cost in ₹ per unit
  purchase_unit?: string | null;
  package_conversion_ratio?: number | null;
  min_stock_level: number;
  display_order: number;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;

  // Dynamic FIFO properties for Master Catalog
  current_stock?: number;
  stock_value?: number;
  batches?: StockBatch[];
}

export interface InventoryPurchaseRecord {
  id: string;
  ingredient_id: string;
  ingredient_name?: string;
  date: string; // YYYY-MM-DD
  quantity: number;
  unit: string;
  price_per_unit: number; // ₹/unit
  total_cost: number; // quantity * price_per_unit
  supplier?: string | null;
  recorded_by?: string;
  notes?: string | null;
  created_at?: string;
}

export type InventoryDayStatus = "DRAFT" | "COUNTING" | "READY_FOR_REVIEW" | "FINALIZED";

export interface InventoryDay {
  id: string;
  date: string; // YYYY-MM-DD (Asia/Kolkata)
  status: InventoryDayStatus;
  checked_by?: string | null;
  finalized_by?: string | null;
  finalized_at?: string | null;
  total_active_ingredients: number;
  counted_ingredients: number;
  total_closing_stock_value?: number | null;
  total_used_value?: number | null;
  total_wastage_value?: number | null;
  total_purchase_value?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryDayItem {
  id: string;
  inventory_day_id: string;
  ingredient_id: string;
  ingredient_number: number;
  ingredient_name: string;
  category_id: string;
  category_name: string;
  unit: string;
  opening_qty: number;
  purchased_qty: number;
  wastage_qty: number;
  closing_actual_qty: number | null;
  calculated_used_qty: number | null;
  // Moving weighted-average cost & valuation (₹)
  unit_cost?: number | null;
  opening_stock_value?: number | null;
  total_purchase_cost?: number | null;
  closing_stock_value?: number | null;
  used_cost?: number | null;
  wastage_cost?: number | null;
  latest_purchase_price?: number | null;
  avg_purchase_price?: number | null;
  purchase_entries?: InventoryPurchaseRecord[];
  available_batches?: StockBatch[];
  closing_batches?: StockBatch[];
  is_counted: boolean;
  counted_by?: string | null;
  counted_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryMovement {
  id: string;
  inventory_day_id?: string | null;
  ingredient_id: string;
  ingredient_name?: string;
  date: string;
  movement_type: "PURCHASE" | "WASTAGE" | "ADJUSTMENT";
  quantity: number;
  unit: string;
  reason?: string | null;
  supplier?: string | null;
  cost?: number | null;
  recorded_by: string;
  notes?: string | null;
  created_at?: string;
}

export interface InventoryDashboardData {
  date: string;
  day: InventoryDay;
  totalIngredients: number;
  totalCategories: number;
  countedToday: number;
  lowStockCount: number;
  categories: InventoryCategory[];
  items: InventoryDayItem[];
  categoryProgress: Record<
    string,
    {
      categoryId: string;
      categoryCode: string;
      categoryName: string;
      total: number;
      counted: number;
      isDone: boolean;
    }
  >;
}

// ---------------------------------------------------------
// DEFAULT SEED DATA (Exact 8 Categories & 69 Ingredients)
// ---------------------------------------------------------

export const DEFAULT_CATEGORIES: InventoryCategory[] = [
  { id: "cat_chicken_seafood", code: "A", name: "Chicken & Seafood", display_order: 1, is_active: true },
  { id: "cat_frozen_ready_to_cook", code: "B", name: "Frozen / Ready-to-Cook", display_order: 2, is_active: true },
  { id: "cat_bread_bakery", code: "C", name: "Bread & Bakery", display_order: 3, is_active: true },
  { id: "cat_dairy_cheese", code: "D", name: "Dairy / Cheese", display_order: 4, is_active: true },
  { id: "cat_vegetables_fresh_produce", code: "E", name: "Vegetables & Fresh Produce", display_order: 5, is_active: true },
  { id: "cat_dry_ingredients_flour_seasonings", code: "F", name: "Dry Ingredients / Flour / Seasonings", display_order: 6, is_active: true },
  { id: "cat_sauces_condiments_raw_packaged", code: "G", name: "Sauces / Condiments — Raw Packaged", display_order: 7, is_active: true },
  { id: "cat_oil_cooking", code: "H", name: "Oil / Cooking", display_order: 8, is_active: true },
];

export const DEFAULT_INGREDIENTS: InventoryIngredient[] = [
  // A. Chicken & Seafood (1-5)
  { id: "ing_1", item_number: 1, name: "Chicken Breast", category_id: "cat_chicken_seafood", unit: "kg", min_stock_level: 5, display_order: 1, is_active: true },
  { id: "ing_2", item_number: 2, name: "Chicken Thigh", category_id: "cat_chicken_seafood", unit: "kg", min_stock_level: 3, display_order: 2, is_active: true },
  { id: "ing_3", item_number: 3, name: "Chicken Wings", category_id: "cat_chicken_seafood", unit: "kg", min_stock_level: 2, display_order: 3, is_active: true },
  { id: "ing_4", item_number: 4, name: "Prawn", category_id: "cat_chicken_seafood", unit: "kg", min_stock_level: 1, display_order: 4, is_active: true },
  { id: "ing_5", item_number: 5, name: "Squid", category_id: "cat_chicken_seafood", unit: "kg", min_stock_level: 1, display_order: 5, is_active: true },

  // B. Frozen / Ready-to-Cook (6-8)
  { id: "ing_6", item_number: 6, name: "McCain 6mm French Fries", category_id: "cat_frozen_ready_to_cook", unit: "kg", min_stock_level: 10, display_order: 6, is_active: true },
  { id: "ing_7", item_number: 7, name: "Veg Patty", category_id: "cat_frozen_ready_to_cook", unit: "pcs", min_stock_level: 15, display_order: 7, is_active: true },
  { id: "ing_8", item_number: 8, name: "Corn", category_id: "cat_frozen_ready_to_cook", unit: "pcs", min_stock_level: 10, display_order: 8, is_active: true },

  // C. Bread & Bakery (9-14)
  { id: "ing_9", item_number: 9, name: "Burger Bun", category_id: "cat_bread_bakery", unit: "pcs", min_stock_level: 20, display_order: 9, is_active: true },
  { id: "ing_10", item_number: 10, name: "Sando Bread", category_id: "cat_bread_bakery", unit: "pcs", min_stock_level: 15, display_order: 10, is_active: true },
  { id: "ing_11", item_number: 11, name: "Makino Nachos", category_id: "cat_bread_bakery", unit: "kg", min_stock_level: 3, display_order: 11, is_active: true },
  { id: "ing_12", item_number: 12, name: "Spaghetti", category_id: "cat_bread_bakery", unit: "kg", min_stock_level: 2, display_order: 12, is_active: true },
  { id: "ing_13", item_number: 13, name: "Penne", category_id: "cat_bread_bakery", unit: "kg", min_stock_level: 2, display_order: 13, is_active: true },
  { id: "ing_14", item_number: 14, name: "Baguette Bread", category_id: "cat_bread_bakery", unit: "pcs", min_stock_level: 10, display_order: 14, is_active: true },

  // D. Dairy / Cheese (15-24)
  { id: "ing_15", item_number: 15, name: "Butter", category_id: "cat_dairy_cheese", unit: "kg", min_stock_level: 2, display_order: 15, is_active: true },
  { id: "ing_16", item_number: 16, name: "Milk", category_id: "cat_dairy_cheese", unit: "L", min_stock_level: 5, display_order: 16, is_active: true },
  { id: "ing_17", item_number: 17, name: "Curd", category_id: "cat_dairy_cheese", unit: "kg", min_stock_level: 3, display_order: 17, is_active: true },
  { id: "ing_18", item_number: 18, name: "Fresh Cream", category_id: "cat_dairy_cheese", unit: "L", min_stock_level: 2, display_order: 18, is_active: true },
  { id: "ing_19", item_number: 19, name: "Processed Cheese", category_id: "cat_dairy_cheese", unit: "kg", min_stock_level: 2, display_order: 19, is_active: true },
  { id: "ing_20", item_number: 20, name: "Mozzarella", category_id: "cat_dairy_cheese", unit: "kg", min_stock_level: 3, display_order: 20, is_active: true },
  { id: "ing_21", item_number: 21, name: "Parmesan", category_id: "cat_dairy_cheese", unit: "kg", min_stock_level: 1, display_order: 21, is_active: true },
  { id: "ing_22", item_number: 22, name: "Cheese Slice", category_id: "cat_dairy_cheese", unit: "pcs", min_stock_level: 20, display_order: 22, is_active: true },
  { id: "ing_23", item_number: 23, name: "Nacho Dip", category_id: "cat_dairy_cheese", unit: "kg", min_stock_level: 1, display_order: 23, is_active: true },
  { id: "ing_24", item_number: 24, name: "Creamy Cheese Blend", category_id: "cat_dairy_cheese", unit: "L", min_stock_level: 2, display_order: 24, is_active: true },

  // E. Vegetables & Fresh Produce (25-41)
  { id: "ing_25", item_number: 25, name: "Onion", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 5, display_order: 25, is_active: true },
  { id: "ing_26", item_number: 26, name: "Tomato", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 5, display_order: 26, is_active: true },
  { id: "ing_27", item_number: 27, name: "Garlic", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 2, display_order: 27, is_active: true },
  { id: "ing_28", item_number: 28, name: "Green Chilli", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 1, display_order: 28, is_active: true },
  { id: "ing_29", item_number: 29, name: "Lettuce", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 2, display_order: 29, is_active: true },
  { id: "ing_30", item_number: 30, name: "Iceberg", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 2, display_order: 30, is_active: true },
  { id: "ing_31", item_number: 31, name: "Bell Pepper", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 2, display_order: 31, is_active: true },
  { id: "ing_32", item_number: 32, name: "Mushroom", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 2, display_order: 32, is_active: true },
  { id: "ing_33", item_number: 33, name: "Gherkins", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 1, display_order: 33, is_active: true },
  { id: "ing_34", item_number: 34, name: "Lemon", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 1, display_order: 34, is_active: true },
  { id: "ing_35", item_number: 35, name: "Cherry Tomato", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 1, display_order: 35, is_active: true },
  { id: "ing_36", item_number: 36, name: "Red Cabbage", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 1, display_order: 36, is_active: true },
  { id: "ing_37", item_number: 37, name: "Parsley", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 0.5, display_order: 37, is_active: true },
  { id: "ing_38", item_number: 38, name: "Spring Onion", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 1, display_order: 38, is_active: true },
  { id: "ing_39", item_number: 39, name: "Black Olives", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 1, display_order: 39, is_active: true },
  { id: "ing_40", item_number: 40, name: "Broccoli", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 2, display_order: 40, is_active: true },
  { id: "ing_41", item_number: 41, name: "Basil", category_id: "cat_vegetables_fresh_produce", unit: "kg", min_stock_level: 0.5, display_order: 41, is_active: true },

  // F. Dry Ingredients / Flour / Seasonings (42-55)
  { id: "ing_42", item_number: 42, name: "Maida", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 10, display_order: 42, is_active: true },
  { id: "ing_43", item_number: 43, name: "Corn Flour", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 5, display_order: 43, is_active: true },
  { id: "ing_44", item_number: 44, name: "Cajun Bread Mix", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 3, display_order: 44, is_active: true },
  { id: "ing_45", item_number: 45, name: "Salt", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 5, display_order: 45, is_active: true },
  { id: "ing_46", item_number: 46, name: "Pepper", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 2, display_order: 46, is_active: true },
  { id: "ing_47", item_number: 47, name: "Onion Powder", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 1, display_order: 47, is_active: true },
  { id: "ing_48", item_number: 48, name: "Garlic Powder", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 1, display_order: 48, is_active: true },
  { id: "ing_49", item_number: 49, name: "Smoked Paprika", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 1, display_order: 49, is_active: true },
  { id: "ing_50", item_number: 50, name: "Oregano", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 1, display_order: 50, is_active: true },
  { id: "ing_51", item_number: 51, name: "Thyme", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 0.5, display_order: 51, is_active: true },
  { id: "ing_52", item_number: 52, name: "Peri Peri Seasoning", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 1, display_order: 52, is_active: true },
  { id: "ing_53", item_number: 53, name: "Nashville Seasoning", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 1, display_order: 53, is_active: true },
  { id: "ing_54", item_number: 54, name: "Hot & Spicy Marinade", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 2, display_order: 54, is_active: true },
  { id: "ing_55", item_number: 55, name: "MSG", category_id: "cat_dry_ingredients_flour_seasonings", unit: "kg", min_stock_level: 1, display_order: 55, is_active: true },

  // G. Sauces / Condiments — Raw Packaged (56-67)
  { id: "ing_56", item_number: 56, name: "Veeba Burger Mayo", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 3, display_order: 56, is_active: true },
  { id: "ing_57", item_number: 57, name: "Veeba Garlic Mayo", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 2, display_order: 57, is_active: true },
  { id: "ing_58", item_number: 58, name: "Veeba Ranch", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 2, display_order: 58, is_active: true },
  { id: "ing_59", item_number: 59, name: "Veeba Mild & Sweet Mayo", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 2, display_order: 59, is_active: true },
  { id: "ing_60", item_number: 60, name: "Veeba Chipotle Style Dip", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 2, display_order: 60, is_active: true },
  { id: "ing_61", item_number: 61, name: "American Mustard", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 1, display_order: 61, is_active: true },
  { id: "ing_62", item_number: 62, name: "Sweet Chilli", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 2, display_order: 62, is_active: true },
  { id: "ing_63", item_number: 63, name: "Sriracha", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 2, display_order: 63, is_active: true },
  { id: "ing_64", item_number: 64, name: "Tomato Sauce", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 5, display_order: 64, is_active: true },
  { id: "ing_65", item_number: 65, name: "Veeba Salsa", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 2, display_order: 65, is_active: true },
  { id: "ing_66", item_number: 66, name: "Dark Soy Sauce", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 1, display_order: 66, is_active: true },
  { id: "ing_67", item_number: 67, name: "Honey", category_id: "cat_sauces_condiments_raw_packaged", unit: "kg", min_stock_level: 1, display_order: 67, is_active: true },

  // H. Oil / Cooking (68-69)
  { id: "ing_68", item_number: 68, name: "Cooking Oil", category_id: "cat_oil_cooking", unit: "L", min_stock_level: 15, display_order: 68, is_active: true },
  { id: "ing_69", item_number: 69, name: "Olive Oil", category_id: "cat_oil_cooking", unit: "L", min_stock_level: 2, display_order: 69, is_active: true },
];

// Helper: Normalize cafe-local date (Asia/Kolkata)
export function getKolkataDateString(d: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d); // Returns YYYY-MM-DD
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// Formula: Used = Opening + Purchased - Wastage - Closing Actual
export function calculateUsedQty(
  opening: number,
  purchased: number,
  wastage: number,
  closing: number | null | undefined
): number | null {
  if (closing === null || closing === undefined || isNaN(closing)) {
    return null;
  }
  const rawUsed = opening + purchased - wastage - closing;
  return Number(rawUsed.toFixed(3));
}

/**
 * FIFO Batch-Based Costing & Allocation Engine
 * Never averages purchase prices.
 * Consumes oldest eligible batches first for wastage and usage.
 * Closing stock is valued from actual remaining batches.
 */
export function calculateFifoAllocation(
  availableBatches: StockBatch[],
  wastageQty: number,
  usedQty: number | null
): {
  wastageCost: number;
  usedCost: number | null;
  closingStockQty: number;
  closingStockValue: number;
  remainingBatches: StockBatch[];
} {
  const sortedBatches: StockBatch[] = availableBatches
    .map((b) => ({ ...b }))
    .sort((a, b) => {
      const dCmp = a.date.localeCompare(b.date);
      if (dCmp !== 0) return dCmp;
      const tCmp = (a.created_at || "").localeCompare(b.created_at || "");
      if (tCmp !== 0) return tCmp;
      return a.id.localeCompare(b.id);
    });

  let remainingWastage = Math.max(0, Number((wastageQty || 0).toFixed(4)));
  let wastageCost = 0;

  // 1. Consume wastage first from oldest batches
  for (const b of sortedBatches) {
    if (remainingWastage <= 0.00001) break;
    if (b.remaining_qty <= 0) continue;

    const take = Math.min(b.remaining_qty, remainingWastage);
    wastageCost += take * b.unit_cost;
    b.remaining_qty = Number((b.remaining_qty - take).toFixed(4));
    b.remaining_value = Number((b.remaining_qty * b.unit_cost).toFixed(2));
    remainingWastage = Number((remainingWastage - take).toFixed(4));
  }

  // 2. Consume used qty from oldest remaining batches
  let usedCost: number | null = null;
  if (usedQty !== null && usedQty !== undefined && !isNaN(usedQty)) {
    let remainingUsed = Math.max(0, Number((usedQty || 0).toFixed(4)));
    let costAcc = 0;

    for (const b of sortedBatches) {
      if (remainingUsed <= 0.00001) break;
      if (b.remaining_qty <= 0) continue;

      const take = Math.min(b.remaining_qty, remainingUsed);
      costAcc += take * b.unit_cost;
      b.remaining_qty = Number((b.remaining_qty - take).toFixed(4));
      b.remaining_value = Number((b.remaining_qty * b.unit_cost).toFixed(2));
      remainingUsed = Number((remainingUsed - take).toFixed(4));
    }
    usedCost = Number(costAcc.toFixed(2));
  }

  const remainingBatches = sortedBatches.filter((b) => b.remaining_qty > 0.00001);
  const closingStockQty = Number(
    remainingBatches.reduce((acc, b) => acc + b.remaining_qty, 0).toFixed(4)
  );
  const closingStockValue = Number(
    remainingBatches.reduce((acc, b) => acc + b.remaining_value, 0).toFixed(2)
  );

  return {
    wastageCost: Number(wastageCost.toFixed(2)),
    usedCost,
    closingStockQty,
    closingStockValue,
    remainingBatches,
  };
}

/**
 * Moving Weighted-Average Costing Formula:
 * Weighted Average Cost = (Opening Stock Value + Total Purchase Cost) / (Opening Qty + Purchased Qty)
 *
 * Used Cost = Used Qty * Weighted Average Cost
 * Closing Value = Closing Actual * Weighted Average Cost
 * Wastage Cost = Wastage Qty * Weighted Average Cost
 */
export function calculateWeightedAverageCost(
  openingQty: number,
  prevUnitCost: number | null | undefined,
  purchasedQty: number,
  purchases: Array<{ quantity: number; price_per_unit: number; total_cost?: number }>,
  baseCost?: number | null
): {
  unitCost: number | null;
  openingStockValue: number | null;
  totalPurchaseCost: number;
  latestPurchasePrice: number | null;
} {
  const openingCost =
    prevUnitCost !== null && prevUnitCost !== undefined && !isNaN(prevUnitCost)
      ? Number(prevUnitCost)
      : baseCost !== null && baseCost !== undefined && !isNaN(baseCost)
      ? Number(baseCost)
      : null;

  const totalPurchaseCost = purchases.reduce(
    (acc, p) => acc + (p.total_cost !== undefined ? p.total_cost : (p.quantity || 0) * (p.price_per_unit || 0)),
    0
  );

  const totalPurchasedQty = purchases.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const effectivePurchasedQty = totalPurchasedQty > 0 ? totalPurchasedQty : (purchasedQty || 0);

  const latestPurchase = purchases.length > 0 ? purchases[purchases.length - 1] : null;
  const latestPurchasePrice = latestPurchase ? latestPurchase.price_per_unit : null;

  const openingStockValue = openingCost !== null ? openingQty * openingCost : null;
  const totalAvailableQty = openingQty + effectivePurchasedQty;

  if (totalAvailableQty > 0) {
    if (openingStockValue !== null && totalPurchaseCost > 0) {
      const avg = (openingStockValue + totalPurchaseCost) / totalAvailableQty;
      return {
        unitCost: Number(avg.toFixed(2)),
        openingStockValue: Number(openingStockValue.toFixed(2)),
        totalPurchaseCost: Number(totalPurchaseCost.toFixed(2)),
        latestPurchasePrice,
      };
    } else if (totalPurchaseCost > 0 && openingQty === 0) {
      const avg = totalPurchaseCost / effectivePurchasedQty;
      return {
        unitCost: Number(avg.toFixed(2)),
        openingStockValue: 0,
        totalPurchaseCost: Number(totalPurchaseCost.toFixed(2)),
        latestPurchasePrice,
      };
    } else if (openingCost !== null) {
      return {
        unitCost: Number(openingCost.toFixed(2)),
        openingStockValue: openingStockValue !== null ? Number(openingStockValue.toFixed(2)) : null,
        totalPurchaseCost: Number(totalPurchaseCost.toFixed(2)),
        latestPurchasePrice,
      };
    }
  } else if (openingCost !== null) {
    return {
      unitCost: Number(openingCost.toFixed(2)),
      openingStockValue: 0,
      totalPurchaseCost: 0,
      latestPurchasePrice,
    };
  }

  return {
    unitCost: null,
    openingStockValue: null,
    totalPurchaseCost: Number(totalPurchaseCost.toFixed(2)),
    latestPurchasePrice,
  };
}

