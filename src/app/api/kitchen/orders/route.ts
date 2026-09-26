import { NextRequest, NextResponse } from "next/server";
import {
  getActiveKitchenOrders,
  getConfig,
  updateOrderStatus,
  updateOrderPayment,
} from "@/lib/db";

function verifyKitchenAuth(req: NextRequest, bodyPin?: string): boolean {
  const config = getConfig();
  const headerPin = req.headers.get("x-kitchen-pin");
  const queryPin = new URL(req.url).searchParams.get("pin");
  const candidate = bodyPin || headerPin || queryPin;
  return candidate === config.kitchenPin;
}

export async function GET(req: NextRequest) {
  if (!verifyKitchenAuth(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Kitchen PIN is required." },
      { status: 401 }
    );
  }

  const data = getActiveKitchenOrders();
  return NextResponse.json({ success: true, ...data });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action, pin } = body;

    if (!verifyKitchenAuth(req, pin)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Valid kitchen PIN required." },
        { status: 401 }
      );
    }

    if (!orderId || !action) {
      return NextResponse.json(
        { success: false, error: "orderId and action are required." },
        { status: 400 }
      );
    }

    let updatedOrder;

    switch (action) {
      case "START_PREPARING":
        updatedOrder = updateOrderStatus(orderId, "PREPARING", "kitchen");
        break;

      case "MARK_READY":
        updatedOrder = updateOrderStatus(orderId, "READY", "kitchen");
        break;

      case "MARK_CASH_RECEIVED":
        // Cash confirmed by staff -> mark paid and complete
        updatedOrder = updateOrderPayment(orderId, "CASH", "PAID", true);
        break;

      case "COMPLETE_ORDER":
        updatedOrder = updateOrderStatus(orderId, "COMPLETED", "kitchen");
        break;

      case "CANCEL_ORDER":
        updatedOrder = updateOrderStatus(orderId, "CANCELLED", "kitchen");
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unrecognized action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error("Kitchen action error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update order state." },
      { status: 400 }
    );
  }
}
