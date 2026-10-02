import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderPayment } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";

/**
 * POST /api/payments/verify
 *
 * Provider-agnostic payment verification endpoint.
 *
 * Security & Integrity:
 * - Server strictly performs cryptographic signature verification via provider adapter.
 * - Enforces idempotency: Duplicate verify calls return existing paid state safely.
 * - Prevents client from directly claiming PAID status without cryptographic proof.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      orderId,
      provider: requestedProvider,
      providerOrderId = body.razorpay_order_id,
      providerPaymentId = body.razorpay_payment_id,
      signature = body.razorpay_signature,
      rawPayload,
    } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required." },
        { status: 400 }
      );
    }

    if (!providerOrderId || !providerPaymentId || !signature) {
      return NextResponse.json(
        {
          success: false,
          error: "Incomplete payment verification payload (providerOrderId, providerPaymentId, signature required).",
        },
        { status: 400 }
      );
    }

    // 1. Authoritative order lookup
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    // 2. Idempotency Check: Safe handling of duplicate/retry verification requests
    if (order.paymentStatus === "PAID") {
      if (order.paymentTxnId === providerPaymentId) {
        return NextResponse.json({
          success: true,
          message: "Order has already been verified and recorded as PAID.",
          order,
          transactionId: providerPaymentId,
          provider: order.paymentProvider || requestedProvider || "razorpay",
        });
      }

      // Fraud / conflict guard: Attempt to overwrite with a different payment ID
      return NextResponse.json(
        {
          success: false,
          error: `Order is already recorded as PAID with transaction ${order.paymentTxnId}.`,
        },
        { status: 400 }
      );
    }

    // 3. Resolve configured payment provider
    const provider = getPaymentProvider(requestedProvider);

    // 4. Verify payment with provider adapter
    const verifyResult = await provider.verifyPayment({
      provider: provider.name,
      orderId: order.id,
      providerOrderId,
      providerPaymentId,
      signature,
      rawPayload: rawPayload || body,
    });

    if (!verifyResult.success || verifyResult.status !== "PAID") {
      return NextResponse.json(
        {
          success: false,
          error: verifyResult.error || "Payment signature verification failed.",
        },
        { status: 400 }
      );
    }

    // 5. Update database state: Order payment status set to PAID, method ONLINE
    const updatedOrder = await updateOrderPayment(
      order.id,
      "ONLINE",
      "PAID",
      true, // Auto-complete if order is already ready
      "Online Gateway",
      providerPaymentId,
      provider.name.toUpperCase()
    );

    return NextResponse.json({
      success: true,
      message: "Payment successfully verified and confirmed as PAID.",
      order: updatedOrder,
      transactionId: providerPaymentId,
      provider: provider.name,
    });
  } catch (err: any) {
    console.error("Payment verification error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Payment verification failed." },
      { status: 500 }
    );
  }
}
