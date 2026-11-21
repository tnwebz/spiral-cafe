import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderPayment } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { method } = body;
    const orderIds: string[] = Array.isArray(body.orderIds)
      ? body.orderIds.filter((id: any) => typeof id === "string" && id.trim())
      : body.orderId
      ? [body.orderId]
      : [];

    if (orderIds.length === 0 || !method) {
      return NextResponse.json(
        { success: false, error: "orderId(s) and method are required." },
        { status: 400 }
      );
    }

    const updatedOrders: any[] = [];

    for (const id of orderIds) {
      const order = await getOrderById(id);
      if (!order) continue;

      if (order.status === "CANCELLED") {
        continue;
      }

      if (order.paymentStatus === "PAID") {
        continue;
      }

      if (method === "CASH") {
        // Cash payment selected: Mark as PENDING_CASH.
        // Staff must mark CASH RECEIVED to complete the order payment.
        const updated = await updateOrderPayment(id, "CASH", "PENDING_CASH", false);
        if (updated) updatedOrders.push(updated);
      } else if (method === "ONLINE" || method === "RESET" || method === "UNSELECTED") {
        // Reset or switched to online payment
        const updated = await updateOrderPayment(id, "ONLINE", "UNPAID", false);
        if (updated) updatedOrders.push(updated);
      }
    }

    if (updatedOrders.length === 0 && orderIds.length === 1) {
      const singleOrder = await getOrderById(orderIds[0]);
      if (singleOrder?.status === "CANCELLED") {
        return NextResponse.json(
          { success: false, error: "Cannot set payment method for a cancelled order." },
          { status: 400 }
        );
      }
      if (singleOrder?.paymentStatus === "PAID") {
        return NextResponse.json(
          { success: false, error: "This order has already been paid for." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedOrders.length,
      orders: updatedOrders,
      order: updatedOrders[0] || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to set payment method." },
      { status: 500 }
    );
  }
}
