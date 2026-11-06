import { NextRequest, NextResponse } from "next/server";
import { getPrinterSettings, updatePrinterSettings } from "@/lib/tables";
import { requireAdminAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const settings = await getPrinterSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch printer settings." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req, "ADMIN");
  if (authError) return authError;

  try {
    const body = await req.json();
    const updated = await updatePrinterSettings(body);
    return NextResponse.json({
      success: true,
      message: "Printer settings saved successfully.",
      settings: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update printer settings." },
      { status: 400 }
    );
  }
}

