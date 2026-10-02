import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCredentials, recordAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, pin } = body;

    const result = await verifyAdminCredentials({ username, password, pin });

    if (!result.success || !result.role) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials or PIN." },
        { status: 401 }
      );
    }

    await recordAuditLog(result.user || "User", "LOGIN", "CONFIG", "session", `Logged in with role: ${result.role}`);

    const response = NextResponse.json({
      success: true,
      role: result.role,
      user: result.user,
    });

    // Set secure HTTP-only session cookie
    response.cookies.set("spiral_admin_role", result.role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    response.cookies.set("spiral_admin_user", result.user || "Admin", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
