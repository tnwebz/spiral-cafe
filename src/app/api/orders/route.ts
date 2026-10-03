import { NextRequest, NextResponse } from "next/server";
import {
  createOrder,
  getAllOrders,
  getSessionOrders,
  getActiveOrderForTable,
  addItemsToExistingOrder,
  normalizeTableNumber,
} from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableNumber, customerSessionId, items, notes, customerPhone, customerId } = body;

    if (!customerSessionId || typeof customerSessionId !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid customer session ID is required." },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Your basket is empty. Please add items." },
        { status: 400 }
      );
    }

    // Validate item structure
    for (const it of items) {
      if (!it.productId || !it.name || typeof it.price !== "number" || !it.quantity) {
        return NextResponse.json(
          { success: false, error: "Invalid item data provided." },
          { status: 400 }
        );
      }
    }

    const cleanTable = normalizeTableNumber(tableNumber || "Table 01");

    // Single Master Order per Table Session:
    // Check if there is an active, unpaid order already for this table
    const activeOrder = await getActiveOrderForTable(cleanTable);

    if (activeOrder) {
      // Append items to the existing order ticket and recalculate consolidated total
      const updatedOrder = await addItemsToExistingOrder({
        orderId: activeOrder.id,
        items,
        notes,
      });

      return NextResponse.json(
        { success: true, order: updatedOrder, isAddon: true },
        { status: 200 }
      );
    }

    // First order for this table sitting -> create new master order
    const order = await createOrder({
      tableNumber: cleanTable,
      customerSessionId,
      customerId,
      customerPhone,
      items,
      notes,
    });

    return NextResponse.json({ success: true, order, isAddon: false }, { status: 201 });
  } catch (err: any) {
    console.error("Order creation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process order." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const table = searchParams.get("table");

    if (table) {
      const activeOrder = await getActiveOrderForTable(table);
      return NextResponse.json({ success: true, activeOrder });
    }

    if (sessionId) {
      const orders = await getSessionOrders(sessionId);
      return NextResponse.json({ success: true, orders });
    }

    // If no session or table filter provided, return all orders
    const all = await getAllOrders();
    return NextResponse.json({ success: true, orders: all });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch orders." },
      { status: 500 }
    );
  }
}
