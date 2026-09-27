import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = getInvoiceById(id);

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, invoice });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch invoice." },
      { status: 500 }
    );
  }
}
