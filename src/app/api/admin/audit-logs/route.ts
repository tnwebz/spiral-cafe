import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const logs = getAuditLogs(limit);
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch audit logs." },
      { status: 500 }
    );
  }
}
