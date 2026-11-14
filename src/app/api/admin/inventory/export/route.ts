import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  getOrCreateDayRegister,
  generateRegisterCSV,
  getKolkataDateString,
} from "@/lib/inventory";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || getKolkataDateString();

    const { day, items, categories } = await getOrCreateDayRegister(dateParam);
    const csvContent = generateRegisterCSV(day, items, categories);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="SpiralCafe_Inventory_${day.date}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate CSV" },
      { status: 500 }
    );
  }
}

