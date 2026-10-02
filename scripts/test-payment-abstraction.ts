import { generateWebCryptoHmacSha256 } from "../src/lib/payments/razorpay";
import { getPaymentProvider } from "../src/lib/payments";

const BASE_URL = "http://localhost:3000";
const TEST_SECRET = process.env.RAZORPAY_KEY_SECRET || "vl1Y1D6EfE5inteQhg27Q4cD";

async function runPaymentTests() {
  console.log("==================================================");
  console.log("STARTING SPIRAL CAFE PAYMENT LAYER VERIFICATION");
  console.log("==================================================\n");

  // Step 1: Create a test order
  console.log("1. Creating test order via POST /api/orders...");
  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tableNumber: "Table 05",
      customerSessionId: `sess_test_${Date.now()}`,
      customerPhone: "9876543210",
      items: [
        {
          productId: "item_espresso",
          name: "Espresso",
          price: 150,
          quantity: 2,
          image: "/coffee.png",
        },
      ],
      notes: "Test payment order",
    }),
  });

  const orderData = await orderRes.json();
  if (!orderData.success || !orderData.order) {
    throw new Error(`Failed to create order: ${JSON.stringify(orderData)}`);
  }

  const orderId = orderData.order.id;
  const expectedGrandTotal = orderData.order.grandTotal;
  console.log(`✓ Order created: ID=${orderId}, OrderNumber=${orderData.order.orderNumber}, GrandTotal=₹${expectedGrandTotal}`);

  // Step 2: Test Tampered Amount on Payment Create
  console.log("\n2. Testing Tampered Amount on POST /api/payments/create...");
  const tamperedCreateRes = await fetch(`${BASE_URL}/api/payments/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      amount: 1, // Tampered client value! Server should ignore this!
    }),
  });

  const tamperedCreateData = await tamperedCreateRes.json();
  if (!tamperedCreateData.success) {
    throw new Error(`Payment create failed: ${JSON.stringify(tamperedCreateData)}`);
  }

  const expectedPaise = Math.round(expectedGrandTotal * 100);
  if (tamperedCreateData.amount !== expectedPaise) {
    throw new Error(`FAILED: Server accepted tampered amount! Got ${tamperedCreateData.amount}, expected ${expectedPaise}`);
  }
  console.log(`✓ Server correctly ignored client amount and used DB grandTotal (${tamperedCreateData.amount} paise = ₹${expectedGrandTotal})`);
  console.log(`✓ Provider: ${tamperedCreateData.provider}, Currency: ${tamperedCreateData.currency}, ProviderOrderId: ${tamperedCreateData.providerOrderId}`);

  const providerOrderId = tamperedCreateData.providerOrderId;
  const testPaymentId = `pay_test_${Date.now()}`;

  // Step 3: Test Invalid Signature on Payment Verify
  console.log("\n3. Testing Invalid Signature on POST /api/payments/verify...");
  const invalidVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      provider: "razorpay",
      providerOrderId,
      providerPaymentId: testPaymentId,
      signature: "invalid_tampered_hmac_hex_signature",
    }),
  });

  const invalidVerifyData = await invalidVerifyRes.json();
  if (invalidVerifyRes.status === 400 && !invalidVerifyData.success) {
    console.log(`✓ Invalid signature rejected as expected: "${invalidVerifyData.error}"`);
  } else {
    throw new Error(`FAILED: Invalid signature was NOT rejected! Status=${invalidVerifyRes.status}, Body=${JSON.stringify(invalidVerifyData)}`);
  }

  // Step 4: Test Valid Web Crypto Signature Verification
  console.log("\n4. Testing Valid Web Crypto HMAC Signature on POST /api/payments/verify...");
  const validSignature = await generateWebCryptoHmacSha256(
    TEST_SECRET,
    `${providerOrderId}|${testPaymentId}`
  );
  console.log(`Generated Web Crypto HMAC: ${validSignature.substring(0, 16)}...`);

  const validVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      provider: "razorpay",
      providerOrderId,
      providerPaymentId: testPaymentId,
      signature: validSignature,
    }),
  });

  const validVerifyData = await validVerifyRes.json();
  if (!validVerifyRes.ok || !validVerifyData.success) {
    throw new Error(`FAILED: Valid signature rejected! Status=${validVerifyRes.status}, Body=${JSON.stringify(validVerifyData)}`);
  }

  console.log(`✓ Payment successfully verified! Status=${validVerifyData.order.paymentStatus}, Method=${validVerifyData.order.paymentMethod}, Provider=${validVerifyData.order.paymentProvider}, Txn=${validVerifyData.order.paymentTxnId}`);

  // Step 5: Test Idempotency (Duplicate verify call)
  console.log("\n5. Testing Idempotency (Duplicate verify call with same payment ID)...");
  const duplicateVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      provider: "razorpay",
      providerOrderId,
      providerPaymentId: testPaymentId,
      signature: validSignature,
    }),
  });

  const duplicateVerifyData = await duplicateVerifyRes.json();
  if (duplicateVerifyRes.ok && duplicateVerifyData.success) {
    console.log(`✓ Duplicate verify succeeded idempotently without errors: "${duplicateVerifyData.message}"`);
  } else {
    throw new Error(`FAILED: Duplicate verify failed! Status=${duplicateVerifyRes.status}, Body=${JSON.stringify(duplicateVerifyData)}`);
  }

  // Step 6: Test Conflict (Attempting to overwrite with a different payment ID)
  console.log("\n6. Testing Conflict Rejection (Attempting to overwrite with a different payment ID)...");
  const conflictVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      provider: "razorpay",
      providerOrderId,
      providerPaymentId: `pay_different_${Date.now()}`,
      signature: validSignature,
    }),
  });

  const conflictVerifyData = await conflictVerifyRes.json();
  if (conflictVerifyRes.status === 400 && !conflictVerifyData.success) {
    console.log(`✓ Conflict correctly rejected: "${conflictVerifyData.error}"`);
  } else {
    throw new Error(`FAILED: Conflicting payment ID was not rejected! Status=${conflictVerifyRes.status}`);
  }

  // Step 7: Test Cash Payment Workflow
  console.log("\n7. Testing Cash Payment Workflow...");
  const cashOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tableNumber: "Table 02",
      customerSessionId: `sess_cash_${Date.now()}`,
      items: [{ productId: "item_croissant", name: "Croissant", price: 120, quantity: 1 }],
    }),
  });
  const cashOrderData = await cashOrderRes.json();
  const cashOrderId = cashOrderData.order.id;

  // Simulate kitchen marking order ready
  await fetch(`${BASE_URL}/api/kitchen/orders`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: cashOrderId, action: "START_PREPARING", pin: "1234" }),
  });
  await fetch(`${BASE_URL}/api/kitchen/orders`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: cashOrderId, action: "MARK_READY", pin: "1234" }),
  });

  // Customer selects CASH
  const setCashRes = await fetch(`${BASE_URL}/api/orders/payment-method`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: cashOrderId, method: "CASH" }),
  });
  const setCashData = await setCashRes.json();
  if (setCashData.order?.paymentStatus !== "PENDING_CASH") {
    throw new Error(`FAILED: Cash order did not set PENDING_CASH: ${JSON.stringify(setCashData)}`);
  }
  console.log(`✓ Cash order payment status set to: ${setCashData.order.paymentStatus}`);

  // Admin collects cash
  const collectCashRes = await fetch(`${BASE_URL}/api/admin/orders/${cashOrderId}/collect-cash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminUser: "Counter Cashier" }),
  });
  const collectCashData = await collectCashRes.json();
  if (collectCashData.order?.paymentStatus !== "PAID" || collectCashData.order?.paymentMethod !== "CASH") {
    throw new Error(`FAILED: Cash collection failed: ${JSON.stringify(collectCashData)}`);
  }
  console.log(`✓ Admin successfully collected cash: Status=${collectCashData.order.paymentStatus}, Method=${collectCashData.order.paymentMethod}, Provider=${collectCashData.order.paymentProvider}`);

  // Step 8: Test Zoho Placeholder Provider
  console.log("\n8. Testing Zoho Placeholder Provider...");
  try {
    const zohoProvider = getPaymentProvider("zoho");
    await zohoProvider.createPayment({
      orderId: "test",
      orderNumber: "ORD-001",
      amount: 100,
      currency: "INR",
    });
    throw new Error("FAILED: Zoho provider did not throw configuration error!");
  } catch (err: any) {
    if (err.message.includes("Zoho Payments provider is not configured yet")) {
      console.log(`✓ Zoho provider cleanly threw expected configuration error: "${err.message}"`);
    } else {
      throw err;
    }
  }

  console.log("\n==================================================");
  console.log("ALL PAYMENT LAYER TESTS PASSED SUCCESSFULLY! (8/8)");
  console.log("==================================================");
}

runPaymentTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
