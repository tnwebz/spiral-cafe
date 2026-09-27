import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { menuData } from "@/data/menu";

export type OrderStatus = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PENDING_CASH" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentMethod = "UNSELECTED" | "CASH" | "ONLINE";
export type AdminRole = "ADMIN" | "KITCHEN" | "CASHIER";

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
  customerId?: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  packagingFee: number;
  serviceCharge: number;
  grandTotal: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentTxnId?: string;
  paymentProvider?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  preparingAt?: string;
  readyAt?: string;
  paidAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface Customer {
  id: string;
  phoneNumber: string;
  name?: string;
  serviceSmsConsent: boolean;
  marketingConsent: boolean;
  totalOrders: number;
  totalSpent: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSession {
  id: string;
  customerId?: string;
  customerPhone?: string;
  tableNumber: string;
  sessionToken: string;
  startedAt: string;
  lastActiveAt: string;
}

export interface InvoiceItemSnapshot {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-000001
  orderId: string;
  orderNumber: string;
  tableNumber: string;
  customerId?: string;
  customerPhone?: string;
  items: InvoiceItemSnapshot[];
  subtotal: number;
  tax: number;
  packagingFee: number;
  serviceCharge: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  createdAt: string;
  secureToken: string; // Signed access token for public customer view
  smsSent: boolean;
  smsSentAt?: string;
}

export interface Settlement {
  id: string;
  date: string; // YYYY-MM-DD
  totalOrders: number;
  totalSales: number;
  cashSales: number;
  onlineSales: number;
  cashCounted: number;
  cashSettled: number;
  difference: number;
  settledBy: string;
  settledAt: string;
  notes?: string;
}

export interface DynamicMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  categoryId: string;
  categoryName: string;
  dietType: "veg" | "non-veg" | "egg" | "other";
  badge: "none" | "bestseller" | "chef-choice" | "new" | "spicy" | "popular";
  rating: number;
  reviewsCount: number;
  image: string;
  cloudinaryPublicId?: string;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  adminUser: string;
  action: string;
  entityType: "ORDER" | "PAYMENT" | "INVOICE" | "MENU_ITEM" | "SETTLEMENT" | "CONFIG";
  entityId: string;
  details: string;
  previousValue?: any;
  newValue?: any;
  timestamp: string;
}

export interface CafeConfig {
  taxPercentage: number;
  packagingFee: number;
  serviceCharge: number;
  kitchenPin: string;
  cashierPin: string;
  adminPin: string;
  adminUsername: string;
  adminPasswordHash: string; // SHA-256
  cafeName: string;
  cafeAddress: string;
  cafePhone: string;
  gstNumber: string;
  currencySymbol: string;
}

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

// Global Event Emitter for Real-Time SSE
declare global {
  // eslint-disable-next-line no-var
  var __spiralOrderEvents: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __spiralDbCache: DatabaseSchema | undefined;
}

export const orderEvents: EventEmitter = global.__spiralOrderEvents || new EventEmitter();
if (!global.__spiralOrderEvents) {
  orderEvents.setMaxListeners(200);
  global.__spiralOrderEvents = orderEvents;
}

const DB_DIR = path.join(process.cwd(), "src", "data");
const DB_FILE = path.join(DB_DIR, "db.json");

