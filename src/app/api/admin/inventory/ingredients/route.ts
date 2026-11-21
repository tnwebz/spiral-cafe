import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  getInventoryIngredients,
  createInventoryIngredient,
  updateInventoryIngredient,
  archiveInventoryIngredient,
} from "@/lib/inventory";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const categoryId = url.searchParams.get("categoryId") || undefined;
    const items = await getInventoryIngredients(categoryId);
    return NextResponse.json(
      { success: true, ingredients: items },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load ingredients" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { name, category_id, unit, min_stock_level, display_order, notes, cost_per_unit } = body;

    if (!name || !category_id || !unit) {
      return NextResponse.json(
        { success: false, error: "name, category_id, and unit are required" },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const created = await createInventoryIngredient({
      name: name.trim(),
      category_id,
      unit: unit.trim(),
      cost_per_unit:
        cost_per_unit !== undefined && cost_per_unit !== null && !isNaN(Number(cost_per_unit))
          ? Number(cost_per_unit)
          : null,
      min_stock_level: min_stock_level !== undefined ? Number(min_stock_level) : 0,
      display_order: display_order !== undefined ? Number(display_order) : 99,
      is_active: true,
      notes: notes || null,
    });

    return NextResponse.json(
      { success: true, ingredient: created },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create ingredient" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function PUT(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { id, ...patch } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    if (patch.cost_per_unit !== undefined) {
      patch.cost_per_unit =
        patch.cost_per_unit === null || isNaN(Number(patch.cost_per_unit))
          ? null
          : Number(patch.cost_per_unit);
    }

    const updated = await updateInventoryIngredient(id, patch);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Ingredient not found" },
        { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    return NextResponse.json(
      { success: true, ingredient: updated },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update ingredient" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "id parameter is required" }, { status: 400 });
    }

    const ok = await archiveInventoryIngredient(id);
    return NextResponse.json({ success: ok });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to archive ingredient" },
      { status: 500 }
    );
  }
}

