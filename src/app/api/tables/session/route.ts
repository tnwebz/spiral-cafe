import { NextRequest, NextResponse } from "next/server";
import { getActiveOrderForTable, normalizeTableNumber } from "@/lib/db";
import { getActiveReservations, getActiveCustomerVisit, reserveTable } from "@/lib/tables";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tableParam = searchParams.get("table") || "A1";
    const visitorId = searchParams.get("visitorId") || "";
    const sessionId = searchParams.get("sessionId") || "";
    const phone = searchParams.get("phone") || "";
    const cleanTable = normalizeTableNumber(tableParam);

    const clientIdent = visitorId || sessionId || "";

    // Check customer-wide active visit across all tables
    let activeCustomerVisit = null;
    if (clientIdent || phone) {
      activeCustomerVisit = await getActiveCustomerVisit(clientIdent, phone || undefined);
    }

    const hasConflictVisit = Boolean(
      activeCustomerVisit &&
      activeCustomerVisit.hasActiveVisit &&
      activeCustomerVisit.tableNumber &&
      activeCustomerVisit.tableNumber.toUpperCase() !== cleanTable.toUpperCase()
    );

    const activeOrder = await getActiveOrderForTable(cleanTable);

    if (activeOrder) {
      // Table is occupied with an active, unpaid dining order
      const existingVisitId =
        activeOrder.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1] ||
        (activeOrder as any).visit_id ||
        `VISIT-${cleanTable}-${activeOrder.id.slice(0, 8).toUpperCase()}`;

      const isMyActiveTable = Boolean(
        (visitorId && activeOrder.customerSessionId === visitorId) ||
        (sessionId && activeOrder.customerSessionId === sessionId) ||
        (phone && activeOrder.customerPhone && activeOrder.customerPhone.slice(-10) === phone.slice(-10))
      );

      const isViewOnlyMenu = !isMyActiveTable && cleanTable !== "TAKEAWAY";

      return NextResponse.json({
        success: true,
        tableNumber: cleanTable,
        status: "OCCUPIED",
        visitId: existingVisitId,
        orderId: activeOrder.id,
        orderNumber: activeOrder.orderNumber,
        isMyActiveTable,
        isViewOnlyMenu,
        isTableBookedByOther: isViewOnlyMenu,
        cartExpiryMinutes: 10,
        conflictActiveVisit: hasConflictVisit,
        currentActiveTable: activeCustomerVisit?.tableNumber || null,
        currentActiveVisit: activeCustomerVisit || null,
      });
    }

    // Check if table is temporarily reserved
    const activeReservations = await getActiveReservations();
    const reservation = activeReservations.find(
      (r) => r.tableNumber.toUpperCase() === cleanTable.toUpperCase()
    );

    if (reservation) {
      const isMyReservation = Boolean(
        (visitorId && reservation.customerSessionId === visitorId) ||
        (sessionId && reservation.customerSessionId === sessionId) ||
        (phone && reservation.customerPhone && reservation.customerPhone.slice(-10) === phone.slice(-10))
      );
      const remainingSeconds = Math.max(
        0,
        Math.floor((new Date(reservation.expiresAt).getTime() - Date.now()) / 1000)
      );

      const isViewOnlyMenu = !isMyReservation && cleanTable !== "TAKEAWAY";

      const visitId = isMyReservation
        ? `VISIT-${cleanTable}-RES-${clientIdent.slice(-6).toUpperCase()}`
        : `VISIT-${cleanTable}-RESERVED`;

      return NextResponse.json({
        success: true,
        tableNumber: cleanTable,
        status: "RESERVED",
        visitId,
        isMyReservation,
        isMyActiveTable: isMyReservation,
        isViewOnlyMenu,
        isTableBookedByOther: isViewOnlyMenu,
        remainingSeconds,
        expiresAt: reservation.expiresAt,
        reservationId: reservation.id,
        cartExpiryMinutes: 10,
        conflictActiveVisit: hasConflictVisit,
        currentActiveTable: activeCustomerVisit?.tableNumber || null,
        currentActiveVisit: activeCustomerVisit || null,
      });
    }

    // If table is free/available and customer is visiting a floor table (not takeaway), auto-reserve for this customer!
    const effectiveSession = sessionId || visitorId || "";
    if (cleanTable !== "TAKEAWAY" && effectiveSession && !hasConflictVisit) {
      try {
        const newRes = await reserveTable({
          tableNumber: cleanTable,
          customerSessionId: effectiveSession,
          customerPhone: phone || undefined,
        });

        const remainingSeconds = Math.max(
          0,
          Math.floor((new Date(newRes.expiresAt).getTime() - Date.now()) / 1000)
        );

        return NextResponse.json({
          success: true,
          tableNumber: cleanTable,
          status: "RESERVED",
          visitId: `VISIT-${cleanTable}-RES-${clientIdent.slice(-6).toUpperCase()}`,
          isMyReservation: true,
          isMyActiveTable: true,
          isViewOnlyMenu: false,
          isTableBookedByOther: false,
          remainingSeconds,
          expiresAt: newRes.expiresAt,
          reservationId: newRes.id,
          cartExpiryMinutes: 10,
          conflictActiveVisit: false,
          currentActiveTable: null,
          currentActiveVisit: null,
        });
      } catch (err: any) {
        console.warn("Auto-reserve notice:", err.message);
      }
    }

    // Table is available / no active order & no reservation
    const visitId = visitorId
      ? `VISIT-${cleanTable}-OPEN-${visitorId.slice(-6).toUpperCase()}`
      : `VISIT-${cleanTable}-IDLE`;

    return NextResponse.json({
      success: true,
      tableNumber: cleanTable,
      status: "AVAILABLE",
      visitId,
      isMyActiveTable: false,
      isMyReservation: false,
      isViewOnlyMenu: false,
      isTableBookedByOther: false,
      cartExpiryMinutes: 10,
      conflictActiveVisit: hasConflictVisit,
      currentActiveTable: activeCustomerVisit?.tableNumber || null,
      currentActiveVisit: activeCustomerVisit || null,
    });
  } catch (err: any) {
    console.error("Table session query error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load table session." },
      { status: 500 }
    );
  }
}
