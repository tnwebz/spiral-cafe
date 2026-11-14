import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, verifyAdminSession } from "@/lib/auth";
import {
  getInventoryMovements,
  recordInventoryMovement,
  getKolkataDateString,
} from "@/lib/inventory";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const ingredientId = url.searchParams.get("ingredientId") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const movements = await getInventoryMovements(ingredientId, limit);
    return NextResponse.json({ success: true, movements });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load movements" },
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

    const {
      ingredient_id,
      movement_type,
      quantity,
      unit,
      date,
      reason,
      supplier,
      cost,
      notes,
    } = body;

    if (!ingredient_id || !movement_type || !quantity || !unit) {
      return NextResponse.json(
        { success: false, error: "ingredient_id, movement_type, quantity, and unit are required" },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { success: false, error: "Quantity must be greater than zero" },
        { status: 400 }
      );
    }

    const recorded = await recordInventoryMovement({
      ingredient_id,
      movement_type,
      quantity: Number(quantity),
      unit,
      date: date || getKolkataDateString(),
      reason: reason || null,
      supplier: supplier || null,
      cost: cost ? Number(cost) : null,
      recorded_by: staffName,
      notes: notes || null,
    });

    return NextResponse.json({ success: true, movement: recorded });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to record movement" },
      { status: 500 }
    );
  }
}

