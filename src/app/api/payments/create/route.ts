import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";

/**
 * POST /api/payments/create
 *
 * Provider-agnostic payment order initialization endpoint.
 *
 * Security & Integrity:
 * - Server strictly checks database for authoritative grandTotal.
 * - Never trusts any client-submitted amount.
 * - Validates order existence and payment readiness.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, provider: requestedProvider } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required." },
        { status: 400 }
      );
    }

    // 1. Authoritative order lookup from database
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    // 2. State verification
    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { success: false, error: "This order has already been paid for." },
        { status: 400 }
      );
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Cannot initiate payment for a cancelled order." },
        { status: 400 }
      );
    }

    // 3. Resolve configured payment provider (Razorpay, Zoho, etc.)
    const provider = getPaymentProvider(requestedProvider);

    // 4. Delegate to provider adapter using authoritative grandTotal
    const paymentResult = await provider.createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.grandTotal, // Authoritative server-side value
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
      provider: paymentResult.provider,
      providerOrderId: paymentResult.providerOrderId,
      amount: paymentResult.amount, // In minor units (paise)
      currency: paymentResult.currency,
      clientPayload: paymentResult.clientPayload,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      grandTotal: order.grandTotal,
    });
  } catch (err: any) {
    console.error("Payment create error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to initialize payment." },
      { status: 500 }
    );
  }
}
