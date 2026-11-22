import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapDbOrderToOrder, createOrder, Order } from "@/lib/db";
import { buildKotData, KotReceiptEngine } from "@/lib/kot";

const CONNECTOR_URL = process.env.NEXT_PUBLIC_PRINT_CONNECTOR_URL || "http://127.0.0.1:4318";
const ADMIN_SECRET = process.env.PRINT_CONNECTOR_SECRET || "spiral_kot_sig_7f8a9b2c3d4e5f6018273645";

export async function GET() {
  try {
    const cutoffIso = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .ilike("table_number", "%takeaway%")
      .neq("status", "CANCELLED")
      .neq("payment_status", "PAID")
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching active takeaway orders:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const orders: Order[] = (data || []).map((r: any) => mapDbOrderToOrder(r));

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (err: any) {
    console.error("Takeaway API GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load takeaway orders." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tableNumber = "TAKEAWAY",
      customerName = "",
      customerPhone = "",
      items = [],
      notes = "",
      sendKotImmediately = false,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order must contain at least one item." },
        { status: 400 }
      );
    }

    const isTakeawayOrder =
      tableNumber === "TAKEAWAY" ||
      tableNumber.toUpperCase() === "TAKE AWAY";

    const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, "").slice(-10) : "";
    const guestLabel = customerName.trim() ? `[CUSTOMER_NAME:${customerName.trim()}]` : "";

    // Map items: check item-level isParcel or order-level takeaway
    const processedItems = items.map((it: any) => {
      let displayName = (it.name || "").trim();
      const isItemParcel =
        Boolean(it.isParcel) ||
        displayName.toLowerCase().includes("(parcel)") ||
        isTakeawayOrder;

      if (isItemParcel && !displayName.toLowerCase().includes("(parcel)")) {
        displayName = `${displayName} - (parcel)`;
      } else if (!isItemParcel) {
        displayName = displayName
          .replace(/\s*-\s*\(parcel\)/gi, "")
          .replace(/\s*\(parcel\)/gi, "")
          .trim();
      }

      const itemNotes = isItemParcel
        ? (it.notes ? `${it.notes} [PARCEL]` : "[PARCEL]")
        : (it.notes || "");

      return {
        productId: it.id || it.productId || `prod_${Date.now()}`,
        name: displayName,
        price: Number(it.price) || 0,
        quantity: Math.max(1, Number(it.quantity) || 1),
        image: it.image || "",
        notes: itemNotes,
      };
    });

    const hasParcelItems = processedItems.some((it: { name: string }) => it.name.toLowerCase().includes("(parcel)"));
    const hasDineInItems = processedItems.some((it: { name: string }) => !it.name.toLowerCase().includes("(parcel)"));
    const isMixed = hasParcelItems && hasDineInItems;

    let fullNotes = `${guestLabel} ${notes}`.trim();
    if (isMixed) {
      if (!fullNotes.includes("DINE_IN_AND_TAKEAWAY")) {
        fullNotes = `[DINE_IN_AND_TAKEAWAY] ${fullNotes}`.trim();
      }
    } else if (isTakeawayOrder || hasParcelItems) {
      if (!fullNotes.includes("[TAKEAWAY]")) {
        fullNotes = `[TAKEAWAY] [PARCEL] ${fullNotes}`.trim();
      }
    }

    const sessionId = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const createdOrder = await createOrder({
      tableNumber:
        tableNumber === "TAKEAWAY" || tableNumber.toUpperCase() === "TAKE AWAY"
          ? "TAKEAWAY"
          : tableNumber.toUpperCase(),
      customerSessionId: sessionId,
      customerPhone: cleanPhone || undefined,
      items: processedItems,
      notes: fullNotes,
    });

    // If sendKotImmediately is false (standard manual order placement), do not call printer yet.
    // Order stays PENDING so admin can review and trigger KOT from the table screen when ready.
    if (!sendKotImmediately) {
      return NextResponse.json({
        success: true,
        order: createdOrder,
        printedKot: false,
        message: `${createdOrder.tableNumber === "TAKEAWAY" ? "Take Away" : `Table ${createdOrder.tableNumber}`} Order #${createdOrder.orderNumber} placed! You can send KOT from the table screen. ✅`,
      });
    }

    // Automatically attempt to dispatch KOT to the Kitchen Printer via connector (if explicitly requested)
    let printedKot = false;
    let kotWarning: string | undefined;

    try {
      const kotData = buildKotData(createdOrder, 1, "Billing 1", { isTakeaway: isTakeawayOrder || hasParcelItems });
      const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const kotPayload = {
        kotId: kotData.kotId,
        orderNumber: createdOrder.orderNumber,
        tableNumber: createdOrder.tableNumber,
        round: 1,
        terminalName: "Billing 1",
        dateStr: kotData.dateStr,
        timeStr: kotData.timeStr,
        items: kotData.items,
        totalItems: kotData.totalItems,
        totalQuantity: kotData.totalQuantity,
        specialInstructions: notes || undefined,
      };

      const res = await fetch(`${CONNECTOR_URL}/printer/print-kot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_SECRET}`,
        },
        body: JSON.stringify({
          attemptId,
          kotPayload,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        printedKot = true;
        const confirmedNotes = `${createdOrder.notes || ""} [KOT_CONFIRMED:ROUND_1_AT_${Date.now()}]`.trim();
        await supabaseAdmin
          .from("orders" as any)
          .update({
            notes: confirmedNotes,
            status: "PREPARING",
            updated_at: new Date().toISOString(),
          })
          .eq("id", createdOrder.id);
        createdOrder.notes = confirmedNotes;
        createdOrder.status = "PREPARING";
      } else {
        kotWarning = json.error || json.message || "Kitchen printer is currently disconnected or busy.";
        const pendingNotes = `${createdOrder.notes || ""} [KOT_PENDING_PRINTER_OFFLINE_AT_${Date.now()}]`.trim();
        await supabaseAdmin
          .from("orders" as any)
          .update({
            notes: pendingNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", createdOrder.id);
        createdOrder.notes = pendingNotes;
      }
    } catch (err: any) {
      kotWarning = "Kitchen printer is not reachable (connector offline or disconnected).";
      const pendingNotes = `${createdOrder.notes || ""} [KOT_PENDING_PRINTER_OFFLINE_AT_${Date.now()}]`.trim();
      await supabaseAdmin
        .from("orders" as any)
        .update({
          notes: pendingNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", createdOrder.id);
      createdOrder.notes = pendingNotes;
    }

    const feedbackMsg = printedKot
      ? `${isTakeawayOrder ? "Take Away" : `Table ${tableNumber}`} Order #${createdOrder.orderNumber} placed & Kitchen KOT printed! ✅`
      : `${isTakeawayOrder ? "Take Away" : `Table ${tableNumber}`} Order #${createdOrder.orderNumber} placed! ⚠️ Kitchen printer offline — KOT pending dispatch.`;

    return NextResponse.json({
      success: true,
      order: createdOrder,
      printedKot,
      kotWarning,
      message: feedbackMsg,
    });
  } catch (err: any) {
    console.error("Takeaway API POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create order." },
      { status: 500 }
    );
  }
}

