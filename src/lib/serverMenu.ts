import { menuData, bestSellingItems, MenuItem } from "@/data/menu";
import { supabaseAdmin } from "@/lib/supabase/admin";

// In-memory cache for dynamic DB menu items (5-minute TTL)
let dbItemsCache: Map<string, { price: number; name: string }> = new Map();
let lastCacheTime = 0;

// Build fast static lookup map
const staticMenuMap = new Map<string, { price: number; name: string }>();

function initStaticMap() {
  if (staticMenuMap.size > 0) return;

  bestSellingItems.forEach((it) => {
    staticMenuMap.set(it.id.toLowerCase(), { price: it.price, name: it.name });
    staticMenuMap.set(it.name.toLowerCase().trim(), { price: it.price, name: it.name });
  });

  menuData.forEach((cat) => {
    cat.items.forEach((it) => {
      staticMenuMap.set(it.id.toLowerCase(), { price: it.price, name: it.name });
      staticMenuMap.set(it.name.toLowerCase().trim(), { price: it.price, name: it.name });
    });
  });
}

initStaticMap();

/**
 * Fetch authoritative item price and details from trusted server sources.
 * Prevents client-side price tampering or spoofed item pricing.
 */
export async function getAuthoritativeItemPrice(
  productId: string,
  name?: string
): Promise<{ price: number; name: string } | null> {
  initStaticMap();

  const cleanId = (productId || "").toLowerCase().trim();
  const cleanName = (name || "").toLowerCase().trim();

  // 1. Check static menu catalog
  if (staticMenuMap.has(cleanId)) {
    return staticMenuMap.get(cleanId)!;
  }
  if (cleanName && staticMenuMap.has(cleanName)) {
    return staticMenuMap.get(cleanName)!;
  }

  // 2. Check dynamic database items (with lightweight cache)
  const now = Date.now();
  if (now - lastCacheTime > 5 * 60 * 1000 || dbItemsCache.size === 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from("menu_items")
        .select("id, name, price")
        .eq("available", true);

      if (!error && Array.isArray(data)) {
        const nextMap = new Map<string, { price: number; name: string }>();
        data.forEach((row: any) => {
          if (row.id) nextMap.set(row.id.toLowerCase(), { price: Number(row.price), name: row.name });
          if (row.name) nextMap.set(row.name.toLowerCase().trim(), { price: Number(row.price), name: row.name });
        });
        dbItemsCache = nextMap;
        lastCacheTime = now;
      }
    } catch {
      // Graceful fallback to static cache
    }
  }

  if (dbItemsCache.has(cleanId)) {
    return dbItemsCache.get(cleanId)!;
  }
  if (cleanName && dbItemsCache.has(cleanName)) {
    return dbItemsCache.get(cleanName)!;
  }

  return null;
}

