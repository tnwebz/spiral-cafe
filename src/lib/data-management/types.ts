/**
-- Spiral Cafe Secure Data Storage Monitoring, Archiving & Restoration Types
*/

export interface TableStorageInfo {
  tableName: string;
  recordCount: number;
  countType: "exact" | "estimated";
  sizeBytes: number;
  tableBytes?: number;
  indexBytes?: number;
  dataCategory: "Operational" | "Master Data" | "Financial Audit" | "Temporary / Logs";
  retentionRecommendation: "Permanent Online" | "Archive when Eligible" | "Safe for Cleanup";
  isEligibleForArchiving: boolean;
}

export interface StorageOverview {
  databaseSizeBytes: number;
  databaseSizeFormatted: string;
  quotaSizeBytes: number;
  quotaSizeFormatted: string;
  percentageUsed: number;
  remainingBytes: number;
  remainingFormatted: string;
  measuredAt: string;
  isRpcMeasurement: boolean;
  diskUsageStatus: "Available" | "Not Available";
  healthStatus: "Healthy" | "Needs Attention" | "Storage Critical" | "Information Unavailable";
  healthExplanation: string;
  orderMetrics: {
    totalOrdersInDb: number;
    activeOrders: number;
    completedOrders: number;
    cancelledOrders: number;
  };
  archiveMetrics: {
    totalArchivesCount: number;
    lastExportDate: string | null;
    verifiedArchivesCount: number;
    purgedArchivesCount: number;
  };
  tables: TableStorageInfo[];
}

export interface DailySummaryRecord {
  date: string; // YYYY-MM-DD
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  gross_sales: number;
  net_sales: number;
  tax_collected: number;
  packaging_fees: number;
  service_charges: number;
  discounts: number;
  cash_sales: number;
  online_sales: number;
  unpaid_sales: number;
  customer_orders_count: number;
  customer_sales: number;
  private_orders_count: number;
  private_sales: number;
  takeaway_orders_count: number;
  takeaway_sales: number;
  dine_in_orders_count: number;
  dine_in_sales: number;
  archived_at?: string;
  archive_reference?: string;
}

export interface ProductSummaryRecord {
  id: string;
  date: string; // YYYY-MM-DD
  product_id: string;
  product_name: string;
  category_name: string;
  quantity_sold: number;
  total_revenue: number;
  unit_price: number;
  is_private: boolean;
}

export interface ArchiveManifest {
  archiveId: string;
  formatVersion: "1.0";
  system: "Spiral Cafe POS";
  exportedAt: string;
  exportedBy: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timezone: "Asia/Kolkata";
  currency: "INR";
  counts: {
    orders: number;
    orderItems: number;
    invoices: number;
    invoiceItems: number;
    settlements: number;
    customerSessions: number;
    auditLogs: number;
  };
  financials: {
    grossSales: number;
    netSales: number;
    taxCollected: number;
    cashSales: number;
    onlineSales: number;
    settledRevenue: number;
  };
  checksumSha256: string;
  encryption: {
    algorithm: "AES-GCM-256";
    kdf: "PBKDF2-SHA256";
    iterations: 100000;
  };
}

export interface ArchivePayloadData {
  manifest: ArchiveManifest;
  orders: any[];
  orderItems: any[];
  invoices: any[];
  invoiceItems: any[];
  settlements: any[];
  customerSessions: any[];
  auditLogs: any[];
  dailySummaries: DailySummaryRecord[];
  productSummaries: ProductSummaryRecord[];
}

export interface EncryptedArchiveFile {
  magic: "SCARCHIVE";
  version: 1;
  salt: string; // base64
  iv: string; // base64
  manifestPreview: Omit<ArchiveManifest, "checksumSha256"> & { checksumSha256: string };
  ciphertext: string; // base64 encrypted payload json
}

export interface ExportPreview {
  startDate: string;
  endDate: string;
  eligibleOrdersCount: number;
  activeOrdersExcludedCount: number;
  pendingPaymentOrdersExcludedCount: number;
  orderItemsCount: number;
  invoicesCount: number;
  settlementsCount: number;
  customerSessionsCount: number;
  auditLogsCount: number;
  financialTotal: number;
  taxTotal: number;
  estimatedExportSizeBytes: number;
  estimatedExportSizeFormatted: string;
  earliestRecordDate: string | null;
  latestRecordDate: string | null;
}

export interface CleanupPreview {
  expiredEmptySessionsCount: number;
  expiredSessionsDetails: Array<{ id: string; startedAt: string; tableNumber: string }>;
  oldDiagnosticLogsCount: number;
}

export interface RestorePreview {
  archiveId: string;
  startDate: string;
  endDate: string;
  ordersCount: number;
  alreadyExistingOrdersCount: number;
  newOrdersToRestoreCount: number;
  invoicesCount: number;
  settlementsCount: number;
  financialTotal: number;
  canRestore: boolean;
  warnings: string[];
}
