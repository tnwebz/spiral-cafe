"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";
import {
  PrinterClient,
  DiscoveredPrinterCandidate,
} from "@/services/printerClient";
import type { PrinterSettings } from "@/lib/tables";
import {
  Printer,
  Wifi,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Activity,
  FileText,
  Sliders,
  ChevronDown,
  ChevronUp,
  Terminal,
  ExternalLink,
  Check,
  Copy,
  Clock,
  ArrowRight,
  Search,
  Sparkles,
  Download,
} from "lucide-react";

export default function AdminPrinterPage() {
  const printer = usePrinterStatus(3500);

  // Persistent settings state
  const [settings, setSettings] = useState<PrinterSettings>({
    printerModel: "CN811-UEWB",
    interfaceType: "ETHERNET",
    ipAddress: "192.168.1.233",
    port: 9100,
    paperWidthMm: 80,
    qzPrinterName: "CN811-UEWB",
    terminalName: "Billing 1",
    autoCut: true,
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSettingsAccordion, setShowSettingsAccordion] = useState(false);

  // Diagnostics & Test buttons state
  const [testingKitchen, setTestingKitchen] = useState(false);
  const [testingCounter, setTestingCounter] = useState(false);
  const [checkingConnections, setCheckingConnections] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    type: "success" | "warning" | "error" | "info";
    title: string;
    message: string;
    durationMs?: number;
  } | null>(null);

  // Discovery & Manual Approval state
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [approvingIp, setApprovingIp] = useState<string | null>(null);

  // Recent Print History state
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load database settings on mount
  useEffect(() => {
    fetch("/api/tables/printer-settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.settings) {
          setSettings(d.settings);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch recent print history when connector is online
  const loadHistory = useCallback(async () => {
    if (!printer.connectorOnline) return;
    setLoadingHistory(true);
    try {
      const logs = await PrinterClient.getPrintHistory(10);
      setHistory(logs);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [printer.connectorOnline]);

  useEffect(() => {
    if (printer.connectorOnline) {
      loadHistory();
    }
  }, [printer.connectorOnline, loadHistory]);

  // Handle Manual Connection Probe
  const handleCheckConnections = async () => {
    setCheckingConnections(true);
    setActionNotice(null);
    try {
      await printer.refresh();
      setActionNotice({
        type: "info",
        title: "Diagnostics Refresh Complete",
        message: "Dual printer reachability and Windows USB spooler states updated.",
      });
    } catch (err: any) {
      setActionNotice({
        type: "error",
        title: "Connection Check Failed",
        message: err.message || "Failed to contact local Windows print connector.",
      });
    } finally {
      setCheckingConnections(false);
    }
  };

  // Handle Print Test KOT (Kitchen Ethernet)
  const handlePrintTestKot = async () => {
    setTestingKitchen(true);
    setActionNotice(null);
    try {
      const res = await PrinterClient.printTestReceipt();
      if (res.success) {
        setActionNotice({
          type: "success",
          title: "Test KOT Printed Successfully",
          message: `Direct ESC/POS test slip printed on ${printer.kitchen.printerModel} (${res.durationMs || 0}ms).`,
          durationMs: res.durationMs,
        });
        loadHistory();
      } else {
        setActionNotice({
          type: "error",
          title: "Kitchen Test Print Failed",
          message: res.message || "Could not deliver ESC/POS print job to kitchen printer.",
        });
      }
    } catch (err: any) {
      setActionNotice({
        type: "error",
        title: "Test Print Error",
        message: err.message || "Failed to reach local print connector.",
      });
    } finally {
      setTestingKitchen(false);
    }
  };

  // Handle Print Test Bill (Counter USB)
  const handlePrintTestBill = async () => {
    setTestingCounter(true);
    setActionNotice(null);
    try {
      const res = await PrinterClient.printTestBill();
      if (res.success) {
        setActionNotice({
          type: "success",
          title: "Test Bill Printed Successfully",
          message: `Direct 58mm test bill printed on ${printer.counter.printerName} (${res.durationMs || 0}ms).`,
          durationMs: res.durationMs,
        });
        loadHistory();
      } else {
        setActionNotice({
          type: "error",
          title: "Counter Test Bill Failed",
          message: res.message || "Could not print to Windows USB spooler queue.",
        });
      }
    } catch (err: any) {
      setActionNotice({
        type: "error",
        title: "Bill Test Print Error",
        message: err.message || "Failed to reach local print connector.",
      });
    } finally {
      setTestingCounter(false);
    }
  };

  // Manual Trigger for Full Subnet Discovery
  const handleRunDiscovery = async () => {
    setIsDiscovering(true);
    setActionNotice(null);
    try {
      const res = await PrinterClient.discoverPrinters();
      await printer.refresh();
      if (res.success) {
        setActionNotice({
          type: "success",
          title: "Printer Discovery Completed",
          message: res.message || `Discovery routine scanned ${res.localSubnet}.`,
        });
      } else {
        setActionNotice({
          type: "warning",
          title: "Printer Discovery Scan Result",
          message: res.message || `No new verified printer detected on ${res.localSubnet}.`,
        });
      }
    } catch (err: any) {
      setActionNotice({
        type: "error",
        title: "Discovery Error",
        message: err.message || "Failed to run network discovery routine.",
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  // Approve Ambiguous Discovered Candidate
  const handleApproveCandidate = async (ip: string, port = 9100) => {
    setApprovingIp(ip);
    try {
      const res = await PrinterClient.approveDiscoveredPrinter(ip, port);
      if (res.success) {
        setSettings((prev) => ({ ...prev, ipAddress: ip, port }));
        await printer.refresh();
        setActionNotice({
          type: "success",
          title: "Printer Approved",
          message: `Kitchen printer address successfully updated to ${ip}:${port}.`,
        });
      } else {
        setActionNotice({
          type: "error",
          title: "Approval Failed",
          message: res.message || "Failed to approve candidate printer.",
        });
      }
    } catch (err: any) {
      setActionNotice({
        type: "error",
        title: "Approval Error",
        message: err.message || "Error communicating with connector.",
      });
    } finally {
      setApprovingIp(null);
    }
  };

  // Save Basic Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      // 1. Update local connector configuration
      await PrinterClient.updateConnectorConfig({
        printerIp: settings.ipAddress,
        printerPort: settings.port,
        printerName: settings.printerModel,
      });

      // 2. Persist in database
      const res = await fetch("/api/tables/printer-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      const d = await res.json();
      if (d.success) {
        setSaveSuccess(true);
        await printer.refresh();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      setActionNotice({
        type: "error",
        title: "Settings Save Failed",
        message: err.message || "Could not save printer settings.",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Derive Display Statuses
  const isKitchenOnline = printer.kitchen.printerReachable;
  const isSimulation = printer.kitchen.printerIp.startsWith("127.0.0.") && printer.kitchen.printerPort === 9102;
  const isCounterReady = printer.counter.ready;

  const discoveryState = printer.kitchen.discoveryState || "IDLE";
  const candidatesNeedingApproval = printer.kitchen.discoveryResult?.candidates?.filter(
    (c: DiscoveredPrinterCandidate) => c.confidence === "AMBIGUOUS"
  ) || [];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#faf9f5] pb-16 font-sans text-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">

          {/* ================================================================= */}
          {/* HEADER SECTION                                                    */}
          {/* ================================================================= */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-black/[0.06] pb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Dual Hardware POS
                </span>
                <span className="text-xs text-zinc-400 font-mono">v1.2.0</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 font-serif">
                Printer Connectivity
              </h1>
              <p className="text-sm text-zinc-600 mt-1">
                Spiral Cafe · Windows Print Connector &amp; Automatic IP Recovery Dashboard
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Connector Status Pill */}
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${
                  printer.connectorOnline
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    printer.connectorOnline ? "bg-emerald-600 animate-pulse" : "bg-rose-500"
                  }`}
                />
                {printer.connectorOnline ? "Connector Online" : "Connector Offline"}
              </div>

              {/* Developer Diagnostics Lab Link */}
              <Link
                href="/admin/printer/diagnostics"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition-all shadow-sm"
              >
                <Terminal className="h-3.5 w-3.5 text-zinc-300" />
                <span>Diagnostics Lab</span>
              </Link>
            </div>
          </div>

          {/* ================================================================= */}
          {/* ACTION NOTICE TOAST / BANNER                                      */}
          {/* ================================================================= */}
          {actionNotice && (
            <div
              className={`p-4 rounded-2xl border text-sm flex items-start gap-3 transition-all ${
                actionNotice.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                  : actionNotice.type === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-950"
                  : actionNotice.type === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-950"
                  : "bg-blue-50 border-blue-200 text-blue-950"
              }`}
            >
              {actionNotice.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : actionNotice.type === "warning" ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              ) : actionNotice.type === "error" ? (
                <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Activity className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">{actionNotice.title}</div>
                <div className="text-xs opacity-90 mt-0.5">{actionNotice.message}</div>
              </div>
              <button
                onClick={() => setActionNotice(null)}
                className="text-xs font-semibold opacity-60 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ================================================================= */}
          {/* DOWNLOAD CONNECTOR BANNER (PROMINENT WHEN OFFLINE)                */}
          {/* ================================================================= */}
          {!printer.connectorOnline ? (
            <div className="bg-gradient-to-r from-amber-500/10 via-white to-amber-500/5 rounded-3xl p-6 sm:p-7 border-2 border-amber-500/30 shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] relative overflow-hidden">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-900 text-xs font-bold uppercase tracking-wider">
                    <Download className="h-3.5 w-3.5 text-amber-700" />
                    Restaurant Desktop Service Required
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-950 font-serif tracking-tight">
                    Print Connector Not Running on this PC
                  </h2>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Spiral Cafe connects directly to both the Ethernet kitchen printer and USB counter printer through a lightweight, background Windows service. No terminal or coding knowledge is required.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px] font-semibold text-zinc-800">
                    <div className="bg-white/90 p-3 rounded-2xl border border-amber-200/60 shadow-xs">
                      <span className="text-amber-700 block text-xs font-bold mb-0.5">1. Download</span>
                      Get SpiralCafe-Printer-Setup.exe
                    </div>
                    <div className="bg-white/90 p-3 rounded-2xl border border-amber-200/60 shadow-xs">
                      <span className="text-amber-700 block text-xs font-bold mb-0.5">2. Run Setup</span>
                      Click Next &amp; Install (starts automatically)
                    </div>
                    <div className="bg-white/90 p-3 rounded-2xl border border-amber-200/60 shadow-xs">
                      <span className="text-amber-700 block text-xs font-bold mb-0.5">3. Ready</span>
                      Status turns Green automatically!
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-zinc-500 pt-1">
                    <span>Installed: <strong className="text-rose-700">Offline / Not Detected</strong></span>
                    <span>•</span>
                    <span>Installer Package: <strong className="text-zinc-900">v1.2.0 (Windows 10 / 11)</strong></span>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                  <a
                    href="/downloads/SpiralCafe-Printer-Setup.exe"
                    download="SpiralCafe-Printer-Setup.exe"
                    className="px-6 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2.5 transform hover:-translate-y-0.5 text-center cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Windows Installer</span>
                  </a>
                  <a
                    href="/downloads/SpiralCafePrintConnector.exe"
                    download="SpiralCafePrintConnector.exe"
                    className="px-4 py-2 rounded-xl bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 text-center shadow-xs"
                  >
                    <span>Download Standalone Executable (.exe)</span>
                  </a>
                  <span className="text-[10px] text-zinc-500 font-medium text-center">
                    Installer (22.2 MB) • Standalone (87.2 MB)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-zinc-900 flex items-center gap-2">
                    <span>Print Connector Daemon Active</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                      v{printer.version || "1.2.0"}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-[11px] mt-0.5">
                    Installed on this machine. Need to install on another billing counter or reinstall?
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-zinc-400 font-mono mr-1">Installer: v1.2.0</span>
                <a
                  href="/downloads/SpiralCafe-Printer-Setup.exe"
                  download="SpiralCafe-Printer-Setup.exe"
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-800 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-zinc-600" />
                  <span>Download Setup.exe</span>
                </a>
                <a
                  href="/downloads/SpiralCafePrintConnector.exe"
                  download="SpiralCafePrintConnector.exe"
                  className="px-2.5 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-xs font-semibold transition-all"
                  title="Direct Standalone Executable"
                >
                  <span>Standalone</span>
                </a>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 1: PRINTER STATUS CARDS (Bento Grid)                      */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* CARD 1: KITCHEN ETHERNET PRINTER */}
            <div className="bg-white rounded-3xl p-6 border border-black/[0.04] shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                      <Printer className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-zinc-950">Kitchen Printer</h2>
                        {isSimulation && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Simulation
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        {isSimulation ? "Loopback · TCP 9102" : "Ethernet · TCP 9100"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      isKitchenOnline
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isKitchenOnline ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    {isKitchenOnline ? (isSimulation ? "Simulation Ready" : "Connected") : "Disconnected"}
                  </span>
                </div>

                <div className="space-y-2.5 py-3 border-y border-zinc-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Hardware Model</span>
                    <span className="font-semibold text-zinc-900 font-mono">CN811-UEWB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Target IP Address</span>
                    <span className="font-semibold text-zinc-900 font-mono">
                      {printer.kitchen.printerIp}:{printer.kitchen.printerPort}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Ethernet MAC</span>
                    <span className="font-semibold text-zinc-700 font-mono">
                      {printer.kitchen.macAddress || "E4:66:E5:12:24:29"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">DNS Hostname</span>
                    <span className="font-semibold text-zinc-700 font-mono">CN811-UEWB-EDAA</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Auto IP Recovery Enabled
                </span>
                <span className="text-zinc-400">80mm Thermal Receipt</span>
              </div>
            </div>

            {/* CARD 2: COUNTER USB BILL PRINTER */}
            <div className="bg-white rounded-3xl p-6 border border-black/[0.04] shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-blue-500/10 text-blue-700 flex items-center justify-center">
                      <HardDrive className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-zinc-950">Bill Printer</h2>
                      <p className="text-xs text-zinc-500">USB · Windows Queue</p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      isCounterReady
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : printer.counter.deviceFound
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isCounterReady
                          ? "bg-emerald-500"
                          : printer.counter.deviceFound
                          ? "bg-amber-500"
                          : "bg-zinc-400"
                      }`}
                    />
                    {isCounterReady
                      ? "Ready"
                      : printer.counter.driverInstalled === false
                      ? "Driver Missing"
                      : "Disconnected"}
                  </span>
                </div>

                <div className="space-y-2.5 py-3 border-y border-zinc-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Hardware Model</span>
                    <span className="font-semibold text-zinc-900 font-mono">KP206B-UB / POS-58</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Windows Queue</span>
                    <span className="font-semibold text-zinc-900 font-mono">
                      {printer.counter.printerName || "POS-58-Series"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Hardware ID</span>
                    <span className="font-semibold text-zinc-700 font-mono">
                      VID_09C5 &amp; PID_58DE
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Queue Port</span>
                    <span className="font-semibold text-zinc-700 font-mono">
                      {printer.counter.portName || "USB001"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                  Automatic Detection
                </span>
                <span className="text-zinc-400">58mm Customer Bill</span>
              </div>
            </div>

          </div>

          {/* ================================================================= */}
          {/* SECTION 2: AUTOMATIC IP RECOVERY (The Operational Showcase)       */}
          {/* ================================================================= */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-black/[0.04] shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950">Automatic IP Recovery</h3>
                  <p className="text-xs text-zinc-500">
                    Monitor, rediscover and reconnect Ethernet kitchen printer without manual IP configuration
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                Auto-Recovery Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  Kitchen IP Address
                </div>
                <div className="text-base font-bold text-zinc-950 font-mono">
                  {printer.kitchen.printerIp || "192.168.1.233"}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">
                  Target: {printer.kitchen.printerIp === "192.168.1.233" ? "Default Production" : "Auto-Detected"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  Last Verified Connection
                </div>
                <div className="text-base font-bold text-zinc-950">
                  {isKitchenOnline ? printer.kitchen.lastChecked || "Just now" : "Offline"}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">
                  {printer.kitchen.lastAutoReconnectedAt
                    ? `Auto-reconnected at ${new Date(printer.kitchen.lastAutoReconnectedAt).toLocaleTimeString()}`
                    : isKitchenOnline
                    ? "Continuous 10s health monitor"
                    : "Awaiting live hardware test"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  Printer Recovery Status
                </div>
                <div className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      discoveryState === "SEARCHING"
                        ? "bg-amber-500 animate-ping"
                        : isKitchenOnline
                        ? "bg-emerald-500"
                        : "bg-zinc-400"
                    }`}
                  />
                  <span>
                    {discoveryState === "SEARCHING"
                      ? "Searching Subnet..."
                      : discoveryState === "NEEDS_APPROVAL"
                      ? "Approval Required"
                      : isKitchenOnline
                      ? "Idle / Healthy"
                      : "Idle"}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1 truncate">
                  {printer.kitchen.discoveryResult?.message || "No recovery currently running"}
                </div>
              </div>
            </div>

            {/* Candidate Approval Alert (if foreign or ambiguous port 9100 device detected) */}
            {candidatesNeedingApproval.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Printer Identification Required</h4>
                    <p className="text-xs text-amber-900 mt-0.5">
                      The discovery engine detected candidate devices with port 9100 open, but the MAC address did not match enrolled CN811-UEWB hardware. Please confirm before auto-switching.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {candidatesNeedingApproval.map((c) => (
                    <div
                      key={c.ip}
                      className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <div className="font-bold font-mono text-zinc-950">{c.ip}:{c.port}</div>
                        <div className="text-zinc-500 text-[11px]">{c.modelHint || "Raw ESC/POS Device"} · MAC: {c.macAddress || "Unknown"}</div>
                      </div>
                      <button
                        onClick={() => handleApproveCandidate(c.ip, c.port)}
                        disabled={approvingIp === c.ip}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-sm"
                      >
                        {approvingIp === c.ip ? "Approving..." : "Approve Device"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 3: PRINTER ACTIONS & TESTING CONTROLS                     */}
          {/* ================================================================= */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-black/[0.04] shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] space-y-4">
            <h3 className="text-base font-bold text-zinc-950">Printer Testing &amp; Diagnostics</h3>
            <p className="text-xs text-zinc-500">
              Run direct ESC/POS hardware tests. Action buttons are automatically enabled when the respective printer is online.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Button 1: Check Printer Connections */}
              <button
                onClick={handleCheckConnections}
                disabled={checkingConnections}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${checkingConnections ? "animate-spin" : ""}`} />
                <span>{checkingConnections ? "Checking..." : "Check Printer Connections"}</span>
              </button>

              {/* Button 2: Print Test KOT */}
              <button
                onClick={handlePrintTestKot}
                disabled={testingKitchen || !printer.connectorOnline || !isKitchenOnline}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                <Printer className="h-4 w-4" />
                <span>{testingKitchen ? "Sending ESC/POS Slip..." : "Print Test KOT (Kitchen)"}</span>
              </button>

              {/* Button 3: Print Test Bill */}
              <button
                onClick={handlePrintTestBill}
                disabled={testingCounter || !printer.connectorOnline || !isCounterReady}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                <HardDrive className="h-4 w-4" />
                <span>{testingCounter ? "Printing 58mm Bill..." : "Print Test Bill (Counter)"}</span>
              </button>

              {/* Button 4: Force Subnet Discovery Scan */}
              <button
                onClick={handleRunDiscovery}
                disabled={isDiscovering || !printer.connectorOnline}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition-all disabled:opacity-40"
              >
                <Search className={`h-3.5 w-3.5 ${isDiscovering ? "animate-spin" : ""}`} />
                <span>{isDiscovering ? "Scanning Subnet..." : "Scan Network"}</span>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION 4: RECENT PRINT ACTIVITY AUDIT LOG                        */}
          {/* ================================================================= */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-black/[0.04] shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Recent Print Activity</h3>
                <p className="text-xs text-zinc-500">Audit log recorded by Windows connector daemon</p>
              </div>
              <button
                onClick={loadHistory}
                disabled={loadingHistory || !printer.connectorOnline}
                className="text-xs text-zinc-500 hover:text-zinc-900 font-semibold flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loadingHistory ? "animate-spin" : ""}`} />
                <span>Refresh Log</span>
              </button>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-10 text-xs text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                {printer.connectorOnline
                  ? "No print jobs recorded in current session. Dispatch a test KOT to verify transmission."
                  : "Start the Windows Print Connector service to inspect live print activity."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-400 uppercase text-[10px] tracking-wider">
                      <th className="pb-2.5 font-semibold">Time</th>
                      <th className="pb-2.5 font-semibold">Job / Order</th>
                      <th className="pb-2.5 font-semibold">Table</th>
                      <th className="pb-2.5 font-semibold">Target Printer</th>
                      <th className="pb-2.5 font-semibold">Status</th>
                      <th className="pb-2.5 font-semibold text-right">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {history.map((item, idx) => (
                      <tr key={item.attemptId || idx} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-2.5 text-zinc-500 font-mono text-[11px]">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "--"}
                        </td>
                        <td className="py-2.5 font-bold text-zinc-900">
                          {item.orderNumber || item.kotId || "System Test"}
                        </td>
                        <td className="py-2.5 text-zinc-600 font-mono">
                          {item.tableNumber || "--"}
                        </td>
                        <td className="py-2.5 text-zinc-600">
                          {item.printerModel || "CN811-UEWB"}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === "SUCCESS" || item.status === "CONFIRMED" || item.status === "SENT_UNVERIFIED"
                                ? "bg-emerald-50 text-emerald-700"
                                : item.status === "ALREADY_PRINTED"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {item.status === "SUCCESS" || item.status === "SENT_UNVERIFIED" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-500">
                          {item.durationMs ? `${item.durationMs}ms` : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 5: COLLAPSIBLE BASIC PRINTER SETTINGS                     */}
          {/* ================================================================= */}
          <div className="bg-white rounded-3xl border border-black/[0.04] shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] overflow-hidden">
            <button
              onClick={() => setShowSettingsAccordion(!showSettingsAccordion)}
              className="w-full p-6 flex items-center justify-between text-left hover:bg-zinc-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-zinc-100 text-zinc-700 flex items-center justify-center">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950">Printer Hardware Settings</h3>
                  <p className="text-xs text-zinc-500">
                    Target IP, port, paper dimensions and counter queue configuration
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                <span>{showSettingsAccordion ? "Collapse" : "Expand"}</span>
                {showSettingsAccordion ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {showSettingsAccordion && (
              <form onSubmit={handleSaveSettings} className="p-6 pt-0 border-t border-zinc-100 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      Kitchen Ethernet IP Address
                    </label>
                    <input
                      type="text"
                      value={settings.ipAddress}
                      onChange={(e) => setSettings({ ...settings, ipAddress: e.target.value })}
                      placeholder="192.168.1.233"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">Default restaurant target: 192.168.1.233</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      Kitchen Raw TCP Port
                    </label>
                    <input
                      type="number"
                      value={settings.port}
                      onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value, 10) || 9100 })}
                      placeholder="9100"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">Standard ESC/POS port: 9100</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      Kitchen Paper Width
                    </label>
                    <select
                      value={settings.paperWidthMm}
                      onChange={(e) => setSettings({ ...settings, paperWidthMm: parseInt(e.target.value, 10) as 80 | 58 })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-950 bg-white"
                    >
                      <option value={80}>80mm Thermal Receipt (Standard Kitchen)</option>
                      <option value={58}>58mm Thermal Receipt</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      Counter USB Windows Queue Name
                    </label>
                    <input
                      type="text"
                      value={settings.qzPrinterName || "POS-58-Series"}
                      onChange={(e) => setSettings({ ...settings, qzPrinterName: e.target.value })}
                      placeholder="POS-58-Series"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">Windows spooler queue for KP206B-UB</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-zinc-500">
                    {saveSuccess && (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Settings saved and synced with connector!
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-5 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                  >
                    {savingSettings ? "Saving Settings..." : "Save Printer Settings"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 6: DEVELOPER DIAGNOSTICS LAB ENTRY BANNER                 */}
          {/* ================================================================= */}
          <div className="p-5 rounded-3xl bg-zinc-100/80 border border-zinc-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-zinc-800">
                <Terminal className="h-4 w-4 text-zinc-600" />
                <span>Need low-level ESC/POS inspection or IP change simulation?</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Visit the Developer Diagnostics Lab to test loopback IP migration, hex dumps, and virtual thermal preview.
              </p>
            </div>

            <Link
              href="/admin/printer/diagnostics"
              className="px-4 py-2 rounded-xl bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-900 text-xs font-bold transition-all shrink-0 shadow-xs flex items-center gap-1.5"
            >
              <span>Open Diagnostics Lab</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
            </Link>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
