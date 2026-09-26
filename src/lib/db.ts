import { EventEmitter } from "events";
import fs from "fs";
import path from "path";

export type OrderStatus = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PENDING_CASH" | "PAID";
export type PaymentMethod = "UNSELECTED" | "CASH" | "ONLINE";

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  image: string;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  tableNumber: string;
  customerSessionId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  packagingFee: number;
  serviceCharge: number;
  grandTotal: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  preparingAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface CafeConfig {
  taxPercentage: number;
  packagingFee: number;
  serviceCharge: number;
  kitchenPin: string;
  cafeName: string;
  currencySymbol: string;
}

// Global Event Emitter for Real-Time SSE
declare global {
  // eslint-disable-next-line no-var
  var __spiralOrderEvents: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __spiralDbCache: { orders: Order[]; config: CafeConfig } | undefined;
}

export const orderEvents: EventEmitter = global.__spiralOrderEvents || new EventEmitter();
if (!global.__spiralOrderEvents) {
  orderEvents.setMaxListeners(200);
  global.__spiralOrderEvents = orderEvents;
}

const DB_DIR = path.join(process.cwd(), "src", "data");
const DB_FILE = path.join(DB_DIR, "db.json");

const DEFAULT_CONFIG: CafeConfig = {
  taxPercentage: 5, // 5% GST
  packagingFee: 0,  // Free for dine-in
  serviceCharge: 0,
  kitchenPin: "1234",
  cafeName: "Spiral Cafe",
  currencySymbol: "₹",
};

// Initialize in-memory cache
function loadDatabase(): { orders: Order[]; config: CafeConfig } {
  if (global.__spiralDbCache) {
    return global.__spiralDbCache;
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      global.__spiralDbCache = {
        orders: parsed.orders || [],
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
      };
      return global.__spiralDbCache;
    }
  } catch (err) {
    console.error("Error reading database file, using fallback:", err);
  }

  const initial = { orders: [], config: DEFAULT_CONFIG };
  saveDatabase(initial);
  global.__spiralDbCache = initial;
  return initial;
}

function saveDatabase(data: { orders: Order[]; config: CafeConfig }) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempFile, DB_FILE);
    global.__spiralDbCache = data;
  } catch (err) {
    console.error("Error writing database file:", err);
    global.__spiralDbCache = data;
  }
}

// Generate unique human-readable order number (e.g. ORD-553797)
export function generateOrderNumber(): string {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `ORD-${randomDigits}`;
}

export function getConfig(): CafeConfig {
  const db = loadDatabase();
  return db.config;
}

export function getAllOrders(): Order[] {
  const db = loadDatabase();
  return [...db.orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getOrderById(idOrNumber: string): Order | undefined {
  const db = loadDatabase();
  return db.orders.find(
    (o) => o.id === idOrNumber || o.orderNumber.toUpperCase() === idOrNumber.toUpperCase()
  );
}

export function getSessionOrders(customerSessionId: string): Order[] {
  const db = loadDatabase();
  return db.orders
    .filter((o) => o.customerSessionId === customerSessionId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getActiveKitchenOrders(): {
  pending: Order[];
  preparing: Order[];
  ready: Order[];
  recentCompleted: Order[];
} {
  const db = loadDatabase();
  const sorted = [...db.orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return {
    pending: sorted.filter((o) => o.status === "PENDING"),
    preparing: sorted.filter((o) => o.status === "PREPARING"),
    ready: sorted.filter((o) => o.status === "READY"),
    recentCompleted: [...db.orders]
      .filter((o) => o.status === "COMPLETED")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 15),
  };
}

export function createOrder(params: {
  tableNumber: string;
  customerSessionId: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    notes?: string;
  }>;
  notes?: string;
}): Order {
  const db = loadDatabase();
  const now = new Date().toISOString();

  if (!params.items || params.items.length === 0) {
    throw new Error("Order must contain at least one item.");
  }

  // Calculate order pricing
  const orderItems: OrderItem[] = params.items.map((item, index) => {
    const qty = Math.max(1, Math.floor(item.quantity));
    const lineTotal = item.price * qty;
    return {
      id: `item-${Date.now()}-${index}`,
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: qty,
      lineTotal,
      image: item.image,
      notes: item.notes,
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = Math.round((subtotal * db.config.taxPercentage) / 100);
  const packagingFee = db.config.packagingFee;
  const serviceCharge = db.config.serviceCharge;
  const grandTotal = subtotal + tax + packagingFee + serviceCharge;

  // Format table identifier (e.g. "Table 08" or clean text)
  let cleanTable = params.tableNumber.trim();
  if (/^\d+$/.test(cleanTable)) {
    cleanTable = `Table ${cleanTable.padStart(2, "0")}`;
  } else if (!cleanTable.toLowerCase().startsWith("table")) {
    cleanTable = `Table ${cleanTable}`;
  }

  const newOrder: Order = {
    id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    orderNumber: generateOrderNumber(),
    tableNumber: cleanTable,
    customerSessionId: params.customerSessionId,
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

  db.orders.push(newOrder);
  saveDatabase(db);

  // Broadcast real-time event to SSE listeners
  orderEvents.emit("order_created", newOrder);
  orderEvents.emit("orders_changed", { type: "create", order: newOrder });

  return newOrder;
}

// Server-side State Machine transition validation
export function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  actor: "kitchen" | "admin" | "system"
): Order {
  const db = loadDatabase();
  const orderIndex = db.orders.findIndex(
    (o) => o.id === orderId || o.orderNumber.toUpperCase() === orderId.toUpperCase()
  );

  if (orderIndex === -1) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const order = db.orders[orderIndex];
  const currentStatus = order.status;
  const now = new Date().toISOString();

  // Validate state transitions
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  if (!validTransitions[currentStatus].includes(newStatus)) {
    throw new Error(
      `Invalid transition: cannot transition order from ${currentStatus} to ${newStatus}.`
    );
  }

  // Update timestamps according to status
  order.status = newStatus;
  order.updatedAt = now;

  if (newStatus === "PREPARING") {
    order.preparingAt = now;
  } else if (newStatus === "READY") {
    order.readyAt = now;
  } else if (newStatus === "COMPLETED") {
    order.completedAt = now;
  } else if (newStatus === "CANCELLED") {
    order.cancelledAt = now;
  }

  db.orders[orderIndex] = order;
  saveDatabase(db);

  // Emit real-time event
  orderEvents.emit("order_updated", order);
  orderEvents.emit("orders_changed", { type: "update", order });

  return order;
}

// Update payment details
export function updateOrderPayment(
  orderId: string,
  paymentMethod: PaymentMethod,
  paymentStatus: PaymentStatus,
  autoCompleteIfPaid: boolean = false
): Order {
  const db = loadDatabase();
  const orderIndex = db.orders.findIndex(
    (o) => o.id === orderId || o.orderNumber.toUpperCase() === orderId.toUpperCase()
  );

  if (orderIndex === -1) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const order = db.orders[orderIndex];
  const now = new Date().toISOString();

  order.paymentMethod = paymentMethod;
  order.paymentStatus = paymentStatus;
  order.updatedAt = now;

  if (paymentStatus === "PAID" && (autoCompleteIfPaid || order.status === "READY")) {
    order.status = "COMPLETED";
    order.completedAt = now;
  }

  db.orders[orderIndex] = order;
  saveDatabase(db);

  orderEvents.emit("order_updated", order);
  orderEvents.emit("payment_updated", order);
  orderEvents.emit("orders_changed", { type: "payment", order });

  return order;
}
