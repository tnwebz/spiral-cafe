import { NextResponse } from "next/server";
import { getConfig } from "@/lib/db";

export async function GET() {
  const config = getConfig();
  // Do not expose secret kitchenPin in public config endpoint
  const publicConfig = {
    taxPercentage: config.taxPercentage,
    packagingFee: config.packagingFee,
    serviceCharge: config.serviceCharge,
    cafeName: config.cafeName,
    currencySymbol: config.currencySymbol,
  };
  return NextResponse.json({ success: true, config: publicConfig });
}
