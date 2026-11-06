import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderPayment } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { releaseTableReservation, normalizeTableLabel } from "@/lib/tables";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      orderId,
      paymentMethod,
      amountReceived,
      changeGiven,
      paymentTxnId,
      adminUser = "Cashier Staff",
    } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required." },
        { status: 400 }
      );
    }

    if (paymentMethod !== "CASH" && paymentMethod !== "ONLINE") {
      return NextResponse.json(
        { success: false, error: "Payment method must be CASH or ONLINE." },
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
        { success: false, error: "This order is already marked as PAID." },
        { status: 400 }
      );
    }

    const txnId =
      paymentTxnId ||
      (paymentMethod === "CASH"
        ? `CASH-RCPT-${Date.now().toString().slice(-6)}`
        : `POS-MCH-${Date.now().toString().slice(-6)}`);

    const provider = paymentMethod === "CASH" ? "CASH_COUNTER" : "EDC_PAYMENT_MACHINE";

    // Mark as PAID and COMPLETED
    const updated = await updateOrderPayment(
      order.id,
      paymentMethod,
      "PAID",
      true, // auto-complete
      adminUser,
      txnId,
      provider
    );

    // Save payment audit record
    try {
      await supabaseAdmin.from("payments" as any).insert({
        order_id: order.id,
        provider,
        provider_order_id: order.orderNumber,
        provider_payment_id: txnId,
        amount: order.grandTotal,
        currency: "INR",
        status: "COMPLETED",
        payment_method: paymentMethod,
        metadata: {
          amountReceived: amountReceived || order.grandTotal,
          changeGiven: changeGiven || 0,
          confirmedBy: adminUser,
          confirmedAt: new Date().toISOString(),
          tableNumber: order.tableNumber,
        },
      });
    } catch {}

    // Settle any sister orders sharing the same visit on this table
    const visitId = order.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1];
    if (visitId) {
      try {
        const { data: sisterOrders } = await supabaseAdmin
          .from("orders" as any)
          .select("id")
          .ilike("notes", `%[VISIT_ID:${visitId}]%`)
          .neq("id", order.id)
          .neq("payment_status", "PAID");

        if (Array.isArray(sisterOrders) && sisterOrders.length > 0) {
          for (const sister of sisterOrders as any[]) {
            await updateOrderPayment(
              sister.id,
              paymentMethod,
              "PAID",
              true,
              adminUser,
              txnId,
              provider
            );
          }
        }
      } catch (err) {
        console.warn("Sister order payment update warning:", err);
      }
    }

    // Release table reservations and return table to AVAILABLE / WHITE
    await releaseTableReservation(order.tableNumber, adminUser);
    try {
      await supabaseAdmin
        .from("restaurant_tables" as any)
        .update({ status: "AVAILABLE", active_order_id: null, updated_at: new Date().toISOString() })
        .eq("table_number", normalizeTableLabel(order.tableNumber));
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Payment of ₹${updated.grandTotal} (${paymentMethod}) successfully confirmed for Table ${order.tableNumber}. Table released to available.`,
      order: updated,
    });
  } catch (err: any) {
    console.error("Payment confirmation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to confirm payment." },
      { status: 500 }
    );
  }
}

