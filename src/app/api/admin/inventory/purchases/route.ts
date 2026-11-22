import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, verifyAdminSession } from "@/lib/auth";
import {
  getInventoryPurchases,
  recordInventoryPurchase,
  deleteInventoryPurchase,
  clearAllPurchasesAndPriceHistory,
  getKolkataDateString,
} from "@/lib/inventory";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const ingredientId = url.searchParams.get("ingredientId") || undefined;
    const date = url.searchParams.get("date") || undefined;

    const purchases = await getInventoryPurchases(ingredientId, date);
    return NextResponse.json({ success: true, purchases });
  } catch (err: any) {
    console.error("Error fetching purchases:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load purchases" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const session = await verifyAdminSession(req);
    const staffName = session.user || "Admin";
    const body = await req.json();

    const {
      ingredient_id,
      date,
      quantity,
      unit,
      price_per_unit,
      supplier,
      notes,
    } = body;

    if (!ingredient_id) {
      return NextResponse.json(
        { success: false, error: "ingredient_id is required" },
        { status: 400 }
      );
    }

    const numQty = Number(quantity);
    const numPrice = Number(price_per_unit);

    if (isNaN(numQty) || numQty <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid purchase quantity is required (> 0)" },
        { status: 400 }
      );
    }

    if (isNaN(numPrice) || numPrice <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid price per unit is required (> 0)" },
        { status: 400 }
      );
    }

    const purchaseDate = date || getKolkataDateString();

    const result = await recordInventoryPurchase({
      ingredient_id,
      date: purchaseDate,
      quantity: numQty,
      unit: unit || "kg",
      price_per_unit: numPrice,
      total_cost: Number((numQty * numPrice).toFixed(2)),
      supplier: supplier || null,
      recorded_by: staffName,
      notes: notes || null,
    });

    return NextResponse.json({
      success: true,
      purchase: result.purchase,
      dayItem: result.dayItem,
    });
  } catch (err: any) {
    console.error("Error recording purchase:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to record purchase" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const ingredientId = url.searchParams.get("ingredientId");
    const clearAll = url.searchParams.get("clearAll");

    if (clearAll === "true" || ingredientId) {
      const res = await clearAllPurchasesAndPriceHistory(ingredientId || undefined);
      return NextResponse.json({
        success: true,
        message: res.message,
        count: res.count,
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Purchase id or ingredientId is required" },
        { status: 400 }
      );
    }

    const result = await deleteInventoryPurchase(id);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err: any) {
    console.error("Error deleting purchase:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete purchase" },
      { status: 500 }
    );
  }
}
