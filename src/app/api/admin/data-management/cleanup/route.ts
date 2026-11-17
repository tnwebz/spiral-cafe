import { NextRequest, NextResponse } from "next/server";
import { previewCleanup, executeCleanup } from "@/lib/data-management";
import { requireAdminAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req, "ADMIN");
  if (authErr) return authErr;

  try {
    const preview = await previewCleanup();
    return NextResponse.json({ success: true, preview });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to preview cleanup." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req, "ADMIN");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { adminPassword } = body;

    if (!adminPassword) {
      return NextResponse.json(
        { success: false, error: "Administrator password is required." },
        { status: 400 }
      );
    }

    const result = await executeCleanup({
      adminPassword,
      adminUser: "Admin Manager",
    });

    return NextResponse.json({
      success: true,
      result,
      message: `Cleaned up ${result.deletedCount} expired empty sessions.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Cleanup failed." },
      { status: 400 }
    );
  }
}
