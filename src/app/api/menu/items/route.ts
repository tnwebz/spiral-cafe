import { NextRequest, NextResponse } from "next/server";
import { getAllMenuItems, createMenuItem } from "@/lib/db";

export async function GET() {
  try {
    const items = await getAllMenuItems();
    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch menu items." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      description = "",
      price,
      originalPrice,
      categoryId,
      categoryName,
      dietType = "non-veg",
      badge = "none",
      rating = 4.8,
      reviewsCount = 100,
      image,
      storagePath,
      cloudinaryPublicId,
      available = true,
      adminUser = "admin",
    } = body;

    if (!name || typeof price !== "number" || !categoryId) {
      return NextResponse.json(
        { success: false, error: "Name, price, and category are required." },
        { status: 400 }
      );
    }

    const newItem = await createMenuItem(
      {
        name: name.trim(),
        description: description.trim(),
        price,
        originalPrice: originalPrice ? Number(originalPrice) : undefined,
        categoryId,
        categoryName: categoryName || categoryId,
        dietType,
        badge,
        rating: Number(rating) || 4.8,
        reviewsCount: Number(reviewsCount) || 100,
        image: image || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80",
        storagePath: storagePath || cloudinaryPublicId,
        cloudinaryPublicId: storagePath || cloudinaryPublicId,
        available: Boolean(available),
      },
      adminUser
    );

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (err: any) {
    console.error("Menu item creation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create menu item." },
      { status: 400 }
    );
  }
}
