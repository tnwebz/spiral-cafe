import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, verifyAdminSession } from "@/lib/auth";
import {
  getOrCreateDayRegister,
  updateDayItemsBatch,
  finalizeDayRegister,
  reopenDayRegister,
  getKolkataDateString,
  DayItemUpdateInput,
} from "@/lib/inventory";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const session = await verifyAdminSession(req);
    const staffName = session.user || "Admin";
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || getKolkataDateString();

    const data = await getOrCreateDayRegister(dateParam, staffName);
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error("Error loading daily inventory register:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load daily register" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const session = await verifyAdminSession(req);
    const staffName = session.user || "Staff";
    const body = await req.json();

    const { dayId, updates, action, notes } = body;

    if (!dayId) {
      return NextResponse.json({ success: false, error: "dayId is required" }, { status: 400 });
    }

    if (action === "finalize") {
      const finalized = await finalizeDayRegister(dayId, staffName, notes);
      return NextResponse.json({
        success: true,
        message: "Inventory day finalized successfully.",
        day: finalized,
      });
    }

    if (action === "reopen") {
      const reopened = await reopenDayRegister(dayId, staffName, notes);
      return NextResponse.json({
        success: true,
        message: "Inventory day reopened for corrections.",
        day: reopened,
      });
    }

    if (!Array.isArray(updates)) {
      return NextResponse.json({ success: false, error: "updates must be an array" }, { status: 400 });
    }

    const result = await updateDayItemsBatch(dayId, updates as DayItemUpdateInput[], staffName);
    return NextResponse.json({
      success: true,
      day: result.day,
      items: result.items,
    });
  } catch (err: any) {
    console.error("Error updating daily inventory items:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update daily items" },
      { status: 500 }
    );
  }
}

