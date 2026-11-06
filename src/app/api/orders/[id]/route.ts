import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";
import { verifyAdminSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    // Customer Session Isolation Guard:
    // Check if the requester is the session owner or an authenticated admin
    const { searchParams } = new URL(req.url);
    const clientSessionId =
      searchParams.get("sessionId") ||
      req.headers.get("x-customer-session-id") ||
      req.headers.get("x-session-id");

    const adminSession = await verifyAdminSession(req);

    if (!adminSession.authenticated) {
      if (!clientSessionId || clientSessionId !== order.customerSessionId) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden. You do not have permission to access this order record.",
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch order." },
      { status: 500 }
    );
  }
}
