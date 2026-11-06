import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getOrderById } from "@/lib/db";
import { normalizeTableLabel } from "@/lib/tables";
import { requireAdminAuth } from "@/lib/auth";

const PRINT_SECRET =
  process.env.PRINT_CONNECTOR_SECRET || "spiral_kot_sig_7f8a9b2c3d4e5f6018273645";

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { orderId, round = 1, terminalName = "Billing 1" } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing required orderId." },
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

    // Duplicate prevention: check if this round is already confirmed in order notes
    const currentNotes = order.notes || "";
    const confirmedMatch = currentNotes.match(/\[KOT_CONFIRMED_ROUNDS:([0-9,]+)\]/);
    if (confirmedMatch && !body.forceReprint) {
      const confirmedRounds = confirmedMatch[1].split(",").map(Number);
      if (confirmedRounds.includes(Number(round))) {
        return NextResponse.json(
          {
            success: false,
            alreadyConfirmed: true,
            error: `KOT Round ${round} for Order #${order.orderNumber} is already confirmed and kitchen was notified. Duplicate print prevented.`,
          },
          { status: 409 }
        );
      }
    }

    // Filter items by round if items have round metadata, otherwise include all items
    const rawItems = order.items || [];
    const itemsForRound = rawItems.filter((it: any) => {
      if (typeof it.round === "number") {
        return it.round === Number(round);
      }
      return true;
    });

    const items = (itemsForRound.length > 0 ? itemsForRound : rawItems).map((it: any) => ({
      name: String(it.name || "Item"),
      quantity: Number(it.quantity) || 1,
      notes: it.notes || it.customizations || undefined,
    }));

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No items found for this KOT dispatch." },
        { status: 400 }
      );
    }

    const totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);
    const totalItems = items.length;

    const normTable = normalizeTableLabel(order.tableNumber || "A1");
    const orderNumber = order.orderNumber || `ORD-${order.id.slice(-6).toUpperCase()}`;

    // Create unique KOT ID
    const kotId = `KOT-${orderNumber}-R${round}-${Date.now().toString().slice(-4)}`;

    // Compute deterministic itemsHash
    const itemsCanonical = items
      .map((i) => `${i.name}:${i.quantity}:${i.notes || ""}`)
      .sort()
      .join(";");
    const itemsHash = crypto.createHash("sha256").update(itemsCanonical).digest("hex").slice(0, 16);

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const kotPayload = {
      kotId,
      orderNumber,
      tableNumber: normTable,
      round: Number(round),
      terminalName,
      dateStr,
      timeStr,
      items,
      totalItems,
      totalQuantity,
      specialInstructions: order.notes || undefined,
    };

    const timestamp = Date.now();
    const nonce = crypto.randomBytes(8).toString("hex");

    const authPayload = {
      kotId,
      orderId: order.id,
      orderNumber,
      tableNumber: normTable,
      round: Number(round),
      itemsHash,
      timestamp,
      nonce,
    };

    // Canonical HMAC message matching local-connector/src/security.ts
    const message = `${authPayload.kotId}|${authPayload.orderId}|${authPayload.orderNumber}|${authPayload.tableNumber}|${authPayload.round}|${authPayload.itemsHash}|${authPayload.timestamp}|${authPayload.nonce}`;
    const signature = crypto.createHmac("sha256", PRINT_SECRET).update(message).digest("hex");

    const attemptId = `ATT-${Date.now()}-${nonce.slice(0, 4)}`;

    return NextResponse.json({
      success: true,
      attemptId,
      kotPayload,
      authPayload,
      signature,
    });
  } catch (err: any) {
    console.error("Error authorizing KOT print:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to authorize KOT print." },
      { status: 500 }
    );
  }
}

