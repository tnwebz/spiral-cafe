import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeTableLabel,
  markTableOrderViewed,
  markTableOrderExitedWithoutKot,
  markTableOrdersExitedWithoutKot,
  extractKotStateFromOrder,
  getActiveReservations,
} from "@/lib/tables";
import { buildKotData, KotReceiptEngine } from "@/lib/kot";
import { getPrinterSettings } from "@/lib/tables";
import { Order, getActiveVisitOrdersForTable } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;
    const cleanTable = normalizeTableLabel(tableId);

    // Fetch all active unpaid orders for this table's current dining visit
    const { visitId, orders } = await getActiveVisitOrdersForTable(cleanTable);
    const printerSettings = await getPrinterSettings();

    if (!orders || orders.length === 0) {
      const activeReservations = await getActiveReservations();
      const reservation = activeReservations.find(
        (r) => r.tableNumber.toUpperCase() === cleanTable.toUpperCase()
      );

      return NextResponse.json({
        success: true,
        tableNumber: cleanTable,
        hasActiveOrder: false,
        orders: [],
        activeOrder: null,
        isReserved: !!reservation,
        reservation: reservation
          ? {
              ...reservation,
              remainingSeconds: Math.max(
                0,
                Math.floor((new Date(reservation.expiresAt).getTime() - Date.now()) / 1000)
              ),
              elapsedMinutes: Math.max(
                0,
                Math.floor((Date.now() - new Date(reservation.reservedAt).getTime()) / 60000)
              ),
            }
          : null,
        printerSettings,
      });
    }

    // Determine target order for KOT print action (prefer newest pending order)
    const pendingOrder = orders.find(
      (o) => o.status === "PENDING" && !(o.notes || "").includes("[KOT_CONFIRMED")
    );
    const targetOrder = pendingOrder || orders[0];

    // Compute bill breakdown: Accepted vs Pending
    const acceptedOrders = orders.filter(
      (o) =>
        o.status === "PREPARING" ||
        o.status === "READY" ||
        o.status === "COMPLETED" ||
        (o.notes || "").includes("[KOT_CONFIRMED")
    );
    const pendingOrders = orders.filter(
      (o) => o.status === "PENDING" && !(o.notes || "").includes("[KOT_CONFIRMED")
    );

    const acceptedSubtotal = acceptedOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const acceptedTax = acceptedOrders.reduce((sum, o) => sum + o.tax, 0);
    const acceptedPackaging = acceptedOrders.reduce((sum, o) => sum + (o.packagingFee || 0), 0);
    const acceptedGrandTotal = acceptedOrders.reduce((sum, o) => sum + o.grandTotal, 0);

    const pendingValue = pendingOrders.reduce((sum, o) => sum + o.grandTotal, 0);
    const totalVisitValue = orders.reduce((sum, o) => sum + o.grandTotal, 0);

    const kotState = extractKotStateFromOrder(targetOrder);

    // Build KOT payload for the target order
    const targetRound = kotState.hasUnconfirmedAddons
      ? kotState.highestRound
      : kotState.confirmedRounds[0] || 1;
    const kotData = buildKotData(targetOrder, targetRound, printerSettings.terminalName);
    const plainSlip = KotReceiptEngine.formatPlainSlip(kotData);
    const escPosCommands = KotReceiptEngine.generateEscPosCommands(kotData);

    return NextResponse.json({
      success: true,
      tableNumber: cleanTable,
      hasActiveOrder: true,
      orders,
      activeOrder: targetOrder,
      visitId,
      billing: {
        acceptedOrdersCount: acceptedOrders.length,
        pendingOrdersCount: pendingOrders.length,
        acceptedSubtotal,
        acceptedTax,
        acceptedPackaging,
        acceptedGrandTotal,
        pendingValue,
        totalVisitValue,
      },
      kotState,
      kotData,
      plainSlip,
      escPosCommands,
      printerSettings,
    });
  } catch (err: any) {
    console.error("Error fetching table details:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load table details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;
    const cleanTable = normalizeTableLabel(tableId);
    const body = await req.json().catch(() => ({}));
    const { orderId, exitedWithoutKot } = body;

    if (exitedWithoutKot) {
      if (orderId) {
        await markTableOrderExitedWithoutKot(orderId);
      } else {
        await markTableOrdersExitedWithoutKot(cleanTable);
      }
    } else if (orderId) {
      await markTableOrderViewed(orderId);
    }

    return NextResponse.json({ success: true, message: `Table ${cleanTable} updated.` });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update table." },
      { status: 500 }
    );
  }
}
