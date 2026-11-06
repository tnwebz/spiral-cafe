import { NextRequest, NextResponse } from "next/server";
import {
  signAdminTokenAsync,
  verifyAdminTokenAsync,
  verifyAdminSession,
  requireAdminAuth,
  getAuthSecret,
} from "./src/lib/auth.js";
import { getAuthoritativeItemPrice } from "./src/lib/serverMenu.js";
import { checkRateLimit } from "./src/lib/rateLimiter.js";
import { middleware } from "./src/middleware.js";
import { verifyAdminCredentials } from "./src/lib/db.js";
import { POST as logoutPost } from "./src/app/api/auth/admin/me/route.js";

async function runSecurityStabilityTests() {
  console.log("==============================================================================");
  console.log("  SPIRAL CAFE — ADMIN AUTHENTICATION & SECURITY TEST SUITE (CLOUDFLARE)");
  console.log("==============================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: ADMIN_SESSION_SECRET strictly enforced
  // -------------------------------------------------------------------------
  const currentSecret = getAuthSecret();
  assert(
    typeof currentSecret === "string" && currentSecret.length > 10,
    "Test 1: ADMIN_SESSION_SECRET is loaded and strictly required"
  );

  // -------------------------------------------------------------------------
  // TEST 2: Admin PIN Login (1234 -> ADMIN)
  // -------------------------------------------------------------------------
  const adminPinResult = await verifyAdminCredentials({ pin: "1234" });
  assert(
    adminPinResult.success && adminPinResult.role === "ADMIN",
    "Test 2: Admin PIN login succeeds and grants ADMIN role"
  );

  // -------------------------------------------------------------------------
  // TEST 3: Cashier PIN Login (5678 -> CASHIER)
  // -------------------------------------------------------------------------
  const cashierPinResult = await verifyAdminCredentials({ pin: "5678" });
  assert(
    cashierPinResult.success && cashierPinResult.role === "CASHIER",
    "Test 3: Cashier PIN login succeeds and grants CASHIER role"
  );

  // -------------------------------------------------------------------------
  // TEST 4: Kitchen PIN Login (KITCHEN role verification)
  // -------------------------------------------------------------------------
  const kitchenToken = await signAdminTokenAsync("Kitchen Chef", "KITCHEN");
  const kitchenSession = await verifyAdminTokenAsync(kitchenToken);
  assert(
    kitchenSession.authenticated && kitchenSession.role === "KITCHEN",
    "Test 4: Kitchen role correctly recognized and verified by session engine"
  );

  // -------------------------------------------------------------------------
  // TEST 5: Username & Password Login (admin / spiral2026 -> ADMIN)
  // -------------------------------------------------------------------------
  const credsResult = await verifyAdminCredentials({ username: "admin", password: "spiral2026" });
  assert(
    credsResult.success && credsResult.role === "ADMIN",
    "Test 5: Username and password login succeeds and grants ADMIN role"
  );

  // -------------------------------------------------------------------------
  // TEST 6: Invalid PIN / Password Rejected
  // -------------------------------------------------------------------------
  const badPinResult = await verifyAdminCredentials({ pin: "9999" });
  const badCredsResult = await verifyAdminCredentials({ username: "admin", password: "wrongpassword" });
  assert(
    !badPinResult.success && !badCredsResult.success,
    "Test 6: Invalid PIN and wrong password safely rejected"
  );

  // -------------------------------------------------------------------------
  // TEST 7: Unauthorized user opening /admin is redirected to /admin/login
  // -------------------------------------------------------------------------
  const unauthAdminReq = new NextRequest("http://localhost:3000/admin/tables", {
    headers: { host: "localhost:3000" },
  });
  const middlewareRes = await middleware(unauthAdminReq);
  const isRedirectToLogin = Boolean(
    middlewareRes.status === 307 &&
    middlewareRes.headers.get("location")?.includes("/admin/login")
  );
  assert(isRedirectToLogin, "Test 7: Unauthorized access to /admin redirected to /admin/login");

  // -------------------------------------------------------------------------
  // TEST 8: Protected Admin API rejects unauthenticated calls with 401
  // -------------------------------------------------------------------------
  const unauthApiReq = new NextRequest("http://localhost:3000/api/admin/overview", {
    headers: { host: "localhost:3000" },
  });
  const apiMiddlewareRes = await middleware(unauthApiReq);
  const is401Unauthorized = apiMiddlewareRes.status === 401;

  const validToken = await signAdminTokenAsync("TestAdmin", "ADMIN");
  const authApiReq = new NextRequest("http://localhost:3000/api/admin/overview", {
    headers: {
      host: "localhost:3000",
      cookie: `spiral_admin_token=${validToken}`,
    },
  });
  const authMiddlewareRes = await middleware(authApiReq);
  const isAuthorized = authMiddlewareRes.status === 200;
  assert(is401Unauthorized && isAuthorized, "Test 8: Unauthenticated API calls return 401; valid cookie returns 200");

  // -------------------------------------------------------------------------
  // TEST 9: Session survives page refresh / cookie verification
  // -------------------------------------------------------------------------
  const refreshReq = new NextRequest("http://localhost:3000/api/auth/admin/me", {
    headers: {
      host: "localhost:3000",
      cookie: `spiral_admin_token=${validToken}`,
    },
  });
  const sessionVerified = await verifyAdminSession(refreshReq);
  assert(
    sessionVerified.authenticated && sessionVerified.user === "TestAdmin" && sessionVerified.role === "ADMIN",
    "Test 9: Admin session persists across refreshes and decodes role accurately"
  );

  // -------------------------------------------------------------------------
  // TEST 10: Role Validation against ADMIN, CASHIER, KITCHEN
  // -------------------------------------------------------------------------
  const tamperedRoleToken = await signAdminTokenAsync("Hacker", "SUPERUSER");
  const tamperedSession = await verifyAdminTokenAsync(tamperedRoleToken);
  assert(
    !tamperedSession.authenticated,
    "Test 10: Unauthorized or unknown role (SUPERUSER) rejected by session validator"
  );

  // -------------------------------------------------------------------------
  // TEST 11: Tampered Token Signature Rejected
  // -------------------------------------------------------------------------
  const fakeToken = `${validToken.split(".")[0]}.badsignaturehex1234567890`;
  const fakeSession = await verifyAdminTokenAsync(fakeToken);
  assert(!fakeSession.authenticated, "Test 11: Tampered signature rejected");

  // -------------------------------------------------------------------------
  // TEST 12: Logout invalidates cookies
  // -------------------------------------------------------------------------
  const logoutRes = await logoutPost();
  const setCookieHeaders = logoutRes.headers.getSetCookie();
  const tokenCookieCleared = setCookieHeaders.some(
    (c) => c.includes("spiral_admin_token=") && (c.includes("Max-Age=0") || c.includes("expires="))
  );
  assert(tokenCookieCleared, "Test 12: Logout response clears spiral_admin_token cookie with Max-Age=0");

  // -------------------------------------------------------------------------
  // TEST 13: Customer ordering and menu price enforcement intact
  // -------------------------------------------------------------------------
  const authItem = await getAuthoritativeItemPrice("americano", "Americano");
  const isPriceIntact = authItem !== null && authItem.price === 130;
  const rateLimitResult = checkRateLimit("customer_ip:127.0.0.1", 100, 60000);
  assert(isPriceIntact && rateLimitResult.allowed, "Test 13: Customer ordering price enforcement and rate limiting intact");

  // -------------------------------------------------------------------------
  // TEST 14: Regression — URL-encoded cookie with "Admin Manager" via standard Request
  // -------------------------------------------------------------------------
  const adminManagerToken = await signAdminTokenAsync("Admin Manager", "ADMIN");
  const urlEncodedToken = encodeURIComponent(adminManagerToken);
  const stdReq = new Request("http://localhost:3000/api/auth/admin/me", {
    headers: {
      cookie: `spiral_admin_token=${urlEncodedToken}`,
    },
  });
  const stdSession = await verifyAdminSession(stdReq);
  assert(
    stdSession.authenticated && stdSession.role === "ADMIN" && stdSession.user === "Admin Manager",
    "Test 14: URL-encoded 'Admin Manager' session cookie via standard Request verifies successfully as ADMIN"
  );

  // -------------------------------------------------------------------------
  // TEST 15: Regression — URL-encoded cookie with "Admin Manager" via NextRequest
  // -------------------------------------------------------------------------
  const nextReqWithEncodedCookie = new NextRequest("http://localhost:3000/api/auth/admin/me", {
    headers: {
      cookie: `spiral_admin_token=${urlEncodedToken}`,
    },
  });
  const nextSession = await verifyAdminSession(nextReqWithEncodedCookie);
  assert(
    nextSession.authenticated && nextSession.role === "ADMIN" && nextSession.user === "Admin Manager",
    "Test 15: URL-encoded 'Admin Manager' session cookie via NextRequest verifies successfully as ADMIN"
  );

  // -------------------------------------------------------------------------
  // TEST 16: Regression — Tampered URL-encoded token safely rejected
  // -------------------------------------------------------------------------
  const tamperedEncodedToken = encodeURIComponent(
    `${adminManagerToken.split(".")[0]}.badsignature1234567890abcdef`
  );
  const tamperedReq = new Request("http://localhost:3000/api/auth/admin/me", {
    headers: {
      cookie: `spiral_admin_token=${tamperedEncodedToken}`,
    },
  });
  const tamperedReqSession = await verifyAdminSession(tamperedReq);
  assert(
    !tamperedReqSession.authenticated,
    "Test 16: Tampered URL-encoded session token safely rejected"
  );

  // -------------------------------------------------------------------------
  // TEST 17: Regression — Expired URL-encoded token safely rejected
  // -------------------------------------------------------------------------
  const expiredPayload = `Admin Manager:ADMIN:${Date.now() - 10000}`;
  const expiredSecret = getAuthSecret();
  const encoder = new TextEncoder();
  const expiredKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(expiredSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expiredSigBuf = await crypto.subtle.sign("HMAC", expiredKey, encoder.encode(expiredPayload));
  const expiredSigHex = Array.from(new Uint8Array(expiredSigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expiredToken = `${expiredPayload}.${expiredSigHex}`;
  const expiredReq = new Request("http://localhost:3000/api/auth/admin/me", {
    headers: {
      cookie: `spiral_admin_token=${encodeURIComponent(expiredToken)}`,
    },
  });
  const expiredReqSession = await verifyAdminSession(expiredReq);
  assert(
    !expiredReqSession.authenticated,
    "Test 17: Expired URL-encoded session token safely rejected"
  );

  // -------------------------------------------------------------------------
  // TEST 18: Regression — Malformed percent-encoding handled without crashing
  // -------------------------------------------------------------------------
  const malformedReq = new Request("http://localhost:3000/api/auth/admin/me", {
    headers: {
      cookie: `spiral_admin_token=Admin%ZZManager%3AADMIN`,
    },
  });
  let didCrash = false;
  let malformedSession;
  try {
    malformedSession = await verifyAdminSession(malformedReq);
  } catch {
    didCrash = true;
  }
  assert(
    !didCrash && malformedSession !== undefined && !malformedSession.authenticated,
    "Test 18: Malformed percent-encoding in cookie does not crash and safely returns unauthenticated"
  );

  // -------------------------------------------------------------------------
  // TEST 19: Regression — Login signing and verification use the exact same ADMIN_SESSION_SECRET
  // -------------------------------------------------------------------------
  const loginSecret = getAuthSecret();
  const testPayload = `Admin Manager:ADMIN:${Date.now() + 60000}`;
  const testKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(loginSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const testSigBuf = await crypto.subtle.sign("HMAC", testKey, encoder.encode(testPayload));
  const testSigHex = Array.from(new Uint8Array(testSigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const manualToken = `${testPayload}.${testSigHex}`;
  const verifyResult = await verifyAdminTokenAsync(manualToken);
  assert(
    verifyResult.authenticated && verifyResult.user === "Admin Manager" && loginSecret === process.env.ADMIN_SESSION_SECRET,
    "Test 19: Login signing and session verification strictly use the same ADMIN_SESSION_SECRET"
  );

  console.log("\n==============================================================================");
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL 19 SCENARIOS)`);
  console.log("==============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityStabilityTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
