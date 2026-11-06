/**
 * Spiral Cafe Kitchen Print Connector Client
 * Direct HTTP bridge to local Windows service on http://127.0.0.1:4318
 * Zero QZ Tray dependency. ESC/POS raw TCP communication to CN811-UEWB on Port 9100.
 */

export interface PrinterState {
  connectorOnline: boolean;
  printerReachable: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "WARNING" | "CHECKING" | "IDENTIFICATION_REQUIRED";
  latencyMs: number;
  lastChecked: string;
  printerIp: string;
  printerPort: number;
  printerModel: string;
  macAddress?: string;
  macVerified?: boolean;
  discoveryState?: "IDLE" | "SEARCHING" | "VERIFIED" | "NEEDS_APPROVAL";
  discoveryResult?: {
    stage?: string;
    oldIp?: string;
    newIp?: string;
    message?: string;
    candidates?: DiscoveredPrinterCandidate[];
  };
  lastAutoReconnectedAt?: string;
  error?: string;
}

export interface CounterPrinterState {
  printerModel: string;
  printerName: string;
  interface: "USB";
  paperWidthMm: number;
  status: "CONNECTED" | "DISCONNECTED" | "NOT_READY" | "UNKNOWN" | "OFFLINE";
  ready: boolean;
  deviceFound: boolean;
  driverInstalled: boolean;
  portName?: string | null;
  message: string;
  lastChecked: string;
}

export interface DiscoveredPrinterCandidate {
  ip: string;
  port: number;
  hostname?: string;
  macAddress?: string;
  latencyMs: number;
  modelHint: string;
  isConfiguredTarget: boolean;
  macRecommendation: string;
  macMatched?: boolean;
  hostnameMatched?: boolean;
  confidence?: "HIGH_VERIFIED" | "AMBIGUOUS";
  stageFound?: string;
  verificationReason?: string;
}

export interface DecodedVirtualKotItem {
  name: string;
  quantity: number;
  notes?: string;
}

export interface DecodedVirtualReceipt {
  rawBytesLength: number;
  receivedAt: string;
  brandName?: string;
  orderNumber?: string;
  tableNumber?: string;
  kotId?: string;
  round?: number;
  terminalName?: string;
  dateTime?: string;
  items: DecodedVirtualKotItem[];
  specialInstructions?: string;
  paperCutDetected: boolean;
  rawText: string;
  formattedLines: string[];
  hexDump: string;
  unsupportedCommands: string[];
}

export interface VirtualPrinterJob {
  id: string;
  receivedAt: string;
  sourceIp: string;
  bytesCount: number;
  decoded: DecodedVirtualReceipt;
}

export interface VirtualPrinterStatus {
  success: boolean;
  isRunning: boolean;
  host: string;
  port: number;
  jobCount: number;
  startedAt?: string;
  lastJobAt?: string;
  isTargeted: boolean;
  currentConfig?: {
    printerIp: string;
    printerPort: number;
  };
}

export interface DualPrinterState {
  connectorOnline: boolean;
  kitchen: PrinterState;
  counter: CounterPrinterState;
}

export interface CustomerBillItem {
  name: string;
  quantity: number;
  price: number;
  lineTotal: number;
}

export interface CustomerBillPayload {
  visitId: string;
  billNumber?: string;
  orderNumber: string;
  tableNumber: string;
  dateStr?: string;
  timeStr?: string;
  terminalName?: string;
  paymentMode: "CASH" | "ONLINE" | "UPI" | "CARD" | string;
  items: CustomerBillItem[];
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
  tax?: number;
  packagingFee?: number;
  grandTotal: number;
  isDuplicate?: boolean;
}

export interface KotPrintResult {
  success: boolean;
  attemptId: string;
  kotId: string;
  outcome: "CONFIRMED" | "FAILED" | "UNKNOWN" | "RECONCILIATION_REQUIRED";
  message: string;
  durationMs?: number;
  duplicateSuppressed?: boolean;
  dbSynced?: boolean;
}

