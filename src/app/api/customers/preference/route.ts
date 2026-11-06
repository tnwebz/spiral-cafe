import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, foodPreference } = body;

    if (!foodPreference || (foodPreference !== "VEG_ONLY" && foodPreference !== "ALL")) {
      return NextResponse.json(
        { success: false, error: "Invalid preference. Must be VEG_ONLY or ALL." },
        { status: 400 }
      );
    }

    if (phoneNumber) {
      const clean = phoneNumber.replace(/\D/g, "").slice(-10);
      try {
        await supabaseAdmin
          .from("customers" as any)
          .update({
            food_preference: foodPreference,
            updated_at: new Date().toISOString(),
          })
          .eq("phone_number", clean);
      } catch (err) {
        console.warn("Preference update notice:", err);
      }
    }

    const response = NextResponse.json({
      success: true,
      foodPreference,
    });

    response.cookies.set("spiral_cust_pref", foodPreference, {
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update preference." },
      { status: 500 }
    );
  }
}

