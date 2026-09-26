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

    const order = getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.status !== "READY" && order.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: "Payment method can only be selected once the order is READY.",
        },
        { status: 400 }
      );
    }

    if (method === "CASH") {
      // Cash payment selected: Mark as PENDING_CASH.
      // Staff must mark CASH RECEIVED to complete the order.
      const updated = updateOrderPayment(orderId, "CASH", "PENDING_CASH", false);
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
