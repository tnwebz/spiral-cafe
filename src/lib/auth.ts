import { NextRequest, NextResponse } from "next/server";

export interface AdminSession {
  authenticated: boolean;
  user?: string;
  role?: "ADMIN" | "CASHIER" | "KITCHEN";
}

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const FALLBACK_SECRET = "spiral_cafe_hmac_secret_2026_super_secure_key";

export function getAuthSecret(): string {
  return process.env.SUPABASE_SECRET_KEY || process.env.ADMIN_SESSION_SECRET || FALLBACK_SECRET;
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
 * Verify and decode an HMAC-SHA256 admin token (Web Crypto API)
 */
export async function verifyAdminTokenAsync(token: string | null | undefined): Promise<AdminSession> {
  if (!token || typeof token !== "string") {
    return { authenticated: false };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { authenticated: false };
  }

  const [payload, signatureHex] = parts;
  const secret = getAuthSecret();
  const encoder = new TextEncoder();

  try {
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
 * Extract and verify admin session from NextRequest (Cookies or Authorization header)
 */
export async function verifyAdminSession(req: NextRequest | Request): Promise<AdminSession> {
  let token: string | undefined;

  // 1. Check cookies
  if ("cookies" in req && typeof (req as any).cookies?.get === "function") {
    token = (req as NextRequest).cookies.get("spiral_admin_token")?.value;
  } else if (req.headers.get("cookie")) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/spiral_admin_token=([^;]+)/);
    if (match) token = match[1];
  }

  // 2. Check Authorization Bearer header
  if (!token) {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
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
  requiredRole?: "ADMIN" | "CASHIER"
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
