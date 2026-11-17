import { NextRequest, NextResponse } from "next/server";
import { previewRestore, executeRestore } from "@/lib/data-management";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req, "ADMIN");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { action, archivePayload, adminPassword } = body;

    if (!archivePayload) {
      return NextResponse.json(
        { success: false, error: "Archive payload is required." },
        { status: 400 }
      );
    }

    if (action === "preview") {
      const preview = await previewRestore(archivePayload);
      return NextResponse.json({ success: true, preview });
    }

    if (action === "execute") {
      if (!adminPassword) {
        return NextResponse.json(
          { success: false, error: "Administrator password is required for live restoration." },
          { status: 400 }
        );
      }

      const result = await executeRestore({
        archivePayload,
        adminPassword,
        adminUser: "Admin Manager",
      });

      return NextResponse.json({
        success: true,
        result,
        message: `Successfully restored ${result.ordersRestoredCount} orders into Supabase live database.`,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err: any) {
    console.error("Restore error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process archive restoration." },
      { status: 400 }
    );
  }
}
