import { NextRequest, NextResponse } from "next/server";
import { getMenuItemById, updateMenuItem, deleteMenuItem } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = getMenuItemById(id);

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Menu item not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch item." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { adminUser = "admin", ...updates } = body;

    const updated = updateMenuItem(id, updates, adminUser);
    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    console.error("Menu item update error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update menu item." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const adminUser = searchParams.get("adminUser") || "admin";

    const deleted = deleteMenuItem(id, adminUser);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Item not found or could not be deleted." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Menu item deleted successfully.",
    });
  } catch (err: any) {
    console.error("Menu item delete error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete menu item." },
      { status: 500 }
    );
  }
}
