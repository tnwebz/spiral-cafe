import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderPayment } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";

/**
 * POST /api/payments/razorpay/verify
 *
 * Backward-compatible endpoint for Razorpay payment verification.
 * Internally delegates to the generic payment provider abstraction.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required." },
        { status: 400 }
      );
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: "Missing required Razorpay verification credentials." },
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

    // Idempotency: Safe return if order is already paid with this payment ID
    if (order.paymentStatus === "PAID") {
      if (order.paymentTxnId === razorpay_payment_id) {
        return NextResponse.json({
          success: true,
          message: "Payment already verified and confirmed as PAID.",
          order,
        });
      }

      return NextResponse.json(
        { success: false, error: `Order is already recorded as PAID with transaction ${order.paymentTxnId}.` },
        { status: 400 }
      );
    }

    // Cryptographic verification via provider abstraction
    const provider = getPaymentProvider("razorpay");
    const result = await provider.verifyPayment({
      provider: "razorpay",
      orderId: order.id,
      providerOrderId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id,
      signature: razorpay_signature,
      rawPayload: body,
    });

    if (!result.success || result.status !== "PAID") {
      return NextResponse.json(
        { success: false, error: result.error || "Invalid payment signature verification failed." },
        { status: 400 }
      );
    }

    // Authoritative update
    const updated = await updateOrderPayment(
      order.id,
      "ONLINE",
      "PAID",
      true,
      "Razorpay Gateway",
      razorpay_payment_id,
      "RAZORPAY"
    );

    return NextResponse.json({
      success: true,
      message: "Payment successfully verified and confirmed as PAID.",
      order: updated,
    });
  } catch (err: any) {
    console.error("Razorpay verification error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to verify payment." },
      { status: 500 }
    );
  }
}
