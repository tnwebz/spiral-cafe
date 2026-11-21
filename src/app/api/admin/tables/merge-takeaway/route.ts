import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeTableLabel } from "@/lib/tables";
import { getActiveVisitOrdersForTable, mapDbOrderToOrder, Order } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { takeawayOrderId, targetTable, adminUser = "Admin Staff" } = body;

    if (!takeawayOrderId || !targetTable) {
      return NextResponse.json(
        { success: false, error: "takeawayOrderId and targetTable are required." },
        { status: 400 }
      );
    }

    const cleanTarget = normalizeTableLabel(targetTable);

    // 1. Fetch the takeaway order
    const { data: orderData, error: orderErr } = await supabaseAdmin
      .from("orders" as any)
      .select("*, order_items(*)")
      .eq("id", takeawayOrderId)
      .maybeSingle();

    if (orderErr || !orderData) {
      return NextResponse.json(
        { success: false, error: "Takeaway order not found." },
        { status: 404 }
      );
    }

    const takeawayOrder: Order = mapDbOrderToOrder(orderData);

    if (takeawayOrder.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Cannot merge a cancelled order." },
        { status: 400 }
      );
    }

    if (takeawayOrder.paymentStatus === "PAID") {
      return NextResponse.json(
        { success: false, error: "This takeaway order has already been paid and settled." },
        { status: 400 }
      );
    }

    // 2. Check if target table already has an active visit
    const { visitId: existingVisitId, orders: tableOrders } = await getActiveVisitOrdersForTable(cleanTarget);

    let visitId = existingVisitId;
    if (!visitId) {
      if (tableOrders.length > 0) {
        const primary = tableOrders[0];
        visitId =
          primary.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1] ||
          (primary as any).visit_id ||
          `VISIT-${cleanTarget}-${primary.id.slice(0, 8).toUpperCase()}`;
      } else {
        visitId = `VISIT-${cleanTarget}-${takeawayOrder.id.slice(0, 8).toUpperCase()}`;
      }
    }

    const currentNotes = takeawayOrder.notes || "";
    let updatedNotes = currentNotes;

    // Ensure [VISIT_ID:...] tag is set to target table's visit
    if (updatedNotes.includes("[VISIT_ID:")) {
      updatedNotes = updatedNotes.replace(/\[VISIT_ID:[^\]]+\]/g, `[VISIT_ID:${visitId}]`);
    } else {
      updatedNotes = `${updatedNotes} [VISIT_ID:${visitId}]`.trim();
    }

    // Ensure [TAKEAWAY] parcel tag is retained so kitchen & billing show parcel badge
    if (!updatedNotes.includes("[TAKEAWAY]") && !updatedNotes.includes("[PARCEL]")) {
      updatedNotes = `${updatedNotes} [TAKEAWAY]`.trim();
    }

    // Add merge history tracking tag
    const nowIso = new Date().toISOString();
    updatedNotes = `${updatedNotes} [MERGED_FROM_TAKEAWAY:${takeawayOrder.orderNumber}_AT:${nowIso}_BY:${adminUser}]`.trim();

    // 3. Update the order in database: change table_number to target table
    const { error: updateErr } = await supabaseAdmin
      .from("orders" as any)
      .update({
        table_number: cleanTarget,
        notes: updatedNotes,
        updated_at: nowIso,
      })
      .eq("id", takeawayOrderId);

    if (updateErr) {
      console.error("Error updating order to target table:", updateErr);
      return NextResponse.json(
        { success: false, error: updateErr.message || "Failed to update order table." },
        { status: 500 }
      );
    }

    // Also update order_items to flag them as takeaway parcel items
    try {
      await supabaseAdmin
        .from("order_items" as any)
        .update({
          order_type: "TAKEAWAY",
        })
        .eq("order_id", takeawayOrderId);
    } catch {}

    // Audit log
    try {
      await supabaseAdmin.from("audit_logs" as any).insert({
        action: "MERGE_TAKEAWAY_TO_TABLE",
        details: {
          orderId: takeawayOrderId,
          orderNumber: takeawayOrder.orderNumber,
          from: takeawayOrder.tableNumber,
          to: cleanTarget,
          visitId,
          grandTotal: takeawayOrder.grandTotal,
          adminUser,
        },
        created_at: nowIso,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Takeaway Order #${takeawayOrder.orderNumber} successfully merged into Table ${cleanTarget}.`,
      targetTable: cleanTarget,
      visitId,
    });
  } catch (err: any) {
    console.error("Merge takeaway error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to merge takeaway order." },
      { status: 500 }
    );
  }
}
