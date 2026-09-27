import { NextRequest, NextResponse } from "next/server";
import { saveCustomer, getAllCustomers, saveCustomerSession } from "@/lib/db";

export async function GET() {
  try {
    const customers = getAllCustomers();
    return NextResponse.json({ success: true, customers });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, name, serviceSmsConsent, marketingConsent, sessionId, tableNumber } = body;

    if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { success: false, error: "Valid 10-digit mobile number required." },
        { status: 400 }
      );
    }

    const customer = saveCustomer({
      phoneNumber,
      name,
      serviceSmsConsent: serviceSmsConsent ?? true,
      marketingConsent: marketingConsent ?? false,
    });

    if (sessionId && tableNumber) {
      saveCustomerSession({
        sessionId,
        phoneNumber: customer.phoneNumber,
        tableNumber,
      });
    }

    return NextResponse.json({ success: true, customer });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
