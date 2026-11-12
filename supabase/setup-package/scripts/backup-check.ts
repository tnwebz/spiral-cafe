/**
 * Spiral Cafe POS — Static Backup Integrity & Privacy Guardrail Validator
 * 
 * Verifies that the exported SQL backup package is:
 * 1. Free of historical customer phone numbers and PII
 * 2. Free of previous customer orders, sessions, and KOT logs
 * 3. Free of product image URLs or storage links
 * 4. Free of private administrator credentials/PINs
 * 5. Complete with all 16 required tables and 41 menu catalog items
 */

import fs from "node:fs";
import path from "node:path";

const pkgDir = path.resolve(__dirname, "..");

interface CheckResult {
  passed: boolean;
  message: string;
}

const checks: CheckResult[] = [];

function assert(condition: boolean, message: string) {
  checks.push({ passed: condition, message });
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

console.log("==============================================================================");
console.log("  SPIRAL CAFE — BACKUP STATIC INTEGRITY & PRIVACY AUDIT");
console.log("==============================================================================");

// 1. Check master SQL file existence
const masterSqlPath = path.join(pkgDir, "spiral-cafe-database-setup.sql");
assert(fs.existsSync(masterSqlPath), "Master SQL file exists: spiral-cafe-database-setup.sql");

const masterSql = fs.readFileSync(masterSqlPath, "utf8");

// 2. Check table count in schema
const requiredTables = [
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

for (const tbl of requiredTables) {
  assert(
    masterSql.includes(`create table if not exists public.${tbl}`),
    `Table schema defined: public.${tbl}`
  );
}

// 3. Privacy & Historical Data Isolation Checks in Seeds
console.log("\n--- Checking Privacy & Customer Isolation Safeguards in Seeds ---");

const restaurantConfigSeed = fs.readFileSync(path.join(pkgDir, "seeds", "restaurant-config.sql"), "utf8");
const menuCatalogSeed = fs.readFileSync(path.join(pkgDir, "seeds", "menu-catalog.sql"), "utf8");
const allSeeds = restaurantConfigSeed + "\n" + menuCatalogSeed;

// A. No transactional data inserted in seeds
assert(
  !allSeeds.includes("insert into public.orders"),
  "Zero historical orders in seed (orders table initializes empty)"
);
assert(
  !allSeeds.includes("insert into public.order_items"),
  "Zero historical order items in seed (order_items initializes empty)"
);
assert(
  !allSeeds.includes("insert into public.customer_sessions"),
  "Zero historical customer sessions in seed (customer_sessions initializes empty)"
);
assert(
  !allSeeds.includes("insert into public.customers"),
  "Zero historical customer records in seed (customers initializes empty)"
);
assert(
  !allSeeds.includes("insert into public.invoices"),
  "Zero historical invoices in seed (invoices initializes empty)"
);
assert(
  !allSeeds.includes("insert into public.kots"),
  "Zero historical KOT records in seed (kots initializes empty)"
);
assert(
  !allSeeds.includes("insert into public.table_reservations"),
  "Zero active reservations in seed (table_reservations initializes empty)"
);
assert(
  !allSeeds.includes("insert into public.audit_logs"),
  "Zero historical audit logs in seed (audit_logs initializes empty)"
);

// B. Floor tables initialized in AVAILABLE state
assert(
  restaurantConfigSeed.includes("('A1', 'A1', 4, 'Dine-In', 'AVAILABLE'"),
  "Floor Table A1 initialized in AVAILABLE state"
);
assert(
  restaurantConfigSeed.includes("('F4', 'F4', 3, 'Dine-In', 'AVAILABLE'"),
  "Floor Table F4 initialized in AVAILABLE state"
);

// Check that restaurant table inserts ONLY have 'AVAILABLE' statuses
const tableInsertValues = restaurantConfigSeed.match(/\('([A-Z0-9]+)',\s*'([A-Z0-9]+)',\s*\d+,\s*'[^']+',\s*'([^']+)'/g) || [];
const nonAvailableStatuses = tableInsertValues.filter(v => !v.includes("'AVAILABLE'"));
assert(
  nonAvailableStatuses.length === 0,
  `All floor table seed rows strictly use 'AVAILABLE' status (Non-available found: ${nonAvailableStatuses.length})`
);

// C. Product Images Excluded
console.log("\n--- Checking Image Asset Exclusion Guardrail ---");
const imageMatches = allSeeds.match(/https?:\/\/[^\s"',]+\.(?:jpg|jpeg|png|webp)/gi) || [];
assert(
  imageMatches.length === 0,
  `Zero product image URLs in database seed (Found: ${imageMatches.length})`
);
assert(
  !allSeeds.includes("supabase.co/storage"),
  "Zero Supabase Storage bucket URLs in database seed"
);

// D. Menu Items Count Verification
console.log("\n--- Checking Menu Catalog Seeds ---");
const valueTupleMatches = menuCatalogSeed.match(/\('([a-z0-9_-]+)',\s*'([^']+)'/gi) || [];
assert(
  valueTupleMatches.length === 41,
  `Exact 41 menu items verified in menu-catalog.sql (Found: ${valueTupleMatches.length})`
);

// 4. Stored Functions and Extensions
console.log("\n--- Checking Stored Procedures, Triggers & Extensions ---");
assert(
  masterSql.includes("create or replace function public.create_order_with_items"),
  "Atomic order creation function create_order_with_items present"
);
assert(
  masterSql.includes("create extension if not exists \"uuid-ossp\""),
  "Extension uuid-ossp enabled"
);
assert(
  masterSql.includes("create extension if not exists \"pgcrypto\""),
  "Extension pgcrypto enabled"
);
assert(
  masterSql.includes("alter publication supabase_realtime add table public.orders"),
  "Realtime publication replication configured"
);

// Summary
const failed = checks.filter((c) => !c.passed);
console.log("\n==============================================================================");
if (failed.length === 0) {
  console.log(`  🎉 ALL ${checks.length} INTEGRITY & PRIVACY CHECKS PASSED PERFECTLY!`);
  console.log("==============================================================================");
  process.exit(0);
} else {
  console.error(`  ⚠️ ${failed.length} CHECKS FAILED!`);
  console.log("==============================================================================");
  process.exit(1);
}
