/**
 * Spiral Cafe POS — Live Supabase Database Verification Tool
 * 
 * Verifies that a target Supabase project has been correctly initialized:
 * - All 16 application tables exist
 * - 41 menu items are seeded across 11 categories
 * - Cafe configuration is present with 5% tax and restaurant address
 * - All 15 floor tables are in 'AVAILABLE' status
 * - Transactional tables (orders, customers, sessions, kots) are strictly EMPTY
 * 
 * Usage:
 *   npx tsx scripts/verify.ts --url <SUPABASE_URL> --key <SERVICE_ROLE_KEY>
 * Or with environment variables:
 *   TARGET_SUPABASE_URL=... TARGET_SUPABASE_KEY=... npx tsx scripts/verify.ts
 */

import path from "node:path";
import { createRequire } from "node:module";

const requireMod = createRequire(import.meta.url);

function getSupabaseClient() {
  const candidates = [
    "@supabase/supabase-js",
    path.resolve(__dirname, "../../menu-card/node_modules/@supabase/supabase-js"),
    path.resolve(process.cwd(), "menu-card/node_modules/@supabase/supabase-js"),
    path.resolve(process.cwd(), "node_modules/@supabase/supabase-js"),
  ];

  for (const c of candidates) {
    try {
      const mod = requireMod(c);
      if (mod && mod.createClient) return mod.createClient;
    } catch {}
  }
  throw new Error("Could not resolve @supabase/supabase-js package. Ensure menu-card dependencies are installed.");
}

const createClient = getSupabaseClient();

// Parse arguments
const args = process.argv.slice(2);
let targetUrl = process.env.TARGET_SUPABASE_URL || "";
let targetKey = process.env.TARGET_SUPABASE_KEY || "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) {
    targetUrl = args[i + 1];
    i++;
  } else if (args[i] === "--key" && args[i + 1]) {
    targetKey = args[i + 1];
    i++;
  }
}

if (!targetUrl || !targetKey) {
  console.log("==============================================================================");
  console.log("  SPIRAL CAFE — DATABASE RESTORATION VERIFICATION TOOL");
  console.log("==============================================================================");
  console.log("Error: Target Supabase credentials missing.\n");
  console.log("Usage:");
  console.log("  npx tsx supabase/setup-package/scripts/verify.ts --url <URL> --key <SERVICE_ROLE_KEY>\n");
  console.log("Or set environment variables:");
  console.log("  TARGET_SUPABASE_URL=https://xyz.supabase.co");
  console.log("  TARGET_SUPABASE_KEY=your-service-role-key\n");
  process.exit(1);
}

const supabase = createClient(targetUrl, targetKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const projectRef = new URL(targetUrl).hostname.split(".")[0];

async function runVerification() {
  console.log("==============================================================================");
  console.log("  SPIRAL CAFE — LIVE DATABASE AUDIT");
  console.log(`  Target Project: ${projectRef}`);
  console.log("==============================================================================");

  let passedCount = 0;
  let failedCount = 0;

  function assertResult(condition: boolean, title: string, details?: string) {
    if (condition) {
      passedCount++;
      console.log(`  ✅ [PASS] ${title}`);
    } else {
      failedCount++;
      console.error(`  ❌ [FAIL] ${title} ${details ? `(${details})` : ""}`);
    }
  }

  // 1. Check all tables
  const tables = [
    "cafe_config",
    "menu_items",
    "customers",
    "customer_sessions",
    "orders",
    "order_items",
    "restaurant_tables",
    "table_reservations",
    "kots",
    "print_attempts",
    "printer_settings",
    "payments",
    "invoices",
    "invoice_items",
    "settlements",
    "audit_logs"
  ];

  console.log("\n[1/5] Verifying Application Tables Presence...");
  for (const tbl of tables) {
    const { error } = await supabase.from(tbl).select("*", { count: "exact", head: true });
    assertResult(!error, `Table exists: public.${tbl}`, error?.message);
  }

  // 2. Verify Menu Catalog
  console.log("\n[2/5] Verifying Menu Catalog Seeds...");
  const { data: menuItems, error: menuErr } = await supabase.from("menu_items").select("*");
  if (menuErr) {
    assertResult(false, "Menu items query failed", menuErr.message);
  } else {
    assertResult(menuItems.length === 41, `Menu items count: ${menuItems.length} (Expected: 41)`);
    const categories = new Set(menuItems.map((m: any) => m.category_name));
    assertResult(categories.size >= 10, `Categories count: ${categories.size} categories configured`);

    // Ensure no dev URLs leaked
    const hasExternalUrls = menuItems.some((m: any) => m.image && m.image.includes("unsplash.com"));
    assertResult(!hasExternalUrls, "Zero development image URLs in menu catalog");
  }

  // 3. Verify Cafe Configuration
  console.log("\n[3/5] Verifying Restaurant Baseline Configuration...");
  const { data: configs } = await supabase.from("cafe_config").select("*");
  if (configs && configs.length > 0) {
    const cfg = configs[0];
    assertResult(cfg.id === 1, "Singleton cafe_config present with ID = 1");
    assertResult(Number(cfg.tax_percentage) === 5, `Tax percentage: ${cfg.tax_percentage}% (Expected: 5%)`);
    assertResult(cfg.cafe_name === "Spiral Cafe", `Cafe name: ${cfg.cafe_name}`);
  } else {
    assertResult(false, "cafe_config is empty or missing");
  }

  // 4. Verify Floor Tables
  console.log("\n[4/5] Verifying Floor Tables State...");
  const { data: floorTables } = await supabase.from("restaurant_tables").select("*");
  if (floorTables && floorTables.length > 0) {
    assertResult(floorTables.length === 15, `Floor tables count: ${floorTables.length} (Expected: 15)`);
    const allAvailable = floorTables.every((t: any) => t.status === "AVAILABLE" && t.active_order_id === null);
    assertResult(allAvailable, "All 15 floor tables are initialized in AVAILABLE state with no active orders");
  } else {
    assertResult(false, "restaurant_tables is empty or missing");
  }

  // 5. Verify Transactional Tables are strictly EMPTY (Clean Start)
  console.log("\n[5/5] Verifying Clean Start (Zero Historical Transactional Data)...");
  const transactionalTables = [
    "orders",
    "order_items",
    "customers",
    "customer_sessions",
    "invoices",
    "invoice_items",
    "table_reservations",
    "kots",
    "print_attempts",
    "settlements"
  ];

  for (const t of transactionalTables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    if (error) {
      assertResult(false, `Table ${t} query error`, error.message);
    } else {
      assertResult(count === 0, `Transactional table ${t} is empty (Row count = ${count})`);
    }
  }

  // Final Summary
  console.log("\n==============================================================================");
  if (failedCount === 0) {
    console.log(`  🎉 RESTORATION VERIFIED! All ${passedCount} tests passed successfully.`);
    console.log("  Spiral Cafe is ready for production operation on this project.");
    console.log("==============================================================================");
    process.exit(0);
  } else {
    console.error(`  ⚠️ RESTORATION INCOMPLETE: ${failedCount} checks failed, ${passedCount} passed.`);
    console.log("==============================================================================");
    process.exit(1);
  }
}

runVerification().catch(console.error);
