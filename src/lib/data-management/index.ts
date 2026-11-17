/**
 * Spiral Cafe Secure Data Storage Monitoring, Archiving & Restoration Service
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getConfig, recordAuditLog } from "@/lib/db";
import { getAuthSecret, safeDecodeToken } from "@/lib/auth";
import crypto from "crypto";
import {
  StorageOverview,
  TableStorageInfo,
  ExportPreview,
  ArchiveManifest,
  ArchivePayloadData,
  EncryptedArchiveFile,
  DailySummaryRecord,
  ProductSummaryRecord,
  CleanupPreview,
  RestorePreview,
} from "./types";
import { encryptArchiveFile, decryptArchiveFile, computeSha256Hex } from "./crypto";

// Supabase Free Tier Quota: 500 MB
export const SUPABASE_FREE_QUOTA_BYTES = 500 * 1024 * 1024; // 524,288,000 bytes
const DM_SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes short-lived session

// IST Offset
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIstDateStr(dateInput: Date | string | number): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${units[i]}`;
}

// -----------------------------------------------------------------------------
// 1. AUTHENTICATION & SHORT-LIVED DATA MANAGEMENT SESSIONS
// -----------------------------------------------------------------------------

/**
 * Verify admin password or PIN on the server
 */
export async function verifyAdminPasswordServer(passwordOrPin: string): Promise<boolean> {
  const trimmed = (passwordOrPin || "").trim();
  if (!trimmed) return false;

  const config = await getConfig();

  // 1. Check Admin PIN
  if (trimmed === (config.adminPin || "1234")) {
    return true;
  }

  // 2. Check Admin Password Hash (SHA-256)
  const inputHash = crypto.createHash("sha256").update(trimmed).digest("hex");
  const defaultHash = crypto.createHash("sha256").update("spiral2026").digest("hex");
  const targetHash = config.adminPasswordHash || defaultHash;

  return inputHash === targetHash;
}

/**
 * Sign a short-lived (15 min) Data Management authorization token
 */
