import fs from "fs";
import path from "path";
import { supabaseAdmin } from "./supabase/admin";
import { Order, getActiveOrderForTable, getAllOrders, mapDbOrderToOrder } from "./db";

export type TableColor = "WHITE" | "BLUE" | "RED" | "YELLOW" | "GREEN";
export type TableStatusLabel =
  | "AVAILABLE"
  | "RESERVED"
  | "NEW ORDER"
  | "ACTION NEEDED"
  | "KOT SENT";
export type KotStatus =
  | "NOT_SENT"
  | "VIEWED"
  | "PRINTING"
  | "SENT_UNVERIFIED"
  | "PRINT_CONFIRMED"
  | "FAILED"
  | "UNKNOWN"
  | "MANUALLY_DELIVERED";

export interface TableReservation {
  id: string;
  tableNumber: string;
  customerSessionId: string;
  customerPhone?: string;
  reservedAt: string;
  expiresAt: string;
  status: "ACTIVE" | "EXPIRED" | "CONVERTED" | "RELEASED" | "TRANSFERRED";
  visitId?: string;
  notes?: string;
}

export interface TableTransferRequest {
  id: string;
  visitId: string;
  fromTable: string;
  toTable: string;
  customerSessionId: string;
  customerPhone?: string;
  ordersCount: number;
  currentBill: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface TableDefinition {
  id: string;
  tableNumber: string;
  capacity: number;
  section: string;
  createdAt: string;
}

export interface TableCardStatus {
  tableNumber: string;
  capacity: number;
  section: string;
  color: TableColor;
  statusLabel: TableStatusLabel;
  activeOrder?: Order;
  activeOrderId?: string;
  orderNumber?: string;
  totalAmount?: number;
  itemsCount?: number;
  elapsedMinutes?: number;
  kotStatus?: KotStatus;
  activeRound?: number;
  isAddonPending?: boolean;
  reservation?: {
    id: string;
    customerSessionId: string;
    customerPhone?: string;
    reservedAt: string;
    expiresAt: string;
    remainingSeconds: number;
    isMyReservation?: boolean;
  };
  visitId?: string;
  isMyActiveTable?: boolean;
}

export interface PrinterSettings {
  printerModel: string;
  interfaceType: "ETHERNET" | "WIFI" | "USB" | "BLUETOOTH";
  ipAddress: string;
  port: number;
  paperWidthMm: number;
  qzPrinterName: string;
  terminalName: string;
  autoCut: boolean;
  lastCheckedAt?: string | null;
  status?: "READY" | "OFFLINE" | "WARNING";
}

const DEFAULT_TABLES: TableDefinition[] = [
  { id: "A1", tableNumber: "A1", capacity: 4, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "A2", tableNumber: "A2", capacity: 4, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "B1", tableNumber: "B1", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "B2", tableNumber: "B2", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "B3", tableNumber: "B3", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "B4", tableNumber: "B4", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "B5", tableNumber: "B5", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "B6", tableNumber: "B6", capacity: 2, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "C1", tableNumber: "C1", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "C2", tableNumber: "C2", capacity: 4, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "C3", tableNumber: "C3", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "F1", tableNumber: "F1", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "F2", tableNumber: "F2", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "F3", tableNumber: "F3", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
  { id: "F4", tableNumber: "F4", capacity: 3, section: "Dine-In", createdAt: "2026-11-03T00:00:00.000Z" },
];

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  printerModel: "CN811-UEWB",
  interfaceType: "ETHERNET",
  ipAddress: "192.168.1.233",
  port: 9100,
  paperWidthMm: 80,
  qzPrinterName: "CN811-UEWB",
  terminalName: "Billing 1",
  autoCut: true,
  lastCheckedAt: null,
  status: "READY",
};

function getConfigFilePath(): string {
  return path.resolve(process.cwd(), "src/data/tables_config.json");
}

function readLocalConfigFile(): { tables: TableDefinition[]; printerSettings: PrinterSettings } {
  try {
    const file = getConfigFilePath();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
      return {
        tables: Array.isArray(parsed.tables) && parsed.tables.length > 0 ? parsed.tables : DEFAULT_TABLES,
        printerSettings: parsed.printerSettings || DEFAULT_PRINTER_SETTINGS,
      };
    }
  } catch (err) {
    console.warn("Failed to read tables_config.json, using defaults:", err);
  }
  return { tables: DEFAULT_TABLES, printerSettings: DEFAULT_PRINTER_SETTINGS };
}

function writeLocalConfigFile(data: { tables: TableDefinition[]; printerSettings: PrinterSettings }) {
  try {
    const file = getConfigFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to write tables_config.json:", err);
  }
}

export const RESERVATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function getReservationsFilePath(): string {
  return path.resolve(process.cwd(), "src/data/reservations.json");
}

function readLocalReservations(): TableReservation[] {
  try {
    const file = getReservationsFilePath();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Failed to read reservations.json:", err);
  }
  return [];
}

