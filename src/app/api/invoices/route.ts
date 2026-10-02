import { NextRequest, NextResponse } from "next/server";
import { getAllInvoices, createInvoice, getOrderById } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    const all = await getAllInvoices();
    if (orderId) {
      const filtered = all.filter(
        (inv) => inv.orderId === orderId || inv.orderNumber.toUpperCase() === orderId.toUpperCase()
      );
      return NextResponse.json({ success: true, invoices: filtered });
    }

    return NextResponse.json({ success: true, invoices: all });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch invoices." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, adminUser = "admin" } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required to generate invoice." },
        { status: 400 }
      );
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found.` },
        { status: 404 }
      );
    }

    if (order.paymentStatus !== "PAID") {
      return NextResponse.json(
        {
          success: false,
          error: "Invoice can only be generated after payment is confirmed as PAID.",
        },
        { status: 400 }
      );
    }

    const invoice = await createInvoice(orderId, adminUser);
    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (err: any) {
    console.error("Invoice creation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate invoice." },
      { status: 400 }
    );
  }
}