export async function signDataManagementToken(adminUser: string): Promise<string> {
  const secret = getAuthSecret();
  const expiry = Date.now() + DM_SESSION_EXPIRY_MS;
  const payload = `DM:${adminUser}:${expiry}`;

  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

/**
 * Verify a short-lived Data Management authorization token
 */
export function verifyDataManagementToken(token: string | null | undefined): {
  valid: boolean;
  user?: string;
} {
  if (!token) return { valid: false };

  const clean = safeDecodeToken(token.trim());
  const parts = clean.split(".");
  if (parts.length !== 2) return { valid: false };

  const [payload, signature] = parts;
  try {
    const secret = getAuthSecret();
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    if (signature !== expected) return { valid: false };

    const [prefix, user, expiryStr] = payload.split(":");
    if (prefix !== "DM" || !user) return { valid: false };

    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) return { valid: false };

    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}

// -----------------------------------------------------------------------------
// 2. DATABASE STORAGE MONITORING
// -----------------------------------------------------------------------------

export async function getStorageOverview(): Promise<StorageOverview> {
  const sb = getSupabaseAdminClient();
  const nowStr = new Date().toISOString();

  // Target application tables to audit
  const targetTables = [
    { name: "orders", category: "Operational", retention: "Archive when Eligible", eligible: true },
    { name: "order_items", category: "Operational", retention: "Archive when Eligible", eligible: true },
    { name: "invoices", category: "Financial Audit", retention: "Archive when Eligible", eligible: true },
    { name: "invoice_items", category: "Financial Audit", retention: "Archive when Eligible", eligible: true },
    { name: "settlements", category: "Financial Audit", retention: "Archive when Eligible", eligible: true },
    { name: "audit_logs", category: "Financial Audit", retention: "Safe for Cleanup", eligible: true },
    { name: "customer_sessions", category: "Temporary / Logs", retention: "Safe for Cleanup", eligible: false },
    { name: "customers", category: "Master Data", retention: "Permanent Online", eligible: false },
    { name: "menu_items", category: "Master Data", retention: "Permanent Online", eligible: false },
    { name: "cafe_config", category: "Master Data", retention: "Permanent Online", eligible: false },
    { name: "analytics_daily_summaries", category: "Master Data", retention: "Permanent Online", eligible: false },
    { name: "analytics_product_summaries", category: "Master Data", retention: "Permanent Online", eligible: false },
    { name: "data_archives_registry", category: "Financial Audit", retention: "Permanent Online", eligible: false },
  ] as const;

  let dbSizeBytes = 0;
  let isRpcMeasurement = false;
  const tableStatsMap: Record<string, { total_bytes: number; table_bytes: number; index_bytes: number; estimated_rows: number }> = {};

  // Step 1: Attempt to call get_database_storage_stats() RPC function
  try {
    const { data: rpcData, error: rpcError } = await sb.rpc("get_database_storage_stats" as any);
    if (!rpcError && rpcData && typeof rpcData.database_size_bytes === "number") {
      dbSizeBytes = rpcData.database_size_bytes;
      isRpcMeasurement = true;
      if (Array.isArray(rpcData.tables)) {
        for (const tbl of rpcData.tables) {
          tableStatsMap[tbl.table_name] = {
            total_bytes: tbl.total_bytes || 0,
            table_bytes: tbl.table_bytes || 0,
            index_bytes: tbl.index_bytes || 0,
            estimated_rows: tbl.estimated_rows || 0,
          };
        }
      }
    }
  } catch (e) {
    // Graceful fallback if RPC is not yet created in Postgres
    isRpcMeasurement = false;
  }

  // Step 2: Query exact live counts from existing tables
  const tableResults: TableStorageInfo[] = [];
  let computedEstimatedDbSize = 0;

  for (const t of targetTables) {
    let exactCount = 0;
    let tableExists = true;

    try {
      const { count, error } = await sb.from(t.name as any).select("*", { count: "exact", head: true });
      if (error) {
        tableExists = false;
      } else {
        exactCount = count || 0;
      }
    } catch {
      tableExists = false;
    }

    if (!tableExists) continue;

    const rpcInfo = tableStatsMap[t.name];
    const bytes = rpcInfo?.total_bytes ?? (exactCount * 256 + 8192); // estimate if RPC not present
    computedEstimatedDbSize += bytes;

    tableResults.push({
      tableName: `public.${t.name}`,
      recordCount: exactCount,
      countType: "exact",
      sizeBytes: bytes,
      tableBytes: rpcInfo?.table_bytes,
      indexBytes: rpcInfo?.index_bytes,
      dataCategory: t.category,
      retentionRecommendation: t.retention,
      isEligibleForArchiving: t.eligible,
    });
  }

  const finalDbBytes = isRpcMeasurement ? dbSizeBytes : computedEstimatedDbSize;
  const pct = Math.min(100, Math.round((finalDbBytes / SUPABASE_FREE_QUOTA_BYTES) * 1000) / 10);
  const remaining = Math.max(0, SUPABASE_FREE_QUOTA_BYTES - finalDbBytes);

  // Step 3: Orders breakdown
  let totalOrdersInDb = 0;
  let activeOrders = 0;
  let completedOrders = 0;
  let cancelledOrders = 0;

  try {
    const { data: ordRows } = await sb.from("orders").select("status, payment_status");
    if (ordRows) {
      totalOrdersInDb = ordRows.length;
      ordRows.forEach((o: any) => {
        if (o.status === "COMPLETED" && (o.payment_status === "PAID" || o.payment_status === "REFUNDED")) {
          completedOrders++;
        } else if (o.status === "CANCELLED") {
          cancelledOrders++;
        } else {
          activeOrders++;
        }
      });
    }
  } catch (e) {
    console.error("Orders count error:", e);
  }

  // Step 4: Archive registry history
  let totalArchivesCount = 0;
  let lastExportDate: string | null = null;
  let verifiedArchivesCount = 0;
  let purgedArchivesCount = 0;

  try {
    const { data: archRows } = await sb
      .from("data_archives_registry" as any)
      .select("export_status, exported_at")
      .order("exported_at", { ascending: false });

    if (archRows) {
      totalArchivesCount = archRows.length;
      if (archRows.length > 0) {
        lastExportDate = (archRows[0] as any).exported_at;
      }
      archRows.forEach((a: any) => {
        if (a.export_status === "VERIFIED" || a.export_status === "PURGED") {
          verifiedArchivesCount++;
        }
        if (a.export_status === "PURGED") {
          purgedArchivesCount++;
        }
      });
    }
  } catch {
    // Registry table may not be initialized yet
  }

  // Step 5: Database Health status
  let healthStatus: StorageOverview["healthStatus"] = "Healthy";
  let healthExplanation = "Database storage is well within safe operational limits.";

  if (pct >= 85) {
    healthStatus = "Storage Critical";
    healthExplanation = `Storage usage is at ${pct}% of your 500 MB Supabase Free limit. Immediate manual archiving is recommended.`;
  } else if (pct >= 70) {
    healthStatus = "Needs Attention";
    healthExplanation = `Storage usage is at ${pct}%. Consider exporting and archiving records older than 6 months.`;
  } else if (!isRpcMeasurement && finalDbBytes === 0) {
    healthStatus = "Information Unavailable";
    healthExplanation = "Unable to retrieve database statistics from Supabase.";
  }

  return {
    databaseSizeBytes: finalDbBytes,
    databaseSizeFormatted: formatBytes(finalDbBytes),
    quotaSizeBytes: SUPABASE_FREE_QUOTA_BYTES,
    quotaSizeFormatted: formatBytes(SUPABASE_FREE_QUOTA_BYTES),
    percentageUsed: pct,
    remainingBytes: remaining,
    remainingFormatted: formatBytes(remaining),
    measuredAt: nowStr,
    isRpcMeasurement,
    diskUsageStatus: isRpcMeasurement ? "Available" : "Not Available",
    healthStatus,
    healthExplanation,
    orderMetrics: {
      totalOrdersInDb,
      activeOrders,
      completedOrders,
      cancelledOrders,
    },
    archiveMetrics: {
      totalArchivesCount,
      lastExportDate,
      verifiedArchivesCount,
      purgedArchivesCount,
    },
    tables: tableResults,
  };
}

// -----------------------------------------------------------------------------
// 3. EXPORT & ARCHIVE WORKFLOW
// -----------------------------------------------------------------------------

/**
 * Preview eligible records for a selected date range
 */
export async function previewExport(
  startDateStr: string,
  endDateStr: string
): Promise<ExportPreview> {
  const sb = getSupabaseAdminClient();

  const startIso = `${startDateStr}T00:00:00.000Z`;
  const endIso = `${endDateStr}T23:59:59.999Z`;

  // Fetch all orders in the date range
  const { data: allOrders, error: ordErr } = await sb
    .from("orders")
    .select("id, order_number, status, payment_status, grand_total, tax, created_at")
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (ordErr) {
    throw new Error(`Failed to query orders: ${ordErr.message}`);
  }

  const orders = allOrders || [];

  let eligibleOrdersCount = 0;
  let activeOrdersExcludedCount = 0;
  let pendingPaymentOrdersExcludedCount = 0;
  let financialTotal = 0;
  let taxTotal = 0;
  const eligibleOrderIds: string[] = [];

  let earliestDate: string | null = null;
  let latestDate: string | null = null;

  orders.forEach((o) => {
    const isCompleted = o.status === "COMPLETED";
    const isSettled = o.payment_status === "PAID" || o.payment_status === "REFUNDED";

    if (!earliestDate || o.created_at < earliestDate) earliestDate = o.created_at;
    if (!latestDate || o.created_at > latestDate) latestDate = o.created_at;

    if (!isCompleted) {
      activeOrdersExcludedCount++;
    } else if (!isSettled) {
      pendingPaymentOrdersExcludedCount++;
    } else {
      eligibleOrdersCount++;
      eligibleOrderIds.push(o.id);
      financialTotal += Number(o.grand_total) || 0;
      taxTotal += Number(o.tax) || 0;
    }
  });

  // Count order items for eligible orders
  let orderItemsCount = 0;
  if (eligibleOrderIds.length > 0) {
    const { count } = await sb
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .in("order_id", eligibleOrderIds);
    orderItemsCount = count || 0;
  }

  // Count related invoices
  let invoicesCount = 0;
  if (eligibleOrderIds.length > 0) {
    const { count } = await sb
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .in("order_id", eligibleOrderIds);
    invoicesCount = count || 0;
  }

  // Count settlements in range
  const { count: settCount } = await sb
    .from("settlements")
    .select("*", { count: "exact", head: true })
    .gte("date", startDateStr)
    .lte("date", endDateStr);

  const settlementsCount = settCount || 0;

  // Rough size estimation: ~1.2 KB per eligible order package
  const estimatedBytes = eligibleOrdersCount * 1200 + orderItemsCount * 300 + 4096;

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    eligibleOrdersCount,
    activeOrdersExcludedCount,
    pendingPaymentOrdersExcludedCount,
    orderItemsCount,
    invoicesCount,
    settlementsCount,
    customerSessionsCount: 0,
    auditLogsCount: 0,
    financialTotal: Math.round(financialTotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    estimatedExportSizeBytes: estimatedBytes,
    estimatedExportSizeFormatted: formatBytes(estimatedBytes),
    earliestRecordDate: earliestDate,
    latestRecordDate: latestDate,
  };
}

/**
 * Generate full encrypted .scarchive file for eligible records
 */
export async function createArchiveExport(params: {
  startDate: string;
  endDate: string;
  adminUser: string;
  passphrase: string;
}): Promise<{ encryptedArchive: EncryptedArchiveFile; filename: string }> {
  const sb = getSupabaseAdminClient();
  const { startDate, endDate, adminUser, passphrase } = params;

  const startIso = `${startDate}T00:00:00.000Z`;
  const endIso = `${endDate}T23:59:59.999Z`;

  // 1. Fetch eligible orders (COMPLETED & PAID/REFUNDED)
  const { data: eligibleOrders, error: ordErr } = await sb
    .from("orders")
    .select("*")
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .eq("status", "COMPLETED")
    .in("payment_status", ["PAID", "REFUNDED"])
    .order("created_at", { ascending: true });

  if (ordErr) throw new Error(`Orders fetch error: ${ordErr.message}`);
  const orders = eligibleOrders || [];

  if (orders.length === 0) {
    throw new Error("No eligible completed records found in the selected date range to archive.");
  }

  const orderIds = orders.map((o) => o.id);

  // 2. Fetch order items
  const { data: itemsData, error: itErr } = await sb
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);
  if (itErr) throw new Error(`Order items fetch error: ${itErr.message}`);
  const orderItems = itemsData || [];

  // 3. Fetch invoices
  const { data: invData } = await sb.from("invoices").select("*").in("order_id", orderIds);
  const invoices = invData || [];
  const invoiceIds = invoices.map((inv) => inv.id);

  // 4. Fetch invoice items
  let invoiceItems: any[] = [];
  if (invoiceIds.length > 0) {
    const { data: iiData } = await sb.from("invoice_items").select("*").in("invoice_id", invoiceIds);
    invoiceItems = iiData || [];
  }

  // 5. Fetch settlements in date range
  const { data: settData } = await sb
    .from("settlements")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate);
  const settlements = settData || [];

  // 6. Generate Permanent Daily & Product Analytics Summaries
  const { dailySummaries, productSummaries } = generateSummariesFromOrders(
    orders,
    orderItems,
    `Archive_${startDate}_${endDate}`
  );

  // 7. Calculate Financial Reconciliation Totals
  let grossSales = 0;
  let netSales = 0;
  let taxCollected = 0;
  let cashSales = 0;
  let onlineSales = 0;

  orders.forEach((o) => {
    const total = Number(o.grand_total) || 0;
    const sub = Number(o.subtotal) || 0;
    const tx = Number(o.tax) || 0;
    grossSales += total;
    netSales += sub;
    taxCollected += tx;
    if (o.payment_method === "CASH") cashSales += total;
    if (o.payment_method === "ONLINE") onlineSales += total;
  });

  // 8. Compute SHA-256 integrity checksum of source data
  const checksumContent = JSON.stringify({
    orders,
    orderItems,
    invoices,
    settlements,
  });
  const checksumSha256 = await computeSha256Hex(checksumContent);

  const archiveId = `arch_${startDate}_${endDate}_${Date.now()}`;
  const filename = `SpiralCafe_Archive_${startDate}_to_${endDate}_v1.scarchive`;

  const manifest: ArchiveManifest = {
    archiveId,
    formatVersion: "1.0",
    system: "Spiral Cafe POS",
    exportedAt: new Date().toISOString(),
    exportedBy: adminUser,
    startDate,
    endDate,
    timezone: "Asia/Kolkata",
    currency: "INR",
    counts: {
      orders: orders.length,
      orderItems: orderItems.length,
      invoices: invoices.length,
      invoiceItems: invoiceItems.length,
      settlements: settlements.length,
      customerSessions: 0,
      auditLogs: 0,
    },
    financials: {
      grossSales: Math.round(grossSales * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      taxCollected: Math.round(taxCollected * 100) / 100,
      cashSales: Math.round(cashSales * 100) / 100,
      onlineSales: Math.round(onlineSales * 100) / 100,
      settledRevenue: Math.round(grossSales * 100) / 100,
    },
    checksumSha256,
    encryption: {
      algorithm: "AES-GCM-256",
      kdf: "PBKDF2-SHA256",
      iterations: 100000,
    },
  };

  const payload: ArchivePayloadData = {
    manifest,
    orders,
    orderItems,
    invoices,
    invoiceItems,
    settlements,
    customerSessions: [],
    auditLogs: [],
    dailySummaries,
    productSummaries,
  };

  // Encrypt with Passphrase
  const encryptedArchive = await encryptArchiveFile(payload, passphrase);

  // Record into Registry
  try {
    await sb.from("data_archives_registry" as any).insert({
      id: archiveId,
      archive_filename: filename,
      start_date: startDate,
      end_date: endDate,
      eligible_orders_count: orders.length,
      order_items_count: orderItems.length,
      invoices_count: invoices.length,
      settlements_count: settlements.length,
      total_revenue: grossSales,
      checksum_sha256: checksumSha256,
      encryption_algorithm: "AES-GCM-256",
      export_status: "EXPORTED",
      exported_by: adminUser,
      exported_at: new Date().toISOString(),
      manifest_preview: manifest,
    });
  } catch (e) {
    console.warn("Archive registry recording skipped:", e);
  }

  await recordAuditLog(
    adminUser,
    "EXPORT_DATA_ARCHIVE",
    "CONFIG",
    archiveId,
    `Exported ${orders.length} orders (${startDate} to ${endDate}) with checksum ${checksumSha256.slice(0, 10)}...`
  );

  return { encryptedArchive, filename };
}

