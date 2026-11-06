import { NextRequest, NextResponse } from "next/server";
import { reserveTable } from "@/lib/tables";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableNumber, customerSessionId, customerPhone } = body;

    if (!tableNumber) {
      return NextResponse.json(
        { success: false, error: "tableNumber is required." },
        { status: 400 }
      );
    }

    if (!customerSessionId) {
      return NextResponse.json(
        { success: false, error: "customerSessionId is required." },
        { status: 400 }
      );
    }

    const reservation = await reserveTable({
      tableNumber,
      customerSessionId,
      customerPhone,
    });

    return NextResponse.json({
      success: true,
      message: `Table ${reservation.tableNumber} is reserved for 10 minutes.`,
      reservation,
    });
  } catch (err: any) {
    console.error("Reserve table error:", err);
    const msg = err.message || "";

    if (msg.startsWith("ALREADY_HAS_ACTIVE_VISIT:")) {
      const activeTable = msg.replace("ALREADY_HAS_ACTIVE_VISIT:", "").trim();
      return NextResponse.json(
        {
          success: false,
          conflictActiveVisit: true,
          currentActiveTable: activeTable,
          error: `You already have an active dining session at ${activeTable}. You cannot independently occupy multiple tables.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: msg || "Failed to reserve table." },
      { status: 400 }
    );
  }
}
