import fs from "fs";
import path from "path";
import { getSupabaseAdminClient } from "./supabase/admin";

export * from "@/types/inventory";
import {
  InventoryCategory,
  InventoryIngredient,
  InventoryDay,
  InventoryDayStatus,
  InventoryDayItem,
  InventoryMovement,
  InventoryPurchaseRecord,
  InventoryDashboardData,
  DEFAULT_CATEGORIES,
  DEFAULT_INGREDIENTS,
  getKolkataDateString,
  calculateUsedQty,
  calculateWeightedAverageCost,
} from "@/types/inventory";

// ---------------------------------------------------------
// LOCAL FALLBACK STORE (Resilient Dual-Mode Operation)
// ---------------------------------------------------------

interface LocalStoreSchema {
  categories: InventoryCategory[];
  ingredients: InventoryIngredient[];
  days: InventoryDay[];
  dayItems: InventoryDayItem[];
  movements: InventoryMovement[];
  purchases: InventoryPurchaseRecord[];
}

function getLocalStorePath(): string {
  const p1 = path.join(process.cwd(), "src", "data", "inventory_store.json");
  if (fs.existsSync(/*turbopackIgnore: true*/ p1)) return p1;
  const p2 = path.join(process.cwd(), "menu-card", "src", "data", "inventory_store.json");
  if (fs.existsSync(/*turbopackIgnore: true*/ p2)) return p2;
  return p1;
}

function readLocalStore(): LocalStoreSchema {
  const filePath = getLocalStorePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed.purchases) parsed.purchases = [];
      return parsed;
    }
  } catch (err) {
    console.warn("Failed reading local inventory store, initializing fresh defaults:", err);
  }

  const initialStore: LocalStoreSchema = {
    categories: [...DEFAULT_CATEGORIES],
    ingredients: [...DEFAULT_INGREDIENTS],
    days: [],
    dayItems: [],
    movements: [],
    purchases: [],
  };

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(initialStore, null, 2), "utf-8");
  } catch {}

  return initialStore;
}

function writeLocalStore(store: LocalStoreSchema): void {
  const filePath = getLocalStorePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing to local inventory store:", err);
  }
}

// ---------------------------------------------------------
// DATABASE / FALLBACK ABSTRACTION LAYER
// ---------------------------------------------------------

async function isSupabaseAvailable(): Promise<boolean> {
  try {
    const admin = getSupabaseAdminClient() as any;
    const { error } = await admin
      .from("inventory_categories")
      .select("id")
      .limit(1);
    if (error) {
      // Missing table or schema error
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// 1. Categories
export async function getInventoryCategories(): Promise<InventoryCategory[]> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      const { data, error } = await admin
        .from("inventory_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (!error && data && data.length > 0) return data as InventoryCategory[];
    } catch {}
  }
  const store = readLocalStore();
  return store.categories
    .filter((c) => c.is_active)
    .sort((a, b) => a.display_order - b.display_order);
}

export async function createInventoryCategory(
  category: Omit<InventoryCategory, "id" | "created_at" | "updated_at">
): Promise<InventoryCategory> {
  const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newCat: InventoryCategory = {
    id,
    ...category,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      const { data, error } = await admin.from("inventory_categories").insert(newCat).select().single();
      if (!error && data) return data as InventoryCategory;
    } catch {}
  }

  const store = readLocalStore();
  store.categories.push(newCat);
  writeLocalStore(store);
  return newCat;
}

export async function updateInventoryCategory(
  id: string,
  patch: Partial<InventoryCategory>
): Promise<InventoryCategory | null> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      const { data, error } = await admin
        .from("inventory_categories")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (!error && data) return data as InventoryCategory;
    } catch {}
  }

  const store = readLocalStore();
  const idx = store.categories.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  store.categories[idx] = { ...store.categories[idx], ...patch, updated_at: new Date().toISOString() };
  writeLocalStore(store);
  return store.categories[idx];
}

// 2. Ingredients
export async function getInventoryIngredients(categoryId?: string): Promise<InventoryIngredient[]> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      let query = admin
        .from("inventory_ingredients")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as InventoryIngredient[];
    } catch {}
  }

  const store = readLocalStore();
  let list = store.ingredients.filter((i) => i.is_active);
  if (categoryId) {
    list = list.filter((i) => i.category_id === categoryId);
  }
  return list.sort((a, b) => a.display_order - b.display_order);
}

export async function createInventoryIngredient(
  item: Omit<InventoryIngredient, "id" | "item_number" | "created_at" | "updated_at">
): Promise<InventoryIngredient> {
  const store = readLocalStore();
  const nextNumber =
    store.ingredients.reduce((max, i) => Math.max(max, i.item_number || 0), 0) + 1;
  const id = `ing_${nextNumber}_${Math.random().toString(36).slice(2, 6)}`;

  const newIng: InventoryIngredient = {
    id,
    item_number: nextNumber,
    ...item,
    cost_per_unit: item.cost_per_unit !== undefined && item.cost_per_unit !== null ? Number(item.cost_per_unit) : null,
    is_active: true,
    display_order: item.display_order || nextNumber,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      const { data, error } = await admin.from("inventory_ingredients").insert(newIng).select().single();
      if (!error && data) {
        // Also ensure ingredient is attached to today's active register
        try {
          const todayStr = getKolkataDateString();
          const { data: todayDay } = await admin.from("inventory_days").select("id").eq("date", todayStr).maybeSingle();
          if (todayDay) {
            const { data: cat } = await admin.from("inventory_categories").select("name").eq("id", newIng.category_id).maybeSingle();
            await admin.from("inventory_day_items").insert({
              id: `item_${todayDay.id}_${newIng.id}`,
              inventory_day_id: todayDay.id,
              ingredient_id: newIng.id,
              ingredient_number: newIng.item_number,
              ingredient_name: newIng.name,
              category_id: newIng.category_id,
              category_name: cat?.name || "Other",
              unit: newIng.unit,
              opening_qty: 0,
              purchased_qty: 0,
              wastage_qty: 0,
              closing_actual_qty: null,
              calculated_used_qty: null,
              is_counted: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } catch {}
        return data as InventoryIngredient;
      }
    } catch {}
  }

  store.ingredients.push(newIng);
  
  // Reconcile into today's active local day if present
  const todayStr = getKolkataDateString();
  const todayDay = store.days.find((d) => d.date === todayStr);
  if (todayDay) {
    const cat = store.categories.find((c) => c.id === newIng.category_id);
    const dayItem: InventoryDayItem = {
      id: `item_${todayDay.id}_${newIng.id}`,
      inventory_day_id: todayDay.id,
      ingredient_id: newIng.id,
      ingredient_number: newIng.item_number,
      ingredient_name: newIng.name,
      category_id: newIng.category_id,
      category_name: cat?.name || "Other",
      unit: newIng.unit,
      opening_qty: 0,
      purchased_qty: 0,
      wastage_qty: 0,
      closing_actual_qty: null,
      calculated_used_qty: null,
      is_counted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.dayItems.push(dayItem);
    todayDay.total_active_ingredients = (todayDay.total_active_ingredients || 0) + 1;
  }

  writeLocalStore(store);
  return newIng;
}

export async function updateInventoryIngredient(
  id: string,
  patch: Partial<InventoryIngredient>
): Promise<InventoryIngredient | null> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      const { data, error } = await admin
        .from("inventory_ingredients")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (!error && data) return data as InventoryIngredient;
    } catch {}
  }

  const store = readLocalStore();
  const idx = store.ingredients.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const parsedCost =
    patch.cost_per_unit !== undefined
      ? patch.cost_per_unit === null || isNaN(Number(patch.cost_per_unit))
        ? null
        : Number(patch.cost_per_unit)
      : store.ingredients[idx].cost_per_unit;

  store.ingredients[idx] = {
    ...store.ingredients[idx],
    ...patch,
    cost_per_unit: parsedCost,
    updated_at: new Date().toISOString(),
  };

  if (patch.cost_per_unit !== undefined) {
    for (const item of store.dayItems) {
      if (item.ingredient_id === id) {
        if (!item.purchase_entries || item.purchase_entries.length === 0) {
          item.unit_cost = parsedCost;
          if (item.closing_actual_qty !== null && parsedCost !== null && parsedCost !== undefined) {
            item.closing_stock_value = Number((item.closing_actual_qty * parsedCost).toFixed(2));
          }
          if (item.calculated_used_qty !== null && parsedCost !== null && parsedCost !== undefined) {
            item.used_cost = Number((item.calculated_used_qty * parsedCost).toFixed(2));
          }
        }
      }
    }
  }

  if (patch.category_id) {
    const targetCategory = store.categories.find((c) => c.id === patch.category_id);
    if (targetCategory) {
      for (const item of store.dayItems) {
        if (item.ingredient_id === id) {
          item.category_id = patch.category_id;
          item.category_name = targetCategory.name;
        }
      }
    }
  }

  writeLocalStore(store);
  return store.ingredients[idx];
}

