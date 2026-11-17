import { NextRequest, NextResponse } from "next/server";
import { previewExport } from "@/lib/data-management";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req, "ADMIN");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "Both startDate and endDate are required." },
        { status: 400 }
      );
    }

    const preview = await previewExport(startDate, endDate);
    return NextResponse.json({ success: true, preview });
  } catch (err: any) {
    console.error("Export preview error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to preview export." },
      { status: 500 }
    );
  }
}
