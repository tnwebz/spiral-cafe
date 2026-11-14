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
  InventoryDashboardData,
  DEFAULT_CATEGORIES,
  DEFAULT_INGREDIENTS,
  getKolkataDateString,
  calculateUsedQty,
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
}

function getLocalStorePath(): string {
  return path.join(process.cwd(), "src", "data", "inventory_store.json");
}

function readLocalStore(): LocalStoreSchema {
  const filePath = getLocalStorePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
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
  store.ingredients[idx] = { ...store.ingredients[idx], ...patch, updated_at: new Date().toISOString() };
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

  // Try Supabase first
  if (await isSupabaseAvailable()) {
    try {
      const admin = getSupabaseAdminClient() as any;
      // Check existing day
      const { data: existingDay } = await admin
        .from("inventory_days")
        .select("*")
        .eq("date", targetDate)
        .maybeSingle();

      if (existingDay) {
        const { data: dayItems } = await admin
          .from("inventory_day_items")
          .select("*")
          .eq("inventory_day_id", existingDay.id)
          .order("ingredient_number", { ascending: true });

        const itemsList: InventoryDayItem[] = (dayItems || []) as InventoryDayItem[];
        const existingIngIds = new Set(itemsList.map((i) => i.ingredient_id));
        const missing = ingredients.filter((ing) => !existingIngIds.has(ing.id));

        if (missing.length > 0) {
          const catMap = new Map(categories.map((c) => [c.id, c.name]));
          const missingItems: InventoryDayItem[] = missing.map((ing) => ({
            id: `item_${existingDay.id}_${ing.id}`,
            inventory_day_id: existingDay.id,
            ingredient_id: ing.id,
            ingredient_number: ing.item_number,
            ingredient_name: ing.name,
            category_id: ing.category_id,
            category_name: catMap.get(ing.category_id) || "Other",
            unit: ing.unit,
            opening_qty: 0,
            purchased_qty: 0,
            wastage_qty: 0,
            closing_actual_qty: null,
            calculated_used_qty: null,
            is_counted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          try {
            await admin.from("inventory_day_items").insert(missingItems);
            itemsList.push(...missingItems);
            itemsList.sort((a, b) => a.ingredient_number - b.ingredient_number);
            await admin
              .from("inventory_days")
              .update({ total_active_ingredients: ingredients.length })
              .eq("id", existingDay.id);
            existingDay.total_active_ingredients = ingredients.length;
          } catch (e) {
            console.warn("Reconciling missing day items to Supabase failed:", e);
          }
        }

        return {
          day: existingDay as InventoryDay,
          items: itemsList,
          categories,
        };
      }

      // Find previous day's closing actual quantities for carry-forward
      const { data: prevDay } = await admin
        .from("inventory_days")
        .select("id")
        .lt("date", targetDate)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      let prevClosingMap: Record<string, number> = {};
      if (prevDay) {
        const { data: prevItems } = await admin
          .from("inventory_day_items")
          .select("ingredient_id, closing_actual_qty")
          .eq("inventory_day_id", prevDay.id);
        if (prevItems) {
          prevItems.forEach((pi: any) => {
            if (pi.closing_actual_qty !== null && pi.closing_actual_qty !== undefined) {
              prevClosingMap[pi.ingredient_id] = Number(pi.closing_actual_qty);
            }
          });
        }
      }

      // Create new day row
      const dayId = `day_${targetDate.replace(/-/g, "")}`;
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

      await admin.from("inventory_days").insert(newDay);

      // Create day items with carry-forward opening balance
      const catMap = new Map(categories.map((c) => [c.id, c.name]));
      const itemsToInsert: InventoryDayItem[] = ingredients.map((ing) => {
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

      await admin.from("inventory_day_items").insert(itemsToInsert);

      return {
        day: newDay,
        items: itemsToInsert,
        categories,
      };
    } catch (err) {
      console.warn("Supabase day register retrieval failed, falling back to local store:", err);
    }
  }

  // Local JSON Store Fallback
  const store = readLocalStore();
  let day = store.days.find((d) => d.date === targetDate);

  if (day) {
    let items = store.dayItems.filter((di) => di.inventory_day_id === day!.id);
    const existingIngIds = new Set(items.map((i) => i.ingredient_id));
    const missing = ingredients.filter((ing) => !existingIngIds.has(ing.id));

    if (missing.length > 0) {
      const catMap = new Map(categories.map((c) => [c.id, c.name]));
      const missingItems: InventoryDayItem[] = missing.map((ing) => ({
        id: `item_${day!.id}_${ing.id}`,
        inventory_day_id: day!.id,
        ingredient_id: ing.id,
        ingredient_number: ing.item_number,
        ingredient_name: ing.name,
        category_id: ing.category_id,
        category_name: catMap.get(ing.category_id) || "Other",
        unit: ing.unit,
        opening_qty: 0,
        purchased_qty: 0,
        wastage_qty: 0,
        closing_actual_qty: null,
        calculated_used_qty: null,
        is_counted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      store.dayItems.push(...missingItems);
      day.total_active_ingredients = ingredients.length;
      writeLocalStore(store);
      items.push(...missingItems);
    }

    return {
      day,
      items: items.sort((a, b) => a.ingredient_number - b.ingredient_number),
      categories,
    };
  }

  // Find previous day for carry forward
  const sortedDays = [...store.days]
    .filter((d) => d.date < targetDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  const prevDay = sortedDays[0];

  const prevClosingMap: Record<string, number> = {};
  if (prevDay) {
    store.dayItems
      .filter((di) => di.inventory_day_id === prevDay.id)
      .forEach((di) => {
        if (di.closing_actual_qty !== null && di.closing_actual_qty !== undefined) {
          prevClosingMap[di.ingredient_id] = di.closing_actual_qty;
        }
      });
  }

  const dayId = `day_${targetDate.replace(/-/g, "")}`;
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

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

  const newItems: InventoryDayItem[] = ingredients.map((ing) => {
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
  store.dayItems.push(...newItems);
  writeLocalStore(store);

  return { day: newDay, items: newItems, categories };
}

// 4. Batch Update Quantities (Daily Register Rows)
export interface DayItemUpdateInput {
  id: string; // item id or ingredient_id
  opening_qty?: number;
  purchased_qty?: number;
  wastage_qty?: number;
  closing_actual_qty?: number | null;
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
  const dayIndex = store.days.findIndex((d) => d.id === dayId);
  if (dayIndex === -1) {
    throw new Error(`Inventory day '${dayId}' not found.`);
  }

  if (store.days[dayIndex].status === "FINALIZED") {
    throw new Error("This inventory day is FINALIZED and locked. Reopening is restricted to admin.");
  }

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

    const updated: InventoryDayItem = {
      ...current,
      opening_qty: opening,
      purchased_qty: purchased,
      wastage_qty: wastage,
      closing_actual_qty: closing,
      calculated_used_qty: calculatedUsed,
      is_counted: isCounted,
      counted_by: isCounted ? staffName : current.counted_by,
      counted_at: isCounted ? (current.counted_at || new Date().toISOString()) : null,
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

  store.days[dayIndex] = {
    ...store.days[dayIndex],
    counted_ingredients: countedCount,
    status: newStatus,
    checked_by: staffName,
    updated_at: new Date().toISOString(),
  };

  writeLocalStore(store);

  // Sync to Supabase in background / if active
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

// 6. Finalize Day Register
export async function finalizeDayRegister(
  dayId: string,
  managerName: string = "Manager",
  notes?: string
): Promise<InventoryDay> {
  const store = readLocalStore();
  const dayIndex = store.days.findIndex((d) => d.id === dayId);
  if (dayIndex === -1) throw new Error(`Inventory day '${dayId}' not found.`);

  const dayItems = store.dayItems.filter((di) => di.inventory_day_id === dayId);
  const uncounted = dayItems.filter((di) => !di.is_counted);

  // If there are uncounted items, require all or set remaining to 0 if manager approves
  const finalizedAt = new Date().toISOString();
  store.days[dayIndex] = {
    ...store.days[dayIndex],
    status: "FINALIZED",
    finalized_by: managerName,
    finalized_at: finalizedAt,
    notes: notes || store.days[dayIndex].notes,
    updated_at: finalizedAt,
  };

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
          notes: notes || store.days[dayIndex].notes,
          updated_at: finalizedAt,
        })
        .eq("id", dayId);
    } catch {}
  }

  return store.days[dayIndex];
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
  store.days[dayIndex] = {
    ...store.days[dayIndex],
    status: "DRAFT",
    updated_at: reopenedAt,
    notes: reason
      ? `[Reopened by ${adminName} at ${reopenedAt}]: ${reason}`
      : store.days[dayIndex].notes,
  };

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

// 7. Movements (Audited Purchases and Wastage)
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

  // Auto-accumulate into the corresponding day's inventory_day_items if dayId or date is present
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

// 8. Dashboard Aggregation
export async function getInventoryDashboard(dateStr?: string): Promise<InventoryDashboardData> {
  const { day, items, categories } = await getOrCreateDayRegister(dateStr);
  const ingredients = await getInventoryIngredients();

  const totalIngredients = ingredients.length;
  const totalCategories = categories.length;
  const countedToday = items.filter((i) => i.is_counted).length;

  // Low stock check: closing_actual_qty <= min_stock_level, or opening <= min if not counted
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

  // Category progress
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

// 9. CSV Export Generator
export function generateRegisterCSV(
  day: InventoryDay,
  items: InventoryDayItem[],
  categories: InventoryCategory[]
): string {
  const lines: string[] = [];
  lines.push(`SPIRAL CAFE — DAILY INVENTORY REGISTER`);
  lines.push(`Date: ${day.date}, Status: ${day.status}, Staff: ${day.checked_by || "Staff"}`);
  lines.push(
    `Formula: Used = Opening + Purchased - Wastage - Closing Actual`
  );
  lines.push("");
  lines.push("Item #,Category,Ingredient,Unit,Opening,Purchased,Wastage,Closing Actual,Used,Status,Notes");

  const catMap = new Map(categories.map((c) => [c.id, c]));

  for (const item of items) {
    const cat = catMap.get(item.category_id);
    const catLabel = cat ? `[${cat.code}] ${cat.name}` : item.category_name;
    const closingStr = item.closing_actual_qty !== null ? item.closing_actual_qty.toString() : "";
    const usedStr = item.calculated_used_qty !== null ? item.calculated_used_qty.toString() : "";
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
        usedStr,
        statusStr,
        `"${notesClean}"`,
      ].join(",")
    );
  }

  return lines.join("\r\n");
}
