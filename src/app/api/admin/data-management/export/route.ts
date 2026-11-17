import { NextRequest, NextResponse } from "next/server";
import { createArchiveExport } from "@/lib/data-management";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req, "ADMIN");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { startDate, endDate, passphrase } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "Valid date range is required." },
        { status: 400 }
      );
    }

    if (!passphrase || passphrase.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: "Archive passphrase must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const { encryptedArchive, filename } = await createArchiveExport({
      startDate,
      endDate,
      adminUser: "Admin Manager",
      passphrase: passphrase.trim(),
    });

    return NextResponse.json({
      success: true,
      archive: encryptedArchive,
      filename,
    });
  } catch (err: any) {
    console.error("Export archive error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate archive." },
      { status: 500 }
    );
  }
}
