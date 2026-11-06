import { NextRequest, NextResponse } from "next/server";
import { verifyAdminTokenAsync } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow login page and public assets freely
  if (pathname === "/admin/login") {
    // If user is already authenticated and visits /admin/login, redirect to /admin
    const token = req.cookies.get("spiral_admin_token")?.value;
    if (token) {
      const session = await verifyAdminTokenAsync(token);
      if (session.authenticated) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }
    return NextResponse.next();
  }

  // 2. Protect nested Admin UI routes (/admin, /admin/tables, /admin/orders, etc.)
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("spiral_admin_token")?.value;
    const session = await verifyAdminTokenAsync(token);

    if (!session.authenticated) {
      const loginUrl = new URL("/admin/login", req.url);
      if (pathname !== "/admin") {
        loginUrl.searchParams.set("redirect", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // 3. Protect Admin API endpoints (/api/admin/*)
  if (pathname.startsWith("/api/admin")) {
    const token =
      req.cookies.get("spiral_admin_token")?.value ||
      req.headers.get("authorization")?.replace("Bearer ", "").trim();

    const session = await verifyAdminTokenAsync(token);

    if (!session.authenticated) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Valid administrator authentication is required.",
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export { middleware as proxy };
export default middleware;



