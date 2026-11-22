import assert from "assert";
import {
  calculateUsedQty,
  calculateFifoAllocation,
  computeItemFifoValuation,
  StockBatch,
  InventoryDayItem,
  InventoryPurchaseRecord,
} from "../src/lib/inventory";

async function testSquidFifoScenario() {
  console.log("=== TESTING EXACT SQUID FIFO COMMERCE SCENARIO ===");

  // Scenario 1: Initial state before purchase
  // Opening: 10 pcs @ ₹100
  // Purchased: 0
  // Wastage: 2 pcs
  // Closing: 5 pcs
  console.log("\n[Step 1] Testing Squid before purchase (Opening 10, Wastage 2, Closing 5)...");

  const openingBatches: StockBatch[] = [
    {
      id: "batch_squid_open",
      ingredient_id: "ing_5",
      batch_type: "OPENING",
      date: "2026-11-22",
      created_at: "2026-11-22T00:00:00.000Z",
      original_qty: 10,
      remaining_qty: 10,
      unit: "pcs",
      unit_cost: 100,
      remaining_value: 1000,
    },
  ];

  const usedQty1 = calculateUsedQty(10, 0, 2, 5);
  assert.strictEqual(usedQty1, 3, "Used quantity must be 3");

  const fifo1 = calculateFifoAllocation(openingBatches, 2, 3);
  console.log("  Step 1 Result:", {
    wastageCost: fifo1.wastageCost,
    wastageBreakdown: fifo1.wastageBreakdown,
    usedCost: fifo1.usedCost,
    usedBreakdown: fifo1.usedBreakdown,
    closingStockQty: fifo1.closingStockQty,
    closingStockValue: fifo1.closingStockValue,
    closingBreakdown: fifo1.closingBreakdown,
  });

  assert.strictEqual(fifo1.wastageCost, 200, "Wastage cost must be ₹200 (2 × ₹100)");
  assert.strictEqual(fifo1.wastageBreakdown, "2 × ₹100");
  assert.strictEqual(fifo1.usedCost, 300, "Used cost must be ₹300 (3 × ₹100)");
  assert.strictEqual(fifo1.usedBreakdown, "3 × ₹100");
  assert.strictEqual(fifo1.closingStockQty, 5, "Closing stock qty must be 5");
  assert.strictEqual(fifo1.closingStockValue, 500, "Closing stock value must be ₹500");
  assert.strictEqual(fifo1.closingBreakdown, "5 × ₹100");
  console.log("  ✓ Step 1 verified perfectly!");

  // Scenario 2: Adding purchase of 5 pcs @ ₹120
  // Opening: 10 pcs @ ₹100
  // Purchased: 5 pcs @ ₹120
  // Wastage: 2 pcs
  // Closing: 5 pcs
  // Total Available: 15 pcs
  // Outflow: 15 - 5 = 10 pcs
  // FIFO Consumptions:
  // - 2 wastage comes from Opening (@ ₹100) -> ₹200
  // - 8 used comes from Opening (@ ₹100) -> ₹800
  // - 5 closing remains from Purchase batch (@ ₹120) -> ₹600
  console.log("\n[Step 2] Testing Squid after purchase (Adding 5 pcs @ ₹120)...");

  const allBatches: StockBatch[] = [
    {
      id: "batch_squid_open",
      ingredient_id: "ing_5",
      batch_type: "OPENING",
      date: "2026-11-22",
      created_at: "2026-11-22T00:00:00.000Z",
      original_qty: 10,
      remaining_qty: 10,
      unit: "pcs",
      unit_cost: 100,
      remaining_value: 1000,
    },
    {
      id: "batch_squid_purch",
      ingredient_id: "ing_5",
      batch_type: "PURCHASE",
      date: "2026-11-22",
      created_at: "2026-11-22T12:00:00.000Z",
      original_qty: 5,
      remaining_qty: 5,
      unit: "pcs",
      unit_cost: 120,
      remaining_value: 600,
    },
  ];

  const usedQty2 = calculateUsedQty(10, 5, 2, 5);
  assert.strictEqual(usedQty2, 8, "Used quantity must be 8 (10 + 5 - 2 - 5 = 8)");

  const fifo2 = calculateFifoAllocation(allBatches, 2, 8);
  console.log("  Step 2 Result:", {
    usedQty: usedQty2,
    wastageCost: fifo2.wastageCost,
    wastageBreakdown: fifo2.wastageBreakdown,
    usedCost: fifo2.usedCost,
    usedBreakdown: fifo2.usedBreakdown,
    closingStockQty: fifo2.closingStockQty,
    closingStockValue: fifo2.closingStockValue,
    closingBreakdown: fifo2.closingBreakdown,
  });

  assert.strictEqual(fifo2.wastageCost, 200, "Wastage cost must be ₹200");
  assert.strictEqual(fifo2.wastageBreakdown, "2 × ₹100");
  assert.strictEqual(fifo2.usedCost, 800, "Used cost must be ₹800 (8 × ₹100)");
  assert.strictEqual(fifo2.usedBreakdown, "8 × ₹100");
  assert.strictEqual(fifo2.closingStockQty, 5, "Closing stock qty must be 5");
  assert.strictEqual(fifo2.closingStockValue, 600, "Closing stock value must be ₹600 (5 × ₹120)");
  assert.strictEqual(fifo2.closingBreakdown, "5 × ₹120");

  console.log("  ✓ Step 2 verified perfectly!");

  // Step 3: Test computeItemFifoValuation integration
  console.log("\n[Step 3] Testing computeItemFifoValuation integration...");
  const dummyItem: InventoryDayItem = {
    id: "item_day_test_squid",
    inventory_day_id: "day_test",
    ingredient_id: "ing_5",
    ingredient_number: 5,
    ingredient_name: "Squid",
    category_id: "cat_chicken_seafood",
    category_name: "Chicken & Seafood",
    unit: "pcs",
    opening_qty: 10,
    purchased_qty: 5,
    wastage_qty: 2,
    closing_actual_qty: 5,
    calculated_used_qty: 8,
    is_counted: true,
  };

  const dayPurchases: InventoryPurchaseRecord[] = [
    {
      id: "purch_squid_1",
      ingredient_id: "ing_5",
      ingredient_name: "Squid",
      date: "2026-11-22",
      quantity: 5,
      unit: "pcs",
      price_per_unit: 120,
      total_cost: 600,
      recorded_by: "Admin",
    },
  ];

  const valuationRes = computeItemFifoValuation(
    dummyItem,
    undefined,
    100, // fallback base cost of Squid = ₹100
    dayPurchases,
    "2026-11-22"
  );

  console.log("  Valuation Integration Result:", {
    openingStockValue: valuationRes.openingStockValue,
    totalPurchaseCost: valuationRes.totalPurchaseCost,
    usedCost: valuationRes.usedCost,
    usedBreakdown: valuationRes.usedBreakdown,
    closingStockValue: valuationRes.closingStockValue,
    closingBreakdown: valuationRes.closingBreakdown,
    wastageCost: valuationRes.wastageCost,
    wastageBreakdown: valuationRes.wastageBreakdown,
  });

  assert.strictEqual(valuationRes.openingStockValue, 1000, "Opening stock value must be ₹1,000");
  assert.strictEqual(valuationRes.totalPurchaseCost, 600, "Total purchase cost must be ₹600");
  assert.strictEqual(valuationRes.usedCost, 800, "Used cost must be ₹800");
  assert.strictEqual(valuationRes.usedBreakdown, "8 × ₹100");
  assert.strictEqual(valuationRes.closingStockValue, 600, "Closing stock value must be ₹600");
  assert.strictEqual(valuationRes.closingBreakdown, "5 × ₹120");
  assert.strictEqual(valuationRes.wastageCost, 200, "Wastage cost must be ₹200");
  assert.strictEqual(valuationRes.wastageBreakdown, "2 × ₹100");

  console.log("\n>>> ALL SQUID FIFO COMMERCE TESTS PASSED FLAWLESSLY! <<<\n");
}

testSquidFifoScenario().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
