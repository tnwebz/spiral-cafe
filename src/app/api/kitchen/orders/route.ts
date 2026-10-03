import { NextRequest, NextResponse } from "next/server";
import {
  getActiveKitchenOrders,
  getConfig,
  updateOrderStatus,
  updateOrderPayment,
  mergeAddonToCooking,
} from "@/lib/db";

async function verifyKitchenAuth(req: NextRequest, bodyPin?: string): Promise<boolean> {
  const config = await getConfig();
  const headerPin = req.headers.get("x-kitchen-pin");
  const queryPin = new URL(req.url).searchParams.get("pin");
  const candidate = bodyPin || headerPin || queryPin;
  return candidate === config.kitchenPin;
}

export async function GET(req: NextRequest) {
  if (!(await verifyKitchenAuth(req))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Kitchen PIN is required." },
      { status: 401 }
    );
  }

  const data = await getActiveKitchenOrders();
  return NextResponse.json({ success: true, ...data });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action, pin, addonRound } = body;

    if (!(await verifyKitchenAuth(req, pin))) {
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

    // Handle add-on ticket ID synthesis (e.g. ord_xxx__addon_r2)
    const isAddonId = typeof orderId === "string" && orderId.includes("__addon_r");
    const parentOrderId = isAddonId ? orderId.split("__addon_r")[0] : orderId;
    const extractedRound = isAddonId
      ? parseInt(orderId.split("__addon_r")[1], 10)
      : addonRound;

    if (action === "MERGE_ADDON_TO_COOKING" || (action === "START_PREPARING" && isAddonId)) {
      updatedOrder = await mergeAddonToCooking(parentOrderId, extractedRound);
      return NextResponse.json({ success: true, order: updatedOrder });
    }

    switch (action) {
      case "START_PREPARING":
        updatedOrder = await updateOrderStatus(parentOrderId, "PREPARING", "kitchen");
        break;

      case "MARK_READY":
        updatedOrder = await updateOrderStatus(parentOrderId, "READY", "kitchen");
        break;

      case "MARK_CASH_RECEIVED":
        // Cash confirmed by staff -> mark paid and complete
        updatedOrder = await updateOrderPayment(parentOrderId, "CASH", "PAID", true);
        break;

      case "COMPLETE_ORDER":
        updatedOrder = await updateOrderStatus(parentOrderId, "COMPLETED", "kitchen");
        break;

      case "CANCEL_ORDER":
        updatedOrder = await updateOrderStatus(parentOrderId, "CANCELLED", "kitchen");
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
