import assert from "assert";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_INGREDIENTS,
  calculateUsedQty,
  getOrCreateDayRegister,
  updateDayItemsBatch,
  markChecklistItemCounted,
  finalizeDayRegister,
  reopenDayRegister,
  generateRegisterCSV,
  recordInventoryMovement,
  getInventoryDashboard,
  getInventoryIngredients,
} from "../src/lib/inventory";

async function runInventoryTests() {
  console.log("=== SPIRAL CAFE MANUAL INVENTORY & STOCK CHECKLIST TESTS ===\n");

  // 1. Verify Default Master Seed Data
  console.log("[Test 1] Verifying 8 Default Categories & Exactly 69 Ingredients...");
  assert.strictEqual(DEFAULT_CATEGORIES.length, 8, "Expected exactly 8 categories (A to H)");
  assert.strictEqual(DEFAULT_INGREDIENTS.length, 69, "Expected exactly 69 printed ingredients");

  const catCodes = DEFAULT_CATEGORIES.map((c) => c.code);
  assert.deepStrictEqual(catCodes, ["A", "B", "C", "D", "E", "F", "G", "H"], "Expected categories A to H");

  // Verify item numbers 1 through 69
  for (let i = 1; i <= 69; i++) {
    const item = DEFAULT_INGREDIENTS.find((ing) => ing.item_number === i);
    assert(item, `Missing ingredient item number ${i}`);
  }
  console.log("  ✓ 8 Categories and 69 Ingredients verified.");

  // 2. Verify Used Formula
  console.log("\n[Test 2] Verifying 'Used = Opening + Purchased - Wastage - Closing Actual' Formula...");
  // Example 1: Opening 10, Purchased 5, Wastage 1, Closing Actual 8 -> Used = 10 + 5 - 1 - 8 = 6
  const used1 = calculateUsedQty(10, 5, 1, 8);
  assert.strictEqual(used1, 6, "Expected Used = 6");

  // Example 2: Uncounted item (closing actual is null) -> Used must be null
  const usedUncounted = calculateUsedQty(10, 5, 1, null);
  assert.strictEqual(usedUncounted, null, "Uncounted item must return null for Used");

  // Example 3: Recorded 0 is valid and distinct from null!
  // Opening 4, Purchased 0, Wastage 0, Closing Actual 0 -> Used = 4
  const usedZero = calculateUsedQty(4, 0, 0, 0);
  assert.strictEqual(usedZero, 4, "Closing actual of 0 must compute Used = 4");

  // Example 4: Decimal quantities (e.g. 2.5 kg + 1.25 kg - 0.25 kg - 1.5 kg = 2.0 kg)
  const usedDecimal = calculateUsedQty(2.5, 1.25, 0.25, 1.5);
  assert.strictEqual(usedDecimal, 2.0, "Decimal quantities must be accurate");
  console.log("  ✓ Formula calculations and null/zero distinctions verified.");

  // 3. Test Daily Register Creation & Item Initialization
  const testDate = `2026-11-${Math.floor(10 + Math.random() * 18)}`;
  console.log(`\n[Test 3] Testing getOrCreateDayRegister for test date ${testDate}...`);
  const { day, items, categories } = await getOrCreateDayRegister(testDate, "TestStaff");
  assert.strictEqual(day.date, testDate);
  const allIngs = await getInventoryIngredients();
  assert(items.length >= 69, "Day must have at least 69 items");
  assert.strictEqual(items.length, allIngs.length, "Day items must match all active ingredients");
  assert.strictEqual(day.status, "DRAFT", "New day register must start as DRAFT");
  console.log("  ✓ Day register initialized with 69 items in DRAFT status.");

  // 4. Test Batch Quantity Updates
  console.log("\n[Test 4] Testing batch update on Day Items (Opening, Purchased, Wastage, Closing)...");
  const milkItem = items.find((i) => i.ingredient_name === "Milk");
  assert(milkItem, "Milk item must exist");

  const updateResult = await updateDayItemsBatch(
    day.id,
    [
      {
        id: milkItem.id,
        opening_qty: 10,
        purchased_qty: 5,
        wastage_qty: 1,
        closing_actual_qty: 6,
      },
    ],
    "StaffTester"
  );

  const updatedMilk = updateResult.items.find((i) => i.id === milkItem.id);
  assert(updatedMilk, "Updated milk item must exist");
  assert.strictEqual(updatedMilk.opening_qty, 10);
  assert.strictEqual(updatedMilk.purchased_qty, 5);
  assert.strictEqual(updatedMilk.wastage_qty, 1);
  assert.strictEqual(updatedMilk.closing_actual_qty, 6);
  assert.strictEqual(updatedMilk.calculated_used_qty, 8); // 10 + 5 - 1 - 6 = 8
  assert.strictEqual(updatedMilk.is_counted, true);
  console.log("  ✓ Batch update calculated used = 8 and marked counted = true.");

  // 5. Test Stock Checklist Sync (Physical Mobile Count)
  console.log("\n[Test 5] Testing markChecklistItemCounted (Stock Checklist sync)...");
  const burgerBun = items.find((i) => i.ingredient_name === "Burger Bun");
  assert(burgerBun, "Burger Bun item must exist");

  const countedBun = await markChecklistItemCounted(day.id, burgerBun.ingredient_id, 24, "KitchenStaff", true);
  assert.strictEqual(countedBun.closing_actual_qty, 24);
  assert.strictEqual(countedBun.is_counted, true);
  console.log("  ✓ Checklist count synced to day items successfully.");

  // 6. Test Movements (Purchases / Wastage entry)
  console.log("\n[Test 6] Testing recordInventoryMovement...");
  const mov = await recordInventoryMovement({
    ingredient_id: burgerBun.ingredient_id,
    date: testDate,
    movement_type: "PURCHASE",
    quantity: 12,
    unit: "pcs",
    supplier: "Local Bakery",
    cost: 180,
    recorded_by: "Admin",
  });
  assert.strictEqual(mov.quantity, 12);
  assert.strictEqual(mov.supplier, "Local Bakery");
  console.log("  ✓ Movement recorded and logged.");

  // 7. Test Finalization and Carry-Forward
  console.log("\n[Test 7] Testing Day Finalization and Carry-Forward to Next Day...");
  const finalized = await finalizeDayRegister(day.id, "ManagerAlice");
  assert.strictEqual(finalized.status, "FINALIZED");
  assert.strictEqual(finalized.finalized_by, "ManagerAlice");

  // Reopen Day Register for Corrections
  const reopened = await reopenDayRegister(day.id, "ManagerAlice", "Need to correct count");
  assert.strictEqual(reopened.status, "DRAFT", "Reopened day status must be DRAFT");
  console.log("  ✓ Reopen verified: status reverted to DRAFT for corrections!");

  // Re-finalize to complete carry-forward test
  await finalizeDayRegister(day.id, "ManagerAlice");

  // Now create the next day and verify Milk opening carried forward!
  const nextDate = `${testDate}-next`;
  const nextDayData = await getOrCreateDayRegister(nextDate, "StaffBob");
  const nextMilk = nextDayData.items.find((i) => i.ingredient_name === "Milk");
  assert(nextMilk, "Next day Milk must exist");
  assert.strictEqual(
    nextMilk.opening_qty,
    6,
    "Tomorrow's opening balance must equal previous finalized day's closing actual (6)"
  );
  console.log("  ✓ Carry-forward verified: tomorrow's opening = 6!");

  // 8. Test CSV Export Generation
  console.log("\n[Test 8] Testing generateRegisterCSV...");
  const csv = generateRegisterCSV(day, updateResult.items, categories);
  assert(csv.includes("SPIRAL CAFE — DAILY INVENTORY REGISTER"));
  assert(csv.includes("Milk"));
  assert(csv.includes("Burger Bun"));
  console.log("  ✓ CSV export generated accurately.");

  console.log("\n>>> ALL INVENTORY & STOCK CHECKLIST REGRESSION TESTS PASSED! <<<\n");
}

runInventoryTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
