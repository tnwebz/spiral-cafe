import { NextRequest, NextResponse } from "next/server";
import { decryptArchiveFile } from "@/lib/data-management/crypto";
import { requireAdminAuth } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req, "ADMIN");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { archiveFile, passphrase } = body;

    if (!archiveFile || !passphrase) {
      return NextResponse.json(
        { success: false, error: "Archive file and passphrase are required." },
        { status: 400 }
      );
    }

    // Attempt decryption and integrity verification
    const payload = await decryptArchiveFile(archiveFile, passphrase);

    // Update registry status to VERIFIED if found
    try {
      const sb = getSupabaseAdminClient();
      await sb
        .from("data_archives_registry" as any)
        .update({
          export_status: "VERIFIED",
          verified_at: new Date().toISOString(),
        })
        .eq("id", payload.manifest.archiveId);
    } catch {
      // Ignored if table not initialized
    }

    return NextResponse.json({
      success: true,
      verified: true,
      manifest: payload.manifest,
      ordersCount: payload.orders?.length || 0,
      invoicesCount: payload.invoices?.length || 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, verified: false, error: err.message || "Archive verification failed." },
      { status: 400 }
    );
  }
}