/**
 * Generate accurate daily and product summaries for permanent analytics
 */
export function generateSummariesFromOrders(
  orders: any[],
  orderItems: any[],
  archiveRef: string
): { dailySummaries: DailySummaryRecord[]; productSummaries: ProductSummaryRecord[] } {
  const dailyMap: Record<string, DailySummaryRecord> = {};
  const productMap: Record<string, ProductSummaryRecord> = {};

  // Build item map by orderId
  const itemsByOrder: Record<string, any[]> = {};
  orderItems.forEach((it) => {
    if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
    itemsByOrder[it.order_id].push(it);
  });

  orders.forEach((o) => {
    const dateStr = getIstDateStr(o.created_at);
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = {
        date: dateStr,
        total_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        gross_sales: 0,
        net_sales: 0,
        tax_collected: 0,
        packaging_fees: 0,
        service_charges: 0,
        discounts: 0,
        cash_sales: 0,
        online_sales: 0,
        unpaid_sales: 0,
        customer_orders_count: 0,
        customer_sales: 0,
        private_orders_count: 0,
        private_sales: 0,
        takeaway_orders_count: 0,
        takeaway_sales: 0,
        dine_in_orders_count: 0,
        dine_in_sales: 0,
        archive_reference: archiveRef,
      };
    }

    const row = dailyMap[dateStr];
    row.total_orders++;
    const total = Number(o.grand_total) || 0;
    const sub = Number(o.subtotal) || 0;
    const tx = Number(o.tax) || 0;
    const pkg = Number(o.packaging_fee) || 0;
    const srv = Number(o.service_charge) || 0;

    if (o.status === "COMPLETED") row.completed_orders++;
    if (o.status === "CANCELLED") row.cancelled_orders++;

    row.gross_sales += total;
    row.net_sales += sub;
    row.tax_collected += tx;
    row.packaging_fees += pkg;
    row.service_charges += srv;

    if (o.payment_method === "CASH") row.cash_sales += total;
    if (o.payment_method === "ONLINE") row.online_sales += total;
    if (o.payment_status !== "PAID" && o.payment_status !== "REFUNDED") row.unpaid_sales += total;

    const isPrivate = o.order_type === "PRIVATE" || o.orderType === "PRIVATE";
    const isTakeaway = (o.table_number || "").toUpperCase() === "TAKEAWAY";

    if (isPrivate) {
      row.private_orders_count++;
      row.private_sales += total;
    } else {
      row.customer_orders_count++;
      row.customer_sales += total;
    }

    if (isTakeaway) {
      row.takeaway_orders_count++;
      row.takeaway_sales += total;
    } else {
      row.dine_in_orders_count++;
      row.dine_in_sales += total;
    }

    // Process line items for product analytics
    const lines = itemsByOrder[o.id] || [];
    lines.forEach((item) => {
      const prodName = (item.name || "Unknown").trim();
      const catName = (item.category || item.category_name || "SPECIALS").toUpperCase();
      const prodKey = `${dateStr}_${prodName.toLowerCase()}_${isPrivate ? "prv" : "pub"}`;

      if (!productMap[prodKey]) {
        productMap[prodKey] = {
          id: `psum_${prodKey.replace(/[^a-zA-Z0-9_]/g, "_")}`,
          date: dateStr,
          product_id: item.product_id || prodName.toLowerCase(),
          product_name: prodName,
          category_name: catName,
          quantity_sold: 0,
          total_revenue: 0,
          unit_price: Number(item.price) || 0,
          is_private: isPrivate,
        };
      }

      productMap[prodKey].quantity_sold += Number(item.quantity) || 1;
      productMap[prodKey].total_revenue += Number(item.line_total) || (Number(item.price) * (Number(item.quantity) || 1));
    });
  });

  return {
    dailySummaries: Object.values(dailyMap),
    productSummaries: Object.values(productMap),
  };
}

