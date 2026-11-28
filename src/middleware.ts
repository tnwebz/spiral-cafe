import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Block/redirect legacy /admin access completely
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 2. Allow login page and public assets freely
  if (pathname === "/admin-sp-access/login") {
    // If user is already authenticated and visits /admin-sp-access/login, redirect to /admin-sp-access/tables
    const session = await verifyAdminSession(req);
    if (session.authenticated) {
      return NextResponse.redirect(new URL("/admin-sp-access/tables", req.url));
    }
    return NextResponse.next();
  }

  // 3. Protect nested Admin UI routes (/admin-sp-access, /admin-sp-access/tables, /admin-sp-access/orders, etc.)
  if (pathname.startsWith("/admin-sp-access")) {
    const session = await verifyAdminSession(req);

    if (!session.authenticated) {
      const loginUrl = new URL("/admin-sp-access/login", req.url);
      if (pathname !== "/admin-sp-access" && pathname !== "/admin-sp-access/tables") {
        loginUrl.searchParams.set("redirect", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // 3. Protect Admin API endpoints (/api/admin/*)
  if (pathname.startsWith("/api/admin")) {
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

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin-sp-access/:path*", "/admin/:path*", "/admin", "/api/admin/:path*"],
};

export { middleware as proxy };
export default middleware;



