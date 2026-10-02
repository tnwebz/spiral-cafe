import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";

/**
 * POST /api/payments/razorpay/create
 *
 * Backward-compatible endpoint for Razorpay order creation.
 * Internally delegates to the generic payment provider abstraction.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required." },
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

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { success: false, error: "This order has already been paid." },
        { status: 400 }
      );
    }

    const provider = getPaymentProvider("razorpay");
    const result = await provider.createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.grandTotal,
      currency: "INR",
      customerPhone: order.customerPhone || undefined,
      tableNumber: order.tableNumber,
      notes: {
        orderId: order.id,
        tableNumber: order.tableNumber,
      },
    });

    return NextResponse.json({
      success: true,
      razorpayOrderId: result.providerOrderId,
      amount: result.amount,
      currency: result.currency,
      key: result.clientPayload.keyId,
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