function writeLocalReservations(reservations: TableReservation[]) {
  try {
    const file = getReservationsFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(reservations, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to write reservations.json:", err);
  }
}

/**
 * Fetch all active reservations (filters out expired and non-active)
 */
export async function getActiveReservations(): Promise<TableReservation[]> {
  const now = new Date();

  // 1. Try Supabase
  try {
    const { data, error } = await supabaseAdmin
      .from("table_reservations" as any)
      .select("*")
      .eq("status", "ACTIVE")
      .gt("expires_at", now.toISOString());

    if (!error && Array.isArray(data)) {
      const activeFromDb: TableReservation[] = data.map((r: any) => ({
        id: r.id,
        tableNumber: normalizeTableLabel(r.table_number),
        customerSessionId: r.customer_session_id,
        customerPhone: r.customer_phone,
        reservedAt: r.reserved_at,
        expiresAt: r.expires_at,
        status: r.status,
        visitId: r.visit_id,
        notes: r.notes,
      }));

      // Cache to local file
      writeLocalReservations(activeFromDb);
      return activeFromDb;
    }
  } catch {}

  // 2. Fallback to local file with expiration filter
  const local = readLocalReservations();
  const activeLocal = local.filter((r) => {
    return r.status === "ACTIVE" && new Date(r.expiresAt).getTime() > now.getTime();
  });
  return activeLocal;
}

/**
 * Release all previous active reservations for a customer session
 */
export async function releaseSessionReservations(
  customerSessionId: string,
  excludeTable?: string
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("table_reservations" as any)
      .update({ status: "RELEASED", updated_at: new Date().toISOString() })
      .eq("customer_session_id", customerSessionId)
      .eq("status", "ACTIVE");

    if (excludeTable) {
      query = query.neq("table_number", excludeTable);
    }
    await query;
  } catch {}

  const local = readLocalReservations().map((r) => {
    if (
      r.customerSessionId === customerSessionId &&
      r.status === "ACTIVE" &&
      (!excludeTable || r.tableNumber !== excludeTable)
    ) {
      return { ...r, status: "RELEASED" as const };
    }
    return r;
  });
  writeLocalReservations(local);
}

/**
 * Single Active Visit Enforcement: Checks if the customer currently has an active dining visit
 * or active reservation across all tables.
 */
export async function getActiveCustomerVisit(
  sessionId: string,
  phone?: string
): Promise<{
  hasActiveVisit: boolean;
  type: "DINING" | "RESERVATION" | "NONE";
  tableNumber: string | null;
  visitId: string | null;
  grandTotal: number;
  orders: Order[];
  reservation?: TableReservation | null;
}> {
  let activeOrders: Order[] = [];

  try {
    let query = supabaseAdmin
      .from("orders" as any)
      .select("*, order_items(*)")
      .neq("status", "CANCELLED")
      .neq("payment_status", "PAID");

    const cleanPhone = phone?.replace(/\D/g, "").slice(-10);

    if (cleanPhone && sessionId) {
      query = query.or(`customer_session_id.eq.${sessionId},customer_phone.eq.${cleanPhone}`);
    } else if (sessionId) {
      query = query.eq("customer_session_id", sessionId);
    } else if (cleanPhone) {
      query = query.eq("customer_phone", cleanPhone);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && Array.isArray(data) && data.length > 0) {
      activeOrders = data
        .map((row: any) => mapDbOrderToOrder(row))
        .filter(
          (o) =>
            o.orderType !== "PRIVATE" &&
            o.tableNumber !== "GIVE ON COUNTER" &&
            o.tableNumber !== "COUNTER" &&
            !(o.notes || "").includes("[ORDER_TYPE:PRIVATE]")
        );
    }
  } catch (err) {
    console.warn("getActiveCustomerVisit order lookup warning:", err);
  }

  // 1. If customer has active dining orders
  if (activeOrders.length > 0) {
    const primary = activeOrders[0];
    const visitId =
      primary.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1] ||
      (primary as any).visit_id ||
      `VISIT-${primary.tableNumber}-${primary.id.slice(0, 8).toUpperCase()}`;

    const visitOrders = activeOrders.filter((o) => {
      const oVisit = o.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1] || (o as any).visit_id;
      return oVisit === visitId || o.tableNumber === primary.tableNumber;
    });

    const grandTotal = visitOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    return {
      hasActiveVisit: true,
      type: "DINING",
      tableNumber: primary.tableNumber,
      visitId,
      grandTotal,
      orders: visitOrders,
    };
  }

  // 2. If no active orders, check active unexpired reservation
  const activeReservations = await getActiveReservations();
  const cleanPhone = phone?.replace(/\D/g, "").slice(-10);
  const myRes = activeReservations.find(
    (r) =>
      (sessionId && r.customerSessionId === sessionId) ||
      (cleanPhone && r.customerPhone && r.customerPhone.slice(-10) === cleanPhone)
  );

  if (myRes) {
    return {
      hasActiveVisit: true,
      type: "RESERVATION",
      tableNumber: myRes.tableNumber,
      visitId: myRes.visitId || null,
      grandTotal: 0,
      orders: [],
      reservation: myRes,
    };
  }

  return {
    hasActiveVisit: false,
    type: "NONE",
    tableNumber: null,
    visitId: null,
    grandTotal: 0,
    orders: [],
  };
}

/**
 * Reserve table atomically for 10 minutes
 */