const DEFAULT_CONFIG: CafeConfig = {
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

/**
 * Extract initial seed dynamic items from menuData
 */
function getInitialMenuItems(): DynamicMenuItem[] {
  const items: DynamicMenuItem[] = [];
  const now = new Date().toISOString();

  menuData.forEach((cat) => {
    cat.items.forEach((it) => {
      let dietType: "veg" | "non-veg" | "egg" | "other" = "non-veg";
      if (it.badges?.includes("veg")) dietType = "veg";

      let badge: "none" | "bestseller" | "chef-choice" | "new" | "spicy" | "popular" = "none";
      if (it.badges?.includes("bestseller")) badge = "bestseller";
      else if (it.badges?.includes("chef-choice")) badge = "chef-choice";
      else if (it.badges?.includes("new")) badge = "new";
      else if (it.badges?.includes("spicy")) badge = "spicy";

      items.push({
        id: it.id,
        name: it.name,
        description: it.description || "",
        price: it.price,
        originalPrice: it.originalPrice,
        categoryId: cat.id,
        categoryName: cat.name,
        dietType,
        badge,
        rating: it.rating || 4.8,
        reviewsCount: it.reviewsCount || 250,
        image: it.image,
        available: true,
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  return items;
}

// Initialize in-memory cache and load from file
function loadDatabase(): DatabaseSchema {
  if (global.__spiralDbCache) {
    if (!Array.isArray(global.__spiralDbCache.auditLogs)) global.__spiralDbCache.auditLogs = [];
    if (!Array.isArray(global.__spiralDbCache.customers)) global.__spiralDbCache.customers = [];
    if (!Array.isArray(global.__spiralDbCache.customerSessions)) global.__spiralDbCache.customerSessions = [];
    if (!Array.isArray(global.__spiralDbCache.invoices)) global.__spiralDbCache.invoices = [];
    if (!Array.isArray(global.__spiralDbCache.settlements)) global.__spiralDbCache.settlements = [];
    if (!Array.isArray(global.__spiralDbCache.orders)) global.__spiralDbCache.orders = [];
    if (!Array.isArray(global.__spiralDbCache.menuItems) || global.__spiralDbCache.menuItems.length === 0) {
      global.__spiralDbCache.menuItems = getInitialMenuItems();
    }
    return global.__spiralDbCache;
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);

      const db: DatabaseSchema = {
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
        customers: Array.isArray(parsed.customers) ? parsed.customers : [],
        customerSessions: Array.isArray(parsed.customerSessions) ? parsed.customerSessions : [],
        invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
        settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
        menuItems: Array.isArray(parsed.menuItems) && parsed.menuItems.length > 0 ? parsed.menuItems : getInitialMenuItems(),
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      };

      global.__spiralDbCache = db;
      return db;
    }
  } catch (err) {
    console.error("Error reading database file, using fallback:", err);
  }

  const initial: DatabaseSchema = {
    orders: [],
    config: DEFAULT_CONFIG,
    customers: [],
    customerSessions: [],
    invoices: [],
    settlements: [],
    menuItems: getInitialMenuItems(),
    auditLogs: [],
  };

  saveDatabase(initial);
  global.__spiralDbCache = initial;
  return initial;
}

function saveDatabase(data: DatabaseSchema) {
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

// Generate unique sequential collision-safe invoice number (e.g. INV-2026-000042)
export function generateInvoiceNumber(db: DatabaseSchema): string {
  const year = new Date().getFullYear();
  const count = (db.invoices?.length || 0) + 1;
  const seq = String(count).padStart(6, "0");
  return `INV-${year}-${seq}`;
}

export function getConfig(): CafeConfig {
  const db = loadDatabase();
  return db.config;
}

export function updateConfig(updates: Partial<CafeConfig>, adminUser = "admin"): CafeConfig {
  const db = loadDatabase();
  db.config = { ...db.config, ...updates };
  saveDatabase(db);
  recordAuditLog(adminUser, "UPDATE_CONFIG", "CONFIG", "global", JSON.stringify(updates));
  orderEvents.emit("config_updated", db.config);
  return db.config;
}

// ----------------------------------------------------
// ORDER OPERATIONS
// ----------------------------------------------------

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
      .slice(0, 20),
  };
}

export function createOrder(params: {
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

  db.orders.push(newOrder);

  // Update customer totals if customerId is present
  if (params.customerPhone) {
    saveCustomer({
      phoneNumber: params.customerPhone,
      serviceSmsConsent: true,
      marketingConsent: false,
    });
  }

  saveDatabase(db);

  // Broadcast real-time events to SSE listeners
  orderEvents.emit("order_created", newOrder);
  orderEvents.emit("orders_changed", { type: "create", order: newOrder });

  return newOrder;
}

export function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  actor: "kitchen" | "admin" | "system",
  actorName = "staff"
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

  recordAuditLog(actorName, "STATUS_CHANGE", "ORDER", order.id, `Status changed from ${currentStatus} to ${newStatus}`);

  orderEvents.emit("order_updated", order);
  orderEvents.emit("orders_changed", { type: "update", order });

  return order;
}

export function updateOrderPayment(
  orderId: string,
  paymentMethod: PaymentMethod,
  paymentStatus: PaymentStatus,
  autoCompleteIfPaid: boolean = false,
  adminUser?: string,
  paymentTxnId?: string,
  paymentProvider?: string
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

  if (paymentTxnId) order.paymentTxnId = paymentTxnId;
  if (paymentProvider) order.paymentProvider = paymentProvider;

  if (paymentStatus === "PAID") {
    order.paidAt = now;
    if (autoCompleteIfPaid || order.status === "READY") {
      order.status = "COMPLETED";
      order.completedAt = now;
    }
  }

  db.orders[orderIndex] = order;
  saveDatabase(db);

  if (adminUser) {
    recordAuditLog(adminUser, "PAYMENT_UPDATE", "PAYMENT", order.id, `Payment status set to ${paymentStatus} via ${paymentMethod}`);
  }

  orderEvents.emit("order_updated", order);
  orderEvents.emit("payment_updated", order);
  orderEvents.emit("orders_changed", { type: "payment", order });

  return order;
}

// ----------------------------------------------------
// INVOICE OPERATIONS
// ----------------------------------------------------

export function createInvoice(orderId: string, adminUser = "admin"): Invoice {
  const db = loadDatabase();
  const order = db.orders.find(
    (o) => o.id === orderId || o.orderNumber.toUpperCase() === orderId.toUpperCase()
  );

  if (!order) {
    throw new Error(`Order ${orderId} not found.`);
  }

  if (order.paymentStatus !== "PAID") {
    throw new Error("Invoice can only be generated after payment is confirmed as PAID.");
  }

  // If invoice already exists for this order, return existing
  const existing = db.invoices.find((inv) => inv.orderId === order.id);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const invoiceNumber = generateInvoiceNumber(db);
  const secureToken = crypto.randomBytes(16).toString("hex");

  const newInvoice: Invoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    invoiceNumber,
    orderId: order.id,
    orderNumber: order.orderNumber,
    tableNumber: order.tableNumber,
    customerId: order.customerId,
    customerPhone: order.customerPhone,
    items: order.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.price,
      lineTotal: it.lineTotal,
    })),
    subtotal: order.subtotal,
    tax: order.tax,
    packagingFee: order.packagingFee,
    serviceCharge: order.serviceCharge,
    grandTotal: order.grandTotal,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paidAt: order.paidAt || now,
    createdAt: now,
    secureToken,
    smsSent: false,
  };

  db.invoices.push(newInvoice);

  // Link invoice back to order
  order.invoiceId = newInvoice.id;
  order.invoiceNumber = newInvoice.invoiceNumber;
  order.updatedAt = now;

  saveDatabase(db);

  recordAuditLog(adminUser, "GENERATE_INVOICE", "INVOICE", newInvoice.id, `Generated invoice ${invoiceNumber} for order ${order.orderNumber}`);

  orderEvents.emit("invoice_created", newInvoice);
  return newInvoice;
}

