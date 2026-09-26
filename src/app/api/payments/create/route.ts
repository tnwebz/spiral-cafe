import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { orderId, method } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required." },
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

    // Business rule: Payment options only become available after order is READY
    if (order.status !== "READY") {
      return NextResponse.json(
        {
          success: false,
          error: "Payment is only enabled once your meal has been prepared and marked READY by the kitchen.",
        },
        { status: 400 }
      );
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { success: false, error: "This order has already been paid for." },
        { status: 400 }
      );
    }

    // Generate mock/real payment session token
    const paymentSessionId = `pay_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return NextResponse.json({
      success: true,
      paymentSessionId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.grandTotal,
      currency: "INR",
      method: method || "ONLINE",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to initiate payment." },
      { status: 500 }
    );
  }
}
