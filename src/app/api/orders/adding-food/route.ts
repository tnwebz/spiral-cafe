import { NextRequest, NextResponse } from "next/server";
import { setCustomerAddingFoodFlag } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, tableNumber, isAdding = true } = body;

    if (!orderId && !tableNumber) {
      return NextResponse.json(
        { success: false, error: "Either orderId or tableNumber must be provided." },
        { status: 400 }
      );
    }

    const updated = await setCustomerAddingFoodFlag({
      orderId,
      tableNumber,
      isAdding: Boolean(isAdding),
    });

    return NextResponse.json({ success: updated });
  } catch (err: any) {
    console.error("Error setting customer adding food flag:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update adding food status." },
      { status: 500 }
    );
  }
}
