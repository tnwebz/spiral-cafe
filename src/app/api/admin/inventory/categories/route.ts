import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  getInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
} from "@/lib/inventory";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const cats = await getInventoryCategories();
    return NextResponse.json({ success: true, categories: cats });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { name, code, display_order } = body;

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: "name and code are required" },
        { status: 400 }
      );
    }

    const created = await createInventoryCategory({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      display_order: display_order !== undefined ? Number(display_order) : 99,
      is_active: true,
    });

    return NextResponse.json({ success: true, category: created });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create category" },
      { status: 500 }
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
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const updated = await updateInventoryCategory(id, patch);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, category: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update category" },
      { status: 500 }
    );
  }
}

