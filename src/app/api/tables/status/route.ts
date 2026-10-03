import { NextResponse } from "next/server";
import { getTablesStatus } from "@/lib/db";

export async function GET() {
  try {
    const tables = await getTablesStatus();
    return NextResponse.json({ success: true, tables });
  } catch (err: any) {
    console.error("Error fetching tables status:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch tables status." },
      { status: 500 }
    );
  }
}
