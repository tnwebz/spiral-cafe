import { NextRequest, NextResponse } from "next/server";
import { createOrder, getAllOrders, getSessionOrders } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableNumber, customerSessionId, items, notes } = body;

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

    const order = createOrder({
      tableNumber: tableNumber || "Table 01",
      customerSessionId,
      items,
      notes,
    });

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (err: any) {
    console.error("Order creation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create order." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      const orders = getSessionOrders(sessionId);
      return NextResponse.json({ success: true, orders });
    }

    // If no session filter provided, return all orders (e.g. for general queries)
    const all = getAllOrders();
    return NextResponse.json({ success: true, orders: all });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch orders." },
      { status: 500 }
    );
  }
}
