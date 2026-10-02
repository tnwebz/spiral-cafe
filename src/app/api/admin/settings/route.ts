import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateConfig } from "@/lib/db";

export async function GET() {
  try {
    const config = await getConfig();
    // Return sanitized config (exclude hashed passwords)
    const sanitized = {
      taxPercentage: config.taxPercentage,
      packagingFee: config.packagingFee,
      serviceCharge: config.serviceCharge,
      cafeName: config.cafeName,
      cafeAddress: config.cafeAddress,
      cafePhone: config.cafePhone,
      gstNumber: config.gstNumber,
      currencySymbol: config.currencySymbol,
      kitchenPin: config.kitchenPin,
      cashierPin: config.cashierPin,
      adminPin: config.adminPin,
      adminUsername: config.adminUsername,
    };
    return NextResponse.json({ success: true, config: sanitized });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load settings." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { updates, adminUser = "Admin" } = body;

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { success: false, error: "Valid updates object is required." },
        { status: 400 }
      );
    }

    const updated = await updateConfig(updates, adminUser);
    return NextResponse.json({ success: true, config: updated });
  } catch (err: any) {
    console.error("Settings update error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update settings." },
      { status: 500 }
    );
  }
}