export async function archiveInventoryIngredient(id: string): Promise<boolean> {
  const updated = await updateInventoryIngredient(id, { is_active: false });
  return !!updated;
}

// 3. Daily Register Lifecycle & Carry-Forward
export async function getOrCreateDayRegister(
  dateStr?: string,
  staffName: string = "Staff"
): Promise<{
  day: InventoryDay;
  items: InventoryDayItem[];
  categories: InventoryCategory[];
}> {
  const targetDate = dateStr || getKolkataDateString();
  const categories = await getInventoryCategories();
  const ingredients = await getInventoryIngredients();
  const ingMap = new Map(ingredients.map((ing) => [ing.id, ing]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const store = readLocalStore();
  if (!store.purchases) store.purchases = [];

  // 1. Locate the latest previous FINALIZED day to carry forward quantities & unit costs
  const previousFinalizedDays = store.days
    .filter((d) => d.date < targetDate && d.status === "FINALIZED")
    .sort((a, b) => b.date.localeCompare(a.date));
  const prevDay = previousFinalizedDays[0];

  const prevClosingMap: Record<string, number> = {};
  const prevCostMap: Record<string, number | null> = {};

  if (prevDay) {
    const prevItems = store.dayItems.filter((di) => di.inventory_day_id === prevDay.id);
    for (const pi of prevItems) {
      if (pi.closing_actual_qty !== null && pi.closing_actual_qty !== undefined && !isNaN(Number(pi.closing_actual_qty))) {
        prevClosingMap[pi.ingredient_id] = Number(pi.closing_actual_qty);
      }
      if (pi.unit_cost !== null && pi.unit_cost !== undefined && !isNaN(Number(pi.unit_cost))) {
        prevCostMap[pi.ingredient_id] = Number(pi.unit_cost);
      }
    }
  }

  let day = store.days.find((d) => d.date === targetDate);
  const dayId = day ? day.id : `day_${targetDate.replace(/-/g, "")}`;

  let items: InventoryDayItem[] = [];

  if (day) {
    items = store.dayItems.filter((di) => di.inventory_day_id === day!.id);
    const existingIngIds = new Set(items.map((i) => i.ingredient_id));
    const missing = ingredients.filter((ing) => !existingIngIds.has(ing.id));

    if (missing.length > 0) {
      const missingItems: InventoryDayItem[] = missing.map((ing) => ({
        id: `item_${day!.id}_${ing.id}`,
        inventory_day_id: day!.id,
        ingredient_id: ing.id,
        ingredient_number: ing.item_number,
        ingredient_name: ing.name,
        category_id: ing.category_id,
        category_name: catMap.get(ing.category_id) || "Other",
        unit: ing.unit,
        opening_qty: prevClosingMap[ing.id] !== undefined ? prevClosingMap[ing.id] : 0,
        purchased_qty: 0,
        wastage_qty: 0,
        closing_actual_qty: null,
        calculated_used_qty: null,
        is_counted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      store.dayItems.push(...missingItems);
      items.push(...missingItems);
      day.total_active_ingredients = ingredients.length;
    }

    // If day is still in DRAFT, synchronize opening balances from previous finalized day
    if (day.status !== "FINALIZED" && prevDay) {
      for (const item of items) {
        if (prevClosingMap[item.ingredient_id] !== undefined) {
          item.opening_qty = prevClosingMap[item.ingredient_id];
          item.calculated_used_qty = calculateUsedQty(
            item.opening_qty,
            item.purchased_qty,
            item.wastage_qty,
            item.closing_actual_qty
          );
        }
      }
    }
  } else {
    // Create fresh day
    const newDay: InventoryDay = {
      id: dayId,
      date: targetDate,
      status: "DRAFT",
      checked_by: staffName,
      total_active_ingredients: ingredients.length,
      counted_ingredients: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    items = ingredients.map((ing) => {
      const opening = prevClosingMap[ing.id] !== undefined ? prevClosingMap[ing.id] : 0;
      return {
        id: `item_${dayId}_${ing.id}`,
        inventory_day_id: dayId,
        ingredient_id: ing.id,
        ingredient_number: ing.item_number,
        ingredient_name: ing.name,
        category_id: ing.category_id,
        category_name: catMap.get(ing.category_id) || "Other",
        unit: ing.unit,
        opening_qty: opening,
        purchased_qty: 0,
        wastage_qty: 0,
        closing_actual_qty: null,
        calculated_used_qty: null,
        is_counted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    store.days.push(newDay);
    store.dayItems.push(...items);
    day = newDay;
  }

  // 2. Load and attach date-wise purchases and moving weighted average costs
  const targetPurchases = store.purchases.filter((p) => p.date === targetDate);
  const allPurchasesForIngredients = store.purchases;

  let dayTotalClosing = 0;
  let dayTotalUsed = 0;
  let dayTotalWastage = 0;
  let dayTotalPurchase = 0;
  let hasIncompleteValuation = false;

  for (const item of items) {
    const itemPurchasesToday = targetPurchases.filter((p) => p.ingredient_id === item.ingredient_id);
    const allItemPurchases = allPurchasesForIngredients.filter((p) => p.ingredient_id === item.ingredient_id);
    const ing = ingMap.get(item.ingredient_id);

    // If purchases were recorded via Add Purchase, enforce purchased_qty to match exact sum
    if (itemPurchasesToday.length > 0) {
      item.purchased_qty = Number(
        itemPurchasesToday.reduce((sum, p) => sum + (p.quantity || 0), 0).toFixed(3)
      );
    }

    item.calculated_used_qty = calculateUsedQty(
      item.opening_qty,
      item.purchased_qty,
      item.wastage_qty,
      item.closing_actual_qty
    );

    const prevCost = prevCostMap[item.ingredient_id] ?? null;
    const costCalc = calculateWeightedAverageCost(
      item.opening_qty,
      prevCost,
      item.purchased_qty,
      itemPurchasesToday,
      ing?.cost_per_unit ?? null
    );

    item.unit_cost = costCalc.unitCost;
    item.opening_stock_value = costCalc.openingStockValue;
    item.total_purchase_cost = costCalc.totalPurchaseCost;
    item.latest_purchase_price =
      costCalc.latestPurchasePrice ??
      (allItemPurchases.length > 0 ? allItemPurchases[allItemPurchases.length - 1].price_per_unit : null);
    item.purchase_entries = itemPurchasesToday;

    if (item.closing_actual_qty !== null && item.unit_cost != null) {
      item.closing_stock_value = Number((item.closing_actual_qty * item.unit_cost).toFixed(2));
      dayTotalClosing += item.closing_stock_value;
    } else {
      item.closing_stock_value = null;
      if (item.closing_actual_qty !== null && item.unit_cost == null) {
        hasIncompleteValuation = true;
      }
    }

    if (item.calculated_used_qty !== null && item.unit_cost != null) {
      item.used_cost = Number((item.calculated_used_qty * item.unit_cost).toFixed(2));
      dayTotalUsed += item.used_cost;
    } else {
      item.used_cost = null;
    }

    if (item.wastage_qty > 0 && item.unit_cost != null) {
      item.wastage_cost = Number((item.wastage_qty * item.unit_cost).toFixed(2));
      dayTotalWastage += item.wastage_cost;
    } else {
      item.wastage_cost = null;
    }

    if (item.total_purchase_cost) {
      dayTotalPurchase += item.total_purchase_cost;
    }
  }

  day.total_closing_stock_value = Number(dayTotalClosing.toFixed(2));
  day.total_used_value = Number(dayTotalUsed.toFixed(2));
  day.total_wastage_value = Number(dayTotalWastage.toFixed(2));
  day.total_purchase_value = Number(dayTotalPurchase.toFixed(2));

  writeLocalStore(store);

  // Sync to Supabase if accessible
  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      await admin.from("inventory_days").upsert({
        id: day.id,
        date: day.date,
        status: day.status,
        checked_by: day.checked_by,
        total_active_ingredients: day.total_active_ingredients,
        counted_ingredients: day.counted_ingredients,
        total_closing_stock_value: day.total_closing_stock_value,
        total_used_value: day.total_used_value,
        total_wastage_value: day.total_wastage_value,
        total_purchase_value: day.total_purchase_value,
        updated_at: new Date().toISOString(),
      });
    } catch {}
  }

  return {
    day,
    items: items.sort((a, b) => a.ingredient_number - b.ingredient_number),
    categories,
  };
}

// 4. Batch Update Quantities (Daily Register Rows)
export interface DayItemUpdateInput {
  id: string; // item id or ingredient_id
  opening_qty?: number;
  purchased_qty?: number;
  wastage_qty?: number;
  closing_actual_qty?: number | null;
  unit_cost?: number | null;
  is_counted?: boolean;
  notes?: string | null;
}

export async function updateDayItemsBatch(
  dayId: string,
  updates: DayItemUpdateInput[],
  staffName: string = "Staff"
): Promise<{
  success: boolean;
  day: InventoryDay;
  items: InventoryDayItem[];
}> {
  const store = readLocalStore();
  let dayIndex = store.days.findIndex((d) => d.id === dayId);
  if (dayIndex === -1) {
    throw new Error(`Inventory day '${dayId}' not found.`);
  }

  if (store.days[dayIndex].status === "FINALIZED") {
    throw new Error("This inventory day is FINALIZED and locked. Reopening is restricted to admin.");
  }

  const day = store.days[dayIndex];
  const updatedItems: InventoryDayItem[] = [];

  for (const up of updates) {
    const itemIndex = store.dayItems.findIndex(
      (di) => di.inventory_day_id === dayId && (di.id === up.id || di.ingredient_id === up.id)
    );
    if (itemIndex === -1) continue;

    const current = store.dayItems[itemIndex];
    const opening = up.opening_qty !== undefined ? Math.max(0, up.opening_qty) : current.opening_qty;
    const purchased = up.purchased_qty !== undefined ? Math.max(0, up.purchased_qty) : current.purchased_qty;
    const wastage = up.wastage_qty !== undefined ? Math.max(0, up.wastage_qty) : current.wastage_qty;

    let closing = current.closing_actual_qty;
    let isCounted = current.is_counted;

    if (up.closing_actual_qty !== undefined) {
      if (up.closing_actual_qty === null) {
        closing = null;
        isCounted = false;
      } else {
        closing = Math.max(0, up.closing_actual_qty);
        isCounted = true;
      }
    }

    if (up.is_counted !== undefined) {
      isCounted = up.is_counted;
    }

    const calculatedUsed = calculateUsedQty(opening, purchased, wastage, closing);
    const unitCost = up.unit_cost !== undefined ? up.unit_cost : current.unit_cost;

    const closingStockValue =
      closing !== null && unitCost !== null && unitCost !== undefined
        ? Number((closing * unitCost).toFixed(2))
        : null;

    const usedCost =
      calculatedUsed !== null && unitCost !== null && unitCost !== undefined
        ? Number((calculatedUsed * unitCost).toFixed(2))
        : null;

    const wastageCost =
      wastage > 0 && unitCost !== null && unitCost !== undefined
        ? Number((wastage * unitCost).toFixed(2))
        : null;

    const updated: InventoryDayItem = {
      ...current,
      opening_qty: opening,
      purchased_qty: purchased,
      wastage_qty: wastage,
      closing_actual_qty: closing,
      calculated_used_qty: calculatedUsed,
      unit_cost: unitCost,
      closing_stock_value: closingStockValue,
      used_cost: usedCost,
      wastage_cost: wastageCost,
      is_counted: isCounted,
      counted_by: isCounted ? staffName : current.counted_by,
      counted_at: isCounted ? current.counted_at || new Date().toISOString() : null,
      notes: up.notes !== undefined ? up.notes : current.notes,
      updated_at: new Date().toISOString(),
    };

    store.dayItems[itemIndex] = updated;
    updatedItems.push(updated);
  }

  // Recalculate Day stats
  const allDayItems = store.dayItems.filter((di) => di.inventory_day_id === dayId);
  const countedCount = allDayItems.filter((di) => di.is_counted).length;
  const newStatus: InventoryDayStatus =
    countedCount === 0
      ? "DRAFT"
      : countedCount === allDayItems.length
      ? "READY_FOR_REVIEW"
      : "COUNTING";

  let totalClosing = 0;
  let totalUsed = 0;
  let totalWastage = 0;
  let totalPurchase = 0;
  for (const it of allDayItems) {
    if (it.closing_stock_value) totalClosing += it.closing_stock_value;
    if (it.used_cost) totalUsed += it.used_cost;
    if (it.wastage_cost) totalWastage += it.wastage_cost;
    if (it.total_purchase_cost) totalPurchase += it.total_purchase_cost;
  }

  store.days[dayIndex] = {
    ...day,
    counted_ingredients: countedCount,
    status: newStatus,
    checked_by: staffName,
    total_closing_stock_value: Number(totalClosing.toFixed(2)),
    total_used_value: Number(totalUsed.toFixed(2)),
    total_wastage_value: Number(totalWastage.toFixed(2)),
    total_purchase_value: Number(totalPurchase.toFixed(2)),
    updated_at: new Date().toISOString(),
  };

  writeLocalStore(store);

  // Sync to Supabase
  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      for (const item of updatedItems) {
        await admin
          .from("inventory_day_items")
          .update({
            opening_qty: item.opening_qty,
            purchased_qty: item.purchased_qty,
            wastage_qty: item.wastage_qty,
            closing_actual_qty: item.closing_actual_qty,
            calculated_used_qty: item.calculated_used_qty,
            unit_cost: item.unit_cost,
            closing_stock_value: item.closing_stock_value,
            used_cost: item.used_cost,
            wastage_cost: item.wastage_cost,
            is_counted: item.is_counted,
            counted_by: item.counted_by,
            counted_at: item.counted_at,
            notes: item.notes,
            updated_at: item.updated_at,
          })
          .eq("id", item.id);
      }
      await admin
        .from("inventory_days")
        .update({
          counted_ingredients: countedCount,
          status: store.days[dayIndex].status,
          checked_by: staffName,
          total_closing_stock_value: store.days[dayIndex].total_closing_stock_value,
          total_used_value: store.days[dayIndex].total_used_value,
          total_wastage_value: store.days[dayIndex].total_wastage_value,
          total_purchase_value: store.days[dayIndex].total_purchase_value,
          updated_at: store.days[dayIndex].updated_at,
        })
        .eq("id", dayId);
    } catch {}
  }

  return {
    success: true,
    day: store.days[dayIndex],
    items: allDayItems.sort((a, b) => a.ingredient_number - b.ingredient_number),
  };
}

// 5. Stock Checklist Single Item Count (Fast mobile tap/input)
export async function markChecklistItemCounted(
  dayId: string,
  ingredientId: string,
  physicalQty: number | null,
  staffName: string = "Staff",
  isCounted: boolean = true
): Promise<InventoryDayItem> {
  const result = await updateDayItemsBatch(
    dayId,
    [
      {
        id: ingredientId,
        closing_actual_qty: physicalQty,
        is_counted: isCounted,
      },
    ],
    staffName
  );

  const found = result.items.find((i) => i.ingredient_id === ingredientId || i.id === ingredientId);
  if (!found) throw new Error("Item not found after update");
  return found;
}

// 6. Finalize Day Register & Propagate Carry-Forward to Next Day
export async function finalizeDayRegister(
  dayId: string,
  managerName: string = "Manager",
  notes?: string
): Promise<InventoryDay> {
  const store = readLocalStore();
  const dayIndex = store.days.findIndex((d) => d.id === dayId);
  if (dayIndex === -1) throw new Error(`Inventory day '${dayId}' not found.`);

  const finalizedAt = new Date().toISOString();
  const day = store.days[dayIndex];
  day.status = "FINALIZED";
  day.finalized_by = managerName;
  day.finalized_at = finalizedAt;
  if (notes) day.notes = notes;
  day.updated_at = finalizedAt;

  const dayItems = store.dayItems.filter((di) => di.inventory_day_id === dayId);

  // Compute final day valuation
  let totalClosing = 0;
  let totalUsed = 0;
  let totalWastage = 0;
  let totalPurchase = 0;
  for (const item of dayItems) {
    if (item.closing_stock_value) totalClosing += item.closing_stock_value;
    if (item.used_cost) totalUsed += item.used_cost;
    if (item.wastage_cost) totalWastage += item.wastage_cost;
    if (item.total_purchase_cost) totalPurchase += item.total_purchase_cost;
  }
  day.total_closing_stock_value = Number(totalClosing.toFixed(2));
  day.total_used_value = Number(totalUsed.toFixed(2));
  day.total_wastage_value = Number(totalWastage.toFixed(2));
  day.total_purchase_value = Number(totalPurchase.toFixed(2));

  // Carry forward to subsequent DRAFT days!
  const subsequentDraftDays = store.days
    .filter((d) => d.date > day.date && d.status === "DRAFT")
    .sort((a, b) => a.date.localeCompare(b.date));

  if (subsequentDraftDays.length > 0) {
    const nextDay = subsequentDraftDays[0];
    const nextDayItems = store.dayItems.filter((di) => di.inventory_day_id === nextDay.id);
    for (const prevItem of dayItems) {
      const nextItem = nextDayItems.find((ni) => ni.ingredient_id === prevItem.ingredient_id);
      if (nextItem) {
        nextItem.opening_qty = prevItem.closing_actual_qty !== null ? prevItem.closing_actual_qty : 0;
        nextItem.calculated_used_qty = calculateUsedQty(
          nextItem.opening_qty,
          nextItem.purchased_qty,
          nextItem.wastage_qty,
          nextItem.closing_actual_qty
        );
        const itemPurchases = (store.purchases || []).filter(
          (p) => p.date === nextDay.date && p.ingredient_id === nextItem.ingredient_id
        );
        const costCalc = calculateWeightedAverageCost(
          nextItem.opening_qty,
          prevItem.unit_cost,
          nextItem.purchased_qty,
          itemPurchases,
          null
        );
        nextItem.unit_cost = costCalc.unitCost;
        nextItem.opening_stock_value = costCalc.openingStockValue;
        nextItem.closing_stock_value =
          nextItem.closing_actual_qty !== null && nextItem.unit_cost != null
            ? Number((nextItem.closing_actual_qty * nextItem.unit_cost).toFixed(2))
            : null;
        nextItem.used_cost =
          nextItem.calculated_used_qty !== null && nextItem.unit_cost != null
            ? Number((nextItem.calculated_used_qty * nextItem.unit_cost).toFixed(2))
            : null;
      }
    }
  }

  writeLocalStore(store);

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      await admin
        .from("inventory_days")
        .update({
          status: "FINALIZED",
          finalized_by: managerName,
          finalized_at: finalizedAt,
          total_closing_stock_value: day.total_closing_stock_value,
          total_used_value: day.total_used_value,
          total_wastage_value: day.total_wastage_value,
          total_purchase_value: day.total_purchase_value,
          updated_at: finalizedAt,
        })
        .eq("id", dayId);
    } catch {}
  }

  return day;
}

// 7. Reopen Day Register for Corrections (Switches status back to DRAFT)
export async function reopenDayRegister(
  dayId: string,
  adminName: string = "Admin",
  reason?: string
): Promise<InventoryDay> {
  const store = readLocalStore();
  const dayIndex = store.days.findIndex((d) => d.id === dayId);
  if (dayIndex === -1) throw new Error(`Inventory day '${dayId}' not found.`);

  const reopenedAt = new Date().toISOString();
  store.days[dayIndex].status = "DRAFT";
  store.days[dayIndex].finalized_at = null;
  store.days[dayIndex].finalized_by = null;
  store.days[dayIndex].updated_at = reopenedAt;
  if (reason) {
    store.days[dayIndex].notes = `[Reopened by ${adminName} at ${reopenedAt}]: ${reason}`;
  }

  writeLocalStore(store);

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      await admin
        .from("inventory_days")
        .update({
          status: "DRAFT",
          finalized_at: null,
          finalized_by: null,
          updated_at: reopenedAt,
        })
        .eq("id", dayId);
    } catch (e) {
      console.warn("Supabase update for reopenDayRegister failed:", e);
    }
  }

  return store.days[dayIndex];
}

// 8. Purchases (Date-Wise Purchase Records & Weighted-Average Updating)
export async function recordInventoryPurchase(
  purchase: Omit<InventoryPurchaseRecord, "id" | "created_at">
): Promise<{
  purchase: InventoryPurchaseRecord;
  dayItem: InventoryDayItem | null;
}> {
  const store = readLocalStore();
  if (!store.purchases) store.purchases = [];

  const id = `pur_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const totalCost = Number((purchase.quantity * purchase.price_per_unit).toFixed(2));

  const newPurchase: InventoryPurchaseRecord = {
    id,
    ingredient_id: purchase.ingredient_id,
    ingredient_name: purchase.ingredient_name,
    date: purchase.date,
    quantity: Number(purchase.quantity),
    unit: purchase.unit,
    price_per_unit: Number(purchase.price_per_unit),
    total_cost: totalCost,
    supplier: purchase.supplier || null,
    recorded_by: purchase.recorded_by || "Admin",
    notes: purchase.notes || null,
    created_at: new Date().toISOString(),
  };

  store.purchases.push(newPurchase);

  // Also log into movements for backwards compatibility
  store.movements.unshift({
    id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ingredient_id: purchase.ingredient_id,
    ingredient_name: purchase.ingredient_name,
    date: purchase.date,
    movement_type: "PURCHASE",
    quantity: Number(purchase.quantity),
    unit: purchase.unit,
    supplier: purchase.supplier || null,
    cost: totalCost,
    recorded_by: purchase.recorded_by || "Admin",
    created_at: new Date().toISOString(),
  });

  // Reconcile into target date's day item
  let updatedDayItem: InventoryDayItem | null = null;
  const day = store.days.find((d) => d.date === purchase.date);
  if (day) {
    const itemIndex = store.dayItems.findIndex(
      (di) => di.inventory_day_id === day.id && di.ingredient_id === purchase.ingredient_id
    );
    if (itemIndex !== -1) {
      const allItemPurchases = store.purchases.filter(
        (p) => p.date === purchase.date && p.ingredient_id === purchase.ingredient_id
      );
      const totalPurchasedQty = allItemPurchases.reduce((acc, p) => acc + p.quantity, 0);
      store.dayItems[itemIndex].purchased_qty = Number(totalPurchasedQty.toFixed(3));
      store.dayItems[itemIndex].calculated_used_qty = calculateUsedQty(
        store.dayItems[itemIndex].opening_qty,
        store.dayItems[itemIndex].purchased_qty,
        store.dayItems[itemIndex].wastage_qty,
        store.dayItems[itemIndex].closing_actual_qty
      );

      const ing = store.ingredients.find((i) => i.id === purchase.ingredient_id);
      const costCalc = calculateWeightedAverageCost(
        store.dayItems[itemIndex].opening_qty,
        store.dayItems[itemIndex].unit_cost,
        store.dayItems[itemIndex].purchased_qty,
        allItemPurchases,
        ing?.cost_per_unit
      );
      store.dayItems[itemIndex].unit_cost = costCalc.unitCost;
      store.dayItems[itemIndex].latest_purchase_price = newPurchase.price_per_unit;
      store.dayItems[itemIndex].total_purchase_cost = costCalc.totalPurchaseCost;

      if (store.dayItems[itemIndex].closing_actual_qty !== null && costCalc.unitCost !== null) {
        store.dayItems[itemIndex].closing_stock_value = Number(
          (store.dayItems[itemIndex].closing_actual_qty! * costCalc.unitCost).toFixed(2)
        );
      }
      if (store.dayItems[itemIndex].calculated_used_qty !== null && costCalc.unitCost !== null) {
        store.dayItems[itemIndex].used_cost = Number(
          (store.dayItems[itemIndex].calculated_used_qty! * costCalc.unitCost).toFixed(2)
        );
      }
      store.dayItems[itemIndex].updated_at = new Date().toISOString();
      updatedDayItem = store.dayItems[itemIndex];
    }
  }

  writeLocalStore(store);

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      await admin.from("inventory_purchases").insert(newPurchase);
    } catch {}
  }

  return { purchase: newPurchase, dayItem: updatedDayItem };
}

export async function deleteInventoryPurchase(
  purchaseId: string
): Promise<{ success: boolean; message?: string }> {
  const store = readLocalStore();
  if (!store.purchases) store.purchases = [];
  const idx = store.purchases.findIndex((p) => p.id === purchaseId);
  if (idx === -1) return { success: false, message: "Purchase not found" };

  const [removed] = store.purchases.splice(idx, 1);

  // Recalculate day item
  const day = store.days.find((d) => d.date === removed.date);
  if (day) {
    const itemIndex = store.dayItems.findIndex(
      (di) => di.inventory_day_id === day.id && di.ingredient_id === removed.ingredient_id
    );
    if (itemIndex !== -1) {
      const remainingPurchases = store.purchases.filter(
        (p) => p.date === removed.date && p.ingredient_id === removed.ingredient_id
      );
      const totalPurchasedQty = remainingPurchases.reduce((acc, p) => acc + p.quantity, 0);
      store.dayItems[itemIndex].purchased_qty = Number(totalPurchasedQty.toFixed(3));
      store.dayItems[itemIndex].calculated_used_qty = calculateUsedQty(
        store.dayItems[itemIndex].opening_qty,
        store.dayItems[itemIndex].purchased_qty,
        store.dayItems[itemIndex].wastage_qty,
        store.dayItems[itemIndex].closing_actual_qty
      );
      const ing = store.ingredients.find((i) => i.id === removed.ingredient_id);
      const costCalc = calculateWeightedAverageCost(
        store.dayItems[itemIndex].opening_qty,
        store.dayItems[itemIndex].unit_cost,
        store.dayItems[itemIndex].purchased_qty,
        remainingPurchases,
        ing?.cost_per_unit
      );
      store.dayItems[itemIndex].unit_cost = costCalc.unitCost;
      store.dayItems[itemIndex].latest_purchase_price = costCalc.latestPurchasePrice;
      store.dayItems[itemIndex].total_purchase_cost = costCalc.totalPurchaseCost;

      if (store.dayItems[itemIndex].closing_actual_qty !== null && costCalc.unitCost !== null) {
        store.dayItems[itemIndex].closing_stock_value = Number(
          (store.dayItems[itemIndex].closing_actual_qty! * costCalc.unitCost).toFixed(2)
        );
      }
      if (store.dayItems[itemIndex].calculated_used_qty !== null && costCalc.unitCost !== null) {
        store.dayItems[itemIndex].used_cost = Number(
          (store.dayItems[itemIndex].calculated_used_qty! * costCalc.unitCost).toFixed(2)
        );
      }
      store.dayItems[itemIndex].updated_at = new Date().toISOString();
    }
  }

  writeLocalStore(store);

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      await admin.from("inventory_purchases").delete().eq("id", purchaseId);
    } catch {}
  }

  return { success: true };
}

export async function getInventoryPurchases(
  ingredientId?: string,
  date?: string
): Promise<InventoryPurchaseRecord[]> {
  const store = readLocalStore();
  let list = store.purchases || [];
  if (ingredientId) {
    list = list.filter((p) => p.ingredient_id === ingredientId);
  }
  if (date) {
    list = list.filter((p) => p.date === date);
  }
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

// 9. Category Management (Edit, Reorder, Archive, Move Ingredients)
export async function archiveInventoryCategory(
  categoryId: string
): Promise<{ success: boolean; message?: string }> {
  const store = readLocalStore();
  const catIndex = store.categories.findIndex((c) => c.id === categoryId);
  if (catIndex === -1) return { success: false, message: "Category not found" };

  const activeCount = store.ingredients.filter((i) => i.is_active && i.category_id === categoryId).length;
  if (activeCount > 0) {
    return {
      success: false,
      message: `Cannot archive category: ${activeCount} active ingredient(s) are assigned to it. Please move them to another category first.`,
    };
  }

  store.categories[catIndex].is_active = false;
  store.categories[catIndex].updated_at = new Date().toISOString();
  writeLocalStore(store);

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      await admin.from("inventory_categories").update({ is_active: false }).eq("id", categoryId);
    } catch {}
  }

  return { success: true };
}

export async function moveIngredientCategory(
  ingredientId: string,
  newCategoryId: string
): Promise<{ success: boolean; ingredient?: InventoryIngredient; message?: string }> {
  const store = readLocalStore();
  const ingIndex = store.ingredients.findIndex((i) => i.id === ingredientId);
  if (ingIndex === -1) return { success: false, message: "Ingredient not found" };

  const targetCategory = store.categories.find((c) => c.id === newCategoryId);
  if (!targetCategory) return { success: false, message: "Target category not found" };

  store.ingredients[ingIndex].category_id = newCategoryId;
  store.ingredients[ingIndex].updated_at = new Date().toISOString();

  // Update category on active daily registers
  for (const item of store.dayItems) {
    if (item.ingredient_id === ingredientId) {
      item.category_id = newCategoryId;
      item.category_name = targetCategory.name;
    }
  }

  writeLocalStore(store);

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      await admin
        .from("inventory_ingredients")
        .update({ category_id: newCategoryId, updated_at: new Date().toISOString() })
        .eq("id", ingredientId);
      await admin
        .from("inventory_day_items")
        .update({ category_id: newCategoryId, category_name: targetCategory.name })
        .eq("ingredient_id", ingredientId);
    } catch {}
  }

  return { success: true, ingredient: store.ingredients[ingIndex] };
}

export async function updateIngredientCost(
  ingredientId: string,
  costPerUnit: number
): Promise<{ success: boolean; ingredient?: InventoryIngredient }> {
  const store = readLocalStore();
  const ingIndex = store.ingredients.findIndex((i) => i.id === ingredientId);
  if (ingIndex === -1) return { success: false };

  store.ingredients[ingIndex].cost_per_unit = Number(costPerUnit);
  store.ingredients[ingIndex].updated_at = new Date().toISOString();

  writeLocalStore(store);

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      await admin
        .from("inventory_ingredients")
        .update({ cost_per_unit: Number(costPerUnit), updated_at: new Date().toISOString() })
        .eq("id", ingredientId);
    } catch {}
  }

  return { success: true, ingredient: store.ingredients[ingIndex] };
}

// 10. Movements (Audited Purchases and Wastage)
export async function recordInventoryMovement(
  movement: Omit<InventoryMovement, "id" | "created_at">
): Promise<InventoryMovement> {
  const store = readLocalStore();
  const id = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newMov: InventoryMovement = {
    id,
    ...movement,
    created_at: new Date().toISOString(),
  };

  store.movements.unshift(newMov);

  const targetDate = movement.date || getKolkataDateString();
  const day = store.days.find((d) => d.date === targetDate);
  if (day) {
    const itemIndex = store.dayItems.findIndex(
      (di) => di.inventory_day_id === day.id && di.ingredient_id === movement.ingredient_id
    );
    if (itemIndex !== -1) {
      const current = store.dayItems[itemIndex];
      if (movement.movement_type === "PURCHASE") {
        current.purchased_qty += movement.quantity;
      } else if (movement.movement_type === "WASTAGE") {
        current.wastage_qty += movement.quantity;
      }
      current.calculated_used_qty = calculateUsedQty(
        current.opening_qty,
        current.purchased_qty,
        current.wastage_qty,
        current.closing_actual_qty
      );
      current.updated_at = new Date().toISOString();
    }
  }

  writeLocalStore(store);

  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      await admin.from("inventory_movements").insert(newMov);
    } catch {}
  }

  return newMov;
}

export async function getInventoryMovements(
  ingredientId?: string,
  limit: number = 50
): Promise<InventoryMovement[]> {
  const store = readLocalStore();
  let list = store.movements;
  if (ingredientId) {
    list = list.filter((m) => m.ingredient_id === ingredientId);
  }
  return list.slice(0, limit);
}

// 11. Dashboard Aggregation
export async function getInventoryDashboard(dateStr?: string): Promise<InventoryDashboardData> {
  const { day, items, categories } = await getOrCreateDayRegister(dateStr);
  const ingredients = await getInventoryIngredients();

  const totalIngredients = ingredients.length;
  const totalCategories = categories.length;
  const countedToday = items.filter((i) => i.is_counted).length;

  const ingMap = new Map(ingredients.map((ing) => [ing.id, ing]));
  let lowStockCount = 0;

  for (const item of items) {
    const ing = ingMap.get(item.ingredient_id);
    const minThreshold = ing?.min_stock_level || 0;
    const currentQty =
      item.closing_actual_qty !== null ? item.closing_actual_qty : item.opening_qty;
    if (currentQty <= minThreshold) {
      lowStockCount++;
    }
  }

  const categoryProgress: Record<
    string,
    {
      categoryId: string;
      categoryCode: string;
      categoryName: string;
      total: number;
      counted: number;
      isDone: boolean;
    }
  > = {};

  for (const cat of categories) {
    const catItems = items.filter((i) => i.category_id === cat.id);
    const countedCat = catItems.filter((i) => i.is_counted).length;
    categoryProgress[cat.id] = {
      categoryId: cat.id,
      categoryCode: cat.code,
      categoryName: cat.name,
      total: catItems.length,
      counted: countedCat,
      isDone: catItems.length > 0 && countedCat === catItems.length,
    };
  }

  return {
    date: day.date,
    day,
    totalIngredients,
    totalCategories,
    countedToday,
    lowStockCount,
    categories,
    items,
    categoryProgress,
  };
}

// 12. Inventory Analytics Data Engine
export interface InventoryAnalyticsData {
  startDate: string;
  endDate: string;
  totalFinalizedDays: number;
  totalConsumptionCost: number; // ₹
  totalPurchasedCost: number; // ₹
  totalWastageCost: number; // ₹
  latestClosingStockValue: number; // ₹
  latestFinalizedDate: string | null;
  missingCostItemsCount: number;
  dailyConsumptionTrend: Array<{
    date: string;
    consumptionCost: number;
    purchasedCost: number;
    wastageCost: number;
  }>;
  categoryConsumption: Array<{
    categoryId: string;
    categoryCode: string;
    categoryName: string;
    consumptionCost: number;
    purchasedCost: number;
    closingStockValue: number;
  }>;
  highestConsumptionIngredients: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    usedQty: number;
    consumptionCost: number;
    avgUnitCost: number;
  }>;
  mostUsedIngredients: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    usedQty: number;
  }>;
  mostWastedIngredients: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    wastageQty: number;
    wastageCost: number;
  }>;
  purchasesHistory: Array<{
    id: string;
    date: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalCost: number;
    supplier?: string | null;
  }>;
}

export async function getInventoryAnalytics(
  startDate: string,
  endDate: string
): Promise<InventoryAnalyticsData> {
  const store = readLocalStore();
  const categories = await getInventoryCategories();
  const ingredients = await getInventoryIngredients();

  const finalizedDays = store.days
    .filter((d) => d.date >= startDate && d.date <= endDate && d.status === "FINALIZED")
    .sort((a, b) => a.date.localeCompare(b.date));

  const latestFinalizedDay =
    finalizedDays.length > 0 ? finalizedDays[finalizedDays.length - 1] : null;

  let totalConsumptionCost = 0;
  let totalPurchasedCost = 0;
  let totalWastageCost = 0;
  let latestClosingStockValue = 0;

  if (latestFinalizedDay) {
    const latestItems = store.dayItems.filter((di) => di.inventory_day_id === latestFinalizedDay.id);
    for (const it of latestItems) {
      if (it.closing_stock_value) {
        latestClosingStockValue += it.closing_stock_value;
      }
    }
  }

  // Groupings by ingredient and category
  const ingUsageMap: Record<
    string,
    {
      ingredientId: string;
      ingredientName: string;
      unit: string;
      usedQty: number;
      consumptionCost: number;
      unitCosts: number[];
      wastageQty: number;
      wastageCost: number;
    }
  > = {};

  const catConsumptionMap: Record<
    string,
    {
      categoryId: string;
      categoryCode: string;
      categoryName: string;
      consumptionCost: number;
      purchasedCost: number;
      closingStockValue: number;
    }
  > = {};

  for (const cat of categories) {
    catConsumptionMap[cat.id] = {
      categoryId: cat.id,
      categoryCode: cat.code,
      categoryName: cat.name,
      consumptionCost: 0,
      purchasedCost: 0,
      closingStockValue: 0,
    };
  }

  const dailyConsumptionTrend: Array<{
    date: string;
    consumptionCost: number;
    purchasedCost: number;
    wastageCost: number;
  }> = [];

  let missingCostItemsCount = 0;

  for (const day of finalizedDays) {
    const dayItems = store.dayItems.filter((di) => di.inventory_day_id === day.id);
    let dayUsedVal = 0;
    let dayPurchaseVal = 0;
    let dayWastageVal = 0;

    for (const it of dayItems) {
      if (!ingUsageMap[it.ingredient_id]) {
        ingUsageMap[it.ingredient_id] = {
          ingredientId: it.ingredient_id,
          ingredientName: it.ingredient_name,
          unit: it.unit,
          usedQty: 0,
          consumptionCost: 0,
          unitCosts: [],
          wastageQty: 0,
          wastageCost: 0,
        };
      }

      if (it.calculated_used_qty !== null && it.calculated_used_qty > 0) {
        ingUsageMap[it.ingredient_id].usedQty += it.calculated_used_qty;
      }

      if (it.used_cost !== null && it.used_cost !== undefined) {
        ingUsageMap[it.ingredient_id].consumptionCost += it.used_cost;
        dayUsedVal += it.used_cost;
        if (catConsumptionMap[it.category_id]) {
          catConsumptionMap[it.category_id].consumptionCost += it.used_cost;
        }
      } else if (it.calculated_used_qty !== null && it.calculated_used_qty > 0) {
        missingCostItemsCount++;
      }

      if (it.unit_cost) {
        ingUsageMap[it.ingredient_id].unitCosts.push(it.unit_cost);
      }

      if (it.wastage_qty > 0) {
        ingUsageMap[it.ingredient_id].wastageQty += it.wastage_qty;
        if (it.wastage_cost) {
          ingUsageMap[it.ingredient_id].wastageCost += it.wastage_cost;
          dayWastageVal += it.wastage_cost;
        }
      }

      if (it.total_purchase_cost) {
        dayPurchaseVal += it.total_purchase_cost;
        if (catConsumptionMap[it.category_id]) {
          catConsumptionMap[it.category_id].purchasedCost += it.total_purchase_cost;
        }
      }
    }

    totalConsumptionCost += dayUsedVal;
    totalPurchasedCost += dayPurchaseVal;
    totalWastageCost += dayWastageVal;

    dailyConsumptionTrend.push({
      date: day.date,
      consumptionCost: Number(dayUsedVal.toFixed(2)),
      purchasedCost: Number(dayPurchaseVal.toFixed(2)),
      wastageCost: Number(dayWastageVal.toFixed(2)),
    });
  }

  // In latest day, record category closing stock value
  if (latestFinalizedDay) {
    const latestItems = store.dayItems.filter((di) => di.inventory_day_id === latestFinalizedDay.id);
    for (const it of latestItems) {
      if (it.closing_stock_value && catConsumptionMap[it.category_id]) {
        catConsumptionMap[it.category_id].closingStockValue += it.closing_stock_value;
      }
    }
  }

  const allUsageList = Object.values(ingUsageMap);

  // Highest consumption cost
  const highestConsumptionIngredients = [...allUsageList]
    .filter((u) => u.consumptionCost > 0)
    .sort((a, b) => b.consumptionCost - a.consumptionCost)
    .slice(0, 15)
    .map((u) => ({
      ingredientId: u.ingredientId,
      ingredientName: u.ingredientName,
      unit: u.unit,
      usedQty: Number(u.usedQty.toFixed(2)),
      consumptionCost: Number(u.consumptionCost.toFixed(2)),
      avgUnitCost:
        u.unitCosts.length > 0
          ? Number((u.unitCosts.reduce((a, b) => a + b, 0) / u.unitCosts.length).toFixed(2))
          : 0,
    }));

  // Most used ingredients by quantity (preserving units)
  const mostUsedIngredients = [...allUsageList]
    .filter((u) => u.usedQty > 0)
    .sort((a, b) => b.usedQty - a.usedQty)
    .slice(0, 15)
    .map((u) => ({
      ingredientId: u.ingredientId,
      ingredientName: u.ingredientName,
      unit: u.unit,
      usedQty: Number(u.usedQty.toFixed(2)),
    }));

  // Most wasted ingredients
  const mostWastedIngredients = [...allUsageList]
    .filter((u) => u.wastageQty > 0)
    .sort((a, b) => b.wastageCost - a.wastageCost || b.wastageQty - a.wastageQty)
    .slice(0, 15)
    .map((u) => ({
      ingredientId: u.ingredientId,
      ingredientName: u.ingredientName,
      unit: u.unit,
      wastageQty: Number(u.wastageQty.toFixed(2)),
      wastageCost: Number(u.wastageCost.toFixed(2)),
    }));

  // Filter purchases for date range
  const purchasesHistory = (store.purchases || [])
    .filter((p) => p.date >= startDate && p.date <= endDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p) => {
      const ing = ingredients.find((i) => i.id === p.ingredient_id);
      return {
        id: p.id,
        date: p.date,
        ingredientName: p.ingredient_name || ing?.name || p.ingredient_id,
        quantity: p.quantity,
        unit: p.unit,
        pricePerUnit: p.price_per_unit,
        totalCost: p.total_cost,
        supplier: p.supplier || null,
      };
    });

  return {
    startDate,
    endDate,
    totalFinalizedDays: finalizedDays.length,
    totalConsumptionCost: Number(totalConsumptionCost.toFixed(2)),
    totalPurchasedCost: Number(totalPurchasedCost.toFixed(2)),
    totalWastageCost: Number(totalWastageCost.toFixed(2)),
    latestClosingStockValue: Number(latestClosingStockValue.toFixed(2)),
    latestFinalizedDate: latestFinalizedDay?.date || null,
    missingCostItemsCount,
    dailyConsumptionTrend,
    categoryConsumption: Object.values(catConsumptionMap).map((c) => ({
      ...c,
      consumptionCost: Number(c.consumptionCost.toFixed(2)),
      purchasedCost: Number(c.purchasedCost.toFixed(2)),
      closingStockValue: Number(c.closingStockValue.toFixed(2)),
    })),
    highestConsumptionIngredients,
    mostUsedIngredients,
    mostWastedIngredients,
    purchasesHistory,
  };
}

// 13. CSV Export Generator
export function generateRegisterCSV(
  day: InventoryDay,
  items: InventoryDayItem[],
  categories: InventoryCategory[]
): string {
  const lines: string[] = [];
  lines.push(`SPIRAL CAFE — DAILY INVENTORY REGISTER`);
  lines.push(`Date: ${day.date}, Status: ${day.status}, Staff: ${day.checked_by || "Staff"}`);
  lines.push(
    `Formula: Used = Opening + Purchased - Wastage - Closing Actual | Stock Value = Closing Actual * Weighted Avg Cost`
  );
  lines.push("");
  lines.push(
    "Item #,Category,Ingredient,Unit,Opening,Purchased,Wastage,Closing Actual,Unit Cost (Rs),Stock Value (Rs),Used,Used Cost (Rs),Status,Notes"
  );

  const catMap = new Map(categories.map((c) => [c.id, c]));

  for (const item of items) {
    const cat = catMap.get(item.category_id);
    const catLabel = cat ? `[${cat.code}] ${cat.name}` : item.category_name;
    const closingStr = item.closing_actual_qty !== null ? item.closing_actual_qty.toString() : "";
    const unitCostStr = item.unit_cost !== null && item.unit_cost !== undefined ? item.unit_cost.toFixed(2) : "Not Set";
    const stockValStr =
      item.closing_stock_value !== null && item.closing_stock_value !== undefined
        ? item.closing_stock_value.toFixed(2)
        : "";
    const usedStr = item.calculated_used_qty !== null ? item.calculated_used_qty.toString() : "";
    const usedCostStr =
      item.used_cost !== null && item.used_cost !== undefined ? item.used_cost.toFixed(2) : "";
    const statusStr = item.is_counted ? "COUNTED" : "PENDING";
    const notesClean = (item.notes || "").replace(/"/g, '""');

    lines.push(
      [
        item.ingredient_number,
        `"${catLabel}"`,
        `"${item.ingredient_name}"`,
        item.unit,
        item.opening_qty,
        item.purchased_qty,
        item.wastage_qty,
        closingStr,
        unitCostStr,
        stockValStr,
        usedStr,
        usedCostStr,
        statusStr,
        `"${notesClean}"`,
      ].join(",")
    );
  }

  return lines.join("\r\n");
}