// -----------------------------------------------------------------------------
// 4. MANUAL REMOVAL (PURGE) FROM LIVE SUPABASE
// -----------------------------------------------------------------------------

/**
 * Remove verified archived records from live Supabase tables
 * Prerequisites: Re-auth verified, permanent summaries committed FIRST.
 */
export async function executePurgeArchivedRecords(params: {
  archiveId: string;
  adminPassword: string;
  adminUser: string;
  archivePayload: ArchivePayloadData;
}): Promise<{
  success: boolean;
  ordersPurgedCount: number;
  orderItemsPurgedCount: number;
  invoicesPurgedCount: number;
  settlementsPurgedCount: number;
}> {
  const { archiveId, adminPassword, adminUser, archivePayload } = params;

  // 1. Strict Server Reauthentication
  const isAuth = await verifyAdminPasswordServer(adminPassword);
  if (!isAuth) {
    throw new Error("Reauthentication failed. Incorrect administrator password.");
  }

  const sb = getSupabaseAdminClient();
  const { orders, orderItems, invoices, invoiceItems, settlements, dailySummaries, productSummaries } =
    archivePayload;

  if (!orders || orders.length === 0) {
    throw new Error("No orders found in archive payload to purge.");
  }

  // 2. Commit Permanent Analytics Summaries FIRST before deleting anything!
  try {
    for (const d of dailySummaries) {
      await sb.from("analytics_daily_summaries" as any).upsert(d, { onConflict: "date" });
    }
    for (const p of productSummaries) {
      await sb.from("analytics_product_summaries" as any).upsert(p, { onConflict: "id" });
    }
  } catch (err: any) {
    console.warn("Analytics summary upsert notice:", err.message);
  }

  // 3. Purge in reverse foreign-key dependency order
  const orderIds = orders.map((o) => o.id);
  const invoiceIds = invoices.map((inv) => inv.id);

  // A. Purge Invoice Items
  if (invoiceIds.length > 0) {
    await sb.from("invoice_items").delete().in("invoice_id", invoiceIds);
  }

  // B. Purge Invoices
  if (orderIds.length > 0) {
    await sb.from("invoices").delete().in("order_id", orderIds);
  }

  // C. Purge Order Items
  if (orderIds.length > 0) {
    await sb.from("order_items").delete().in("order_id", orderIds);
  }

  // D. Purge Orders
  if (orderIds.length > 0) {
    await sb.from("orders").delete().in("id", orderIds);
  }

  // E. Update Archive Registry Status to PURGED
  try {
    await sb
      .from("data_archives_registry" as any)
      .update({
        export_status: "PURGED",
        purged_at: new Date().toISOString(),
      })
      .eq("id", archiveId);
  } catch (e) {
    console.warn("Registry status update notice:", e);
  }

  // F. Record Audit Log
  await recordAuditLog(
    adminUser,
    "PURGE_ARCHIVED_RECORDS",
    "ORDER",
    archiveId,
    `Purged ${orders.length} archived orders and ${orderItems.length} items from live Supabase database after verification.`
  );

  return {
    success: true,
    ordersPurgedCount: orders.length,
    orderItemsPurgedCount: orderItems.length,
    invoicesPurgedCount: invoices.length,
    settlementsPurgedCount: settlements.length,
  };
}

