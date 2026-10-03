import crypto from "crypto";
import { supabaseAdmin } from "./supabase/admin";
import type {
  Database,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  AdminRole,
  OrderItem,
  Order,
  Customer,
  CustomerSession,
  Invoice,
  InvoiceItemSnapshot,
  Settlement,
  DynamicMenuItem,
  AuditLog,
  CafeConfig,
} from "./supabase/types";

// Re-export domain types for full backward compatibility
export type {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  AdminRole,
  OrderItem,
  Order,
  Customer,
  CustomerSession,
  Invoice,
  InvoiceItemSnapshot,
  Settlement,
  DynamicMenuItem,
  AuditLog,
  CafeConfig,
};

export interface DatabaseSchema {
  orders: Order[];
  config: CafeConfig;
  customers: Customer[];
  customerSessions: CustomerSession[];
  invoices: Invoice[];
  settlements: Settlement[];
  menuItems: DynamicMenuItem[];
  auditLogs: AuditLog[];
}



export const DEFAULT_CONFIG: CafeConfig = {
  taxPercentage: 5,
  packagingFee: 0,
  serviceCharge: 0,
  kitchenPin: "1234",
  cashierPin: "5678",
  adminPin: "1234",
  adminUsername: "admin",
  adminPasswordHash: crypto.createHash("sha256").update("spiral2026").digest("hex"),
  cafeName: "Spiral Cafe",
  cafeAddress: "Opposite Government Hospital, CSI Mahimai Illam, Alagesan Nagar, Chengalpattu, Tamil Nadu 603001",
  cafePhone: "+91 98765 43210",
  gstNumber: "33AAAAA0000A1Z5",
  currencySymbol: "₹",
};

// ----------------------------------------------------
// HELPER CONVERTERS (DB Snake_Case <-> App CamelCase)
// ----------------------------------------------------

export function normalizeTableNumber(table: string): string {
  let clean = (table || "").trim();
  const numMatch = clean.match(/\d+/);
  if (numMatch) {
    return `Table ${numMatch[0].padStart(2, "0")}`;
  }
  return clean || "Table 01";
}

function mapDbOrderToOrder(row: any, items: OrderItem[] = []): Order {
  const mappedItems: OrderItem[] =
    items.length > 0
      ? items
      : row.order_items
      ? row.order_items.map(mapDbOrderItemToOrderItem)
      : [];

  const notesStr = row.notes || "";
  const addingMatch = notesStr.match(/\[ADDING_FOOD_UNTIL:(\d+)\]/);
  const addingFoodUntil = addingMatch ? parseInt(addingMatch[1], 10) : undefined;
  const customerAddingFood = addingFoodUntil ? Date.now() < addingFoodUntil : false;

  const cookingMatch = notesStr.match(/\[COOKING_ROUNDS:([0-9,]+)\]/);
  const cookingRounds = cookingMatch
    ? cookingMatch[1]
        .split(",")
        .map(Number)
        .filter((n: number) => !isNaN(n))
    : row.status === "PENDING"
    ? []
    : [1];

  return {
    id: row.id,
    orderNumber: row.order_number,
    tableNumber: row.table_number,
    customerSessionId: row.customer_session_id || "",
    customerId: row.customer_id || undefined,
    customerPhone: row.customer_phone || undefined,
    items: mappedItems,
    subtotal: Number(row.subtotal || 0),
    tax: Number(row.tax || 0),
    packagingFee: Number(row.packaging_fee || 0),
    serviceCharge: Number(row.service_charge || 0),
    grandTotal: Number(row.grand_total || 0),
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: row.payment_method as PaymentMethod,
    paymentTxnId: row.payment_txn_id || undefined,
    paymentProvider: row.payment_provider || undefined,
    invoiceId: row.invoice_id || undefined,
    invoiceNumber: row.invoice_number || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preparingAt: row.preparing_at || undefined,
    readyAt: row.ready_at || undefined,
    paidAt: row.paid_at || undefined,
    completedAt: row.completed_at || undefined,
    cancelledAt: row.cancelled_at || undefined,
    customerAddingFood,
    addingFoodUntil,
    cookingRounds,
  };
}

function mapDbOrderItemToOrderItem(row: any): OrderItem {
  const roundMatch = (row.notes || "").match(/\[ROUND:(\d+)\]/);
  const round = roundMatch ? parseInt(roundMatch[1], 10) : 1;

  return {
    id: row.id,
    productId: row.product_id || "",
    name: row.name,
    price: Number(row.price || 0),
    quantity: Number(row.quantity || 1),
    lineTotal: Number(row.line_total || 0),
    image: row.image || "",
    notes: row.notes || undefined,
    round,
  };
}

function mapDbMenuItemToMenuItem(row: any): DynamicMenuItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    price: Number(row.price || 0),
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    categoryId: row.category_id,
    categoryName: row.category_name,
    dietType: row.diet_type,
    badge: row.badge,
    rating: Number(row.rating || 4.8),
    reviewsCount: Number(row.reviews_count || 250),
    image: row.image,
    storagePath: row.cloudinary_public_id || undefined,
    cloudinaryPublicId: row.cloudinary_public_id || undefined,
    available: Boolean(row.available),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbInvoiceToInvoice(row: any): Invoice {
  let itemsSnapshot: InvoiceItemSnapshot[] = [];
  if (Array.isArray(row.items)) {
    itemsSnapshot = row.items.map((it: any) => ({
      name: it.name,
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || it.price || 0),
      lineTotal: Number(it.lineTotal || 0),
    }));
  }

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    orderId: row.order_id || "",
    orderNumber: row.order_number,
    tableNumber: row.table_number,
    customerId: row.customer_id || undefined,
    customerPhone: row.customer_phone || undefined,
    items: itemsSnapshot,
    subtotal: Number(row.subtotal || 0),
    tax: Number(row.tax || 0),
    packagingFee: Number(row.packaging_fee || 0),
    serviceCharge: Number(row.service_charge || 0),
    grandTotal: Number(row.grand_total || 0),
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    paidAt: row.paid_at || undefined,
    secureToken: row.secure_token || undefined,
    smsSent: Boolean(row.sms_sent),
    smsSentAt: row.sms_sent_at || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

