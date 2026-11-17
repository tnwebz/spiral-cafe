import { NextRequest, NextResponse } from "next/server";
import { getStorageOverview } from "@/lib/data-management";
import { requireAdminAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req, "ADMIN");
  if (authErr) return authErr;

  try {
    const overview = await getStorageOverview();
    return NextResponse.json({ success: true, overview });
  } catch (err: any) {
    console.error("Storage overview error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load storage statistics." },
      { status: 500 }
    );
  }
}