export function getAllInvoices(): Invoice[] {
  const db = loadDatabase();
  return [...db.invoices].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getInvoiceById(idOrNumber: string): Invoice | undefined {
  const db = loadDatabase();
  return db.invoices.find(
    (inv) =>
      inv.id === idOrNumber ||
      inv.invoiceNumber.toUpperCase() === idOrNumber.toUpperCase() ||
      inv.orderId === idOrNumber
  );
}

export function getInvoiceBySecureToken(token: string): Invoice | undefined {
  const db = loadDatabase();
  return db.invoices.find((inv) => inv.secureToken === token);
}

export function markInvoiceSmsSent(invoiceId: string, adminUser = "admin"): Invoice {
  const db = loadDatabase();
  const invoice = db.invoices.find((inv) => inv.id === invoiceId);
  if (!invoice) throw new Error("Invoice not found.");

  invoice.smsSent = true;
  invoice.smsSentAt = new Date().toISOString();
  saveDatabase(db);

  recordAuditLog(adminUser, "SEND_SMS", "INVOICE", invoice.id, `Dispatched invoice SMS to ${invoice.customerPhone || "customer"}`);
  return invoice;
}

// ----------------------------------------------------
// CUSTOMER & SESSION OPERATIONS
// ----------------------------------------------------

export function saveCustomer(params: {
  phoneNumber: string;
  name?: string;
  serviceSmsConsent?: boolean;
  marketingConsent?: boolean;
}): Customer {
  const db = loadDatabase();
  const cleanPhone = params.phoneNumber.replace(/\D/g, "");
  const now = new Date().toISOString();

  let customer = db.customers.find((c) => c.phoneNumber === cleanPhone);

  if (customer) {
    if (params.name) customer.name = params.name;
    if (params.serviceSmsConsent !== undefined) customer.serviceSmsConsent = params.serviceSmsConsent;
    if (params.marketingConsent !== undefined) customer.marketingConsent = params.marketingConsent;
    customer.lastSeenAt = now;
    customer.updatedAt = now;
  } else {
    customer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      phoneNumber: cleanPhone,
      name: params.name,
      serviceSmsConsent: params.serviceSmsConsent ?? true,
      marketingConsent: params.marketingConsent ?? false,
      totalOrders: 0,
      totalSpent: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };
    db.customers.push(customer);
  }

  // Recalculate customer metrics from existing orders
  const customerOrders = db.orders.filter(
    (o) => o.customerPhone === cleanPhone || o.customerId === customer?.id
  );
  customer.totalOrders = customerOrders.length;
  customer.totalSpent = customerOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  saveDatabase(db);
  return customer;
}