function mapDbCustomerToCustomer(row: any): Customer {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    name: row.name || undefined,
    serviceSmsConsent: Boolean(row.service_sms_consent),
    marketingConsent: Boolean(row.marketing_consent),
    totalOrders: Number(row.total_orders || 0),
    totalSpent: Number(row.total_spent || 0),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbConfigToConfig(row: any): CafeConfig {
  if (!row) return DEFAULT_CONFIG;
  return {
    taxPercentage: Number(row.tax_percentage ?? DEFAULT_CONFIG.taxPercentage),
    packagingFee: Number(row.packaging_fee ?? DEFAULT_CONFIG.packagingFee),
    serviceCharge: Number(row.service_charge ?? DEFAULT_CONFIG.serviceCharge),
    kitchenPin: row.kitchen_pin || DEFAULT_CONFIG.kitchenPin,
    cashierPin: row.cashier_pin || DEFAULT_CONFIG.cashierPin,
    adminPin: row.admin_pin || DEFAULT_CONFIG.adminPin,
    adminUsername: row.admin_username || DEFAULT_CONFIG.adminUsername,
    adminPasswordHash: row.admin_password_hash || DEFAULT_CONFIG.adminPasswordHash,
    cafeName: row.cafe_name || DEFAULT_CONFIG.cafeName,
    cafeAddress: row.cafe_address || DEFAULT_CONFIG.cafeAddress,
    cafePhone: row.cafe_phone || DEFAULT_CONFIG.cafePhone,
    gstNumber: row.gst_number || DEFAULT_CONFIG.gstNumber,
    currencySymbol: row.currency_symbol || DEFAULT_CONFIG.currencySymbol,
  };
}

export function generateOrderNumber(): string {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `ORD-${randomDigits}`;
}

export function generateInvoiceNumber(seq: number): string {
  const year = new Date().getFullYear();
  const formattedSeq = String(seq).padStart(6, "0");
  return `INV-${year}-${formattedSeq}`;
}

// ----------------------------------------------------
// CONFIGURATION OPERATIONS
// ----------------------------------------------------

export async function getConfig(): Promise<CafeConfig> {
  try {
    const { data, error } = await supabaseAdmin
      .from("cafe_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_CONFIG;
    }

    return mapDbConfigToConfig(data);
  } catch (err) {
    console.error("Error reading config from Supabase:", err);
    return DEFAULT_CONFIG;
  }
}

export async function updateConfig(
  updates: Partial<CafeConfig>,
  adminUser = "admin"
): Promise<CafeConfig> {
  const current = await getConfig();
  const merged: CafeConfig = { ...current, ...updates };

  const { error } = await supabaseAdmin.from("cafe_config").upsert(
    {
      id: 1,
      tax_percentage: merged.taxPercentage,
      packaging_fee: merged.packagingFee,
      service_charge: merged.serviceCharge,
      kitchen_pin: merged.kitchenPin,
      cashier_pin: merged.cashierPin,
      admin_pin: merged.adminPin,
      admin_username: merged.adminUsername,
      admin_password_hash: merged.adminPasswordHash,
      cafe_name: merged.cafeName,
      cafe_address: merged.cafeAddress,
      cafe_phone: merged.cafePhone,
      gst_number: merged.gstNumber,
      currency_symbol: merged.currencySymbol,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Failed to update config in Supabase: ${error.message}`);
  }

  await recordAuditLog(adminUser, "UPDATE_CONFIG", "CONFIG", "global", JSON.stringify(updates));
  return merged;
}

// ----------------------------------------------------
// ORDER OPERATIONS
// ----------------------------------------------------

export async function getAllOrders(): Promise<Order[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders from Supabase:", error);
    return [];
  }

  return (data || []).map((row: any) => mapDbOrderToOrder(row));
}

export async function getOrderById(idOrNumber: string): Promise<Order | undefined> {
  const isOrdNumber = idOrNumber.toUpperCase().startsWith("ORD-");

  let query = supabaseAdmin.from("orders").select("*, order_items(*)");
  if (isOrdNumber) {
    query = query.ilike("order_number", idOrNumber);
  } else {
    query = query.eq("id", idOrNumber);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return undefined;
  }

  return mapDbOrderToOrder(data);
}

export async function getSessionOrders(customerSessionId: string): Promise<Order[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .eq("customer_session_id", customerSessionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching session orders from Supabase:", error);
    return [];
  }

  return (data || []).map((row: any) => mapDbOrderToOrder(row));
}

export async function getActiveOrderForTable(tableNumber: string): Promise<Order | null> {
  const cleanTable = normalizeTableNumber(tableNumber);

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .eq("table_number", cleanTable)
    .neq("status", "CANCELLED")
    .neq("payment_status", "PAID")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapDbOrderToOrder(data);
}

export async function addItemsToExistingOrder(params: {
  orderId: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    notes?: string;
  }>;
  notes?: string;
}): Promise<Order> {
  const current = await getOrderById(params.orderId);
  if (!current) {
    throw new Error(`Active order not found for ID: ${params.orderId}`);
  }

  const config = await getConfig();
  const now = new Date().toISOString();

  // Determine current max round from existing items
  const existingRounds = current.items.map((it) => {
    const match = (it.notes || "").match(/\[ROUND:(\d+)\]/);
    return match ? parseInt(match[1], 10) : (it.round || 1);
  });
  const currentMaxRound = existingRounds.length > 0 ? Math.max(...existingRounds) : 1;
  const nextRound = current.status === "PENDING" ? currentMaxRound : currentMaxRound + 1;

  // Prepare new items payload with [ROUND:nextRound]
  const newOrderItems: OrderItem[] = params.items.map((item, index) => {
    const qty = Math.max(1, Math.floor(item.quantity));
    const lineTotal = item.price * qty;
    const itemNote = (item.notes || "").trim();
    const taggedNote = itemNote ? `${itemNote} [ROUND:${nextRound}]` : `[ROUND:${nextRound}]`;

    return {
      id: `oi_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: qty,
      lineTotal,
      image: item.image,
      notes: taggedNote,
      round: nextRound,
    };
  });

  const allItems = [...current.items, ...newOrderItems];
  const subtotal = allItems.reduce((sum, it) => sum + it.lineTotal, 0);
  const tax = Math.round((subtotal * config.taxPercentage) / 100);
  const packagingFee = config.packagingFee;
  const serviceCharge = config.serviceCharge;
  const grandTotal = subtotal + tax + packagingFee + serviceCharge;

  // Clean adding-food flag from notes and append any new customer note
  let updatedNotes = current.notes || "";
  updatedNotes = updatedNotes.replace(/\[ADDING_FOOD_UNTIL:\d+\]/g, "").trim();
  if (params.notes && params.notes.trim()) {
    updatedNotes = updatedNotes ? `${updatedNotes} | ${params.notes.trim()}` : params.notes.trim();
  }

  const itemsPayload: Database["public"]["Tables"]["order_items"]["Insert"][] = newOrderItems.map((it) => ({
    id: it.id!,
    order_id: current.id,
    product_id: it.productId || null,
    name: it.name,
    price: it.price,
    quantity: it.quantity,
    line_total: it.lineTotal,
    image: it.image || "",
    notes: it.notes || null,
  }));

  const { error: insertErr } = await supabaseAdmin.from("order_items").insert(itemsPayload);
  if (insertErr) {
    throw new Error(`Failed to insert add-on items: ${insertErr.message}`);
  }

  // Status transition when adding items:
  // If the previous order was COMPLETED (already served) or READY:
  // Since new items have been added to the table order that need cooking,
  // the order status MUST become "PENDING" so it enters the kitchen workflow!
  let newStatus: OrderStatus = current.status;
  if (current.status === "COMPLETED" || current.status === "READY") {
    newStatus = "PENDING";
  }

  // If the previous order was already cooking/served, preserve those rounds in [COOKING_ROUNDS]
  if (current.status !== "PENDING" && !updatedNotes.includes("[COOKING_ROUNDS:")) {
    const prevRounds = Array.from(new Set(existingRounds)).sort((a, b) => a - b);
    const cookedRounds = prevRounds.length > 0 ? prevRounds : [1];
    updatedNotes = updatedNotes ? `${updatedNotes} [COOKING_ROUNDS:${cookedRounds.join(",")}]` : `[COOKING_ROUNDS:${cookedRounds.join(",")}]`;
  }

  const orderUpdates: Database["public"]["Tables"]["orders"]["Update"] = {
    status: newStatus,
    subtotal,
    tax,
    packaging_fee: packagingFee,
    service_charge: serviceCharge,
    grand_total: grandTotal,
    notes: updatedNotes,
    updated_at: now,
  };

  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update(orderUpdates)
    .eq("id", current.id);

  if (updateErr) {
    throw new Error(`Failed to update order totals: ${updateErr.message}`);
  }

  return {
    ...current,
    status: newStatus,
    items: allItems,
    subtotal,
    tax,
    packagingFee,
    serviceCharge,
    grandTotal,
    notes: updatedNotes,
    updatedAt: now,
  };
}