export async function reserveTable(params: {
  tableNumber: string;
  customerSessionId: string;
  customerPhone?: string;
}): Promise<TableReservation> {
  const norm = normalizeTableLabel(params.tableNumber);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESERVATION_TIMEOUT_MS).toISOString();

  // 0. Single Active Visit Enforcement: customer cannot independently occupy another table
  const activeVisit = await getActiveCustomerVisit(params.customerSessionId, params.customerPhone);
  if (
    activeVisit.hasActiveVisit &&
    activeVisit.type === "DINING" &&
    activeVisit.tableNumber &&
    activeVisit.tableNumber.toUpperCase() !== norm.toUpperCase()
  ) {
    throw new Error(
      `ALREADY_HAS_ACTIVE_VISIT:Table ${activeVisit.tableNumber}`
    );
  }

  // 1. Check if table has an active order (already dining)
  const activeOrder = await getActiveOrderForTable(norm);
  if (activeOrder) {
    throw new Error(
      `Table ${norm} is currently occupied by an active dining order. If you are seated here, please contact the counter.`
    );
  }

  // 2. Check if table has an active unexpired reservation
  const activeReservations = await getActiveReservations();
  const existingForTable = activeReservations.find(
    (r) => r.tableNumber.toUpperCase() === norm.toUpperCase()
  );

  if (existingForTable) {
    if (existingForTable.customerSessionId === params.customerSessionId) {
      // Already reserved by same customer session: refresh the 10-minute timer!
      const refreshed: TableReservation = {
        ...existingForTable,
        expiresAt,
        customerPhone: params.customerPhone || existingForTable.customerPhone,
      };

      try {
        await supabaseAdmin
          .from("table_reservations" as any)
          .update({ expires_at: expiresAt, customer_phone: refreshed.customerPhone })
          .eq("id", existingForTable.id);
      } catch {}

      const local = readLocalReservations().map((r) =>
        r.id === existingForTable.id ? refreshed : r
      );
      writeLocalReservations(local);
      return refreshed;
    } else {
      // Reserved by another customer!
      throw new Error(
        `Table ${norm} is currently reserved by another customer. If you are seated here, please contact the counter.`
      );
    }
  }

  // 3. Release any previous active reservation held by THIS customer session on another table
  await releaseSessionReservations(params.customerSessionId, norm);

  // 4. Create new reservation
  const reservation: TableReservation = {
    id: `RES-${norm}-${Date.now().toString(36).toUpperCase()}`,
    tableNumber: norm,
    customerSessionId: params.customerSessionId,
    customerPhone: params.customerPhone,
    reservedAt: now.toISOString(),
    expiresAt,
    status: "ACTIVE",
  };

  try {
    await supabaseAdmin.from("table_reservations" as any).insert({
      id: reservation.id,
      table_number: norm,
      customer_session_id: params.customerSessionId,
      customer_phone: params.customerPhone,
      reserved_at: reservation.reservedAt,
      expires_at: reservation.expiresAt,
      status: "ACTIVE",
    });
  } catch {}

  const currentLocal = readLocalReservations().filter(
    (r) => r.customerSessionId !== params.customerSessionId && r.tableNumber !== norm
  );
  writeLocalReservations([...currentLocal, reservation]);

  return reservation;
}

/**
 * Atomic reservation transfer from fromTable to toTable
 */
export async function transferReservation(params: {
  fromTable: string;
  toTable: string;
  customerSessionId: string;
  customerPhone?: string;
}): Promise<TableReservation> {
  const fromNorm = normalizeTableLabel(params.fromTable);
  const toNorm = normalizeTableLabel(params.toTable);

  if (fromNorm.toUpperCase() === toNorm.toUpperCase()) {
    // Same table: refresh reservation
    return reserveTable({
      tableNumber: toNorm,
      customerSessionId: params.customerSessionId,
      customerPhone: params.customerPhone,
    });
  }

  // 1. First ensure destination table is available
  const newReservation = await reserveTable({
    tableNumber: toNorm,
    customerSessionId: params.customerSessionId,
    customerPhone: params.customerPhone,
  });

  // 2. Mark old table reservation as TRANSFERRED
  try {
    await supabaseAdmin
      .from("table_reservations" as any)
      .update({ status: "TRANSFERRED", updated_at: new Date().toISOString() })
      .eq("table_number", fromNorm)
      .eq("customer_session_id", params.customerSessionId)
      .eq("status", "ACTIVE");
  } catch {}

  const local = readLocalReservations().map((r) => {
    if (
      r.tableNumber === fromNorm &&
      r.customerSessionId === params.customerSessionId &&
      r.status === "ACTIVE"
    ) {
      return { ...r, status: "TRANSFERRED" as const };
    }
    return r;
  });
  writeLocalReservations(local);

  return newReservation;
}

function getTransfersFilePath(): string {
  return path.resolve(process.cwd(), "src/data/table_transfers.json");
}

export function readLocalTransfers(): TableTransferRequest[] {
  try {
    const file = getTransfersFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Read local transfers warning:", err);
  }
  return [];
}

export function writeLocalTransfers(transfers: TableTransferRequest[]): void {
  try {
    const file = getTransfersFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(transfers, null, 2), "utf-8");
  } catch (err) {
    console.warn("Write local transfers warning:", err);
  }
}

export async function getPendingTransferRequests(): Promise<TableTransferRequest[]> {
  const transfers = readLocalTransfers();
  return transfers.filter((t) => t.status === "PENDING");
}

export async function getTransferRequestById(id: string): Promise<TableTransferRequest | null> {
  const transfers = readLocalTransfers();
  return transfers.find((t) => t.id === id) || null;
}

export function cancelPendingTransfersForTable(tableNumber: string): void {
  const norm = normalizeTableLabel(tableNumber);
  const local = readLocalTransfers().map((t) => {
    if (
      (t.fromTable.toUpperCase() === norm.toUpperCase() ||
        t.toTable.toUpperCase() === norm.toUpperCase()) &&
      t.status === "PENDING"
    ) {
      return { ...t, status: "CANCELLED" as const };
    }
    return t;
  });
  writeLocalTransfers(local);
}

/**
 * Customer Table Transfer:
 * If the customer only has a temporary reservation and no placed orders, transfers immediately.
 * If orders have already been placed, creates a PENDING transfer request that requires counter admin approval.
 */
