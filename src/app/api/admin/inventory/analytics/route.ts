import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getInventoryAnalytics, getKolkataDateString } from "@/lib/inventory";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const today = getKolkataDateString();
    const startDate = url.searchParams.get("startDate") || today;
    const endDate = url.searchParams.get("endDate") || today;

    const data = await getInventoryAnalytics(startDate, endDate);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error("Error generating inventory analytics:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate analytics" },
      { status: 500 }
    );
  }
}
