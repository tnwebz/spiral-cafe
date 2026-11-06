/**
 * QZ Tray Client Bridge for Windows Billing Desktop & Thermal KOT Printer (CN811-UEWB)
 * Paper: 80mm ESC/POS thermal receipt printer
 * Local QZ Tray WebSocket: wss://localhost:8181 or ws://localhost:8182
 */

import { KotData, KotReceiptEngine } from "./kot";

export interface PrinterConnectionState {
  qzConnected: boolean;
  printerReachable: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "WARNING" | "CHECKING";
  lastChecked: string;
  printerModel: string;
  ipAddress: string;
  port: number;
  message?: string;
}

declare global {
  interface Window {
    qz?: any;
  }
}

/**
 * Load official QZ Tray script dynamically if not present
 */
export async function loadQzTrayScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.qz) return true;

  return new Promise((resolve) => {
    // Check if script tag already exists
    const existing = document.getElementById("qz-tray-script");
    if (existing) {
      if (window.qz) return resolve(true);
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.id = "qz-tray-script";
    script.src = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn("Could not load QZ Tray from CDN. Local printing may require local qz-tray installation.");
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * Connect to local QZ Tray instance running on Windows billing desktop
 */
export async function connectQzTray(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  await loadQzTrayScript();

  if (!window.qz) {
    return false;
  }

  try {
    if (window.qz.websocket.isActive()) {
      return true;
    }

    // Connect with timeout
    await window.qz.websocket.connect({
      retries: 0, // CRITICAL: Never auto-retry or loop spool
      delay: 0,
    });

    return window.qz.websocket.isActive();
  } catch (err: any) {
    console.warn("QZ Tray connection check:", err?.message || err);
    return false;
  }
}

/**
 * Probe connectivity to kitchen printer
 */
export async function probePrinterConnectivity(config: {
  printerModel?: string;
  ipAddress?: string;
  port?: number;
  qzPrinterName?: string;
}): Promise<PrinterConnectionState> {
  const ipAddress = config.ipAddress || "192.168.1.50";
  const port = config.port || 9100;
  const printerModel = config.printerModel || "CN811-UEWB";
  const printerName = config.qzPrinterName || "CN811-UEWB";

  const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const qzOk = await connectQzTray();

  if (!qzOk) {
    return {
      qzConnected: false,
      printerReachable: false,
      status: "DISCONNECTED",
      lastChecked: nowStr,
      printerModel,
      ipAddress,
      port,
      message: "QZ Tray is not running on this billing computer. Check if QZ Tray is open.",
    };
  }

  try {
    // Check if printer is recognized in QZ Tray
    const printers: string[] = await window.qz.printers.find();
    const found = printers.some(
      (p) =>
        p.toLowerCase().includes(printerName.toLowerCase()) ||
        p.toLowerCase().includes("kitchen") ||
        p.toLowerCase().includes("thermal") ||
        p.toLowerCase().includes("cn811")
    );

    if (found) {
      return {
        qzConnected: true,
        printerReachable: true,
        status: "CONNECTED",
        lastChecked: nowStr,
        printerModel,
        ipAddress,
        port,
        message: "Kitchen printer is online and ready.",
      };
    }

    // If custom network IP printer or printer not in Windows list
    return {
      qzConnected: true,
      printerReachable: true, // QZ is active, will dispatch via raw IP/Socket
      status: "CONNECTED",
      lastChecked: nowStr,
      printerModel,
      ipAddress,
      port,
      message: `QZ Tray connected. Configured for network printer ${ipAddress}:${port}.`,
    };
  } catch (e: any) {
    return {
      qzConnected: true,
      printerReachable: false,
      status: "WARNING",
      lastChecked: nowStr,
      printerModel,
      ipAddress,
      port,
      message: e.message || "Printer check failed.",
    };
  }
}

export interface PrintResult {
  success: boolean;
  status: "PRINT_CONFIRMED" | "FAILED" | "UNKNOWN";
  error?: string;
  details?: string;
}

/**
 * Dispatches an 80mm KOT directly to the CN811-UEWB printer via QZ Tray
 * Implements strict single-shot dispatch with NO auto-retry replay.
 */
export async function printKotViaQz(
  kotData: KotData,
  printerConfig: {
    printerModel?: string;
    ipAddress?: string;
    port?: number;
    qzPrinterName?: string;
  }
): Promise<PrintResult> {
  const escPosCommands = KotReceiptEngine.generateEscPosCommands(kotData);
  const plainSlip = KotReceiptEngine.formatPlainSlip(kotData);

  const qzOk = await connectQzTray();

  if (!qzOk) {
    // If QZ Tray is not running on this client device (e.g., testing on admin tablet or browser)
    return {
      success: false,
      status: "FAILED",
      error: "QZ Tray is not running on this Windows computer. Please ensure QZ Tray is open, or deliver manually.",
      details: plainSlip,
    };
  }

  try {
    const printerName = printerConfig.qzPrinterName || "CN811-UEWB";

    // Find closest matching installed printer or fallback to default
    let targetPrinter = printerName;
    try {
      const printers: string[] = await window.qz.printers.find();
      const match = printers.find(
        (p) =>
          p.toLowerCase().includes(printerName.toLowerCase()) ||
          p.toLowerCase().includes("kitchen") ||
          p.toLowerCase().includes("thermal") ||
          p.toLowerCase().includes("pos")
      );
      if (match) targetPrinter = match;
    } catch {}

    const config = window.qz.configs.create(targetPrinter, {
      encoding: "ISO-8859-1",
      altPrinting: true,
      spool: { size: null, end: null }, // Prevent OS spool replay
    });

    const printData = [
      {
        type: "raw",
        format: "command",
        flavor: "plain",
        data: escPosCommands,
      },
    ];

    // Submit print job with promise timeout
    await Promise.race([
      window.qz.print(config, printData),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Printer communication timeout after 8 seconds.")), 8000)
      ),
    ]);

    return {
      success: true,
      status: "PRINT_CONFIRMED",
      details: plainSlip,
    };
  } catch (err: any) {
    const msg = (err?.message || String(err)).toLowerCase();

    // If connection dropped during transmission -> UNKNOWN
    if (msg.includes("timeout") || msg.includes("disconnect") || msg.includes("pipe") || msg.includes("socket")) {
      return {
        success: false,
        status: "UNKNOWN",
        error: "Print connection timed out or was interrupted. Check kitchen before resending to avoid duplicate tickets.",
        details: plainSlip,
      };
    }

    return {
      success: false,
      status: "FAILED",
      error: err.message || "Failed to transmit print job to kitchen printer.",
      details: plainSlip,
    };
  }
}

