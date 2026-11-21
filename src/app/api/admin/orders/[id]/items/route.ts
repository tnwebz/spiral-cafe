import { NextRequest, NextResponse } from "next/server";
import { updateOrderItemQuantityOrDelete, addOrderItemToOrder, getOrderById } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { item, adminUser = "Admin Staff" } = body;

    if (!item || !item.name || typeof item.price !== "number") {
      return NextResponse.json(
        { success: false, error: "Valid product name and price are required." },
        { status: 400 }
      );
    }

    const updatedOrder = await addOrderItemToOrder({
      orderId: id,
      item: {
        productId: item.productId || item.id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: Math.max(1, Number(item.quantity) || 1),
        image: item.image || undefined,
        notes: item.notes || undefined,
      },
      adminUser,
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `"${item.name}" added to order #${updatedOrder.orderNumber}`,
    });
  } catch (err: any) {
    console.error("Add order item error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to add product to order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { itemId, itemName, quantity, adminUser = "Admin" } = body;

    if (quantity === undefined || typeof quantity !== "number") {
      return NextResponse.json(
        { success: false, error: "A valid numeric quantity is required." },
        { status: 400 }
      );
    }

    if (!itemId && !itemName) {
      return NextResponse.json(
        { success: false, error: "Either itemId or itemName must be provided." },
        { status: 400 }
      );
    }

    const updatedOrder = await updateOrderItemQuantityOrDelete({
      orderId: id,
      itemId,
      itemName,
      newQuantity: quantity,
      adminUser,
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message:
        quantity <= 0
          ? `Item removed from order ${updatedOrder.orderNumber}`
          : `Item quantity updated to ${quantity} for order ${updatedOrder.orderNumber}`,
    });
  } catch (err: any) {
    console.error("Update order item error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update order item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    const url = new URL(req.url);
    let itemId = url.searchParams.get("itemId") || undefined;
    let itemName = url.searchParams.get("itemName") || undefined;
    let adminUser = url.searchParams.get("adminUser") || "Admin";

    // Also parse JSON body if provided
    try {
      const body = await req.json();
      if (body) {
        if (body.itemId) itemId = body.itemId;
        if (body.itemName) itemName = body.itemName;
        if (body.adminUser) adminUser = body.adminUser;
      }
    } catch {}

    if (!itemId && !itemName) {
      return NextResponse.json(
        { success: false, error: "Either itemId or itemName must be specified to delete." },
        { status: 400 }
      );
    }

    const updatedOrder = await updateOrderItemQuantityOrDelete({
      orderId: id,
      itemId,
      itemName,
      newQuantity: 0,
      adminUser,
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Item successfully deleted from order ${updatedOrder.orderNumber}.`,
    });
  } catch (err: any) {
    console.error("Delete order item error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete order item" },
      { status: 500 }
    );
  }
}
