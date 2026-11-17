import { NextRequest, NextResponse } from "next/server";
import { executePurgeArchivedRecords } from "@/lib/data-management";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req, "ADMIN");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { archiveId, adminPassword, archivePayload } = body;

    if (!archiveId || !adminPassword || !archivePayload) {
      return NextResponse.json(
        {
          success: false,
          error: "Archive reference, admin verification password, and verified archive data are required.",
        },
        { status: 400 }
      );
    }

    const result = await executePurgeArchivedRecords({
      archiveId,
      adminPassword,
      adminUser: "Admin Manager",
      archivePayload,
    });

    return NextResponse.json({
      success: true,
      result,
      message: `Successfully removed ${result.ordersPurgedCount} archived orders from live Supabase. Permanent business analytics summaries were safely preserved.`,
    });
  } catch (err: any) {
    console.error("Purge error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to purge archived records." },
      { status: 400 }
    );
  }
}