export async function setCustomerAddingFoodFlag(params: {
  orderId?: string;
  tableNumber?: string;
  isAdding: boolean;
}): Promise<boolean> {
  let targetOrder: Order | null | undefined = null;
  if (params.orderId) {
    targetOrder = await getOrderById(params.orderId);
  }
  if (!targetOrder && params.tableNumber) {
    targetOrder = await getActiveOrderForTable(params.tableNumber);
  }

  if (!targetOrder) {
    return false;
  }

  let notes = targetOrder.notes || "";
  notes = notes.replace(/\[ADDING_FOOD_UNTIL:\d+\]/g, "").trim();

  if (params.isAdding) {
    const expireTs = Date.now() + 120000; // 2 minutes window
    notes = notes ? `${notes} [ADDING_FOOD_UNTIL:${expireTs}]` : `[ADDING_FOOD_UNTIL:${expireTs}]`;
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", targetOrder.id);

  return !error;
}

export async function mergeAddonToCooking(orderId: string, addonRound?: number): Promise<Order> {
  const current = await getOrderById(orderId);
  if (!current) {
    throw new Error(`Order not found: ${orderId}`);
  }

  let notes = current.notes || "";
  const match = notes.match(/\[COOKING_ROUNDS:([0-9,]+)\]/);
  const existingCooking = match
    ? match[1].split(",").map(Number).filter((n) => !isNaN(n))
    : [1];

  let targetRounds = [...existingCooking];
  if (addonRound && !targetRounds.includes(addonRound)) {
    targetRounds.push(addonRound);
  } else {
    const allRounds = Array.from(new Set(current.items.map((it) => it.round || 1)));
    targetRounds = Array.from(new Set([...targetRounds, ...allRounds]));
  }
  targetRounds.sort((a, b) => a - b);

  notes = notes.replace(/\[COOKING_ROUNDS:[0-9,]+\]/g, "").trim();
  notes = notes ? `${notes} [COOKING_ROUNDS:${targetRounds.join(",")}]` : `[COOKING_ROUNDS:${targetRounds.join(",")}]`;

  const now = new Date().toISOString();
  const updates: Database["public"]["Tables"]["orders"]["Update"] = {
    notes,
    status: "PREPARING",
    preparing_at: current.preparingAt || now,
    updated_at: now,
  };

  const { error } = await supabaseAdmin.from("orders").update(updates).eq("id", current.id);
  if (error) {
    throw new Error(`Failed to merge add-on into cooking: ${error.message}`);
  }

  return {
    ...current,
    status: "PREPARING",
    notes,
    cookingRounds: targetRounds,
    updatedAt: now,
  };
}

export async function getTablesStatus(): Promise<
  Array<{
    tableNumber: string;
    isLocked: boolean;
    activeOrderId?: string;
    orderNumber?: string;
    customerSessionId?: string;
    grandTotal?: number;
    status?: OrderStatus;
  }>
> {
  const TABLES = Array.from({ length: 15 }, (_, i) => `Table ${String(i + 1).padStart(2, "0")}`);

  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, table_number, customer_session_id, grand_total, status, payment_status")
    .neq("status", "CANCELLED")
    .neq("payment_status", "PAID");

  const activeByTable = new Map<string, any>();
  for (const row of data || []) {
    const norm = normalizeTableNumber(row.table_number);
    if (!activeByTable.has(norm)) {
      activeByTable.set(norm, row);
    }
  }

  return TABLES.map((t) => {
    const active = activeByTable.get(t);
    return {
      tableNumber: t,
      isLocked: !!active,
      activeOrderId: active?.id,
      orderNumber: active?.order_number,
      customerSessionId: active?.customer_session_id,
      grandTotal: active ? Number(active.grand_total) : 0,
      status: active?.status,
    };
  });
}

export async function getActiveKitchenOrders(): Promise<{
  pending: Order[];
  preparing: Order[];
  ready: Order[];
  recentCompleted: Order[];
}> {
  // Fetch active table orders that are not settled (payment_status !== PAID and status !== CANCELLED)
  // as well as recently completed orders
  const [activeRes, completedRes] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .neq("status", "CANCELLED")
      .neq("payment_status", "PAID")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("status", "COMPLETED")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const activeOrders = (activeRes.data || []).map((r: any) => mapDbOrderToOrder(r));
  const rawCompleted = (completedRes.data || []).map((r: any) => mapDbOrderToOrder(r));

  const pending: Order[] = [];
  const preparing: Order[] = [];
  const ready: Order[] = [];

  for (const order of activeOrders) {
    const roundsPresent = Array.from(new Set(order.items.map((it) => it.round || 1))).sort((a, b) => a - b);
    const cookingRounds =
      order.cookingRounds && order.cookingRounds.length > 0
        ? order.cookingRounds
        : order.status === "PENDING"
        ? []
        : [1];

    const unmergedRounds = roundsPresent.filter((r) => !cookingRounds.includes(r));

    // Self-healing database check:
    // If order was marked COMPLETED or READY, but has unmerged rounds that need cooking:
    if (order.status === "COMPLETED" && unmergedRounds.length > 0) {
      order.status = "PENDING";
      void Promise.resolve(
        supabaseAdmin
          .from("orders")
          .update({ status: "PENDING", updated_at: new Date().toISOString() })
          .eq("id", order.id)
      ).catch((e: unknown) => console.warn("Notice: auto healing order status:", e));
    }

    if (order.status === "PENDING") {
      if (cookingRounds.length === 0) {
        // Initial order where all rounds/items are pending together
        pending.push(order);
      } else {
        // Order where previous rounds were already cooked/served, and newly added rounds are pending
        for (const r of unmergedRounds) {
          const roundItems = order.items.filter((it) => (it.round || 1) === r);
          const roundTotal = roundItems.reduce((sum, it) => sum + it.lineTotal, 0);
          pending.push({
            ...order,
            id: `${order.id}__addon_r${r}`,
            parentOrderId: order.id,
            isAddon: true,
            addonRound: r,
            items: roundItems,
            grandTotal: roundTotal,
            subtotal: roundTotal,
            notes: order.notes,
          });
        }
      }
    } else if (order.status === "PREPARING") {
      // Items currently in cooking
      const cookingItems = order.items.filter((it) => cookingRounds.includes(it.round || 1));
      if (cookingItems.length > 0) {
        preparing.push({
          ...order,
          items: cookingItems,
        });
      }

      // Synthesize an Add-On ticket in PENDING for each unmerged round
      for (const r of unmergedRounds) {
        const roundItems = order.items.filter((it) => (it.round || 1) === r);
        const roundTotal = roundItems.reduce((sum, it) => sum + it.lineTotal, 0);
        pending.push({
          ...order,
          id: `${order.id}__addon_r${r}`,
          parentOrderId: order.id,
          isAddon: true,
          addonRound: r,
          items: roundItems,
          grandTotal: roundTotal,
          subtotal: roundTotal,
          notes: order.notes,
        });
      }
    } else if (order.status === "READY") {
      const readyItems = order.items.filter((it) => cookingRounds.includes(it.round || 1));
      ready.push({
        ...order,
        items: readyItems.length > 0 ? readyItems : order.items,
      });

      for (const r of unmergedRounds) {
        const roundItems = order.items.filter((it) => (it.round || 1) === r);
        const roundTotal = roundItems.reduce((sum, it) => sum + it.lineTotal, 0);
        pending.push({
          ...order,
          id: `${order.id}__addon_r${r}`,
          parentOrderId: order.id,
          isAddon: true,
          addonRound: r,
          items: roundItems,
          grandTotal: roundTotal,
          subtotal: roundTotal,
          notes: order.notes,
        });
      }
    }
  }

  // Remove any order from recentCompleted if it has active pending or preparing add-ons
  const activeOrderIds = new Set([
    ...pending.map((p) => p.parentOrderId || p.id),
    ...preparing.map((p) => p.parentOrderId || p.id),
  ]);
  const recentCompleted = rawCompleted.filter((c) => !activeOrderIds.has(c.id));

  return {
    pending,
    preparing,
    ready,
    recentCompleted,
  };
}

export async function createOrder(params: {
  tableNumber: string;
  customerSessionId: string;
  customerId?: string;
  customerPhone?: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    notes?: string;
  }>;
  notes?: string;
}): Promise<Order> {
  const config = await getConfig();
  const now = new Date().toISOString();

  if (!params.items || params.items.length === 0) {
    throw new Error("Order must contain at least one item.");
  }

  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const orderNumber = generateOrderNumber();

  // Price calculations - Tag initial items with [ROUND:1]
  const orderItems: OrderItem[] = params.items.map((item, index) => {
    const qty = Math.max(1, Math.floor(item.quantity));
    const lineTotal = item.price * qty;
    const note = (item.notes || "").trim();
    const taggedNote = note ? `${note} [ROUND:1]` : `[ROUND:1]`;
    return {
      id: `item-${Date.now()}-${index}`,
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: qty,
      lineTotal,
      image: item.image,
      notes: taggedNote,
      round: 1,
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = Math.round((subtotal * config.taxPercentage) / 100);
  const packagingFee = config.packagingFee;
  const serviceCharge = config.serviceCharge;
  const grandTotal = subtotal + tax + packagingFee + serviceCharge;

  const cleanTable = normalizeTableNumber(params.tableNumber);

  const orderPayload = {
    id: orderId,
    order_number: orderNumber,
    table_number: cleanTable,
    customer_session_id: params.customerSessionId,
    customer_id: params.customerId || null,
    customer_phone: params.customerPhone || null,
    subtotal,
    tax,
    packaging_fee: packagingFee,
    service_charge: serviceCharge,
    grand_total: grandTotal,
    status: "PENDING" as OrderStatus,
    payment_status: "UNPAID" as PaymentStatus,
    payment_method: "UNSELECTED" as PaymentMethod,
    payment_txn_id: null,
    payment_provider: null,
    invoice_id: null,
    invoice_number: null,
    notes: params.notes || "",
    created_at: now,
    updated_at: now,
  };

  const itemsPayload: Database["public"]["Tables"]["order_items"]["Insert"][] = orderItems.map((it) => ({
    id: it.id || `oi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    order_id: orderId,
    product_id: it.productId || null,
    name: it.name,
    price: it.price,
    quantity: it.quantity,
    line_total: it.lineTotal,
    image: it.image || "",
    notes: it.notes || null,
  }));

  // Ensure customer session exists if provided to satisfy foreign key constraint
  if (params.customerSessionId) {
    try {
      await supabaseAdmin.from("customer_sessions").upsert(
        {
          id: params.customerSessionId,
          table_number: cleanTable,
          session_token: params.customerSessionId,
          customer_phone: params.customerPhone || null,
          last_active_at: now,
        },
        { onConflict: "id" }
      );
    } catch (sessionErr) {
      console.warn("Notice: customer session upsert:", sessionErr);
    }
  }

  // Transaction-safe insert (Try RPC first; fallback to atomic two-step)
  let createdOrder: Order;

  const { error: rpcError } = await supabaseAdmin.rpc("create_order_with_items", {
    order_payload: orderPayload as any,
    items_payload: itemsPayload as any,
  });

  if (rpcError) {
    // Direct transaction fallback
    const { error: insertOrderError } = await supabaseAdmin.from("orders").insert(orderPayload);
    if (insertOrderError) {
      throw new Error(`Failed to insert order: ${insertOrderError.message}`);
    }

    const { error: insertItemsError } = await supabaseAdmin.from("order_items").insert(itemsPayload);
    if (insertItemsError) {
      // Rollback order to avoid corrupted partial state
      await supabaseAdmin.from("orders").delete().eq("id", orderId);
      throw new Error(`Failed to insert order items: ${insertItemsError.message}`);
    }
  }

  createdOrder = {
    id: orderId,
    orderNumber,
    tableNumber: cleanTable,
    customerSessionId: params.customerSessionId,
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    items: orderItems,
    subtotal,
    tax,
    packagingFee,
    serviceCharge,
    grandTotal,
    status: "PENDING",
    paymentStatus: "UNPAID",
    paymentMethod: "UNSELECTED",
    notes: params.notes,
    createdAt: now,
    updatedAt: now,
  };

  // Upsert customer profile if phone is supplied
  if (params.customerPhone) {
    saveCustomer({
      phoneNumber: params.customerPhone,
      serviceSmsConsent: true,
      marketingConsent: false,
    }).catch((e) => console.error("Customer background save error:", e));
  }

  return createdOrder;
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  actor: "kitchen" | "admin" | "system",
  actorName = "staff"
): Promise<Order> {
  const current = await getOrderById(orderId);
  if (!current) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["COMPLETED", "PREPARING", "PENDING", "CANCELLED"],
    COMPLETED: ["PREPARING", "PENDING"],
    CANCELLED: [],
  };

  const currentStatus = current.status as OrderStatus;
  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    throw new Error(`Invalid transition: cannot transition order from ${current.status} to ${newStatus}.`);
  }

  const now = new Date().toISOString();
  let updatedNotes = current.notes || "";

  const updates: Database["public"]["Tables"]["orders"]["Update"] = {
    status: newStatus,
    updated_at: now,
  };

  if (newStatus === "PREPARING") {
    updates.preparing_at = now;
    // Strip adding food flag since kitchen is now preparing
    updatedNotes = updatedNotes.replace(/\[ADDING_FOOD_UNTIL:\d+\]/g, "").trim();
    if (!updatedNotes.includes("[COOKING_ROUNDS:")) {
      const allRounds = Array.from(new Set(current.items.map((it) => it.round || 1))).sort((a, b) => a - b);
      const roundsToCook = allRounds.length > 0 ? allRounds : [1];
      updatedNotes = updatedNotes ? `${updatedNotes} [COOKING_ROUNDS:${roundsToCook.join(",")}]` : `[COOKING_ROUNDS:${roundsToCook.join(",")}]`;
    }
    updates.notes = updatedNotes;
  } else if (newStatus === "READY") {
    updates.ready_at = now;
  } else if (newStatus === "COMPLETED") {
    updates.completed_at = now;
  } else if (newStatus === "CANCELLED") {
    updates.cancelled_at = now;
  }

  const { error } = await supabaseAdmin.from("orders").update(updates).eq("id", current.id);
  if (error) {
    throw new Error(`Failed to update order status in Supabase: ${error.message}`);
  }

  const updatedOrder = { ...current, ...updates, notes: updatedNotes };

  await recordAuditLog(
    actorName,
    "STATUS_CHANGE",
    "ORDER",
    current.id,
    `Status changed from ${current.status} to ${newStatus}`
  );

  return updatedOrder;
}

export async function updateOrderPayment(
  orderId: string,
  paymentMethod: PaymentMethod,
  paymentStatus: PaymentStatus,
  autoCompleteIfPaid: boolean = false,
  adminUser?: string,
  paymentTxnId?: string,
  paymentProvider?: string
): Promise<Order> {
  const current = await getOrderById(orderId);
  if (!current) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const now = new Date().toISOString();
  const updates: Database["public"]["Tables"]["orders"]["Update"] = {
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    updated_at: now,
  };

  if (paymentTxnId) updates.payment_txn_id = paymentTxnId;
  if (paymentProvider) updates.payment_provider = paymentProvider;

  let newStatus = current.status;
  if (paymentStatus === "PAID") {
    updates.paid_at = now;
    if (autoCompleteIfPaid || current.status === "READY") {
      newStatus = "COMPLETED";
      updates.status = "COMPLETED";
      updates.completed_at = now;
    }
  }

  const { error } = await supabaseAdmin.from("orders").update(updates).eq("id", current.id);
  if (error) {
    throw new Error(`Failed to update order payment in Supabase: ${error.message}`);
  }

  const updatedOrder = {
    ...current,
    paymentMethod,
    paymentStatus,
    paymentTxnId: paymentTxnId || current.paymentTxnId,
    paymentProvider: paymentProvider || current.paymentProvider,
    status: newStatus,
    paidAt: updates.paid_at || current.paidAt,
    completedAt: updates.completed_at || current.completedAt,
    updatedAt: now,
  };

  if (adminUser) {
    await recordAuditLog(
      adminUser,
      "PAYMENT_UPDATE",
      "PAYMENT",
      current.id,
      `Payment status set to ${paymentStatus} via ${paymentMethod}`
    );
  }

  return updatedOrder;
}

// ----------------------------------------------------
// INVOICE OPERATIONS
// ----------------------------------------------------

export async function createInvoice(orderId: string, adminUser = "admin"): Promise<Invoice> {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found.`);
  }

  if (order.paymentStatus !== "PAID") {
    throw new Error("Invoice can only be generated after payment is confirmed as PAID.");
  }

  // Check if invoice already exists
  const { data: existing } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("order_id", order.id)
    .maybeSingle();

  if (existing) {
    return mapDbInvoiceToInvoice(existing);
  }

  // Count existing invoices for sequential numbering
  const { count } = await supabaseAdmin
    .from("invoices")
    .select("*", { count: "exact", head: true });

  const seq = (count || 0) + 1;
  const invoiceNumber = generateInvoiceNumber(seq);
  const now = new Date().toISOString();
  const secureToken = crypto.randomBytes(16).toString("hex");
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const itemsSnapshot: InvoiceItemSnapshot[] = (order.items || []).map((it: OrderItem) => ({
    name: it.name,
    quantity: it.quantity,
    unitPrice: it.price,
    lineTotal: it.lineTotal,
  }));

  const invoiceRow: Database["public"]["Tables"]["invoices"]["Insert"] = {
    id: invoiceId,
    invoice_number: invoiceNumber,
    order_id: order.id,
    order_number: order.orderNumber,
    table_number: order.tableNumber,
    customer_id: order.customerId || null,
    customer_phone: order.customerPhone || null,
    items: itemsSnapshot as any,
    subtotal: order.subtotal,
    tax: order.tax,
    packaging_fee: order.packagingFee,
    service_charge: order.serviceCharge,
    grand_total: order.grandTotal,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    paid_at: order.paidAt || now,
    secure_token: secureToken,
    sms_sent: false,
    sms_sent_at: null,
    notes: order.notes || null,
    created_at: now,
  };

  const { error: invError } = await supabaseAdmin.from("invoices").insert(invoiceRow);
  if (invError) {
    throw new Error(`Failed to create invoice in Supabase: ${invError.message}`);
  }

  // Insert normalized line items into invoice_items table
  const invoiceItems: Database["public"]["Tables"]["invoice_items"]["Insert"][] = itemsSnapshot.map((it, idx) => ({
    id: `${invoiceId}_item_${idx}`,
    invoice_id: invoiceId,
    product_id: null,
    name: it.name,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    line_total: it.lineTotal,
  }));
  try {
    await supabaseAdmin.from("invoice_items").insert(invoiceItems);
  } catch {
    // Non-critical normalized copy
  }

  // Update order with invoice link
  await supabaseAdmin
    .from("orders")
    .update({
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      updated_at: now,
    })
    .eq("id", order.id);

  const newInvoice = mapDbInvoiceToInvoice(invoiceRow);

  await recordAuditLog(
    adminUser,
    "GENERATE_INVOICE",
    "INVOICE",
    newInvoice.id,
    `Generated invoice ${invoiceNumber} for order ${order.orderNumber}`
  );

  return newInvoice;
}

export async function getAllInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching invoices from Supabase:", error);
    return [];
  }

  return (data || []).map(mapDbInvoiceToInvoice);
}

export async function getInvoiceById(idOrNumber: string): Promise<Invoice | undefined> {
  const clean = idOrNumber.trim();
  const isInvNumber = clean.toUpperCase().startsWith("INV-");
  const isOrdNumber = clean.toUpperCase().startsWith("ORD-");

  let query = supabaseAdmin.from("invoices").select("*");
  if (isInvNumber) {
    query = query.ilike("invoice_number", clean);
  } else if (isOrdNumber) {
    query = query.ilike("order_number", clean);
  } else {
    query = query.or(`id.eq.${clean},order_id.eq.${clean}`);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return undefined;
  }

  return mapDbInvoiceToInvoice(data);
}

export async function getInvoiceBySecureToken(token: string): Promise<Invoice | undefined> {
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("secure_token", token)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return mapDbInvoiceToInvoice(data);
}

export async function markInvoiceSmsSent(
  invoiceId: string,
  adminUser = "admin",
  customerPhone?: string
): Promise<Invoice> {
  const now = new Date().toISOString();
  const updates: any = {
    sms_sent: true,
    sms_sent_at: now,
  };
  if (customerPhone) {
    updates.customer_phone = customerPhone;
  }

  const { data, error } = await supabaseAdmin
    .from("invoices")
    .update(updates)
    .eq("id", invoiceId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update invoice SMS status: ${error?.message}`);
  }

  const invoice = mapDbInvoiceToInvoice(data);

  await recordAuditLog(
    adminUser,
    "SEND_SMS",
    "INVOICE",
    invoice.id,
    `Dispatched invoice SMS to ${customerPhone || invoice.customerPhone || "customer"}`
  );

  return invoice;
}

// ----------------------------------------------------
// CUSTOMER & SESSION OPERATIONS
// ----------------------------------------------------

export async function saveCustomer(params: {
  phoneNumber: string;
  name?: string;
  serviceSmsConsent?: boolean;
  marketingConsent?: boolean;
}): Promise<Customer> {
  const cleanPhone = params.phoneNumber.replace(/\D/g, "");
  const now = new Date().toISOString();

  // Find existing customer
  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("phone_number", cleanPhone)
    .maybeSingle();

  // Query order stats for this phone number
  const { data: customerOrders } = await supabaseAdmin
    .from("orders")
    .select("grand_total, payment_status")
    .eq("customer_phone", cleanPhone);

  const totalOrders = customerOrders ? customerOrders.length : 0;
  const totalSpent = customerOrders
    ? customerOrders
        .filter((o: any) => o.payment_status === "PAID")
        .reduce((sum: number, o: any) => sum + Number(o.grand_total || 0), 0)
    : 0;

  if (existing) {
    const updates: Database["public"]["Tables"]["customers"]["Update"] = {
      total_orders: totalOrders,
      total_spent: totalSpent,
      last_seen_at: now,
      updated_at: now,
    };
    if (params.name) updates.name = params.name;
    if (params.serviceSmsConsent !== undefined) updates.service_sms_consent = params.serviceSmsConsent;
    if (params.marketingConsent !== undefined) updates.marketing_consent = params.marketingConsent;

    const { data: updated, error } = await supabaseAdmin
      .from("customers")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update customer: ${error.message}`);
    return mapDbCustomerToCustomer(updated);
  } else {
    const newId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRow: Database["public"]["Tables"]["customers"]["Insert"] = {
      id: newId,
      phone_number: cleanPhone,
      name: params.name || null,
      service_sms_consent: params.serviceSmsConsent ?? true,
      marketing_consent: params.marketingConsent ?? false,
      total_orders: totalOrders,
      total_spent: totalSpent,
      first_seen_at: now,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    };

    const { data: created, error } = await supabaseAdmin
      .from("customers")
      .insert(newRow)
      .select()
      .single();

    if (error) throw new Error(`Failed to create customer: ${error.message}`);
    return mapDbCustomerToCustomer(created);
  }
}

export async function getAllCustomers(): Promise<Customer[]> {
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("*")
    .order("last_seen_at", { ascending: false });

  if (error) {
    console.error("Error fetching customers from Supabase:", error);
    return [];
  }

  return (data || []).map(mapDbCustomerToCustomer);
}

export async function saveCustomerSession(params: {
  sessionId: string;
  phoneNumber?: string;
  tableNumber: string;
}): Promise<CustomerSession> {
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("customer_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabaseAdmin
      .from("customer_sessions")
      .update({
        table_number: params.tableNumber,
        customer_phone: params.phoneNumber || existing.customer_phone,
        last_active_at: now,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update customer session: ${error.message}`);
    return {
      id: updated.id,
      customerId: updated.customer_id || undefined,
      customerPhone: updated.customer_phone || undefined,
      tableNumber: updated.table_number,
      sessionToken: updated.session_token,
      startedAt: updated.started_at,
      lastActiveAt: updated.last_active_at,
    };
  } else {
    const sessionToken = crypto.randomBytes(16).toString("hex");
    const newSession: Database["public"]["Tables"]["customer_sessions"]["Insert"] = {
      id: params.sessionId,
      customer_id: null,
      customer_phone: params.phoneNumber || null,
      table_number: params.tableNumber,
      session_token: sessionToken,
      started_at: now,
      last_active_at: now,
    };

    const { data: created, error } = await supabaseAdmin
      .from("customer_sessions")
      .insert(newSession)
      .select()
      .single();

    if (error) throw new Error(`Failed to create customer session: ${error.message}`);
    return {
      id: created.id,
      customerId: created.customer_id || undefined,
      customerPhone: created.customer_phone || undefined,
      tableNumber: created.table_number,
      sessionToken: created.session_token,
      startedAt: created.started_at,
      lastActiveAt: created.last_active_at,
    };
  }
}

// ----------------------------------------------------
// DYNAMIC MENU MANAGEMENT
// ----------------------------------------------------

export async function getAllMenuItems(): Promise<DynamicMenuItem[]> {
  const { data, error } = await supabaseAdmin
    .from("menu_items")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching menu items from Supabase:", error);
    return [];
  }

  return (data || []).map(mapDbMenuItemToMenuItem);
}

export async function getMenuItemById(id: string): Promise<DynamicMenuItem | undefined> {
  const { data, error } = await supabaseAdmin
    .from("menu_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return undefined;
  return mapDbMenuItemToMenuItem(data);
}

export async function createMenuItem(
  item: Omit<DynamicMenuItem, "id" | "createdAt" | "updatedAt">,
  adminUser = "admin"
): Promise<DynamicMenuItem> {
  const now = new Date().toISOString();
  const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const row: Database["public"]["Tables"]["menu_items"]["Insert"] = {
    id,
    name: item.name,
    description: item.description || "",
    price: item.price,
    original_price: item.originalPrice ?? null,
    category_id: item.categoryId,
    category_name: item.categoryName,
    diet_type: item.dietType || "veg",
    badge: item.badge || "none",
    rating: item.rating ?? 4.8,
    reviews_count: item.reviewsCount ?? 250,
    image: item.image,
    cloudinary_public_id: item.storagePath || item.cloudinaryPublicId || null,
    available: item.available ?? true,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from("menu_items")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`Failed to create menu item: ${error.message}`);

  const created = mapDbMenuItemToMenuItem(data);
  await recordAuditLog(adminUser, "CREATE_MENU_ITEM", "MENU_ITEM", created.id, `Created product: ${created.name} (₹${created.price})`);
  return created;
}

export async function updateMenuItem(
  id: string,
  updates: Partial<DynamicMenuItem>,
  adminUser = "admin"
): Promise<DynamicMenuItem> {
  const now = new Date().toISOString();
  const dbUpdates: Database["public"]["Tables"]["menu_items"]["Update"] = {
    updated_at: now,
  };

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.price !== undefined) dbUpdates.price = updates.price;
  if (updates.originalPrice !== undefined) dbUpdates.original_price = updates.originalPrice;
  if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
  if (updates.categoryName !== undefined) dbUpdates.category_name = updates.categoryName;
  if (updates.dietType !== undefined) dbUpdates.diet_type = updates.dietType;
  if (updates.badge !== undefined) dbUpdates.badge = updates.badge;
  if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
  if (updates.reviewsCount !== undefined) dbUpdates.reviews_count = updates.reviewsCount;
  if (updates.image !== undefined) dbUpdates.image = updates.image;
  if (updates.storagePath !== undefined) dbUpdates.cloudinary_public_id = updates.storagePath;
  else if (updates.cloudinaryPublicId !== undefined) dbUpdates.cloudinary_public_id = updates.cloudinaryPublicId;
  if (updates.available !== undefined) dbUpdates.available = updates.available;

  const { data, error } = await supabaseAdmin
    .from("menu_items")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update menu item: ${error.message}`);

  const updated = mapDbMenuItemToMenuItem(data);
  await recordAuditLog(adminUser, "UPDATE_MENU_ITEM", "MENU_ITEM", id, `Updated product: ${updated.name}`);
  return updated;
}

export async function deleteMenuItem(id: string, adminUser = "admin"): Promise<boolean> {
  const existing = await getMenuItemById(id);
  if (!existing) return false;

  const { error } = await supabaseAdmin.from("menu_items").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete menu item: ${error.message}`);

  await recordAuditLog(adminUser, "DELETE_MENU_ITEM", "MENU_ITEM", id, `Deleted product: ${existing.name}`);
  return true;
}

export async function toggleMenuItemAvailability(id: string, adminUser = "admin"): Promise<DynamicMenuItem> {
  const existing = await getMenuItemById(id);
  if (!existing) throw new Error("Menu item not found.");

  const newStatus = !existing.available;
  return updateMenuItem(id, { available: newStatus }, adminUser);
}

// ----------------------------------------------------
// SETTLEMENT & REVENUE OPERATIONS
// ----------------------------------------------------

export async function getSettlementSummary(dateStr?: string): Promise<{
  date: string;
  totalOrders: number;
  totalSales: number;
  cashSales: number;
  onlineSales: number;
  unpaidTotal: number;
  paidOrdersCount: number;
  unpaidOrdersCount: number;
  orders: Order[];
}> {
  const targetDate = dateStr || new Date().toISOString().split("T")[0];

  const allOrders = await getAllOrders();
  const dayOrders = allOrders.filter((o) => o.createdAt.startsWith(targetDate));

  const paidOrders = dayOrders.filter((o) => o.paymentStatus === "PAID");
  const unpaidOrders = dayOrders.filter((o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED");

  const cashSales = paidOrders
    .filter((o) => o.paymentMethod === "CASH")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const onlineSales = paidOrders
    .filter((o) => o.paymentMethod === "ONLINE")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const totalSales = cashSales + onlineSales;
  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + o.grandTotal, 0);

  return {
    date: targetDate,
    totalOrders: dayOrders.length,
    totalSales,
    cashSales,
    onlineSales,
    unpaidTotal,
    paidOrdersCount: paidOrders.length,
    unpaidOrdersCount: unpaidOrders.length,
    orders: dayOrders,
  };
}

export async function recordSettlement(params: {
  date: string;
  cashCounted: number;
  cashSettled: number;
  notes?: string;
  settledBy: string;
}): Promise<Settlement> {
  const summary = await getSettlementSummary(params.date);
  const difference = params.cashCounted - summary.cashSales;
  const now = new Date().toISOString();
  const id = `stl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const row: Database["public"]["Tables"]["settlements"]["Insert"] = {
    id,
    date: params.date,
    total_orders: summary.totalOrders,
    total_sales: summary.totalSales,
    cash_sales: summary.cashSales,
    online_sales: summary.onlineSales,
    cash_counted: params.cashCounted,
    cash_settled: params.cashSettled,
    difference,
    notes: params.notes || null,
    settled_by: params.settledBy,
    settled_at: now,
  };

  const { error } = await supabaseAdmin.from("settlements").insert(row);
  if (error) {
    throw new Error(`Failed to record settlement in Supabase: ${error.message}`);
  }

  const settlement: Settlement = {
    id,
    date: params.date,
    totalOrders: summary.totalOrders,
    totalSales: summary.totalSales,
    cashSales: summary.cashSales,
    onlineSales: summary.onlineSales,
    cashCounted: params.cashCounted,
    cashSettled: params.cashSettled,
    difference,
    settledBy: params.settledBy,
    settledAt: now,
    notes: params.notes,
  };

  await recordAuditLog(
    params.settledBy,
    "RECORD_SETTLEMENT",
    "SETTLEMENT",
    id,
    `Recorded settlement for ${params.date}. Cash Counted: ₹${params.cashCounted}, Diff: ₹${difference}`
  );

  return settlement;
}

export async function getAllSettlements(): Promise<Settlement[]> {
  const { data, error } = await supabaseAdmin
    .from("settlements")
    .select("*")
    .order("settled_at", { ascending: false });

  if (error) {
    console.error("Error fetching settlements from Supabase:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    date: row.date,
    totalOrders: Number(row.total_orders || 0),
    totalSales: Number(row.total_sales || 0),
    cashSales: Number(row.cash_sales || 0),
    onlineSales: Number(row.online_sales || 0),
    cashCounted: Number(row.cash_counted || 0),
    cashSettled: Number(row.cash_settled || 0),
    difference: Number(row.difference || 0),
    notes: row.notes || undefined,
    settledBy: row.settled_by,
    settledAt: row.settled_at,
  }));
}

// ----------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------

export async function recordAuditLog(
  adminUser: string,
  action: string,
  entityType: "ORDER" | "PAYMENT" | "INVOICE" | "MENU_ITEM" | "SETTLEMENT" | "CONFIG",
  entityId: string,
  details: string,
  previousValue?: any,
  newValue?: any
): Promise<AuditLog> {
  const now = new Date().toISOString();
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const row: Database["public"]["Tables"]["audit_logs"]["Insert"] = {
    id,
    admin_user: adminUser,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    previous_value: previousValue ?? null,
    new_value: newValue ?? null,
    timestamp: now,
  };

  try {
    await supabaseAdmin.from("audit_logs").insert(row);
  } catch (e) {
    console.error("Audit log background insert error:", e);
  }

  return {
    id,
    adminUser,
    action,
    entityType,
    entityId,
    details,
    previousValue,
    newValue,
    timestamp: now,
  };
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching audit logs from Supabase:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    adminUser: row.admin_user,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details,
    previousValue: row.previous_value,
    newValue: row.new_value,
    timestamp: row.timestamp,
  }));
}

