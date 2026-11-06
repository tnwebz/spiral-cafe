import { NextRequest, NextResponse } from "next/server";

export interface AdminSession {
  authenticated: boolean;
  user?: string;
  role?: "ADMIN" | "CASHIER" | "KITCHEN";
}

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getAuthSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }

  return secret;
}

// Convert ArrayBuffer to Hex string
function bufToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time string equality check
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Safely decodes a token or cookie string if it contains URL percent-encoded characters.
 * Handles malformed percent encoding without crashing.
 */
export function safeDecodeToken(rawToken: string): string {
  try {
    if (rawToken.includes("%")) {
      return decodeURIComponent(rawToken);
    }
    return rawToken;
  } catch {
    return rawToken;
  }
}

/**
 * Safely parses cookie header into key-value pairs and strips enclosing quotes.
 */
export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    let val = pair.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
      val = val.slice(1, -1);
    }
    cookies[name] = val;
  }
  return cookies;
}

/**
 * Sign an admin payload with HMAC-SHA256 (Web Crypto API)
 */
export async function signAdminTokenAsync(user: string, role: string): Promise<string> {
  const secret = getAuthSecret();
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const payload = `${user}:${role}:${expiry}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const signatureHex = bufToHex(signatureBuffer);

  return `${payload}.${signatureHex}`;
}

/**
 * Verify and decode an HMAC-SHA256 admin token (Web Crypto API).
 * Safely decodes percent-encoded tokens exactly once.
 */
export async function verifyAdminTokenAsync(token: string | null | undefined): Promise<AdminSession> {
  if (!token || typeof token !== "string") {
    return { authenticated: false };
  }

  const cleanToken = safeDecodeToken(token.trim());
  const parts = cleanToken.split(".");
  if (parts.length !== 2) {
    return { authenticated: false };
  }

  const [payload, signatureHex] = parts;

  try {
    const secret = getAuthSecret();
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const expectedBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedHex = bufToHex(expectedBuffer);

    if (!safeCompare(signatureHex, expectedHex)) {
      return { authenticated: false };
    }

    const payloadParts = payload.split(":");
    if (payloadParts.length !== 3) {
      return { authenticated: false };
    }

    const [user, role, expiryStr] = payloadParts;

    // Validate role against known roles
    if (role !== "ADMIN" && role !== "CASHIER" && role !== "KITCHEN") {
      return { authenticated: false };
    }

    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) {
      return { authenticated: false }; // Expired
    }

    return {
      authenticated: true,
      user,
      role: role as "ADMIN" | "CASHIER" | "KITCHEN",
    };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Extract and verify admin session from NextRequest or standard Request (Cookies or Authorization header).
 * Prefers framework cookie parser where available and safely parses/decodes raw cookie headers.
 */
export async function verifyAdminSession(req: NextRequest | Request): Promise<AdminSession> {
  let token: string | undefined;

  // 1. Prefer framework's cookie parser where available (e.g. NextRequest)
  if ("cookies" in req && typeof (req as any).cookies?.get === "function") {
    const cookieObj = (req as NextRequest).cookies.get("spiral_admin_token");
    if (cookieObj?.value) {
      token = safeDecodeToken(cookieObj.value);
    }
  }

  // 2. For standard Request objects or fallback, safely parse and decode the cookie value
  if (!token && req.headers.get("cookie")) {
    const cookies = parseCookieHeader(req.headers.get("cookie"));
    const rawVal = cookies["spiral_admin_token"];
    if (rawVal) {
      token = safeDecodeToken(rawVal);
    }
  }

  // 3. Check Authorization Bearer header
  if (!token) {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = safeDecodeToken(authHeader.substring(7).trim());
    }
  }

  return verifyAdminTokenAsync(token);
}

/**
 * Helper to enforce admin authorization on an API route.
 * Returns null if authorized, or a 401 Unauthorized NextResponse if unauthenticated.
 */
export async function requireAdminAuth(
  req: NextRequest | Request,
  requiredRole?: "ADMIN" | "CASHIER" | "KITCHEN"
): Promise<NextResponse | null> {
  const session = await verifyAdminSession(req);

  if (!session.authenticated) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized. Valid administrator authentication is required.",
      },
      { status: 401 }
    );
  }

  if (requiredRole && requiredRole === "ADMIN" && session.role !== "ADMIN") {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden. Administrative privileges are required for this action.",
      },
      { status: 403 }
    );
  }

  return null;
}