export function getAllCustomers(): Customer[] {
  const db = loadDatabase();
  return [...db.customers].sort(
    (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
  );
}

export function saveCustomerSession(params: {
  sessionId: string;
  phoneNumber?: string;
  tableNumber: string;
}): CustomerSession {
  const db = loadDatabase();
  const now = new Date().toISOString();

  let session = db.customerSessions.find((s) => s.id === params.sessionId);
  if (session) {
    session.tableNumber = params.tableNumber;
    session.customerPhone = params.phoneNumber || session.customerPhone;
    session.lastActiveAt = now;
  } else {
    session = {
      id: params.sessionId,
      customerPhone: params.phoneNumber,
      tableNumber: params.tableNumber,
      sessionToken: crypto.randomBytes(16).toString("hex"),
      startedAt: now,
      lastActiveAt: now,
    };
    db.customerSessions.push(session);
  }

  saveDatabase(db);
  return session;
}

// ----------------------------------------------------
// DYNAMIC MENU MANAGEMENT
// ----------------------------------------------------

export function getAllMenuItems(): DynamicMenuItem[] {
  const db = loadDatabase();
  return [...db.menuItems].sort((a, b) => a.name.localeCompare(b.name));
}

export function getMenuItemById(id: string): DynamicMenuItem | undefined {
  const db = loadDatabase();
  return db.menuItems.find((item) => item.id === id);
}

export function createMenuItem(item: Omit<DynamicMenuItem, "id" | "createdAt" | "updatedAt">, adminUser = "admin"): DynamicMenuItem {
  const db = loadDatabase();
  const now = new Date().toISOString();
  const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newItem: DynamicMenuItem = {
    ...item,
    id,
    createdAt: now,
    updatedAt: now,
  };

  db.menuItems.push(newItem);
  saveDatabase(db);

  recordAuditLog(adminUser, "CREATE_MENU_ITEM", "MENU_ITEM", newItem.id, `Created product: ${newItem.name} (₹${newItem.price})`);
  orderEvents.emit("menu_updated", db.menuItems);
  return newItem;
}

export function updateMenuItem(id: string, updates: Partial<DynamicMenuItem>, adminUser = "admin"): DynamicMenuItem {
  const db = loadDatabase();
  const index = db.menuItems.findIndex((it) => it.id === id);
  if (index === -1) throw new Error(`Menu item not found: ${id}`);

  const existing = db.menuItems[index];
  const updated: DynamicMenuItem = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  db.menuItems[index] = updated;
  saveDatabase(db);

  recordAuditLog(adminUser, "UPDATE_MENU_ITEM", "MENU_ITEM", id, `Updated product: ${updated.name}`);
  orderEvents.emit("menu_updated", db.menuItems);
  return updated;
}

export function deleteMenuItem(id: string, adminUser = "admin"): boolean {
  const db = loadDatabase();
  const index = db.menuItems.findIndex((it) => it.id === id);
  if (index === -1) return false;

  const item = db.menuItems[index];
  db.menuItems.splice(index, 1);
  saveDatabase(db);

  recordAuditLog(adminUser, "DELETE_MENU_ITEM", "MENU_ITEM", id, `Deleted product: ${item.name}`);
  orderEvents.emit("menu_updated", db.menuItems);
  return true;
}

export function toggleMenuItemAvailability(id: string, adminUser = "admin"): DynamicMenuItem {
  const db = loadDatabase();
  const item = db.menuItems.find((it) => it.id === id);
  if (!item) throw new Error("Menu item not found.");

  item.available = !item.available;
  item.updatedAt = new Date().toISOString();
  saveDatabase(db);

  recordAuditLog(adminUser, "TOGGLE_AVAILABILITY", "MENU_ITEM", id, `Marked ${item.name} as ${item.available ? "AVAILABLE" : "SOLD OUT"}`);
  orderEvents.emit("menu_updated", db.menuItems);
  return item;
}

// ----------------------------------------------------
// SETTLEMENT & REVENUE OPERATIONS
// ----------------------------------------------------

export function getSettlementSummary(dateStr?: string): {
  date: string;
  totalOrders: number;
  totalSales: number;
  cashSales: number;
  onlineSales: number;
  unpaidTotal: number;
  paidOrdersCount: number;
  unpaidOrdersCount: number;
  orders: Order[];
} {
  const db = loadDatabase();
  const targetDate = dateStr || new Date().toISOString().split("T")[0];

  const dayOrders = db.orders.filter((o) => o.createdAt.startsWith(targetDate));

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

export function recordSettlement(params: {
  date: string;
  cashCounted: number;
  cashSettled: number;
  notes?: string;
  settledBy: string;
}): Settlement {
  const db = loadDatabase();
  const summary = getSettlementSummary(params.date);
  const difference = params.cashCounted - summary.cashSales;
  const now = new Date().toISOString();

  const newSettlement: Settlement = {
    id: `stl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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

  db.settlements.push(newSettlement);
  saveDatabase(db);

  recordAuditLog(params.settledBy, "RECORD_SETTLEMENT", "SETTLEMENT", newSettlement.id, `Recorded settlement for ${params.date}. Cash Counted: ₹${params.cashCounted}, Diff: ₹${difference}`);

  return newSettlement;
}

export function getAllSettlements(): Settlement[] {
  const db = loadDatabase();
  return [...db.settlements].sort(
    (a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime()
  );
}

// ----------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------

export function recordAuditLog(
  adminUser: string,
  action: string,
  entityType: "ORDER" | "PAYMENT" | "INVOICE" | "MENU_ITEM" | "SETTLEMENT" | "CONFIG",
  entityId: string,
  details: string,
  previousValue?: any,
  newValue?: any
): AuditLog {
  const db = loadDatabase();
  const newLog: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    adminUser,
    action,
    entityType,
    entityId,
    details,
    previousValue,
    newValue,
    timestamp: new Date().toISOString(),
  };

  if (!Array.isArray(db.auditLogs)) {
    db.auditLogs = [];
  }

  db.auditLogs.unshift(newLog);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }

  saveDatabase(db);
  return newLog;
}

export function getAuditLogs(limit = 100): AuditLog[] {
  const db = loadDatabase();
  return db.auditLogs.slice(0, limit);
}

// ----------------------------------------------------
// AUTHENTICATION & ROLE VERIFICATION
// ----------------------------------------------------

export function verifyAdminCredentials(params: {
  username?: string;
  password?: string;
  pin?: string;
}): { success: boolean; role?: AdminRole; user?: string } {
  const db = loadDatabase();
  const config = { ...DEFAULT_CONFIG, ...(db.config || {}) };

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
