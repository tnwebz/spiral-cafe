import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus, OrderStatus } from "@/lib/db";
import { verifyAdminSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(req, context);
}

export async function PATCH(
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

    const adminSession = await verifyAdminSession(req);
    const { searchParams } = new URL(req.url);
    const clientSessionId =
      searchParams.get("sessionId") ||
      req.headers.get("x-customer-session-id") ||
      req.headers.get("x-session-id");

    // Must be either an authenticated admin or the session owner
    if (!adminSession.authenticated) {
      if (!clientSessionId || clientSessionId !== order.customerSessionId) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden. You do not have permission to update this order.",
          },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const { status, reason, notes } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: "Status is required." },
        { status: 400 }
      );
    }

    // Non-admin can ONLY cancel pending orders
    if (!adminSession.authenticated) {
      if (status !== "CANCELLED" || order.status !== "PENDING") {
        return NextResponse.json(
          {
            success: false,
            error: "Only administrators can perform this order status change.",
          },
          { status: 403 }
        );
      }
    }

    // If order is already in the requested status, return success
    if (order.status === status) {
      return NextResponse.json({ success: true, order });
    }

    const actor = adminSession.authenticated
      ? adminSession.role === "KITCHEN"
        ? "kitchen"
        : "admin"
      : "system";
    const actorName = adminSession.authenticated ? adminSession.user || "admin" : "customer";

    const updatedOrder = await updateOrderStatus(order.id, status as OrderStatus, actor, actorName);

    // If reason or additional note is provided, update notes in Supabase
    if (reason || notes) {
      const extraNote = reason ? `[CANCEL_REASON:${reason.trim()}]` : `[NOTE:${notes.trim()}]`;
      const combinedNotes = updatedOrder.notes ? `${updatedOrder.notes} ${extraNote}` : extraNote;
      try {
        await supabaseAdmin
          .from("orders")
          .update({ notes: combinedNotes, updated_at: new Date().toISOString() })
          .eq("id", order.id);
        updatedOrder.notes = combinedNotes;
      } catch (noteErr) {
        console.warn("Failed to update extra note on order:", noteErr);
      }
    }

    // Release table if order was cancelled and held a floor table
    if (
      status === "CANCELLED" &&
      order.tableNumber &&
      order.tableNumber !== "TAKEAWAY" &&
      order.tableNumber !== "COUNTER" &&
      order.tableNumber !== "GIVE ON COUNTER"
    ) {
      try {
        const { data: tableData } = await supabaseAdmin
          .from("restaurant_tables" as any)
          .select("*")
          .eq("table_number", order.tableNumber)
          .maybeSingle();

        if (tableData && (tableData as any).active_order_id === order.id) {
          await supabaseAdmin
            .from("restaurant_tables" as any)
            .update({
              status: "AVAILABLE",
              active_order_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("table_number", order.tableNumber);
        }
      } catch (tableErr) {
        console.warn("Error updating table status after cancellation:", tableErr);
      }
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error("Error updating order status:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update order status." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const adminSession = await verifyAdminSession(req);
    if (!adminSession.authenticated) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin authentication required." },
        { status: 401 }
      );
    }

    // Cancel order rather than destructive deletion
    const updatedOrder = await updateOrderStatus(order.id, "CANCELLED", "admin", adminSession.user || "admin");
    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to cancel order." },
      { status: 500 }
    );
  }
}