export async function requestTableTransfer(params: {
  fromTable: string;
  toTable: string;
  customerSessionId: string;
  customerPhone?: string;
}): Promise<{
  success: boolean;
  isDirectTransfer: boolean;
  request?: TableTransferRequest;
  reservation?: TableReservation;
  message: string;
}> {
  const fromNorm = normalizeTableLabel(params.fromTable);
  const toNorm = normalizeTableLabel(params.toTable);

  if (fromNorm.toUpperCase() === toNorm.toUpperCase()) {
    return {
      success: true,
      isDirectTransfer: true,
      message: `You are already seated at Table ${toNorm}.`,
    };
  }

  // 1. Destination table must not be occupied by another customer's orders
  const activeOrderTo = await getActiveOrderForTable(toNorm);
  if (activeOrderTo) {
    throw new Error(
      `Table ${toNorm} is currently occupied by another customer. Please select an available table.`
    );
  }

  // 2. Destination table must not be reserved by another customer
  const activeReservations = await getActiveReservations();
  const resTo = activeReservations.find(
    (r) => r.tableNumber.toUpperCase() === toNorm.toUpperCase()
  );
  if (resTo && resTo.customerSessionId !== params.customerSessionId) {
    throw new Error(
      `Table ${toNorm} is currently reserved by another customer. Please select another available table.`
    );
  }

  // 3. Check customer's active orders at fromTable
  const activeVisit = await getActiveCustomerVisit(params.customerSessionId, params.customerPhone);
  const hasOrdersAtFromTable =
    activeVisit.hasActiveVisit &&
    activeVisit.type === "DINING" &&
    activeVisit.tableNumber?.toUpperCase() === fromNorm.toUpperCase();

  if (!hasOrdersAtFromTable) {
    // Customer has not placed any food order yet: direct reservation transfer
    const res = await transferReservation({
      fromTable: fromNorm,
      toTable: toNorm,
      customerSessionId: params.customerSessionId,
      customerPhone: params.customerPhone,
    });
    return {
      success: true,
      isDirectTransfer: true,
      reservation: res,
      message: `Table changed to ${toNorm} successfully.`,
    };
  }

  // Customer has placed orders! Must submit transfer request for Admin counter approval.
  const now = new Date().toISOString();
  const requestId = `TRF-${fromNorm}-${toNorm}-${Date.now().toString(36).toUpperCase()}`;

  const request: TableTransferRequest = {
    id: requestId,
    visitId: activeVisit.visitId || `VISIT-${fromNorm}`,
    fromTable: fromNorm,
    toTable: toNorm,
    customerSessionId: params.customerSessionId,
    customerPhone: params.customerPhone,
    ordersCount: activeVisit.orders.length,
    currentBill: activeVisit.grandTotal,
    status: "PENDING",
    requestedAt: now,
  };

  // Replace any existing PENDING request for this session
  const transfers = readLocalTransfers().filter(
    (t) => !(t.customerSessionId === params.customerSessionId && t.status === "PENDING")
  );
  transfers.unshift(request);
  writeLocalTransfers(transfers);

  // Audit log
  try {
    await supabaseAdmin.from("audit_logs" as any).insert({
      action: "TABLE_TRANSFER_REQUESTED",
      details: {
        requestId,
        fromTable: fromNorm,
        toTable: toNorm,
        visitId: request.visitId,
        ordersCount: request.ordersCount,
        currentBill: request.currentBill,
      },
      created_at: now,
    });
  } catch {}

  return {
    success: true,
    isDirectTransfer: false,
    request,
    message: `Table transfer request from Table ${fromNorm} to Table ${toNorm} submitted to counter. Please wait for staff approval.`,
  };
}

/**
 * Admin Counter Staff Approval:
 * Atomically transfers Visit ID, orders, and bill to the new table.
 * Releases old table to AVAILABLE (White).
 * Locks new table as OCCUPIED.
 * Zero duplicate food preparation: does not automatically reprint past KOTs.
 */
export async function approveTransferRequest(
  requestId: string,
  adminUser: string = "Admin Staff"
): Promise<{
  success: boolean;
  fromTable: string;
  toTable: string;
  visitId: string;
  updatedOrdersCount: number;
}> {
  const transfers = readLocalTransfers();
  const targetReq = transfers.find((t) => t.id === requestId);

  if (!targetReq) {
    throw new Error("Transfer request not found.");
  }

  if (targetReq.status !== "PENDING") {
    throw new Error(`Transfer request is already ${targetReq.status}.`);
  }

  const fromNorm = normalizeTableLabel(targetReq.fromTable);
  const toNorm = normalizeTableLabel(targetReq.toTable);

  // Verify destination table is not occupied
  const activeOrderTo = await getActiveOrderForTable(toNorm);
  if (activeOrderTo) {
    throw new Error(
      `Table ${toNorm} has since become occupied by another customer. Cannot complete transfer.`
    );
  }

  const now = new Date().toISOString();
  let updatedOrdersCount = 0;

  // 1. Atomically reassign all orders for this visit to the new table
  try {
    if (targetReq.visitId) {
      const { data: matchedOrders } = await supabaseAdmin
        .from("orders" as any)
        .select("id, notes")
        .ilike("notes", `%[VISIT_ID:${targetReq.visitId}]%`)
        .neq("status", "CANCELLED")
        .neq("payment_status", "PAID");

      if (Array.isArray(matchedOrders) && matchedOrders.length > 0) {
        for (const order of matchedOrders as any[]) {
          const transferTag = `[TABLE_TRANSFERRED:FROM_${fromNorm}_TO_${toNorm}_AT_${Date.now()}]`;
          const newNotes = `${order.notes || ""} ${transferTag}`.trim();

          await supabaseAdmin
            .from("orders" as any)
            .update({
              table_number: toNorm,
              notes: newNotes,
              updated_at: now,
            })
            .eq("id", order.id);
          updatedOrdersCount++;
        }
      }
    }

    // Fallback: update any remaining unpaid orders with fromTable and customerSessionId
    const { data: sisterOrders } = await supabaseAdmin
      .from("orders" as any)
      .select("id, notes")
      .eq("table_number", fromNorm)
      .eq("customer_session_id", targetReq.customerSessionId)
      .neq("status", "CANCELLED")
      .neq("payment_status", "PAID");

    if (Array.isArray(sisterOrders) && sisterOrders.length > 0) {
      for (const order of sisterOrders as any[]) {
        const transferTag = `[TABLE_TRANSFERRED:FROM_${fromNorm}_TO_${toNorm}_AT_${Date.now()}]`;
        const newNotes = `${order.notes || ""} ${transferTag}`.trim();

        await supabaseAdmin
          .from("orders" as any)
          .update({
            table_number: toNorm,
            notes: newNotes,
            updated_at: now,
          })
          .eq("id", order.id);
        updatedOrdersCount++;
      }
    }
  } catch (dbErr) {
    console.error("Database order table reassign error:", dbErr);
  }

  // 2. Mark old table reservation as TRANSFERRED / RELEASED
  await releaseTableReservation(fromNorm, adminUser);

  // 3. Mark destination table reservation as CONVERTED with visitId
  const toReservation: TableReservation = {
    id: `RES-${toNorm}-${Date.now().toString(36).toUpperCase()}`,
    tableNumber: toNorm,
    customerSessionId: targetReq.customerSessionId,
    customerPhone: targetReq.customerPhone,
    reservedAt: now,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    status: "CONVERTED",
    visitId: targetReq.visitId,
    notes: `Transferred from ${fromNorm} by ${adminUser}`,
  };

  const localRes = readLocalReservations().map((r) => {
    if (r.tableNumber === fromNorm && r.status === "ACTIVE") {
      return { ...r, status: "TRANSFERRED" as const };
    }
    return r;
  });
  localRes.push(toReservation);
  writeLocalReservations(localRes);

  // 4. Update customer_sessions table if present
  try {
    await supabaseAdmin
      .from("customer_sessions" as any)
      .update({ table_number: toNorm, updated_at: now })
      .eq("session_id", targetReq.customerSessionId);
  } catch {}

  // 5. Update transfer request record
  const updatedTransfers = transfers.map((t) => {
    if (t.id === requestId) {
      return {
        ...t,
        status: "APPROVED" as const,
        reviewedAt: now,
        reviewedBy: adminUser,
      };
    }
    return t;
  });
  writeLocalTransfers(updatedTransfers);

  // 6. Audit log
  try {
    await supabaseAdmin.from("audit_logs" as any).insert({
      action: "TABLE_TRANSFER_APPROVED",
      details: {
        requestId,
        fromTable: fromNorm,
        toTable: toNorm,
        visitId: targetReq.visitId,
        adminUser,
        ordersMoved: updatedOrdersCount,
      },
      created_at: now,
    });
  } catch {}

  return {
    success: true,
    fromTable: fromNorm,
    toTable: toNorm,
    visitId: targetReq.visitId,
    updatedOrdersCount,
  };
}

