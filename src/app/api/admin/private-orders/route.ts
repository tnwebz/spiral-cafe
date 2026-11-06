import { NextRequest, NextResponse } from "next/server";
import { getPrivateOrders, createPrivateOrder, PrivatePurpose } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const purpose = url.searchParams.get("purpose") as PrivatePurpose | null;
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);

    let orders = await getPrivateOrders();

    if (purpose) {
      orders = orders.filter((o) => o.privatePurpose === purpose);
    }

    orders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      orders: orders.slice(0, limit),
      totalCount: orders.length,
    });
  } catch (error: any) {
    console.error("Failed to fetch private orders:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch private orders" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { purpose, privateNote, items, specialInstructions } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one item is required for private order." },
        { status: 400 }
      );
    }

    const validPurpose: PrivatePurpose =
      purpose === "OWNER" || purpose === "STAFF" || purpose === "OTHER_INTERNAL"
        ? purpose
        : "STAFF";

    const order = await createPrivateOrder({
      purpose: validPurpose,
      privateNote: typeof privateNote === "string" ? privateNote.trim() : undefined,
      items,
      specialInstructions:
        typeof specialInstructions === "string" ? specialInstructions.trim() : undefined,
    });

    return NextResponse.json({
      success: true,
      order,
      message: `Private order #${order.orderNumber} placed for ${validPurpose}. Destination: GIVE ON COUNTER.`,
    });
  } catch (error: any) {
    console.error("Failed to place private order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create private order." },
      { status: 500 }
    );
  }
}