// -----------------------------------------------------------------------------
// 5. RESTORATION WORKFLOW
// -----------------------------------------------------------------------------

/**
 * Preview restoration of an archive
 */
export async function previewRestore(
  archivePayload: ArchivePayloadData
): Promise<RestorePreview> {
  const sb = getSupabaseAdminClient();
  const { manifest, orders, invoices, settlements } = archivePayload;

  const orderIds = (orders || []).map((o) => o.id);
  let existingCount = 0;

  if (orderIds.length > 0) {
    const { data: existing } = await sb.from("orders").select("id").in("id", orderIds);
    existingCount = existing?.length || 0;
  }

  const newOrdersToRestoreCount = (orders || []).length - existingCount;
  const warnings: string[] = [];

  if (existingCount > 0) {
    warnings.push(
      `${existingCount} order(s) already exist in the live database and will be safely preserved without duplicates.`
    );
  }

  return {
    archiveId: manifest.archiveId,
    startDate: manifest.startDate,
    endDate: manifest.endDate,
    ordersCount: (orders || []).length,
    alreadyExistingOrdersCount: existingCount,
    newOrdersToRestoreCount,
    invoicesCount: (invoices || []).length,
    settlementsCount: (settlements || []).length,
    financialTotal: manifest.financials.grossSales,
    canRestore: true,
    warnings,
  };
}

