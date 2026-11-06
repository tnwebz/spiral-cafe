import { NextRequest, NextResponse } from "next/server";
import { saveCustomer, saveCustomerSession } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, foodPreference = "ALL", tableNumber, sessionId } = body;

    const clean = (phoneNumber || "").replace(/\D/g, "");
    if (clean.length < 10) {
      return NextResponse.json(
        { success: false, error: "Valid 10-digit mobile number required." },
        { status: 400 }
      );
    }

    const tenDigitPhone = clean.slice(-10);
    const maskedPhone = `******${tenDigitPhone.slice(-4)}`;

    // Check if customer already exists
    let existingPref = foodPreference;
    let isReturning = false;

    try {
      const { data: existing } = await supabaseAdmin
        .from("customers" as any)
        .select("*")
        .eq("phone_number", tenDigitPhone)
        .maybeSingle();

      if (existing) {
        isReturning = true;
        const custData = existing as any;
        if (custData.food_preference) {
          existingPref = custData.food_preference;
        }
      }
    } catch {}

    // Save/update customer record
    try {
      await saveCustomer({
        phoneNumber: tenDigitPhone,
        serviceSmsConsent: true,
        marketingConsent: false,
      });

      // Update food preference column if present
      await supabaseAdmin
        .from("customers" as any)
        .update({
          food_preference: foodPreference || existingPref || "ALL",
          last_seen_at: new Date().toISOString(),
        })
        .eq("phone_number", tenDigitPhone);
    } catch (saveErr) {
      console.warn("Customer save notice:", saveErr);
    }

    if (sessionId && tableNumber) {
      try {
        await saveCustomerSession({
          sessionId,
          phoneNumber: tenDigitPhone,
          tableNumber,
        });
      } catch {}
    }

    const response = NextResponse.json({
      success: true,
      maskedPhone,
      foodPreference: foodPreference || existingPref || "ALL",
      isReturning,
      lastVisited: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Set 30-day cookie for customer preference recognition
    response.cookies.set("spiral_cust_pref", foodPreference || existingPref || "ALL", {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    console.error("Customer identify error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to identify customer." },
      { status: 500 }
    );
  }
}
