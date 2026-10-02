import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderPayment } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { adminUser = "Admin Staff" } = body;

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { success: false, error: "This order is already marked as PAID." },
        { status: 400 }
      );
    }

    // Mark as PAID via CASH, with autoComplete if ready
    const updated = await updateOrderPayment(
      order.id,
      "CASH",
      "PAID",
      true,
      adminUser,
      `CASH-RCPT-${Date.now().toString().slice(-6)}`,
      "CASH_COUNTER"
    );

    return NextResponse.json({
      success: true,
      message: `Cash of ₹${updated.grandTotal} successfully collected and confirmed for order ${updated.orderNumber}.`,
      order: updated,
    });
  } catch (err: any) {
    console.error("Collect cash error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to collect cash." },
      { status: 500 }
    );
  }
}
