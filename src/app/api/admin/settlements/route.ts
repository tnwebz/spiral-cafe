import { NextRequest, NextResponse } from "next/server";
import { getSettlementSummary, recordSettlement, getAllSettlements } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const history = searchParams.get("history");

    if (history === "true") {
      const all = await getAllSettlements();
      return NextResponse.json({ success: true, settlements: all });
    }

    const summary = await getSettlementSummary(date);
    const settlements = await getAllSettlements();

    return NextResponse.json({
      success: true,
      summary,
      settlements,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch settlement data." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, cashCounted, cashSettled, notes, settledBy = "Admin" } = body;

    if (!date || typeof cashCounted !== "number" || typeof cashSettled !== "number") {
      return NextResponse.json(
        { success: false, error: "Valid date, cashCounted, and cashSettled are required." },
        { status: 400 }
      );
    }

    const settlement = await recordSettlement({
      date,
      cashCounted,
      cashSettled,
      notes,
      settledBy,
    });

    return NextResponse.json({ success: true, settlement }, { status: 201 });
  } catch (err: any) {
    console.error("Settlement record error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to record cash settlement." },
      { status: 500 }
    );
  }
}
