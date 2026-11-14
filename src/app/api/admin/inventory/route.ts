import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getInventoryDashboard, getKolkataDateString } from "@/lib/inventory";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || getKolkataDateString();

    const dashboard = await getInventoryDashboard(dateParam);
    return NextResponse.json({
      success: true,
      ...dashboard,
    });
  } catch (err: any) {
    console.error("Error fetching inventory dashboard:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load inventory dashboard" },
      { status: 500 }
    );
  }
}

