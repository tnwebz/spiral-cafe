import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action = "PREPARE", kotId: incomingKotId, printedAtCounter } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required." },
        { status: 400 }
      );
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found.` },
        { status: 404 }
      );
    }

    // Confirmation action: update database status to PREPARING and mark KOT as confirmed
    if (action === "CONFIRM") {
      const confirmedNotes = `${order.notes || ""} [KOT_CONFIRMED:ROUND_1_AT_${Date.now()}]${
        printedAtCounter ? " [PRINTED_AT_COUNTER]" : ""
      }`.trim();

      await supabaseAdmin
        .from("orders" as any)
        .update({
          notes: confirmedNotes,
          status: "PREPARING",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      return NextResponse.json({
        success: true,
        printed: true,
        kotId: incomingKotId || `PRV-KOT-${order.orderNumber}`,
        message: `Kitchen KOT confirmed for #${order.orderNumber}. Order marked PREPARING.`,
      });
    }

    // Build KOT payload from authoritative database record
    const items = (order.items || []).map((it) => ({
      name: it.name,
      quantity: it.quantity,
      notes: it.notes,
    }));

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order has no items." },
        { status: 400 }
      );
    }

    const totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);
    const totalItems = items.length;
    const kotId = incomingKotId || `PRV-KOT-${order.orderNumber}-${Date.now().toString().slice(-4)}`;

    const dest =
      order.tableNumber && order.tableNumber !== "COUNTER" && order.tableNumber !== "GIVE ON COUNTER"
        ? `TABLE ${order.tableNumber.toUpperCase()}`
        : "GIVE ON COUNTER";

    const cleanNoteInstructions = (order.notes || "")
      .replace(/\[[^\]]+\]/g, "")
      .replace(/\|/g, "")
      .trim();
    const specialInstructions = [order.privateNote?.trim(), cleanNoteInstructions]
      .filter((s, idx, arr) => Boolean(s) && arr.indexOf(s) === idx)
      .join(" | ");

    const kotPayload = {
      kotId,
      orderNumber: order.orderNumber,
      purpose: order.privatePurpose || "STAFF",
      isPrivateOrder: true,
      privatePurpose: order.privatePurpose || "STAFF",
      tableNumber: dest,
      destination: dest,
      terminalName: "Billing 1",
      dateStr: new Date().toLocaleDateString("en-GB"),
      timeStr: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      items,
      totalItems,
      totalQuantity,
      specialInstructions: specialInstructions || undefined,
    };

    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Return the prepared payload for browser direct transmission to local print connector
    return NextResponse.json({
      success: true,
      attemptId,
      kotPayload,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        destination: dest,
      },
    });
  } catch (error: any) {
    console.error("Private KOT route error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process private KOT" },
      { status: 500 }
    );
  }
}