// ----------------------------------------------------
// AUTHENTICATION & ROLE VERIFICATION
// ----------------------------------------------------

export async function verifyAdminCredentials(params: {
  username?: string;
  password?: string;
  pin?: string;
}): Promise<{ success: boolean; role?: AdminRole; user?: string }> {
  const config = await getConfig();

  // 1. PIN-based login
  if (params.pin) {
    const pin = params.pin.trim();
    const adminPin = config.adminPin || "1234";
    const cashierPin = config.cashierPin || "5678";
    const kitchenPin = config.kitchenPin || "1234";

    if (pin === adminPin) {
      return { success: true, role: "ADMIN", user: "Admin Manager" };
    }
    if (pin === cashierPin) {
      return { success: true, role: "CASHIER", user: "Cashier Desk" };
    }
    if (pin === kitchenPin) {
      return { success: true, role: "KITCHEN", user: "Kitchen Chef" };
    }
    return { success: false };
  }

  // 2. Username & Password login
  if (params.username && params.password) {
    const username = params.username.trim().toLowerCase();
    const adminUsername = (config.adminUsername || "admin").toLowerCase();
    const inputHash = crypto.createHash("sha256").update(params.password.trim()).digest("hex");
    const defaultHash = crypto.createHash("sha256").update("spiral2026").digest("hex");
    const targetHash = config.adminPasswordHash || defaultHash;

    if (username === adminUsername && inputHash === targetHash) {
      return { success: true, role: "ADMIN", user: "Administrator" };
    }
  }

  return { success: false };
}