/**
 * Admin Counter Staff Rejection of Table Transfer
 */
export async function rejectTransferRequest(
  requestId: string,
  reason: string = "Declined by counter staff",
  adminUser: string = "Admin Staff"
): Promise<TableTransferRequest> {
  const transfers = readLocalTransfers();
  const targetReq = transfers.find((t) => t.id === requestId);

  if (!targetReq) {
    throw new Error("Transfer request not found.");
  }

  const now = new Date().toISOString();
  let updatedReq: TableTransferRequest = {
    ...targetReq,
    status: "REJECTED",
    reviewedAt: now,
    reviewedBy: adminUser,
    rejectionReason: reason,
  };

  const updatedTransfers = transfers.map((t) => (t.id === requestId ? updatedReq : t));
  writeLocalTransfers(updatedTransfers);

  try {
    await supabaseAdmin.from("audit_logs" as any).insert({
      action: "TABLE_TRANSFER_REJECTED",
      details: {
        requestId,
        reason,
        adminUser,
      },
      created_at: now,
    });
  } catch {}

  return updatedReq;
}

/**
 * Admin Manual Table Transfer (Physical move initiated by counter staff)
 */
export async function adminManualTransfer(params: {
  fromTable: string;
  toTable: string;
  adminUser?: string;
}): Promise<{
  success: boolean;
  fromTable: string;
  toTable: string;
  visitId: string;
  updatedOrdersCount: number;
}> {
  const adminUser = params.adminUser || "Admin Counter";
  const fromNorm = normalizeTableLabel(params.fromTable);
  const toNorm = normalizeTableLabel(params.toTable);

  if (fromNorm.toUpperCase() === toNorm.toUpperCase()) {
    throw new Error("Source and destination tables cannot be the same.");
  }

  // Ensure destination is not occupied
  const activeOrderTo = await getActiveOrderForTable(toNorm);
  if (activeOrderTo) {
    throw new Error(`Table ${toNorm} is already occupied by an active order.`);
  }

  // Ensure source has active orders
  const activeOrderFrom = await getActiveOrderForTable(fromNorm);
  if (!activeOrderFrom) {
    throw new Error(`Table ${fromNorm} has no active dining visit to transfer.`);
  }

  const visitId =
    activeOrderFrom.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1] ||
    (activeOrderFrom as any).visit_id ||
    `VISIT-${fromNorm}-${activeOrderFrom.id.slice(0, 8).toUpperCase()}`;

  // Synthesize a request record
  const requestId = `MANUAL-TRF-${fromNorm}-${toNorm}-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  const synthesizedRequest: TableTransferRequest = {
    id: requestId,
    visitId,
    fromTable: fromNorm,
    toTable: toNorm,
    customerSessionId: activeOrderFrom.customerSessionId || "counter-manual",
    customerPhone: activeOrderFrom.customerPhone || undefined,
    ordersCount: 1,
    currentBill: activeOrderFrom.grandTotal,
    status: "PENDING",
    requestedAt: now,
  };

  const transfers = readLocalTransfers();
  transfers.unshift(synthesizedRequest);
  writeLocalTransfers(transfers);

  return approveTransferRequest(requestId, adminUser);
}

/**
 * Admin override: Release a reserved table
 */
export async function releaseTableReservation(
  tableNumber: string,
  adminUser: string = "Admin"
): Promise<void> {
  const norm = normalizeTableLabel(tableNumber);
  const now = new Date().toISOString();

  cancelPendingTransfersForTable(norm);

  try {
    await supabaseAdmin
      .from("table_reservations" as any)
      .update({
        status: "RELEASED",
        notes: `Released by ${adminUser} at ${now}`,
        updated_at: now,
      })
      .eq("table_number", norm)
      .eq("status", "ACTIVE");
  } catch {}

  const local = readLocalReservations().map((r) => {
    if (r.tableNumber === norm && r.status === "ACTIVE") {
      return {
        ...r,
        status: "RELEASED" as const,
        notes: `Released by ${adminUser} at ${now}`,
      };
    }
    return r;
  });
  writeLocalReservations(local);
}

/**
 * Convert reservation to active dining visit upon placing an order
 */
export async function convertReservationToVisit(params: {
  tableNumber: string;
  customerSessionId: string;
  visitId: string;
}): Promise<void> {
  const norm = normalizeTableLabel(params.tableNumber);
  const now = new Date().toISOString();

  try {
    await supabaseAdmin
      .from("table_reservations" as any)
      .update({
        status: "CONVERTED",
        visit_id: params.visitId,
        updated_at: now,
      })
      .eq("table_number", norm)
      .eq("customer_session_id", params.customerSessionId)
      .eq("status", "ACTIVE");
  } catch {}

  const local = readLocalReservations().map((r) => {
    if (
      r.tableNumber === norm &&
      r.customerSessionId === params.customerSessionId &&
      r.status === "ACTIVE"
    ) {
      return {
        ...r,
        status: "CONVERTED" as const,
        visitId: params.visitId,
      };
    }
    return r;
  });
  writeLocalReservations(local);
}

/**
 * Normalizes table number preserving letter-code formats like A1, A2, B3, F4, F4-A
 */
export function normalizeTableLabel(table: string): string {
  if (!table) return "A1";
  const clean = table.trim();
  // Strip leading "Table " or "table-" if followed by a code like A1 or 01
  const tablePrefixMatch = clean.match(/^Table[\s\-_]*([A-Za-z0-9\-_]+)$/i);
  if (tablePrefixMatch) {
    const code = tablePrefixMatch[1].trim();
    // If it's a number like "01" or "1", convert to A1, A2, etc. if desired or keep
    const numOnly = code.match(/^\d+$/);
    if (numOnly) {
      const n = parseInt(numOnly[0], 10);
      return `A${n}`;
    }
    return code.toUpperCase();
  }

  // If input is like "a1", "b2", "f4-a"
  const letterCodeMatch = clean.match(/^([A-Za-z]+[\-_\s]*\d+.*)$/);
  if (letterCodeMatch) {
    return clean.replace(/[\s\-_]+/g, "").toUpperCase();
  }

  // If it's just a number: "1" -> "A1", "2" -> "A2"
  const rawNum = clean.match(/^\d+$/);
  if (rawNum) {
    return `A${parseInt(rawNum[0], 10)}`;
  }

  return clean.toUpperCase();
}

/**
 * Fetch all configured tables persistently
 */
export async function getAllTables(): Promise<TableDefinition[]> {
  // 1. Try Supabase restaurant_tables
  try {
    const { data, error } = await supabaseAdmin
      .from("restaurant_tables" as any)
      .select("*")
      .order("table_number", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((t: any) => ({
        id: t.id || t.table_number,
        tableNumber: t.table_number,
        capacity: Number(t.capacity) || 4,
        section: t.section || "Dine-In",
        createdAt: t.created_at || new Date().toISOString(),
      }));
    }
  } catch {}

  // 2. Fallback to local config file
  const local = readLocalConfigFile();
  return local.tables;
}

/**
 * Create a new table persistently
 */
export async function createNewTable(params: {
  tableNumber: string;
  capacity: number;
  section?: string;
}): Promise<TableDefinition> {
  const normNumber = normalizeTableLabel(params.tableNumber);
  const capacity = Math.max(1, Number(params.capacity) || 4);
  const section = (params.section || "Dine-In").trim();

  const existing = await getAllTables();
  if (existing.some((t) => t.tableNumber.toUpperCase() === normNumber.toUpperCase())) {
    throw new Error(`Table ${normNumber} already exists. Please choose a different table number.`);
  }

  const newTable: TableDefinition = {
    id: normNumber,
    tableNumber: normNumber,
    capacity,
    section,
    createdAt: new Date().toISOString(),
  };

  // 1. Try insert into Supabase
  try {
    await supabaseAdmin.from("restaurant_tables" as any).insert({
      id: normNumber,
      table_number: normNumber,
      capacity,
      section,
      status: "AVAILABLE",
    });
  } catch {}

  // 2. Persist in local config
  const local = readLocalConfigFile();
  const updatedTables = [...local.tables, newTable];
  writeLocalConfigFile({ ...local, tables: updatedTables });

  return newTable;
}

/**
 * Helper to parse KOT status and rounds from order notes
 */
export function extractKotStateFromOrder(order: Order): {
  kotStatus: KotStatus;
  confirmedRounds: number[];
  highestRound: number;
  hasUnconfirmedAddons: boolean;
  viewedAt?: string;
  manuallyDelivered: boolean;
} {
  const notes = order.notes || "";
  
  // Extract rounds from order items
  const rounds = order.items.map((it) => {
    const match = (it.notes || "").match(/\[ROUND:(\d+)\]/);
    return match ? parseInt(match[1], 10) : (it.round || 1);
  });
  const highestRound = rounds.length > 0 ? Math.max(...rounds) : 1;

  // Extract confirmed KOT rounds
  const confirmedMatch = notes.match(/\[KOT_CONFIRMED_ROUNDS:([0-9,]+)\]/);
  const confirmedRounds = confirmedMatch
    ? confirmedMatch[1]
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n))
    : [];

  const manuallyDelivered = notes.includes("[KOT_MANUALLY_DELIVERED]");
  const isFailed = notes.includes("[KOT_FAILED]");
  const isUnknown = notes.includes("[KOT_UNKNOWN]");
  const isViewed = notes.includes("[KOT_VIEWED_EXITED]") || notes.includes("[KOT_EXITED_WITHOUT_KOT]");

  const hasUnconfirmedAddons = highestRound > 1 && !confirmedRounds.includes(highestRound);

  let kotStatus: KotStatus = "NOT_SENT";

  if (confirmedRounds.includes(highestRound) || order.status === "PREPARING" || order.status === "READY") {
    kotStatus = "PRINT_CONFIRMED";
  } else if (hasUnconfirmedAddons) {
    kotStatus = "NOT_SENT";
  } else if (manuallyDelivered) {
    kotStatus = "MANUALLY_DELIVERED";
  } else if (isFailed) {
    kotStatus = "FAILED";
  } else if (isUnknown) {
    kotStatus = "UNKNOWN";
  } else if (isViewed) {
    kotStatus = "VIEWED";
  }

  const viewedMatch = notes.match(/\[KOT_VIEWED_AT:([^\]]+)\]/);
  const viewedAt = viewedMatch ? viewedMatch[1] : undefined;

  return {
    kotStatus,
    confirmedRounds,
    highestRound,
    hasUnconfirmedAddons,
    viewedAt,
    manuallyDelivered,
  };
}

/**
 * Computes table management overview for all tables
 */
export async function getTablesOverview(
  visitorSessionId?: string,
  customerPhone?: string
): Promise<TableCardStatus[]> {
  const [tables, activeReservations] = await Promise.all([
    getAllTables(),
    getActiveReservations(),
  ]);

  const activeReservationsByTable = new Map<string, TableReservation>();
  for (const r of activeReservations) {
    activeReservationsByTable.set(r.tableNumber.toUpperCase(), r);
  }

  // Fetch all active, unpaid orders
  const { data: rawOrders } = await supabaseAdmin
    .from("orders" as any)
    .select("*, order_items(*)")
    .neq("status", "CANCELLED")
    .neq("payment_status", "PAID")
    .order("created_at", { ascending: false });

  const activeOrdersByTable = new Map<string, Order[]>();

  for (const row of (rawOrders as any[]) || []) {
    const isPrivate =
      row.order_type === "PRIVATE" ||
      row.table_number === "GIVE ON COUNTER" ||
      row.table_number === "COUNTER" ||
      (row.notes || "").includes("[ORDER_TYPE:PRIVATE]");
    if (isPrivate) continue;

    const rawTable = row.table_number || "";
    const norm = normalizeTableLabel(rawTable);

    const items = (row.order_items || []).map((it: any) => ({
      id: it.id,
      orderId: it.order_id,
      productId: it.product_id,
      name: it.name,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
      lineTotal: Number(it.line_total) || 0,
      image: it.image || "",
      notes: it.notes || "",
      round: it.round || 1,
    }));

    const orderObj: Order = {
      id: row.id,
      orderNumber: row.order_number,
      tableNumber: norm,
      customerSessionId: row.customer_session_id,
      customerId: row.customer_id,
      customerPhone: row.customer_phone,
      items,
      subtotal: Number(row.subtotal) || 0,
      tax: Number(row.tax) || 0,
      packagingFee: Number(row.packaging_fee) || 0,
      serviceCharge: Number(row.service_charge) || 0,
      grandTotal: Number(row.grand_total) || 0,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      paymentTxnId: row.payment_txn_id,
      paymentProvider: row.payment_provider,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (!activeOrdersByTable.has(norm)) {
      activeOrdersByTable.set(norm, [orderObj]);
    } else {
      activeOrdersByTable.get(norm)!.push(orderObj);
    }
  }

  // Compute table status & color for each table
  return tables.map((t) => {
    const tableOrders = activeOrdersByTable.get(t.tableNumber) || [];
    const activeOrder = tableOrders[0] || null;

    if (!activeOrder) {
      const activeRes = activeReservationsByTable.get(t.tableNumber.toUpperCase());
      if (activeRes) {
        const remainingSeconds = Math.max(
          0,
          Math.floor((new Date(activeRes.expiresAt).getTime() - Date.now()) / 1000)
        );
        const elapsedMinutes = Math.max(
          0,
          Math.floor((Date.now() - new Date(activeRes.reservedAt).getTime()) / 60000)
        );

        return {
          tableNumber: t.tableNumber,
          capacity: t.capacity,
          section: t.section,
          color: "BLUE",
          statusLabel: "RESERVED",
          totalAmount: 0,
          itemsCount: 0,
          elapsedMinutes,
          reservation: {
            id: activeRes.id,
            customerSessionId: activeRes.customerSessionId,
            customerPhone: activeRes.customerPhone,
            reservedAt: activeRes.reservedAt,
            expiresAt: activeRes.expiresAt,
            remainingSeconds,
            isMyReservation: Boolean(
              (visitorSessionId && activeRes.customerSessionId === visitorSessionId) ||
              (customerPhone && activeRes.customerPhone && activeRes.customerPhone.slice(-10) === customerPhone.replace(/\D/g, "").slice(-10))
            ),
          },
          isMyActiveTable: Boolean(
            (visitorSessionId && activeRes.customerSessionId === visitorSessionId) ||
            (customerPhone && activeRes.customerPhone && activeRes.customerPhone.slice(-10) === customerPhone.replace(/\D/g, "").slice(-10))
          ),
        };
      }

      return {
        tableNumber: t.tableNumber,
        capacity: t.capacity,
        section: t.section,
        color: "WHITE",
        statusLabel: "AVAILABLE",
        totalAmount: 0,
        itemsCount: 0,
      };
    }

    // Check all orders for this table to detect any pending new orders
    const hasAnyPendingOrder = tableOrders.some(
      (o) => o.status === "PENDING" && !(o.notes || "").includes("[KOT_CONFIRMED")
    );
    const hasAnyActionNeeded = tableOrders.some((o) => {
      const s = extractKotStateFromOrder(o);
      return (
        s.kotStatus === "VIEWED" ||
        s.kotStatus === "FAILED" ||
        s.kotStatus === "UNKNOWN" ||
        s.manuallyDelivered
      );
    });

    const { kotStatus, highestRound, hasUnconfirmedAddons, manuallyDelivered } =
      extractKotStateFromOrder(activeOrder);

    // Compute elapsed minutes from the earliest order of this visit
    const earliestOrder = tableOrders[tableOrders.length - 1];
    const elapsedMinutes = Math.max(
      0,
      Math.floor((Date.now() - new Date(earliestOrder.createdAt).getTime()) / 60000)
    );

    let color: TableColor = "WHITE";
    let statusLabel: TableStatusLabel = "AVAILABLE";

    if (hasAnyPendingOrder || hasUnconfirmedAddons) {
      color = "RED";
      statusLabel = "NEW ORDER";
    } else if (hasAnyActionNeeded || manuallyDelivered) {
      color = "YELLOW";
      statusLabel = "ACTION NEEDED";
    } else {
      color = "GREEN";
      statusLabel = "KOT SENT";
    }

    const totalQty = tableOrders.reduce(
      (sum, ord) => sum + ord.items.reduce((acc, it) => acc + (it.quantity || 1), 0),
      0
    );
    const totalAmount = tableOrders.reduce((sum, ord) => sum + ord.grandTotal, 0);

    const visitId =
      activeOrder.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1] ||
      (activeOrder as any).visit_id ||
      `VISIT-${t.tableNumber}-${activeOrder.id.slice(0, 8).toUpperCase()}`;

    const cleanPhone = customerPhone?.replace(/\D/g, "").slice(-10);
    const isMyActiveTable = tableOrders.some(
      (o) =>
        (visitorSessionId && o.customerSessionId === visitorSessionId) ||
        (cleanPhone && o.customerPhone && o.customerPhone.slice(-10) === cleanPhone)
    );

    return {
      tableNumber: t.tableNumber,
      capacity: t.capacity,
      section: t.section,
      color,
      statusLabel,
      activeOrder,
      activeOrderId: activeOrder.id,
      orderNumber: activeOrder.orderNumber,
      totalAmount,
      itemsCount: totalQty,
      elapsedMinutes,
      kotStatus,
      activeRound: highestRound,
      isAddonPending: hasUnconfirmedAddons,
      visitId,
      isMyActiveTable,
    };
  });
}

/**
 * Mark that an admin has viewed a table's order
 * If KOT is not yet confirmed and order was RED, turning viewed changes state to YELLOW when exiting
 */
export async function markTableOrderViewed(orderId: string): Promise<void> {
  // Kept for backward compatibility
  await markTableOrderExitedWithoutKot(orderId);
}

/**
 * Mark order as exited by admin without sending KOT -> triggers Yellow state
 */
export async function markTableOrderExitedWithoutKot(orderId: string): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders" as any)
    .select("id, notes, status")
    .eq("id", orderId)
    .single();

  if (!order) return;

  const currentNotes = (order as any).notes || "";
  // Only mark yellow if KOT was not already confirmed
  if (
    !currentNotes.includes("[KOT_CONFIRMED_ROUNDS") &&
    (order as any).status !== "PREPARING" &&
    (order as any).status !== "READY" &&
    (order as any).status !== "COMPLETED"
  ) {
    if (!currentNotes.includes("[KOT_VIEWED_EXITED]")) {
      const now = new Date().toISOString();
      const updatedNotes = `${currentNotes} [KOT_VIEWED_EXITED] [KOT_VIEWED_AT:${now}]`.trim();

      await supabaseAdmin
        .from("orders" as any)
        .update({ notes: updatedNotes, updated_at: now })
        .eq("id", orderId);
    }
  }
}

/**
 * Get Printer Settings
 */
export async function getPrinterSettings(): Promise<PrinterSettings> {
  // 1. Try Supabase printer_settings
  try {
    const { data }: any = await supabaseAdmin
      .from("printer_settings" as any)
      .select("*")
      .eq("id", 1)
      .single();

    if (data) {
      return {
        printerModel: data.printer_model || "CN811-UEWB",
        interfaceType: data.interface_type || "ETHERNET",
        ipAddress: data.ip_address || "192.168.1.50",
        port: data.port || 9100,
        paperWidthMm: data.paper_width_mm || 80,
        qzPrinterName: data.qz_printer_name || "CN811-UEWB",
        terminalName: data.terminal_name || "Billing 1",
        autoCut: data.auto_cut ?? true,
        lastCheckedAt: data.updated_at,
        status: "READY",
      };
    }
  } catch {}

  const local = readLocalConfigFile();
  return local.printerSettings;
}

/**
 * Update Printer Settings
 */
export async function updatePrinterSettings(settings: Partial<PrinterSettings>): Promise<PrinterSettings> {
  const current = await getPrinterSettings();
  const merged: PrinterSettings = {
    ...current,
    ...settings,
    lastCheckedAt: new Date().toISOString(),
  };

  try {
    await supabaseAdmin.from("printer_settings" as any).upsert({
      id: 1,
      printer_model: merged.printerModel,
      interface_type: merged.interfaceType,
      ip_address: merged.ipAddress,
      port: merged.port,
      paper_width_mm: merged.paperWidthMm,
      qz_printer_name: merged.qzPrinterName,
      terminal_name: merged.terminalName,
      auto_cut: merged.autoCut,
      updated_at: new Date().toISOString(),
    });
  } catch {}

  const local = readLocalConfigFile();
  writeLocalConfigFile({ ...local, printerSettings: merged });

  return merged;
}
