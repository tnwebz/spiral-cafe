import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById, markInvoiceSmsSent } from "@/lib/db";
import { smsService } from "@/lib/sms";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { adminUser = "admin" } = body;

    const invoice = getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found." },
        { status: 404 }
      );
    }

    const phone = invoice.customerPhone;
    if (!phone) {
      return NextResponse.json(
        { success: false, error: "No customer phone number attached to this invoice." },
        { status: 400 }
      );
    }

    // Determine host for secure invoice link
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const invoiceUrl = `${protocol}://${host}/invoice/${invoice.secureToken}`;

    const smsResult = await smsService.sendInvoiceLink({
      phoneNumber: phone,
      invoiceNumber: invoice.invoiceNumber,
      orderNumber: invoice.orderNumber,
      grandTotal: invoice.grandTotal,
      invoiceUrl,
    });

    if (smsResult.success) {
      markInvoiceSmsSent(invoice.id, adminUser);
    }

    return NextResponse.json({
      success: smsResult.success,
      smsDetails: smsResult,
      message: smsResult.success
        ? `Invoice SMS dispatched successfully to ${phone}`
        : `SMS send notice: ${smsResult.error || "Failed to deliver"}`,
    });
  } catch (err: any) {
    console.error("Invoice SMS error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to dispatch SMS." },
      { status: 500 }
    );
  }
}
