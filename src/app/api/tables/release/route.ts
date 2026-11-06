import { NextRequest, NextResponse } from "next/server";
import { releaseTableReservation } from "@/lib/tables";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { tableNumber, adminUser } = body;

    if (!tableNumber) {
      return NextResponse.json(
        { success: false, error: "tableNumber is required." },
        { status: 400 }
      );
    }

    await releaseTableReservation(tableNumber, adminUser || "Admin");

    return NextResponse.json({
      success: true,
      message: `Table ${tableNumber} reservation has been released.`,
    });
  } catch (err: any) {
    console.error("Release table reservation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to release table reservation." },
      { status: 400 }
    );
  }
}

