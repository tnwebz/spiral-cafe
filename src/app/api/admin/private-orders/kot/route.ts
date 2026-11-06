import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";

const CONNECTOR_URL = process.env.NEXT_PUBLIC_PRINT_CONNECTOR_URL || "http://127.0.0.1:4318";
const ADMIN_SECRET =
  process.env.PRINT_CONNECTOR_SECRET || "spiral_kot_sig_7f8a9b2c3d4e5f6018273645";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = body;

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
    const kotId = `PRV-KOT-${order.orderNumber}-${Date.now().toString().slice(-4)}`;

    const kotPayload = {
      kotId,
      orderNumber: order.orderNumber,
      purpose: order.privatePurpose || "STAFF",
      destination: "GIVE ON COUNTER",
      terminalName: "Billing 1",
      dateStr: new Date().toLocaleDateString("en-IN"),
      timeStr: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      items,
      totalItems,
      totalQuantity,
      specialInstructions: order.privateNote || undefined,
    };

    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Try transmitting to local print connector
    try {
      const res = await fetch(`${CONNECTOR_URL}/printer/print-private-kot`, {
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
        return NextResponse.json({
          success: true,
          printed: true,
          kotId,
          message: `Kitchen KOT sent to Kitchen CN811-UEWB (GIVE ON COUNTER).`,
        });
      } else {
        return NextResponse.json({
          success: true,
          printed: false,
          warning: json.error || "Printer connector reported issue.",
          kotId,
        });
      }
    } catch (netErr: any) {
      return NextResponse.json({
        success: true,
        printed: false,
        warning: "Local Print Connector is not running or unreachable on port 4318.",
        kotId,
      });
    }
  } catch (error: any) {
    console.error("Private KOT route error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to dispatch private KOT" },
      { status: 500 }
    );
  }
}

