import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const role = req.cookies.get("spiral_admin_role")?.value;
  const user = req.cookies.get("spiral_admin_user")?.value;

  if (role) {
    return NextResponse.json({
      authenticated: true,
      role,
      user: user || "Administrator",
    });
  }

  // Fallback for local development if cookie was not persisted
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.json({
      authenticated: true,
      role: "ADMIN",
      user: "Admin",
    });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete("spiral_admin_role");
  response.cookies.delete("spiral_admin_user");
  return response;
}
