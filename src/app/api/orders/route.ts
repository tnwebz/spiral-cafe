import { NextRequest, NextResponse } from "next/server";
import {
  createOrder,
  getAllOrders,
  getSessionOrders,
  getActiveOrderForTable,
  getActiveVisitOrdersForTable,
  getOrderById,
  getOrdersByVisitId,
  addItemsToExistingOrder,
  normalizeTableNumber,
} from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getActiveReservations,
  convertReservationToVisit,
} from "@/lib/tables";
import { getAuthoritativeItemPrice } from "@/lib/serverMenu";
import { requireAdminAuth, verifyAdminSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";

// In-flight mutex set to prevent concurrent double-click race conditions
const inFlightCheckouts = new Set<string>();

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const {
      tableNumber,
      customerSessionId,
      checkoutId,
      items,
      notes,
      customerPhone,
      customerId,
    } = body;

    // 1. Basic Input Validation
    if (!customerSessionId || typeof customerSessionId !== "string" || customerSessionId.length < 5) {
      return NextResponse.json(
        { success: false, error: "Valid customer session ID is required." },
        { status: 400 }
      );
    }

    const cleanSessionId = customerSessionId.trim().slice(0, 128);

    // 2. Wi-Fi Friendly Rate Limiting:
    // Allows 150 req/min per IP (so 20 cafe guests sharing Wi-Fi are never throttled)
    // Limits single customer session to max 12 orders/min (stops spam/loops)
    const ipLimit = checkRateLimit(`order_ip:${ip}`, 150, 60000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "High cafe network traffic. Please wait a moment." },
        { status: 429 }
      );
    }

    const sessionLimit = checkRateLimit(`order_session:${cleanSessionId}`, 12, 60000);
    if (!sessionLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Please wait a moment before submitting another order." },
        { status: 429 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Your basket is empty. Please add items." },
        { status: 400 }
      );
    }

    // 3. Server-Side Authoritative Price Verification & Sanitization
    // Do not trust client-supplied prices!
    const validatedItems: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      image: string;
      notes?: string;
    }> = [];

    for (const it of items) {
      const qty = Math.floor(Number(it.quantity));
      if (!qty || qty < 1 || qty > 50) {
        return NextResponse.json(
          { success: false, error: "Item quantities must be between 1 and 50." },
          { status: 400 }
        );
      }

      if (!it.productId || typeof it.productId !== "string") {
        return NextResponse.json(
          { success: false, error: "Invalid item reference in basket." },
          { status: 400 }
        );
      }

      // Query authoritative server catalog for item price
      const authItem = await getAuthoritativeItemPrice(it.productId, it.name);
      if (!authItem) {
        return NextResponse.json(
          { success: false, error: `Product "${it.name || it.productId}" is not currently available.` },
          { status: 400 }
        );
      }

      // Sanitize item notes
      const cleanItemNote = typeof it.notes === "string" ? it.notes.replace(/<[^>]*>/g, "").trim().slice(0, 150) : undefined;

      validatedItems.push({
        productId: it.productId.trim().slice(0, 64),
        name: authItem.name,
        price: authItem.price, // Trusted server price
        quantity: qty,
        image: typeof it.image === "string" ? it.image.slice(0, 500) : "",
        notes: cleanItemNote,
      });
    }

    const cleanTable = normalizeTableNumber(tableNumber || "A1");
    const cleanCheckoutId = typeof checkoutId === "string" ? checkoutId.trim().slice(0, 64) : "";
    const cleanNotes = typeof notes === "string" ? notes.replace(/<[^>]*>/g, "").trim().slice(0, 300) : "";
    const cleanPhone = typeof customerPhone === "string" ? customerPhone.replace(/\D/g, "").slice(0, 15) : undefined;

    // 4. Concurrency Guard: Prevent Double-Click Race Conditions
    const lockKey = cleanCheckoutId || `${cleanSessionId}:${cleanTable}`;
    if (inFlightCheckouts.has(lockKey)) {
      // In-flight submission already processing; wait slightly
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    inFlightCheckouts.add(lockKey);

    try {
      // 5. Single Master Order per Table Session:
      // Check if there is an active, unpaid order already for this table
      const activeOrder = await getActiveOrderForTable(cleanTable);

      // Idempotency Protection:
      // If client retried with the exact same checkoutId, return the existing order
      if (cleanCheckoutId) {
        if (activeOrder && (activeOrder.notes || "").includes(`[CHECKOUT:${cleanCheckoutId}]`)) {
          return NextResponse.json(
            { success: true, order: activeOrder, isAddon: true, duplicateSuppressed: true },
            { status: 200 }
          );
        }

        try {
          const { data: duplicateOrder } = await supabaseAdmin
            .from("orders")
            .select("id")
            .ilike("notes", `%[CHECKOUT:${cleanCheckoutId}]%`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (duplicateOrder) {
            const fullExisting = await getOrderById(duplicateOrder.id);
            if (fullExisting) {
              return NextResponse.json(
                { success: true, order: fullExisting, duplicateSuppressed: true },
                { status: 200 }
              );
            }
          }
        } catch (idempErr) {
          console.warn("Idempotency lookup warning:", idempErr);
        }
      }

      const checkoutTag = cleanCheckoutId ? `[CHECKOUT:${cleanCheckoutId}]` : "";
      const combinedNotes = `${cleanNotes} ${checkoutTag}`.trim();

      if (activeOrder) {
        // Check customer session ownership of this dining table
        if (activeOrder.customerSessionId && activeOrder.customerSessionId !== cleanSessionId) {
          return NextResponse.json(
            {
              success: false,
              error: `Table ${cleanTable} is currently occupied by another customer. If you are seated here, please contact the counter.`,
              tableOccupied: true,
            },
            { status: 403 }
          );
        }

        // Customer is ordering additional food in the same dining visit!
        // Reuse existing Visit ID so all orders contribute to the single table bill
        const existingVisitId =
          activeOrder.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1] ||
          (activeOrder as any).visit_id ||
          `VISIT-${cleanTable}-${activeOrder.id.slice(0, 8).toUpperCase()}`;

        // Create a separate new order record with its own KOT ticket
        const newOrder = await createOrder({
          tableNumber: cleanTable,
          customerSessionId: cleanSessionId,
          customerId,
          customerPhone: cleanPhone || activeOrder.customerPhone || undefined,
          items: validatedItems,
          notes: `${combinedNotes} [VISIT_ID:${existingVisitId}]`.trim(),
        });

        return NextResponse.json(
          {
            success: true,
            order: newOrder,
            visitId: existingVisitId,
            isAddon: true,
            duplicateSuppressed: false,
            message: "Add-on order placed successfully. Sent to counter for KOT approval.",
          },
          { status: 201 }
        );
      }

      // Check if table is occupied or reserved
      const activeRes = await getActiveReservations();
      const tableRes = activeRes.find(
        (r) =>
          normalizeTableNumber(r.tableNumber) === cleanTable &&
          r.status === "ACTIVE" &&
          new Date(r.expiresAt) > new Date()
      );

      let visitId = `VISIT-${cleanTable}-${Date.now().toString(36).toUpperCase()}`;

      if (tableRes) {
        if (tableRes.customerSessionId && tableRes.customerSessionId !== cleanSessionId) {
          return NextResponse.json(
            {
              success: false,
              error: `Table ${cleanTable} is temporarily reserved by another customer. Please choose another table.`,
              tableReserved: true,
            },
            { status: 403 }
          );
        }
        await convertReservationToVisit({
          tableNumber: cleanTable,
          customerSessionId: cleanSessionId,
          visitId,
        });
      }

      const order = await createOrder({
        tableNumber: cleanTable,
        customerSessionId: cleanSessionId,
        customerId,
        customerPhone: cleanPhone,
        items: validatedItems,
        notes: `${combinedNotes} [VISIT_ID:${visitId}]`.trim(),
      });

      return NextResponse.json(
        {
          success: true,
          order,
          visitId,
          isAddon: false,
          message: "Order placed successfully. Sent to counter for KOT approval.",
        },
        { status: 201 }
      );
    } finally {
      inFlightCheckouts.delete(lockKey);
    }
  } catch (err: any) {
    console.error("Order creation error:", err?.message || err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to process order. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const visitId = searchParams.get("visitId");
    const sessionId = searchParams.get("sessionId");
    const table = searchParams.get("table");
    const includeHistory = searchParams.get("includeHistory") === "true";

    // 1. Visit ID specified (fetch active orders for this specific dining visit)
    if (visitId && !includeHistory) {
      const visitOrders = await getOrdersByVisitId(visitId);
      // Filter out paid/cancelled if not explicitly querying history
      const activeOrders = visitOrders.filter(
        (o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED"
      );

      // Session isolation check
      if (sessionId && activeOrders.length > 0) {
        const adminSession = await verifyAdminSession(req);
        if (!adminSession.authenticated) {
          const belongsToCustomer = activeOrders.some((o) => o.customerSessionId === sessionId);
          if (!belongsToCustomer) {
            return NextResponse.json({ success: true, orders: [], visitId: null });
          }
        }
      }

      // Sort newest first
      activeOrders.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return NextResponse.json({ success: true, orders: activeOrders, visitId });
    }

    // 2. Table specified (Customer view or Table view)
    if (table) {
      const cleanTable = normalizeTableNumber(table);
      const activeVisit = await getActiveVisitOrdersForTable(cleanTable);

      // Verify authorization: non-admin callers MUST supply matching sessionId to see orders
      const adminSession = await verifyAdminSession(req);
      if (!adminSession.authenticated) {
        if (!sessionId) {
          return NextResponse.json({
            success: true,
            orders: [],
            visitId: null,
            tableOccupiedByOther: activeVisit.orders.length > 0,
          });
        }
        const matchesSession = activeVisit.orders.some(
          (o) => o.customerSessionId === sessionId
        );
        if (!matchesSession) {
          return NextResponse.json({
            success: true,
            orders: [],
            visitId: null,
            tableOccupiedByOther: true,
          });
        }
      }

      return NextResponse.json({
        success: true,
        orders: activeVisit.orders,
        visitId: activeVisit.visitId,
        activeOrder: activeVisit.orders[0] || null,
      });
    }

    // 3. Session ID specified without table (Customer order tracker)
    if (sessionId) {
      if (includeHistory) {
        const orders = await getSessionOrders(sessionId);
        return NextResponse.json({ success: true, orders });
      }

      const allSessionOrders = await getSessionOrders(sessionId);
      const activeCurrent = allSessionOrders.filter(
        (o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED"
      );

      if (activeCurrent.length > 0) {
        const mostRecentTable = normalizeTableNumber(activeCurrent[0].tableNumber);
        const filtered = activeCurrent.filter(
          (o) => normalizeTableNumber(o.tableNumber) === mostRecentTable
        );
        return NextResponse.json({ success: true, orders: filtered });
      }

      return NextResponse.json({ success: true, orders: [] });
    }

    // 4. If no session or table filter provided, return all orders (ADMIN ONLY)
    const authError = await requireAdminAuth(req);
    if (authError) return authError;

    const all = await getAllOrders();
    return NextResponse.json({ success: true, orders: all });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders." },
      { status: 500 }
    );
  }
}
