import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderPayment } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const { orderId, method } = await req.json();

    if (!orderId || !method) {
      return NextResponse.json(
        { success: false, error: "orderId and method are required." },
        { status: 400 }
      );
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot set payment method for a cancelled order.",
        },
        { status: 400 }
      );
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        {
          success: false,
          error: "This order has already been paid for.",
        },
        { status: 400 }
      );
    }

    if (method === "CASH") {
      // Cash payment selected: Mark as PENDING_CASH.
      // Staff must mark CASH RECEIVED to complete the order payment.
      const updated = await updateOrderPayment(orderId, "CASH", "PENDING_CASH", false);
      return NextResponse.json({ success: true, order: updated });
    }

    if (method === "ONLINE" || method === "RESET" || method === "UNSELECTED") {
      // Reset or switched to online payment
      const updated = await updateOrderPayment(orderId, "ONLINE", "UNPAID", false);
      return NextResponse.json({ success: true, order: updated });
    }

    return NextResponse.json(
      { success: false, error: "Invalid payment method specified." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to set payment method." },
      { status: 500 }
    );
  }
}