/**
 * Idempotently restore historical records back into Supabase
 */
export async function executeRestore(params: {
  archivePayload: ArchivePayloadData;
  adminPassword: string;
  adminUser: string;
}): Promise<{
  success: boolean;
  ordersRestoredCount: number;
  orderItemsRestoredCount: number;
  invoicesRestoredCount: number;
}> {
  const { archivePayload, adminPassword, adminUser } = params;

  // 1. Re-auth check
  const isAuth = await verifyAdminPasswordServer(adminPassword);
  if (!isAuth) {
    throw new Error("Reauthentication failed. Incorrect administrator password.");
  }

  const sb = getSupabaseAdminClient();
  const { orders, orderItems, invoices, invoiceItems, settlements, manifest } = archivePayload;

  // 2. Batch Upsert Orders
  if (orders && orders.length > 0) {
    for (let i = 0; i < orders.length; i += 50) {
      const chunk = orders.slice(i, i + 50);
      await sb.from("orders").upsert(chunk, { onConflict: "id" });
    }
  }

  // 3. Batch Upsert Order Items
  if (orderItems && orderItems.length > 0) {
    for (let i = 0; i < orderItems.length; i += 50) {
      const chunk = orderItems.slice(i, i + 50);
      await sb.from("order_items").upsert(chunk, { onConflict: "id" });
    }
  }

  // 4. Batch Upsert Invoices
  if (invoices && invoices.length > 0) {
    for (let i = 0; i < invoices.length; i += 50) {
      const chunk = invoices.slice(i, i + 50);
      await sb.from("invoices").upsert(chunk, { onConflict: "id" });
    }
  }

  // 5. Batch Upsert Invoice Items
  if (invoiceItems && invoiceItems.length > 0) {
    for (let i = 0; i < invoiceItems.length; i += 50) {
      const chunk = invoiceItems.slice(i, i + 50);
      await sb.from("invoice_items").upsert(chunk, { onConflict: "id" });
    }
  }

  // 6. Record in registry
  try {
    await sb
      .from("data_archives_registry" as any)
      .update({ export_status: "RESTORED" })
      .eq("id", manifest.archiveId);
  } catch (e) {
    console.warn("Restore registry update notice:", e);
  }

  // 7. Audit log
  await recordAuditLog(
    adminUser,
    "RESTORE_ARCHIVED_RECORDS",
    "ORDER",
    manifest.archiveId,
    `Restored ${orders.length} orders from archive ${manifest.archiveId}.`
  );

  return {
    success: true,
    ordersRestoredCount: orders.length,
    orderItemsRestoredCount: (orderItems || []).length,
    invoicesRestoredCount: (invoices || []).length,
  };
}

