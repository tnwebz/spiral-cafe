import { NextRequest, NextResponse } from "next/server";
import { toggleMenuItemAvailability } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { adminUser = "admin" } = body;

    const updated = toggleMenuItemAvailability(id, adminUser);
    return NextResponse.json({
      success: true,
      available: updated.available,
      item: updated,
      message: `Product is now marked ${updated.available ? "AVAILABLE" : "SOLD OUT"}.`,
    });
  } catch (err: any) {
    console.error("Toggle availability error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to toggle item availability." },
      { status: 400 }
    );
  }
}
