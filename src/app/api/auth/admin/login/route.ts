import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCredentials, recordAuditLog } from "@/lib/db";
import { signAdminTokenAsync } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Rate limiting: max 5 login attempts per minute per IP
    const rateCheck = checkRateLimit(`login:${ip}`, 5, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${rateCheck.resetSeconds} seconds before retrying.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { username, password, pin } = body;

    const result = await verifyAdminCredentials({ username, password, pin });

    if (!result.success || !result.role) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials or PIN." },
        { status: 401 }
      );
    }

    const adminUser = result.user || "Admin";
    await recordAuditLog(adminUser, "LOGIN", "CONFIG", "session", `Logged in with role: ${result.role}`);

    // Generate signed HMAC session token
    const token = await signAdminTokenAsync(adminUser, result.role);

    const response = NextResponse.json({
      success: true,
      role: result.role,
      user: adminUser,
    });

    const isSecure = req.url.startsWith("https") || process.env.NODE_ENV === "production";

    // 1. Secure HTTP-Only session token cookie
    response.cookies.set("spiral_admin_token", token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // 2. Client-readable role cookie for UI layout
    response.cookies.set("spiral_admin_role", result.role, {
      httpOnly: false,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    // 3. Client-readable user cookie for UI layout
    response.cookies.set("spiral_admin_user", encodeURIComponent(adminUser), {
      httpOnly: false,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "Authentication service error." }, { status: 500 });
  }
}