// -----------------------------------------------------------------------------
// 6. SAFE REVIEW & CLEANUP OF DISPOSABLE DATA
// -----------------------------------------------------------------------------

/**
 * Preview disposable expired empty customer sessions (older than 48h with 0 orders)
 */
export async function previewCleanup(): Promise<CleanupPreview> {
  const sb = getSupabaseAdminClient();
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Query customer sessions started more than 48 hours ago
  const { data: oldSessions } = await sb
    .from("customer_sessions")
    .select("id, started_at, table_number")
    .lte("started_at", twoDaysAgo);

  const sessions = oldSessions || [];
  if (sessions.length === 0) {
    return {
      expiredEmptySessionsCount: 0,
      expiredSessionsDetails: [],
      oldDiagnosticLogsCount: 0,
    };
  }

  // Find which of these old sessions have orders
  const sessionIds = sessions.map((s) => s.id);
  const { data: linkedOrders } = await sb
    .from("orders")
    .select("customer_session_id")
    .in("customer_session_id", sessionIds);

  const usedSessionSet = new Set((linkedOrders || []).map((o) => o.customer_session_id));
  const disposable = sessions.filter((s) => !usedSessionSet.has(s.id));

  return {
    expiredEmptySessionsCount: disposable.length,
    expiredSessionsDetails: disposable.slice(0, 10).map((s) => ({
      id: s.id,
      startedAt: s.started_at,
      tableNumber: s.table_number,
    })),
    oldDiagnosticLogsCount: 0,
  };
}

/**
 * Execute cleanup of safe disposable records
 */
export async function executeCleanup(params: {
  adminPassword: string;
  adminUser: string;
}): Promise<{ deletedCount: number }> {
  const { adminPassword, adminUser } = params;

  const isAuth = await verifyAdminPasswordServer(adminPassword);
  if (!isAuth) {
    throw new Error("Reauthentication failed. Incorrect administrator password.");
  }

  const sb = getSupabaseAdminClient();
  const preview = await previewCleanup();

  if (preview.expiredEmptySessionsCount === 0) {
    return { deletedCount: 0 };
  }

  const idsToDelete = preview.expiredSessionsDetails.map((s) => s.id);
  const { error } = await sb.from("customer_sessions").delete().in("id", idsToDelete);

  if (error) {
    throw new Error(`Failed to clean up expired sessions: ${error.message}`);
  }

  await recordAuditLog(
    adminUser,
    "CLEANUP_EMPTY_SESSIONS",
    "CONFIG",
    "batch",
    `Cleaned up ${idsToDelete.length} expired empty customer sessions.`
  );

  return { deletedCount: idsToDelete.length };
}
