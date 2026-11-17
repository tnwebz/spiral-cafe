import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPasswordServer, signDataManagementToken } from "@/lib/data-management";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // First ensure caller has a valid general admin/cashier session or is verifying password
  const authErr = await requireAdminAuth(req, "ADMIN");
  if (authErr) return authErr;

  const ip = getClientIp(req);
  // Rate limit: max 5 attempts per minute
  const rate = checkRateLimit(`dm-auth:${ip}`, 5, 60000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many password verification attempts. Please wait ${rate.resetSeconds} seconds.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: "Administrator password is required." },
        { status: 400 }
      );
    }

    const isValid = await verifyAdminPasswordServer(password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Incorrect administrator password." },
        { status: 401 }
      );
    }

    const token = await signDataManagementToken("Admin");

    const res = NextResponse.json({
      success: true,
      message: "Authorization verified.",
    });

    const isSecure = req.url.startsWith("https") || process.env.NODE_ENV === "production";
    res.cookies.set("spiral_dm_token", token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60, // 15 minutes
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Authentication error." },
      { status: 500 }
    );
  }
}
