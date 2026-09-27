import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";
import { createRazorpayOrder, RAZORPAY_CONFIG } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required." },
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

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { success: false, error: "This order has already been paid." },
        { status: 400 }
      );
    }

    // Amount in Rupees -> paise (e.g. ₹680 -> 68000 paise)
    const amountInPaise = Math.round(order.grandTotal * 100);

    const rzpOrder = await createRazorpayOrder({
      amountInPaise,
      currency: "INR",
      receipt: order.orderNumber,
      notes: {
        orderId: order.id,
        tableNumber: order.tableNumber,
        customerPhone: order.customerPhone || "N/A",
      },
    });

    return NextResponse.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key: RAZORPAY_CONFIG.keyId,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      grandTotal: order.grandTotal,
    });
  } catch (err: any) {
    console.error("Razorpay order create error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to initialize online payment." },
      { status: 500 }
    );
  }
}
