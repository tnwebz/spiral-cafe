import { getActiveCustomerVisit, getTablesOverview } from "./src/lib/tables";
import { normalizeTableNumber } from "./src/lib/db";

async function runIsolationTest() {
  console.log("==============================================================================");
  console.log("  SPIRAL CAFE — CUSTOMER SESSION ISOLATION & TABLE ALLOCATION TEST");
  console.log("==============================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // Scenario 1: Fresh customer session with new phone number should have NO active visit
    const freshSessionId = `sess_fresh_${Date.now()}_test123`;
    const freshPhone = "9988776655";
    const freshVisit = await getActiveCustomerVisit(freshSessionId, freshPhone);
    assert(!freshVisit.hasActiveVisit, "Customer B with fresh session has hasActiveVisit === false");
    assert(freshVisit.orders.length === 0, "Customer B sees 0 active orders");
    assert(freshVisit.tableNumber === null, "Customer B has no pre-allocated table");

    // Scenario 2: Phone number alone without valid sessionId should not return active visits
    const phoneOnlyVisit = await getActiveCustomerVisit("", "8608113558");
    assert(!phoneOnlyVisit.hasActiveVisit, "Phone number alone without session credential returns hasActiveVisit === false");
    assert(phoneOnlyVisit.orders.length === 0, "Phone number alone cannot access orders");

    // Scenario 3: Mismatched session and phone (attacker trying to pass someone else's phone)
    const mismatchedVisit = await getActiveCustomerVisit(freshSessionId, "8608113558");
    assert(!mismatchedVisit.hasActiveVisit, "Mismatched session ID and phone returns hasActiveVisit === false");
    assert(mismatchedVisit.orders.length === 0, "Mismatched session sees 0 orders");

    // Scenario 4: Table overview does not mark table as isMyActiveTable for fresh customer
    const overview = await getTablesOverview(freshSessionId, freshPhone);
    const anyMyTable = overview.some((t) => t.isMyActiveTable);
    assert(!anyMyTable, "Fresh customer does not have any table marked as isMyActiveTable");

    // Scenario 5: Available tables (WHITE) are present
    const availableTables = overview.filter((t) => t.color === "WHITE");
    assert(availableTables.length > 0, `Floor has available tables (found ${availableTables.length})`);

    // Scenario 6: Table numbers are correctly normalized
    assert(normalizeTableNumber("B4") === "B4", "normalizeTableNumber('B4') === 'B4'");
    assert(normalizeTableNumber("Table B4") === "B4", "normalizeTableNumber('Table B4') === 'B4'");
    assert(normalizeTableNumber("A1") === "A1", "normalizeTableNumber('A1') === 'A1'");

    console.log("==============================================================================");
    console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed})`);
    console.log("==============================================================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test execution error:", err);
    process.exit(1);
  }
}

runIsolationTest();

