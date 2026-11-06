import { NextRequest, NextResponse } from "next/server";
import { getTablesOverview, createNewTable, getAllTables, getActiveCustomerVisit } from "@/lib/tables";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const visitorId = searchParams.get("visitorId") || undefined;
    const phone = searchParams.get("phone") || undefined;
    const overview = await getTablesOverview(visitorId, phone);

    let activeCustomerVisit = null;
    if (visitorId || phone) {
      activeCustomerVisit = await getActiveCustomerVisit(visitorId || "", phone);
    }

    const stats = {
      total: overview.length,
      available: overview.filter((t) => t.color === "WHITE").length,
      reserved: overview.filter((t) => t.color === "BLUE").length,
      newOrders: overview.filter((t) => t.color === "RED").length,
      actionNeeded: overview.filter((t) => t.color === "YELLOW").length,
      kotSent: overview.filter((t) => t.color === "GREEN").length,
    };

    return NextResponse.json({
      success: true,
      tables: overview,
      stats,
      activeCustomerVisit,
    });
  } catch (err: any) {
    console.error("Error fetching tables overview:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load tables overview." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableNumber, capacity, section } = body;

    if (!tableNumber || typeof tableNumber !== "string" || !tableNumber.trim()) {
      return NextResponse.json(
        { success: false, error: "A valid table number is required (e.g. A1, A2, B1)." },
        { status: 400 }
      );
    }

    const created = await createNewTable({
      tableNumber: tableNumber.trim(),
      capacity: Number(capacity) || 4,
      section: section || "Dine-In",
    });

    return NextResponse.json({
      success: true,
      message: `Table ${created.tableNumber} successfully created.`,
      table: created,
    });
  } catch (err: any) {
    console.error("Error creating table:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create table." },
      { status: 400 }
    );
  }
}

