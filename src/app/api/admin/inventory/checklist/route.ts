import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, verifyAdminSession } from "@/lib/auth";
import {
  getOrCreateDayRegister,
  markChecklistItemCounted,
  updateDayItemsBatch,
  getKolkataDateString,
} from "@/lib/inventory";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const session = await verifyAdminSession(req);
    const staffName = session.user || "Staff";
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || getKolkataDateString();

    const { day, items, categories } = await getOrCreateDayRegister(dateParam, staffName);

    // Group items by category
    const grouped = categories.map((cat) => {
      const catItems = items.filter((i) => i.category_id === cat.id);
      const countedCount = catItems.filter((i) => i.is_counted).length;
      return {
        category: cat,
        items: catItems,
        total: catItems.length,
        counted: countedCount,
        isDone: catItems.length > 0 && countedCount === catItems.length,
      };
    });

    const totalItems = items.length;
    const totalCounted = items.filter((i) => i.is_counted).length;
    const progressPercent = totalItems > 0 ? Math.round((totalCounted / totalItems) * 100) : 0;

    return NextResponse.json({
      success: true,
      day,
      categories,
      grouped,
      stats: {
        totalItems,
        totalCounted,
        progressPercent,
        isComplete: totalItems > 0 && totalCounted === totalItems,
      },
    });
  } catch (err: any) {
    console.error("Error loading stock checklist:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load stock checklist" },
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

    const { dayId, ingredientId, physicalQty, isCounted, updates } = body;

    if (!dayId) {
      return NextResponse.json({ success: false, error: "dayId is required" }, { status: 400 });
    }

    // Bulk update support
    if (Array.isArray(updates)) {
      const result = await updateDayItemsBatch(dayId, updates, staffName);
      return NextResponse.json({ success: true, day: result.day, items: result.items });
    }

    // Single item update
    if (!ingredientId) {
      return NextResponse.json({ success: false, error: "ingredientId is required" }, { status: 400 });
    }

    const updated = await markChecklistItemCounted(
      dayId,
      ingredientId,
      physicalQty !== undefined ? physicalQty : null,
      staffName,
      isCounted !== undefined ? isCounted : true
    );

    return NextResponse.json({
      success: true,
      item: updated,
    });
  } catch (err: any) {
    console.error("Error updating stock checklist item:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update item count" },
      { status: 500 }
    );
  }
}

