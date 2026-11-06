import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await verifyAdminSession(req);

  if (session.authenticated && session.role) {
    return NextResponse.json({
      authenticated: true,
      role: session.role,
      user: session.user || "Administrator",
    });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete("spiral_admin_token");
  response.cookies.delete("spiral_admin_role");
  response.cookies.delete("spiral_admin_user");
  return response;
}