const CONNECTOR_BASE_URL = "http://127.0.0.1:4318";

export class PrinterClient {
  /**
   * Check if local background connector process is active on Windows port 4318
   */
  static async checkConnectorHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.status === "ok" || data.status === "ONLINE";
    } catch {
      return false;
    }
  }

  /**
   * Get real-time printer status (TCP reachability to CN811-UEWB port 9100)
   */
  static async getPrinterStatus(force = false): Promise<PrinterState> {
    const defaultState: PrinterState = {
      connectorOnline: false,
      printerReachable: false,
      status: "DISCONNECTED",
      latencyMs: 0,
      lastChecked: new Date().toLocaleTimeString(),
      printerIp: "192.168.1.233",
      printerPort: 9100,
      printerModel: "CN811-UEWB",
      error: "Spiral Print Connector is offline. Ensure background service is running on 127.0.0.1:4318",
    };

    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/status${force ? "?force=true" : ""}`, {
        method: "GET",
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) {
        return {
          ...defaultState,
          connectorOnline: true,
          status: "WARNING",
          error: `Connector returned HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      const kitchenData = data.kitchen || data;
      
      const isReachable = Boolean(
        kitchenData.printerReachable !== undefined
          ? kitchenData.printerReachable
          : (kitchenData.status === "CONNECTED" || kitchenData.probe?.reachable)
      );

      const status: "CONNECTED" | "DISCONNECTED" | "WARNING" = isReachable
        ? "CONNECTED"
        : kitchenData.status === "WARNING"
        ? "WARNING"
        : "DISCONNECTED";

      return {
        connectorOnline: true,
        printerReachable: isReachable,
        status,
        latencyMs: kitchenData.latencyMs ?? kitchenData.probe?.durationMs ?? kitchenData.probe?.latencyMs ?? 0,
        lastChecked: new Date(kitchenData.lastChecked || data.timestamp || Date.now()).toLocaleTimeString(),
        printerIp: kitchenData.printerIp || data.config?.printerIp || "192.168.1.233",
        printerPort: kitchenData.printerPort || data.config?.printerPort || 9100,
        printerModel: kitchenData.printerModel || data.config?.printerModel || "CN811-UEWB",
        error: isReachable
          ? undefined
          : (kitchenData.message || kitchenData.error || `Printer not responding at IP ${kitchenData.printerIp || "192.168.1.233"}:${kitchenData.printerPort || 9100}`),
      };
    } catch (err: any) {
      return {
        ...defaultState,
        error: "Cannot connect to local Spiral Print Connector (http://127.0.0.1:4318). Ensure the background service is running.",
      };
    }
  }

  /**
   * Get real-time dual printer status (CN811-UEWB Kitchen Ethernet + KP206B-UB Counter USB)
   */
  static async getDualPrinterStatus(force = false): Promise<DualPrinterState> {
    const defaultCounter: CounterPrinterState = {
      printerModel: "KP206B-UB",
      printerName: "POS-58-Series",
      interface: "USB",
      paperWidthMm: 58,
      status: "OFFLINE",
      ready: false,
      deviceFound: false,
      driverInstalled: false,
      message: "Connector is offline",
      lastChecked: new Date().toLocaleTimeString(),
    };

    const defaultKitchen: PrinterState = {
      connectorOnline: false,
      printerReachable: false,
      status: "DISCONNECTED",
      latencyMs: 0,
      lastChecked: new Date().toLocaleTimeString(),
      printerIp: "192.168.1.233",
      printerPort: 9100,
      printerModel: "CN811-UEWB",
      error: "Spiral Print Connector is offline",
    };

    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/status${force ? "?force=true" : ""}`, {
        method: "GET",
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) {
        return {
          connectorOnline: true,
          kitchen: { ...defaultKitchen, connectorOnline: true, status: "WARNING", error: `HTTP ${res.status}` },
          counter: { ...defaultCounter, status: "NOT_READY", message: `HTTP ${res.status}` },
        };
      }

      const data = await res.json();
      const kitchenData = data.kitchen || data;
      const counterData = data.counter || {};

      const isKitchenReachable = Boolean(
        kitchenData.printerReachable !== undefined
          ? kitchenData.printerReachable
          : (kitchenData.status === "CONNECTED" || kitchenData.probe?.reachable)
      );

      return {
        connectorOnline: true,
        kitchen: {
          connectorOnline: true,
          printerReachable: isKitchenReachable,
          status: isKitchenReachable ? "CONNECTED" : (kitchenData.status === "WARNING" ? "WARNING" : "DISCONNECTED"),
          latencyMs: kitchenData.latencyMs ?? kitchenData.probe?.durationMs ?? 0,
          lastChecked: new Date(kitchenData.lastChecked || data.timestamp || Date.now()).toLocaleTimeString(),
          printerIp: kitchenData.printerIp || "192.168.1.233",
          printerPort: kitchenData.printerPort || 9100,
          printerModel: kitchenData.printerModel || "CN811-UEWB",
          error: isKitchenReachable ? undefined : (kitchenData.message || kitchenData.error || "Kitchen printer offline"),
        },
        counter: {
          printerModel: counterData.printerModel || "KP206B-UB",
          printerName: counterData.printerName || "POS-58-Series",
          interface: "USB",
          paperWidthMm: counterData.paperWidthMm || 58,
          status: counterData.status || (counterData.ready ? "CONNECTED" : "DISCONNECTED"),
          ready: Boolean(counterData.ready),
          deviceFound: Boolean(counterData.deviceFound),
          driverInstalled: Boolean(counterData.driverInstalled),
          portName: counterData.portName,
          message: counterData.message || (counterData.ready ? "Counter printer ready" : "Counter printer disconnected"),
          lastChecked: new Date(counterData.lastChecked || Date.now()).toLocaleTimeString(),
        },
      };
    } catch {
      return {
        connectorOnline: false,
        kitchen: defaultKitchen,
        counter: defaultCounter,
      };
    }
  }

  /**
   * Get counter bill printer (USB) status
   */
  static async getCounterPrinterStatus(force = false): Promise<CounterPrinterState> {
    const dual = await this.getDualPrinterStatus(force);
    return dual.counter;
  }

  /**
   * Print 58mm customer payment bill via local USB printer
   */
  static async printCustomerBill(
    billPayload: CustomerBillPayload
  ): Promise<{ success: boolean; message: string; durationMs?: number }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/print-bill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        body: JSON.stringify({ billPayload }),
        signal: AbortSignal.timeout(8000),
      });

      const data = await res.json();
      return {
        success: Boolean(data.success),
        message:
          data.message ||
          (data.success ? "Customer bill printed successfully." : data.error || "Failed to print bill."),
        durationMs: data.durationMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to reach local print connector for customer bill.",
      };
    }
  }

  /**
   * Print 58mm test bill on counter printer
   */
  static async printTestCustomerBill(): Promise<{ success: boolean; message: string; durationMs?: number }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/print-test-bill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        signal: AbortSignal.timeout(6000),
      });

      const data = await res.json();
      return {
        success: Boolean(data.success),
        message:
          data.message ||
          (data.success ? "58mm test bill printed successfully!" : data.error || "Counter print failed."),
        durationMs: data.durationMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to reach local print connector.",
      };
    }
  }

  /**
   * Print test slip directly to CN811-UEWB
   */
  static async printTestReceipt(): Promise<{ success: boolean; message: string; durationMs?: number }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        signal: AbortSignal.timeout(5000),
      });

      const data = await res.json();
      return {
        success: Boolean(data.success),
        message: data.message || (data.success ? "Test print succeeded!" : data.error || "Test print failed."),
        durationMs: data.durationMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Print failed: ${err.message || "Failed to reach local connector"}`,
      };
    }
  }

  /**
   * Dispatches a signed KOT print to the local connector with full end-to-end status persistence
   */
  static async dispatchKotPrint(
    orderId: string,
    round = 1,
    terminalName = "Billing 1",
    forceReprint = false
  ): Promise<KotPrintResult> {
    try {
      // 1. Authorize KOT print via Next.js backend (HMAC-SHA256 signature generated server-side)
      const authRes = await fetch("/api/tables/kot/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, round, terminalName, forceReprint }),
      });

      if (!authRes.ok) {
        const errData = await authRes.json().catch(() => ({}));
        if (authRes.status === 409 && errData.alreadyConfirmed) {
          return {
            success: true,
            attemptId: `ALREADY_PRINTED-${orderId}-R${round}`,
            kotId: `KOT-ORD-${orderId}`,
            outcome: "CONFIRMED",
            duplicateSuppressed: true,
            dbSynced: true,
            message: errData.error || `KOT Round ${round} is already confirmed. Duplicate printing prevented.`,
          };
        }
        throw new Error(errData.error || `Server failed to authorize KOT (HTTP ${authRes.status})`);
      }

      const authData = await authRes.json();
      const { attemptId, kotPayload, authPayload, signature } = authData;

      // 2. Dispatch to local connector
      let connectorRes: Response;
      try {
        connectorRes = await fetch(`${CONNECTOR_BASE_URL}/printer/print-kot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signature}`,
          },
          body: JSON.stringify({
            attemptId,
            kotPayload,
            authPayload,
          }),
          signal: AbortSignal.timeout(7000),
        });
      } catch (networkErr: any) {
        // Connector is offline or unreachable - record as unknown / needs attention
        await this.syncKotBackendStatus(orderId, round, "REPORT_FAILURE", "Connector offline or timed out");
        return {
          success: false,
          attemptId,
          kotId: kotPayload?.kotId || `KOT-ORD-${orderId}`,
          outcome: "UNKNOWN",
          message: "Cannot communicate with local printer connector. Please check if the connector app is running.",
        };
      }

      const printResult = await connectorRes.json().catch(() => ({}));

      const isTransmitted = Boolean(
        printResult.success &&
        (printResult.status === "SENT_UNVERIFIED" ||
          printResult.status === "ALREADY_PRINTED" ||
          printResult.outcome === "CONFIRMED")
      );

      if (isTransmitted) {
        // TCP transmission completed successfully! Now sync database status
        const syncRes = await this.syncKotBackendStatus(orderId, round, "CONFIRM_PRINT", undefined, terminalName);

        if (syncRes.success) {
          return {
            success: true,
            attemptId,
            kotId: kotPayload.kotId,
            outcome: "CONFIRMED",
            message: printResult.message || `KOT #${kotPayload.kotId} successfully transmitted to kitchen printer (TCP delivered).`,
            durationMs: printResult.durationMs,
            duplicateSuppressed: Boolean(printResult.duplicateSuppressed || printResult.status === "ALREADY_PRINTED"),
            dbSynced: true,
          };
        } else {
          // Transmission succeeded to TCP socket, but DB update failed!
          // DO NOT claim printer failure; show accurate reconciliation requirement
          return {
            success: false,
            attemptId,
            kotId: kotPayload.kotId,
            outcome: "RECONCILIATION_REQUIRED",
            message: `KOT was successfully transmitted to the kitchen printer (TCP delivered), but the database update could not be confirmed: ${syncRes.error || "Database sync failed"}. Please confirm status without re-printing.`,
            durationMs: printResult.durationMs,
            duplicateSuppressed: Boolean(printResult.duplicateSuppressed || printResult.status === "ALREADY_PRINTED"),
            dbSynced: false,
          };
        }
      } else if (printResult.status === "UNKNOWN" || printResult.outcome === "UNKNOWN") {
        await this.syncKotBackendStatus(orderId, round, "MARK_UNKNOWN", printResult.message || "KOT outcome unverified");
        return {
          success: false,
          attemptId,
          kotId: kotPayload?.kotId || `KOT-ORD-${orderId}`,
          outcome: "UNKNOWN",
          message: printResult.message || "KOT print outcome could not be verified (connection interrupted).",
        };
      } else {
        await this.syncKotBackendStatus(orderId, round, "REPORT_FAILURE", printResult.error || printResult.message || "Print failed");
        return {
          success: false,
          attemptId,
          kotId: kotPayload?.kotId || `KOT-ORD-${orderId}`,
          outcome: "FAILED",
          message: printResult.error || printResult.message || "Kitchen printer is unavailable or disconnected.",
        };
      }
    } catch (err: any) {
      console.error("dispatchKotPrint exception:", err);
      return {
        success: false,
        attemptId: `ERR-${Date.now()}`,
        kotId: `KOT-${orderId}`,
        outcome: "FAILED",
        message: err.message || "An unexpected error occurred during KOT dispatch.",
      };
    }
  }

  /**
   * Helper to sync KOT status back to Next.js / Supabase database
   */
  static async syncKotBackendStatus(
    orderId: string,
    round: number,
    action: "CONFIRM_PRINT" | "REPORT_FAILURE" | "MARK_FAILED" | "MARK_UNKNOWN" | "MARK_HANDOFF" | "MARK_MANUAL",
    errorMessage?: string,
    adminUser = "Counter Admin"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch("/api/tables/kot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderId,
          round,
          adminUser,
          errorMessage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (err: any) {
      console.warn("Failed to synchronize KOT backend status:", err);
      return { success: false, error: err.message || "Network error syncing KOT status" };
    }
  }

  /**
   * Reconcile database state when print was already sent over TCP
   * but the database confirmation needs to be re-applied without re-printing.
   */
  static async reconcileKotStatus(
    orderId: string,
    round = 1,
    adminUser = "Counter Admin"
  ): Promise<{ success: boolean; error?: string }> {
    return this.syncKotBackendStatus(orderId, round, "CONFIRM_PRINT", undefined, adminUser);
  }

  /**
   * Record manual kitchen handoff if printer is out of paper or power is off
   */
  static async recordManualHandoff(orderId: string, round = 1, adminUser = "Counter Staff"): Promise<boolean> {
    try {
      const res = await fetch("/api/tables/kot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MARK_HANDOFF",
          orderId,
          round,
          adminUser,
        }),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  }

  /**
   * Check detailed connector health including version and uptime
   */
  static async getConnectorHealthDetails(): Promise<{
    online: boolean;
    version?: string;
    uptimeSeconds?: number;
    host?: string;
  }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return { online: false };
      const data = await res.json();
      return {
        online: true,
        version: data.version || "1.1.0",
        uptimeSeconds: data.uptimeSeconds,
        host: data.host,
      };
    } catch {
      return { online: false };
    }
  }

  /**
   * Pair the frontend dashboard with the local connector
   */
  static async pairWithConnector(secret = "spiral_kot_sig_7f8a9b2c3d4e5f6018273645"): Promise<{
    success: boolean;
    message: string;
    version?: string;
    printer?: any;
  }> {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/pair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ origin }),
        signal: AbortSignal.timeout(4000),
      });

      const data = await res.json();
      return {
        success: Boolean(data.success),
        message: data.message || (data.success ? "Pairing successful!" : data.error || "Pairing failed."),
        version: data.version,
        printer: data.printer,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Pairing failed: ${err.message || "Cannot connect to local service on 127.0.0.1:4318"}`,
      };
    }
  }

  /**
   * Fetch recent print history from connector audit log
   */
  static async getPrintHistory(limit = 20): Promise<any[]> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/history?limit=${limit}`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.history) ? data.history : [];
    } catch {
      return [];
    }
  }

  /**
   * Update printer IP or port settings in local connector
   */
  static async updateConnectorConfig(config: {
    printerIp?: string;
    printerPort?: number;
    printerName?: string;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/configure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      return { success: Boolean(data.success), message: data.message || data.error };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to update configuration." };
    }
  }

  /**
   * Safe automatic network discovery of kitchen ESC/POS printers on local subnet
   */
  static async discoverPrinters(): Promise<{
    success: boolean;
    localSubnet: string;
    foundPrinters: DiscoveredPrinterCandidate[];
    message: string;
  }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        signal: AbortSignal.timeout(6500),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Discovery returned HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        localSubnet: "Local Subnet",
        foundPrinters: [],
        message: err.message || "Failed to execute printer discovery on local subnet.",
      };
    }
  }

  /**
   * One-time administrator approval for a printer candidate
   */
  static async approveDiscoveredPrinter(ip: string, port = 9100): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/approve-candidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        body: JSON.stringify({ ip, port }),
        signal: AbortSignal.timeout(4000),
      });
      const data = await res.json();
      return {
        success: Boolean(res.ok && data.success),
        message: data.message || (res.ok ? "Printer candidate approved." : "Approval failed."),
      };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to reach connector service." };
    }
  }

  /**
   * Get Virtual Kitchen Printer status
   */
  static async getVirtualPrinterStatus(): Promise<VirtualPrinterStatus> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/virtual-printer/status`, {
        method: "GET",
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        success: false,
        isRunning: false,
        host: "127.0.0.1",
        port: 9102,
        jobCount: 0,
        isTargeted: false,
      };
    }
  }

  /**
   * Start Virtual Kitchen Printer TCP Server (127.0.0.1:9102)
   */
  static async startVirtualPrinter(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/virtual-printer/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        signal: AbortSignal.timeout(3000),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to start virtual printer." };
    }
  }

  /**
   * Stop Virtual Kitchen Printer TCP Server
   */
  static async stopVirtualPrinter(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/virtual-printer/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        signal: AbortSignal.timeout(3000),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to stop virtual printer." };
    }
  }

  /**
   * Fetch captured jobs from Virtual Kitchen Printer
   */
  static async getVirtualPrinterJobs(limit = 20): Promise<VirtualPrinterJob[]> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/virtual-printer/jobs?limit=${limit}`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.jobs) ? data.jobs : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear captured jobs from Virtual Kitchen Printer
   */
  static async clearVirtualPrinterJobs(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/virtual-printer/clear`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        signal: AbortSignal.timeout(2500),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to clear virtual printer jobs." };
    }
  }

  /**
   * Toggle between Virtual Simulation Mode (127.0.0.1:9102) and Production Mode (192.168.1.233:9100)
   */
  static async toggleVirtualPrinterMode(
    mode: "VIRTUAL" | "PRODUCTION"
  ): Promise<{ success: boolean; mode: string; message: string }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/virtual-printer/toggle-mode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        body: JSON.stringify({ mode }),
        signal: AbortSignal.timeout(4000),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, mode, message: err.message || "Failed to switch target mode." };
    }
  }

  /**
   * Print physical Table Transfer Notice to Kitchen / Service
   */
  static async printTableTransferNotice(notice: {
    visitId: string;
    fromTable: string;
    toTable: string;
    orderCount?: number;
    totalBill?: number;
    adminUser?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${CONNECTOR_BASE_URL}/printer/print-transfer-notice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer spiral_kot_sig_7f8a9b2c3d4e5f6018273645`,
        },
        body: JSON.stringify(notice),
      });
      const data = await res.json();
      return {
        success: Boolean(data.success),
        message:
          data.message ||
          (data.success
            ? `Table transfer notice sent to kitchen printer: Table ${notice.fromTable} -> ${notice.toTable}`
            : data.error || "Failed to print transfer notice."),
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err.message ||
          "Could not reach local printer connector. Please verify service is running.",
      };
    }
  }
}

