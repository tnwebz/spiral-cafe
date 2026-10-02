import { NextRequest, NextResponse } from "next/server";
import { getInvoiceBySecureToken, getConfig } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invoice = await getInvoiceBySecureToken(token);

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired invoice token." },
        { status: 404 }
      );
    }

    const config = await getConfig();

    return NextResponse.json({
      success: true,
      invoice,
      cafe: {
        name: config.cafeName,
        address: config.cafeAddress,
        phone: config.cafePhone,
        gstNumber: config.gstNumber,
        currencySymbol: config.currencySymbol,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch invoice." },
      { status: 500 }
    );
  }
}
