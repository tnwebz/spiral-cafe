"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";
import {
  PrinterClient,
  CounterPrinterState,
  DiscoveredPrinterCandidate,
  VirtualPrinterJob,
  VirtualPrinterStatus,
} from "@/services/printerClient";
import type { PrinterSettings } from "@/lib/tables";
import {
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sliders,
  FileText,
  ShieldCheck,
  Wifi,
  Network,
  Clock,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  HardDrive,
  Info,
  Search,
  ChevronDown,
  ChevronUp,
  Cpu,
  Radio,
  Play,
  Square,
  Trash2,
  Scissors,
  Eye,
} from "lucide-react";

export default function AdminPrinterPage() {
  const printer = usePrinterStatus(3500);

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

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Diagnostics state
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    type: "success" | "warning" | "error" | "info";
    title: string;
    message: string;
    durationMs?: number;
  } | null>(null);

  // Counter Bill Printer (USB) State & Diagnostics
  const [testingCounterPrint, setTestingCounterPrint] = useState(false);
  const [checkingUsbStatus, setCheckingUsbStatus] = useState(false);
  const [counterDiagnosticResult, setCounterDiagnosticResult] = useState<{
    type: "success" | "warning" | "error" | "info";
    title: string;
    message: string;
    durationMs?: number;
  } | null>(null);

  // Discovery State
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [approvingIp, setApprovingIp] = useState<string | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<{
    localSubnet: string;
    foundPrinters: DiscoveredPrinterCandidate[];
    message: string;
  } | null>(null);

  const handleApproveCandidate = async (ip: string, port = 9100) => {
    setApprovingIp(ip);
    try {
      const res = await PrinterClient.approveDiscoveredPrinter(ip, port);
      if (res.success) {
        setSettings((prev) => ({ ...prev, ipAddress: ip, port }));
        printer.refresh();
      } else {
        alert("Failed to approve printer candidate: " + res.message);
      }
    } catch (err: any) {
      alert("Error approving candidate: " + err.message);
    } finally {
      setApprovingIp(null);
    }
  };

  // Virtual Printer (Simulation Mode) State
  const [virtualStatus, setVirtualStatus] = useState<VirtualPrinterStatus | null>(null);
  const [virtualJobs, setVirtualJobs] = useState<VirtualPrinterJob[]>([]);
  const [virtualLoading, setVirtualLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<VirtualPrinterJob | null>(null);
  const [receiptViewTab, setReceiptViewTab] = useState<"VISUAL" | "RAW" | "HEX">("VISUAL");

  // Pairing state
  const [pairing, setPairing] = useState(false);
  const [pairedSuccess, setPairedSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Print history audit log
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Developer diagnostics accordion
  const [showTechDiagnostics, setShowTechDiagnostics] = useState(false);

  // Load persistent settings from database
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
      const logs = await PrinterClient.getPrintHistory(15);
      setHistory(logs);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [printer.connectorOnline]);

  // Poll Virtual Printer status and jobs
  const refreshVirtualPrinter = useCallback(async () => {
    if (!printer.connectorOnline) return;
    try {
      const [vStatus, jobs] = await Promise.all([
        PrinterClient.getVirtualPrinterStatus(),
        PrinterClient.getVirtualPrinterJobs(15),
      ]);
      setVirtualStatus(vStatus);
      setVirtualJobs(jobs);
      if (jobs.length > 0 && !selectedJob) {
        setSelectedJob(jobs[0]);
      }
    } catch {}
  }, [printer.connectorOnline, selectedJob]);

  useEffect(() => {
    if (printer.connectorOnline) {
      loadHistory();
      refreshVirtualPrinter();
      const interval = setInterval(() => {
        refreshVirtualPrinter();
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [printer.connectorOnline, loadHistory, refreshVirtualPrinter]);

  // Test Raw TCP Socket Reachability to active target
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setDiagnosticResult(null);
    try {
      const res = await PrinterClient.getPrinterStatus(true);
      const isSim = res.printerIp === "127.0.0.1" && res.printerPort === 9102;
      if (res.printerReachable) {
        setDiagnosticResult({
          type: "success",
          title: isSim ? "Virtual Kitchen Printer Reachable" : "Kitchen Printer Reachable",
          message: isSim
            ? `Successfully connected to Virtual ESC/POS TCP Printer at 127.0.0.1:9102 (SIMULATION). Socket round-trip: ${res.latencyMs}ms.`
            : `Successfully probed CN811-UEWB at ${res.printerIp}:${res.printerPort}. Socket round-trip latency: ${res.latencyMs}ms.`,
          durationMs: res.latencyMs,
        });
      } else {
        setDiagnosticResult({
          type: "warning",
          title: isSim ? "Virtual Kitchen Printer Offline" : "Kitchen Printer Unreachable",
          message: isSim
            ? "Virtual Printer TCP server on 127.0.0.1:9102 is not running. Click 'Start Virtual Printer' below to start it."
            : res.error ||
              `Connector is running, but the kitchen printer at ${res.printerIp}:${res.printerPort} did not respond. Check printer power switch and Ethernet cable to router.`,
        });
      }
    } catch (err: any) {
      setDiagnosticResult({
        type: "error",
        title: "Connection Probe Failed",
        message: err.message || "Unable to reach local connector service on 127.0.0.1:4318.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Test Print Physical / Virtual KOT Slip
  const handlePrintTestKot = async () => {
    setTestingPrint(true);
    setDiagnosticResult(null);
    try {
      const res = await PrinterClient.printTestReceipt();
      const isSim = printer.kitchen?.printerIp === "127.0.0.1" && printer.kitchen?.printerPort === 9102;
      if (res.success) {
        setDiagnosticResult({
          type: "success",
          title: isSim ? "Test KOT Received by Virtual Printer" : "Test KOT Printed Successfully",
          message: isSim
            ? `ESC/POS 80mm test slip transmitted to Virtual Printer at 127.0.0.1:9102 in ${res.durationMs || 15}ms! Check the Receipt Preview below.`
            : res.message ||
              `ESC/POS 80mm test slip transmitted and cut in ${res.durationMs || 45}ms. Please check physical kitchen printer tray.`,
          durationMs: res.durationMs,
        });
        loadHistory();
        refreshVirtualPrinter();
      } else {
        setDiagnosticResult({
          type: "error",
          title: "Test Print Failed",
          message:
            res.message ||
            "Kitchen printer failed to accept ESC/POS print job. Verify printer IP and paper roll in tray.",
        });
      }
    } catch (err: any) {
      setDiagnosticResult({
        type: "error",
        title: "Print Exception",
        message: err.message || "Test print failed.",
      });
    } finally {
      setTestingPrint(false);
    }
  };

  // Virtual Printer Controls
  const handleToggleVirtualServer = async (start: boolean) => {
    setVirtualLoading(true);
    try {
      if (start) {
        await PrinterClient.startVirtualPrinter();
      } else {
        await PrinterClient.stopVirtualPrinter();
      }
      await refreshVirtualPrinter();
      printer.refresh();
    } finally {
      setVirtualLoading(false);
    }
  };

  const handleSwitchTargetMode = async (mode: "VIRTUAL" | "PRODUCTION") => {
    setVirtualLoading(true);
    try {
      const res = await PrinterClient.toggleVirtualPrinterMode(mode);
      if (res.success) {
        if (mode === "VIRTUAL") {
          setSettings((prev) => ({ ...prev, ipAddress: "127.0.0.1", port: 9102 }));
        } else {
          setSettings((prev) => ({ ...prev, ipAddress: "192.168.1.233", port: 9100 }));
        }
      }
      await refreshVirtualPrinter();
      printer.refresh();
    } finally {
      setVirtualLoading(false);
    }
  };

  const handleClearVirtualJobs = async () => {
    await PrinterClient.clearVirtualPrinterJobs();
    setVirtualJobs([]);
    setSelectedJob(null);
  };

  // Run Local Subnet Printer Discovery
  const handleRunDiscovery = async () => {
    setIsDiscovering(true);
    setDiscoveryResult(null);
    try {
      const res = await PrinterClient.discoverPrinters();
      setDiscoveryResult(res);
    } catch (err: any) {
      setDiscoveryResult({
        localSubnet: "Local Subnet",
        foundPrinters: [],
        message: err.message || "Discovery scan failed.",
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleApplyDiscoveredIp = (ip: string, port: number) => {
    setSettings((prev) => ({
      ...prev,
      ipAddress: ip,
      port: port,
    }));
  };

  // Test Counter USB Hardware Detection
  const handleTestCounterUsb = async () => {
    setCheckingUsbStatus(true);
    setCounterDiagnosticResult(null);
    try {
      const status = await PrinterClient.getCounterPrinterStatus(true);
      if (status.status === "CONNECTED") {
        setCounterDiagnosticResult({
          type: "success",
          title: "Counter USB Printer Ready",
          message:
            status.message ||
            `Found ${status.printerName} on port ${status.portName || "USB001"}. Win32 Raw Spooler queue is active and ready for customer bills.`,
        });
      } else if (status.status === "NOT_READY") {
        setCounterDiagnosticResult({
          type: "warning",
          title: "USB Detected — Driver Missing or Queue Paused",
          message:
            status.message ||
            "USB hardware VID_09C5&PID_58DE was detected, but Windows Print Queue 'POS-58-Series' is not ready or paused.",
        });
      } else {
        setCounterDiagnosticResult({
          type: "error",
          title: "Counter Printer Disconnected",
          message:
            status.message ||
            "KP206B-UB USB cable is unplugged. Please plug the USB cable into the billing computer.",
        });
      }
    } catch (err: any) {
      setCounterDiagnosticResult({
        type: "error",
        title: "USB Check Failed",
        message: err.message || "Failed to query USB status from connector.",
      });
    } finally {
      setCheckingUsbStatus(false);
    }
  };

  // Print 58mm Test Receipt on Counter Printer
  const handlePrintTestCounterBill = async () => {
    setTestingCounterPrint(true);
    setCounterDiagnosticResult(null);
    try {
      const res = await PrinterClient.printTestCustomerBill();
      if (res.success) {
        setCounterDiagnosticResult({
          type: "success",
          title: "58mm Test Bill Printed Successfully",
          message:
            res.message ||
            "Sample customer receipt sent to KP206B-UB counter printer via Win32 spooler. Please check paper feed.",
          durationMs: res.durationMs,
        });
        loadHistory();
      } else {
        setCounterDiagnosticResult({
          type: "error",
          title: "Counter Print Failed",
          message:
            res.message ||
            "Could not spool print job to counter printer. Please verify USB connection and paper roll.",
        });
      }
    } catch (err: any) {
      setCounterDiagnosticResult({
        type: "error",
        title: "Print Exception",
        message: err.message || "Counter test print failed.",
      });
    } finally {
      setTestingCounterPrint(false);
    }
  };

  // Save Settings to Database & Local Connector
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      // 1. Save to Next.js / Supabase backend
      const res = await fetch("/api/tables/printer-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      // 2. Sync to local connector at runtime
      await PrinterClient.updateConnectorConfig({
        printerIp: settings.ipAddress,
        printerPort: settings.port,
        printerName: settings.printerModel,
      }).catch(() => {});

      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
        printer.refresh();
        refreshVirtualPrinter();
      }
    } catch (err: any) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Pair with local connector
  const handlePairConnector = async () => {
    setPairing(true);
    try {
      const res = await PrinterClient.pairWithConnector();
      if (res.success) {
        setPairedSuccess(true);
        setTimeout(() => setPairedSuccess(false), 4000);
        printer.refresh();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert("Pairing failed: " + err.message);
    } finally {
      setPairing(false);
    }
  };

  const copySecretKey = () => {
    navigator.clipboard.writeText("spiral_kot_sig_7f8a9b2c3d4e5f6018273645");
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const isKitchenConnected = printer.kitchen?.status === "CONNECTED";
  const isCounterConnected = printer.counter?.status === "CONNECTED";
  const isConnectorOnline = printer.connectorOnline;

  const isSimulationMode =
    printer.kitchen?.printerIp === "127.0.0.1" && printer.kitchen?.printerPort === 9102;

  const hasUnsavedChanges =
    settings.ipAddress !== printer.kitchen?.printerIp ||
    settings.port !== printer.kitchen?.printerPort;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EBDAD0]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-[#CA340A]/10 text-[#CA340A]">
                <Printer size={24} />
              </span>
              <div>
                <h1 className="font-heading font-black text-2xl text-[#2C1710] tracking-tight">
                  Dual Thermal Printer Management
                </h1>
                <p className="text-xs text-[#6B5E55] font-medium">
                  Kitchen KOT (CN811-UEWB, 80mm Ethernet) &amp; Counter Bill (KP206B-UB, 58mm USB)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Connector Indicator Pill */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all shadow-xs ${
                isConnectorOnline
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
              title="Local Windows Background Service (Port 4318)"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnectorOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                }`}
              />
              <span>Connector: {isConnectorOnline ? `Online (v${printer.version || "1.1.0"})` : "Offline"}</span>
            </div>

            {/* Kitchen Indicator Pill with Explicit Simulation Mode Badge */}
            {isSimulationMode ? (
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition-all shadow-xs ${
                  isKitchenConnected
                    ? "bg-indigo-50 text-indigo-900 border-indigo-200"
                    : "bg-amber-50 text-amber-900 border-amber-200"
                }`}
                title="Virtual ESC/POS Kitchen Printer (Home Simulation 127.0.0.1:9102)"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isKitchenConnected ? "bg-indigo-600 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span>
                  Kitchen: {isKitchenConnected ? "CONNECTED (SIMULATION)" : "DISCONNECTED (SIMULATION)"}
                </span>
              </div>
            ) : (
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition-all shadow-xs ${
                  isKitchenConnected
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : isConnectorOnline
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
                title="Kitchen KOT Printer (Real Restaurant Hardware 192.168.1.233:9100)"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isKitchenConnected
                      ? "bg-emerald-500 animate-pulse"
                      : isConnectorOnline
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                />
                <span>Kitchen: {isKitchenConnected ? `Ready (${printer.kitchen.latencyMs}ms)` : "Offline"}</span>
              </div>
            )}

            {/* Counter Bill Printer Indicator Pill */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition-all shadow-xs ${
                isCounterConnected
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : printer.counter?.status === "NOT_READY"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : isConnectorOnline
                  ? "bg-rose-50 text-rose-800 border-rose-200"
                  : "bg-zinc-100 text-zinc-600 border-zinc-200"
              }`}
              title="Counter Bill Printer (58mm USB)"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCounterConnected
                    ? "bg-emerald-500 animate-pulse"
                    : printer.counter?.status === "NOT_READY"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
              />
              <span>
                Counter:{" "}
                {isCounterConnected
                  ? "Ready"
                  : printer.counter?.status === "NOT_READY"
                  ? "Driver Missing"
                  : isConnectorOnline
                  ? "Disconnected"
                  : "Offline"}
              </span>
            </div>

            <button
              onClick={() => {
                printer.refresh();
                refreshVirtualPrinter();
              }}
              disabled={printer.isChecking}
              className="p-2 rounded-2xl bg-white border border-[#EBDAD0] hover:bg-zinc-50 text-[#2C1710] transition-colors shadow-xs cursor-pointer"
              title="Refresh status now"
            >
              <RefreshCw size={17} className={printer.isChecking ? "animate-spin text-[#CA340A]" : ""} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SIMULATION MODE ACTIVE BANNER (When Target is 127.0.0.1:9102) */}
        {/* ========================================================================= */}
        {isSimulationMode && (
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-indigo-600 text-white shrink-0">
                <Radio size={20} className="animate-pulse" />
              </span>
              <div>
                <h3 className="font-heading font-extrabold text-sm text-indigo-950 flex items-center gap-2">
                  <span>Home Simulation Mode Active</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800">
                    Target: 127.0.0.1:9102
                  </span>
                </h3>
                <p className="text-xs text-indigo-700 font-medium">
                  Print Connector is streaming raw ESC/POS KOT tickets to the Virtual Kitchen Printer on this computer. Restaurant hardware is not affected.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSwitchTargetMode("PRODUCTION")}
              disabled={virtualLoading}
              className="shrink-0 px-4 py-2 rounded-xl bg-white border border-indigo-300 hover:bg-indigo-100/60 text-xs font-bold text-indigo-900 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Restore Restaurant Target (192.168.1.233)</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DOWNLOAD CONNECTOR BANNER (Appears if Connector is Offline) */}
        {/* ========================================================================= */}
        {!isConnectorOnline && (
          <div className="bg-gradient-to-r from-[#FFF8F3] via-white to-[#FFF8F3] rounded-3xl p-6 border-2 border-[#CA340A]/30 shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CA340A]/10 text-[#CA340A] text-xs font-black uppercase tracking-wider">
                  <Download size={13} />
                  Restaurant Desktop Service Required
                </div>
                <h2 className="font-heading font-black text-xl text-[#2C1710]">
                  Print Connector Not Running on this PC
                </h2>
                <p className="text-xs text-[#6B5E55] leading-relaxed">
                  Spiral Cafe connects directly to both the Ethernet kitchen printer and USB counter printer through a lightweight, background Windows service. No terminal or coding knowledge is required.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] font-bold text-[#4A2117]">
                  <div className="bg-white/80 p-2.5 rounded-2xl border border-[#EBDAD0]">
                    <span className="text-[#CA340A] block text-xs">1. Download</span>
                    Get SpiralCafe-Printer-Setup.exe
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-2xl border border-[#EBDAD0]">
                    <span className="text-[#CA340A] block text-xs">2. Run Setup</span>
                    Click Next and Install (starts automatically)
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-2xl border border-[#EBDAD0]">
                    <span className="text-[#CA340A] block text-xs">3. Ready</span>
                    Status lights turn Green automatically!
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center gap-2">
                <a
                  href="/downloads/SpiralCafe-Printer-Setup.exe"
                  download="SpiralCafe-Printer-Setup.exe"
                  className="px-6 py-3.5 rounded-2xl bg-[#CA340A] hover:bg-[#B73F1D] text-white text-sm font-extrabold shadow-lg shadow-[#CA340A]/25 transition-all flex items-center gap-2.5 cursor-pointer transform hover:-translate-y-0.5"
                >
                  <Download size={18} />
                  <span>Download Print Connector</span>
                </a>
                <span className="text-[10px] text-zinc-500 font-medium">
                  Windows 10 / 11 • Version 1.1.0 (22.2 MB)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIRTUAL KITCHEN PRINTER (HOME SIMULATION & RECEIPT PREVIEW) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-[0_15px_35px_rgba(79,70,229,0.05)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-indigo-50 text-indigo-700">
                <Radio size={19} />
              </span>
              <div>
                <h3 className="font-heading font-extrabold text-base text-zinc-900 flex items-center gap-2">
                  <span>Virtual Kitchen Printer</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    Home Simulation
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium">
                  Raw ESC/POS TCP Server on 127.0.0.1:9102 • Decodes print jobs and renders realistic thermal KOT slips
                </p>
              </div>
            </div>

            {/* Virtual Printer Status Pill & Quick Controls */}
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                  virtualStatus?.isRunning
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    virtualStatus?.isRunning ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                  }`}
                />
                <span>Server: {virtualStatus?.isRunning ? "Running (Port 9102)" : "Stopped"}</span>
              </span>

              {virtualStatus?.isRunning ? (
                <button
                  type="button"
                  onClick={() => handleToggleVirtualServer(false)}
                  disabled={virtualLoading || !isConnectorOnline}
                  className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Stop TCP Server on 127.0.0.1:9102"
                >
                  <Square size={12} className="fill-rose-700 text-rose-700" />
                  <span>Stop Server</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleVirtualServer(true)}
                  disabled={virtualLoading || !isConnectorOnline}
                  className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Start TCP Server on 127.0.0.1:9102"
                >
                  <Play size={12} className="fill-white text-white" />
                  <span>Start Server</span>
                </button>
              )}
            </div>
          </div>

          {/* Mode Switch & Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-stone-700">Active Kitchen Target:</span>
              <span className="font-mono font-extrabold px-2 py-0.5 rounded-lg bg-white border border-stone-300 text-stone-900">
                {printer.kitchen?.printerIp}:{printer.kitchen?.printerPort}
              </span>
              {isSimulationMode ? (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                  Simulation Target
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Production Restaurant Target
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isSimulationMode ? (
                <button
                  type="button"
                  onClick={() => handleSwitchTargetMode("PRODUCTION")}
                  disabled={virtualLoading || !isConnectorOnline}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 font-bold transition-all text-xs cursor-pointer disabled:opacity-50"
                >
                  Restore Production (192.168.1.233:9100)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSwitchTargetMode("VIRTUAL")}
                  disabled={virtualLoading || !isConnectorOnline}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all text-xs cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  Switch Target to Virtual Printer (127.0.0.1:9102)
                </button>
              )}

              <button
                type="button"
                onClick={handlePrintTestKot}
                disabled={testingPrint || !isConnectorOnline}
                className="px-3.5 py-1.5 rounded-xl bg-[#CA340A] hover:bg-[#B73F1D] text-white font-bold transition-all text-xs cursor-pointer disabled:opacity-50 shadow-xs flex items-center gap-1.5"
                title="Send a sample KOT ticket through Website -> Connector -> Target TCP"
              >
                <FileText size={13} className={testingPrint ? "animate-bounce" : ""} />
                <span>{testingPrint ? "Printing..." : "Print Test KOT"}</span>
              </button>
            </div>
          </div>

          {/* Captured Receipts & Thermal Slip Viewer */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Left: Job History List (5 cols) */}
            <div className="md:col-span-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-stone-800 pb-1 border-b border-stone-200">
                <span className="flex items-center gap-1.5">
                  <Terminal size={14} className="text-indigo-600" />
                  Captured Jobs ({virtualJobs.length})
                </span>
                {virtualJobs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearVirtualJobs}
                    className="text-[10px] text-stone-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={11} /> Clear
                  </button>
                )}
              </div>

              {virtualJobs.length === 0 ? (
                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200/70 text-center space-y-2">
                  <p className="text-xs font-semibold text-stone-600">No print jobs received yet.</p>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Start the virtual printer, ensure the target is set to <code className="font-bold text-stone-800">127.0.0.1:9102</code>, and click <strong>"Print Test KOT"</strong> above to see the captured receipt.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {virtualJobs.map((job) => {
                    const isSelected = selectedJob?.id === job.id;
                    const itemsSummary = job.decoded.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");

                    return (
                      <div
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer text-xs ${
                          isSelected
                            ? "bg-indigo-50/70 border-indigo-300 shadow-xs ring-1 ring-indigo-200"
                            : "bg-[#FFF9F5] border-stone-200 hover:bg-stone-50"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-stone-900 mb-1">
                          <span>
                            Table {job.decoded.tableNumber || "T?"} • #{job.decoded.orderNumber || "ORD"}
                          </span>
                          <span className="text-[10px] font-mono text-stone-500">
                            {new Date(job.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 truncate">
                          {itemsSummary || job.decoded.rawText.slice(0, 45) || "ESC/POS Payload"}
                        </p>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-stone-500 font-mono">
                          <span>{job.bytesCount} bytes</span>
                          {job.decoded.paperCutDetected && (
                            <span className="text-indigo-700 font-sans font-bold flex items-center gap-0.5">
                              <Scissors size={10} /> Cut OK
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Thermal Receipt Preview Box (7 cols) */}
            <div className="md:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-stone-800 pb-1 border-b border-stone-200">
                <span className="flex items-center gap-1.5">
                  <Eye size={14} className="text-[#CA340A]" />
                  Receipt Preview
                </span>
                {selectedJob && (
                  <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => setReceiptViewTab("VISUAL")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        receiptViewTab === "VISUAL" ? "bg-white text-stone-900 shadow-2xs" : "text-stone-600"
                      }`}
                    >
                      Thermal Slip
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptViewTab("RAW")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        receiptViewTab === "RAW" ? "bg-white text-stone-900 shadow-2xs" : "text-stone-600"
                      }`}
                    >
                      Decoded Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptViewTab("HEX")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        receiptViewTab === "HEX" ? "bg-white text-stone-900 shadow-2xs" : "text-stone-600"
                      }`}
                    >
                      Hex Dump
                    </button>
                  </div>
                )}
              </div>

              {!selectedJob ? (
                <div className="p-8 bg-[#FFF9F5] rounded-2xl border border-dashed border-stone-300 text-center text-xs text-stone-500">
                  Select a captured print job on the left to preview its ESC/POS thermal formatting.
                </div>
              ) : receiptViewTab === "VISUAL" ? (
                /* REALISTIC THERMAL PAPER SLIP STYLING */
                <div className="bg-[#FFFDF9] border border-stone-300 rounded-2xl p-5 shadow-md font-mono text-xs text-stone-900 space-y-3 relative overflow-hidden">
                  <div className="text-center space-y-0.5 pb-2 border-b-2 border-dashed border-stone-300">
                    <p className="font-black text-sm tracking-widest text-[#2C1710]">
                      {selectedJob.decoded.brandName || "SPIRAL CAFE"}
                    </p>
                    <p className="text-[11px] font-bold text-stone-700">KITCHEN ORDER TICKET (KOT)</p>
                    <p className="text-[10px] text-stone-500">
                      {selectedJob.decoded.dateTime || new Date(selectedJob.receivedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] py-1 border-b border-stone-200">
                    <div>
                      <span className="text-stone-500">Table: </span>
                      <span className="font-extrabold text-sm">{selectedJob.decoded.tableNumber || "--"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-stone-500">Order: </span>
                      <span className="font-extrabold">{selectedJob.decoded.orderNumber || "--"}</span>
                    </div>
                    {selectedJob.decoded.kotId && (
                      <div className="col-span-2 text-[10px] text-stone-600">
                        <span>Ticket: </span>
                        <span className="font-bold">{selectedJob.decoded.kotId}</span>
                        {selectedJob.decoded.round && <span> (Round {selectedJob.decoded.round})</span>}
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 py-1">
                    <div className="flex justify-between text-[10px] font-bold text-stone-500 uppercase tracking-wider pb-1 border-b border-stone-200">
                      <span>Qty &amp; Item</span>
                    </div>
                    {selectedJob.decoded.items.length === 0 ? (
                      <p className="text-[11px] italic text-stone-500 py-1">
                        (Raw receipt without structured items — see Decoded Text tab)
                      </p>
                    ) : (
                      selectedJob.decoded.items.map((it, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex items-baseline justify-between font-bold text-stone-900">
                            <span>
                              <span className="text-[#CA340A] font-extrabold mr-1.5">{it.quantity}x</span>
                              {it.name}
                            </span>
                          </div>
                          {it.notes && (
                            <p className="text-[10px] text-stone-600 pl-4 italic">
                              * {it.notes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Special Instructions */}
                  {selectedJob.decoded.specialInstructions && (
                    <div className="p-2 bg-stone-100 rounded-lg text-[11px] border border-stone-200 space-y-0.5">
                      <span className="font-bold text-stone-700 block text-[10px] uppercase">Special Instructions:</span>
                      <span className="font-extrabold text-[#CA340A]">{selectedJob.decoded.specialInstructions}</span>
                    </div>
                  )}

                  {/* Paper Cut Indicator */}
                  <div className="pt-3 border-t-2 border-dashed border-stone-300 flex items-center justify-between text-[10px] text-stone-500">
                    <span className="flex items-center gap-1 font-bold text-indigo-700">
                      <Scissors size={12} /> Paper Cut Command (GS V B 0)
                    </span>
                    <span>{selectedJob.bytesCount} bytes</span>
                  </div>
                </div>
              ) : receiptViewTab === "RAW" ? (
                <div className="p-4 bg-zinc-950 text-zinc-200 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                  {selectedJob.decoded.rawText || "Empty text payload."}
                </div>
              ) : (
                <div className="p-4 bg-zinc-950 text-emerald-400 rounded-2xl font-mono text-[10px] overflow-x-auto max-h-96 space-y-2">
                  <p className="text-zinc-400 text-[11px]">// Captured Raw ESC/POS Byte Stream</p>
                  <p className="break-all tracking-wider leading-relaxed">{selectedJob.decoded.hexDump}</p>
                  {selectedJob.decoded.unsupportedCommands.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800 text-amber-300">
                      <p className="font-bold">Unsupported ESC/POS Codes:</p>
                      <p>{selectedJob.decoded.unsupportedCommands.join(", ")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TWO-COLUMN CONFIGURATION & DIAGNOSTICS LAYOUT */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: HARDWARE CONFIGURATION (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* KITCHEN PRINTER SETTINGS CARD */}
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-[0_15px_35px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-[#CA340A]" />
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                      Kitchen KOT Printer Configuration
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      CN811-UEWB • 80mm Thermal Receipt • Raw ESC/POS TCP
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                    isKitchenConnected
                      ? isSimulationMode
                        ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : printer.kitchen?.status === "IDENTIFICATION_REQUIRED"
                      ? "bg-amber-50 text-amber-900 border-amber-300 animate-pulse"
                      : isConnectorOnline
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200"
                  }`}
                >
                  {isKitchenConnected
                    ? isSimulationMode
                      ? "SIMULATION ONLINE"
                      : "REACHABLE"
                    : printer.kitchen?.status === "IDENTIFICATION_REQUIRED"
                    ? "IDENTIFICATION REQUIRED"
                    : isConnectorOnline
                    ? "DISCONNECTED"
                    : "OFFLINE"}
                </span>
              </div>

              {/* DYNAMIC AUTO-RECONNECT NOTIFICATION */}
              {printer.kitchen?.lastAutoReconnectedAt && (
                <div className="p-3.5 bg-emerald-50 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between border border-emerald-200 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>Kitchen printer automatically reconnected at {printer.kitchen.printerIp}.</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-mono">
                    {new Date(printer.kitchen.lastAutoReconnectedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}

              {/* IDENTIFICATION REQUIRED BANNER (When candidate found on port 9100 with unverified MAC) */}
              {printer.kitchen?.status === "IDENTIFICATION_REQUIRED" && (
                <div className="p-4 bg-amber-50 text-amber-950 rounded-2xl text-xs space-y-3 border-2 border-amber-300 shadow-sm animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-950">Printer Identification Required</h4>
                      <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                        A raw TCP device on port 9100 was discovered on your local network at{" "}
                        <code className="font-mono font-bold bg-amber-100 px-1.5 py-0.5 rounded text-amber-950">
                          {printer.kitchen.printerIp}
                        </code>
                        , but its physical Ethernet MAC could not be automatically confirmed as <code className="font-bold">E4:66:E5:12:24:29</code>.
                        To prevent sending kitchen orders to an incorrect device, please verify and approve this connection.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApproveCandidate(printer.kitchen.printerIp, printer.kitchen.printerPort)}
                      disabled={approvingIp === printer.kitchen.printerIp}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      <span>{approvingIp === printer.kitchen.printerIp ? "Approving..." : "Approve & Connect Kitchen Printer"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRunDiscovery}
                      disabled={isDiscovering}
                      className="px-3.5 py-2 bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-900 rounded-xl text-xs font-bold transition-all"
                    >
                      Scan Again
                    </button>
                  </div>
                </div>
              )}

              {/* DISCONNECTED WARNING BANNER */}
              {printer.kitchen?.status === "DISCONNECTED" && isConnectorOnline && !isSimulationMode && (
                <div className="p-3.5 bg-rose-50 text-rose-900 rounded-2xl text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-rose-200">
                  <div className="flex items-center gap-2">
                    <XCircle size={16} className="text-rose-600 shrink-0" />
                    <span>Kitchen printer could not be identified. Check power and Ethernet connection.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunDiscovery}
                    disabled={isDiscovering}
                    className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 hover:bg-rose-100 text-rose-900 font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                  >
                    {isDiscovering ? "Scanning Network..." : "Discover Printer"}
                  </button>
                </div>
              )}

              {saveSuccess && (
                <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 border border-emerald-200 animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Configuration saved persistently and synced with local connector at runtime!</span>
                </div>
              )}

              {/* LIVE METADATA GRID (Active IP, Port, MAC, Discovery State) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 bg-[#FFF9F5] rounded-xl border border-[#CA340A]/15 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                    Active IP & Port
                  </span>
                  <span className="font-mono font-bold text-zinc-900 block truncate">
                    {printer.kitchen?.printerIp || "192.168.1.233"}:{printer.kitchen?.printerPort || 9100}
                  </span>
                </div>

                <div className="p-2.5 bg-[#FFF9F5] rounded-xl border border-[#CA340A]/15 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                    Ethernet MAC
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-zinc-900 text-[11px] truncate">
                      {printer.kitchen?.macAddress || "E4:66:E5:12:24:29"}
                    </span>
                    {printer.kitchen?.macVerified && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-extrabold">
                        ARP
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 bg-[#FFF9F5] rounded-xl border border-[#CA340A]/15 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                    Discovery State
                  </span>
                  <span className="font-bold text-zinc-800 block text-[11px] truncate">
                    {printer.kitchen?.discoveryState || "IDLE"} {printer.kitchen?.discoveryResult?.stage ? `(${printer.kitchen.discoveryResult.stage})` : ""}
                  </span>
                </div>

                <div className="p-2.5 bg-[#FFF9F5] rounded-xl border border-[#CA340A]/15 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                    Last Verified
                  </span>
                  <span className="font-bold text-zinc-800 block text-[11px] truncate">
                    {printer.kitchen?.lastChecked ? new Date(printer.kitchen.lastChecked).toLocaleTimeString() : "--"}
                  </span>
                </div>
              </div>

              {/* ACTION TOOLBAR: Discover, Test Connection, Print Test KOT */}
              <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
                <button
                  type="button"
                  onClick={handleRunDiscovery}
                  disabled={isDiscovering || !isConnectorOnline}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-xs font-bold text-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Search size={13} className={isDiscovering ? "animate-spin text-[#CA340A]" : "text-[#CA340A]"} />
                  <span>{isDiscovering ? "Scanning Subnet..." : "Discover Printer"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !isConnectorOnline}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-xs font-bold text-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Wifi size={13} className="text-emerald-600" />
                  <span>{testingConnection ? "Probing..." : "Test Connection"}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintTestKot}
                  disabled={testingPrint || !isConnectorOnline}
                  className="px-3.5 py-1.5 rounded-xl bg-[#CA340A] hover:bg-[#B73F1D] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <FileText size={13} />
                  <span>{testingPrint ? "Printing..." : "Print Test KOT"}</span>
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1.5">
                      Printer Model
                    </label>
                    <input
                      type="text"
                      value={settings.printerModel}
                      onChange={(e) => setSettings({ ...settings, printerModel: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-2xl text-xs font-bold text-[#2C1710] focus:outline-none focus:ring-2 focus:ring-[#CA340A]/30"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1.5">
                      Terminal Name
                    </label>
                    <input
                      type="text"
                      value={settings.terminalName}
                      onChange={(e) => setSettings({ ...settings, terminalName: e.target.value })}
                      placeholder="Billing 1"
                      className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-2xl text-xs font-bold text-[#2C1710] focus:outline-none focus:ring-2 focus:ring-[#CA340A]/30"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#2C1710] mb-1.5 flex items-center justify-between">
                      <span>Kitchen Printer IP Address</span>
                      <span className="text-[10px] text-zinc-500 font-semibold">Router DHCP</span>
                    </label>
                    <input
                      type="text"
                      value={settings.ipAddress}
                      onChange={(e) => setSettings({ ...settings, ipAddress: e.target.value })}
                      placeholder="192.168.1.233"
                      className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-2xl text-xs font-mono font-bold text-[#2C1710] focus:outline-none focus:ring-2 focus:ring-[#CA340A]/30"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1.5">
                      TCP Port
                    </label>
                    <input
                      type="number"
                      value={settings.port}
                      onChange={(e) =>
                        setSettings({ ...settings, port: parseInt(e.target.value, 10) || 9100 })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-2xl text-xs font-mono font-bold text-[#2C1710] focus:outline-none focus:ring-2 focus:ring-[#CA340A]/30"
                      required
                    />
                  </div>
                </div>

                {/* Subnet Discovery Box */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Search size={14} className="text-[#CA340A]" />
                      Local Network Discovery
                    </span>
                    <button
                      type="button"
                      onClick={handleRunDiscovery}
                      disabled={isDiscovering || !isConnectorOnline}
                      className="px-3 py-1 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-[11px] font-bold text-stone-700 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {isDiscovering ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw size={11} className="animate-spin text-[#CA340A]" /> Scanning Subnet...
                        </span>
                      ) : (
                        "Scan Subnet (Port 9100)"
                      )}
                    </button>
                  </div>

                  {discoveryResult && (
                    <div className="pt-1 space-y-2">
                      <p className="text-[11px] text-stone-600 font-medium">{discoveryResult.message}</p>
                      {discoveryResult.foundPrinters.length > 0 && (
                        <div className="space-y-2">
                          {discoveryResult.foundPrinters.map((p) => {
                            const isVerified = p.confidence === "HIGH_VERIFIED" || p.macMatched;
                            return (
                              <div
                                key={p.ip}
                                className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                                  isVerified
                                    ? "bg-emerald-50/70 border-emerald-300"
                                    : "bg-amber-50/70 border-amber-300"
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-zinc-900 text-sm">
                                      {p.ip}:{p.port}
                                    </span>
                                    <span
                                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                                        isVerified
                                          ? "bg-emerald-200 text-emerald-900"
                                          : "bg-amber-200 text-amber-900"
                                      }`}
                                    >
                                      {isVerified ? "✅ VERIFIED HARDWARE MATCH" : "⚠ IDENTIFICATION REQUIRED"}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 mt-0.5">
                                    {p.macAddress && (
                                      <span>
                                        MAC: <code className="font-mono font-bold text-zinc-900">{p.macAddress}</code>
                                      </span>
                                    )}
                                    {p.hostname && (
                                      <span>
                                        Host: <code className="font-bold text-zinc-900">{p.hostname}</code>
                                      </span>
                                    )}
                                    <span className="text-emerald-700 font-semibold">{p.latencyMs}ms</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveCandidate(p.ip, p.port)}
                                    disabled={approvingIp === p.ip}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                                  >
                                    {approvingIp === p.ip ? "Connecting..." : "Approve & Connect"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyDiscoveredIp(p.ip, p.port)}
                                    className="px-2.5 py-1.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 font-bold text-xs transition-colors"
                                  >
                                    Use this IP
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SAFEGUARD 4: RECOMMENDED ROUTER SETUP (DHCP RESERVATION) */}
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-950 font-bold">
                      <ShieldCheck size={16} className="text-amber-700" />
                      <span>Permanent Network Safeguard: Router DHCP Reservation</span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      The cafe router uses DHCP, which may assign a new IP address whenever the router reboots. While Spiral Print Connector automatically rediscovers the printer, the ultimate permanent safeguard is to set a one-time IP reservation in your router admin panel:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                      <div className="bg-white p-2 rounded-xl border border-amber-200">
                        <span className="text-[9px] font-sans font-bold text-amber-800 uppercase block">Device Hostname</span>
                        <span className="font-bold text-zinc-900">CN811-UEWB-EDAA</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-amber-200">
                        <span className="text-[9px] font-sans font-bold text-amber-800 uppercase block">Ethernet MAC Address</span>
                        <span className="font-bold text-zinc-900">E4:66:E5:12:24:29</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-amber-200">
                        <span className="text-[9px] font-sans font-bold text-amber-800 uppercase block">Reserved IP Target</span>
                        <span className="font-bold text-zinc-900">192.168.1.233</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-800 italic">
                      Note: Router configuration is a separate one-time administrative action performed in your router&apos;s web portal (usually http://192.168.1.1). The website cannot alter your physical router settings.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-2xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#B73F1D] shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
                    <span>{saving ? "Saving..." : "Save Configuration"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* COUNTER BILL PRINTER CARD (POSITEASY KP206B-UB, 58mm USB) */}
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-[0_15px_35px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Printer size={18} className="text-[#3A1710]" />
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                      Counter Bill Printer (58mm USB)
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      Model: POSITEASY KP206B-UB • Win32 Raw Spooler • 32 Columns (Font A)
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                    isCounterConnected
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : printer.counter?.status === "NOT_READY"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  {isCounterConnected
                    ? "READY"
                    : printer.counter?.status === "NOT_READY"
                    ? "DRIVER MISSING"
                    : "DISCONNECTED"}
                </span>
              </div>

              {/* Device Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#FFF9F5] rounded-2xl border border-[#CA340A]/15 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Verified USB Hardware ID
                  </span>
                  <span className="font-mono font-bold text-zinc-900 block">
                    VID: 09C5 • PID: 58DE
                  </span>
                  <span className="text-[11px] text-zinc-600">
                    Device: HaoYin CX58D • {printer.counter?.deviceFound ? "✅ Physical USB Attached" : "❌ USB Disconnected"}
                  </span>
                </div>

                <div className="p-3 bg-[#FFF9F5] rounded-2xl border border-[#CA340A]/15 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Windows Spooler Queue
                  </span>
                  <span className="font-mono font-bold text-zinc-900 block">
                    {printer.counter?.printerName || "POS-58-Series"}
                  </span>
                  <span className="text-[11px] text-zinc-600">
                    Port: {printer.counter?.portName || "USB001"} • Driver: POS-58-Series Driver
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleTestCounterUsb}
                  disabled={checkingUsbStatus || !isConnectorOnline}
                  className="flex-1 py-2.5 px-3 rounded-2xl border border-zinc-300 hover:bg-zinc-50 text-xs font-bold text-zinc-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw size={14} className={checkingUsbStatus ? "animate-spin text-[#CA340A]" : ""} />
                  <span>{checkingUsbStatus ? "Detecting USB..." : "Check USB Connection"}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintTestCounterBill}
                  disabled={testingCounterPrint || !isConnectorOnline || !isCounterConnected}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-[#3A1710] hover:bg-[#2C1710] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  <FileText size={14} className={testingCounterPrint ? "animate-bounce" : ""} />
                  <span>{testingCounterPrint ? "Printing..." : "Print 58mm Test Bill"}</span>
                </button>
              </div>

              {/* Counter Diagnostic Result Box */}
              {counterDiagnosticResult && (
                <div
                  className={`p-4 rounded-2xl text-xs space-y-1 border animate-in fade-in ${
                    counterDiagnosticResult.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : counterDiagnosticResult.type === "warning"
                      ? "bg-amber-50 text-amber-900 border-amber-300"
                      : "bg-red-50 text-red-900 border-red-200"
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    {counterDiagnosticResult.type === "success" ? (
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    )}
                    <span>{counterDiagnosticResult.title}</span>
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {counterDiagnosticResult.message}
                  </p>
                </div>
              )}
            </div>

            {/* SECURITY & PAIRING CARD */}
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-[0_15px_35px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                    Secure Application Pairing & Isolation
                  </h3>
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  HMAC-SHA256 SIGNED
                </span>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                The local connector listens strictly on loopback (<code>127.0.0.1:4318</code>).
                All kitchen print requests require a tamper-proof HMAC-SHA256 signature generated by the Spiral Cafe server with 90-second expiration and replay protection.
              </p>

              <div className="bg-[#FFF9F5] p-3.5 rounded-2xl border border-[#CA340A]/15 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="block font-bold text-[#2C1710]">Pairing Key / Secret</span>
                  <span className="font-mono text-zinc-500 text-[11px]">spiral_kot_sig_7f8a9...</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copySecretKey}
                    className="p-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition-colors"
                    title="Copy full secret"
                  >
                    {copiedKey ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={handlePairConnector}
                    disabled={pairing || !isConnectorOnline}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {pairing ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={14} />}
                    <span>{pairing ? "Pairing..." : "Pair with Connector"}</span>
                  </button>
                </div>
              </div>

              {pairedSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200 animate-in fade-in">
                  <CheckCircle2 size={15} />
                  <span>Dashboard origin successfully paired and whitelisted in local connector!</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: REAL-TIME DIAGNOSTICS & TESTING (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* LIVE CONNECTOR STATUS CARD */}
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-[0_15px_35px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                  Live Diagnostics Center
                </h3>
                <span className="text-xs font-mono text-zinc-500">Port 4318</span>
              </div>

              {/* Status List */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                  <span className="font-semibold text-zinc-600">Local Connector Service</span>
                  <span className="font-bold flex items-center gap-1.5">
                    {isConnectorOnline ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Running (v{printer.version || "1.1.0"})
                      </span>
                    ) : (
                      <span className="text-red-700 flex items-center gap-1">
                        <XCircle size={14} /> Offline
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                  <span className="font-semibold text-zinc-600">Kitchen KOT Target</span>
                  <span className="font-bold flex items-center gap-1.5">
                    {isKitchenConnected ? (
                      <span className={`${isSimulationMode ? "text-indigo-700" : "text-emerald-700"} flex items-center gap-1`}>
                        <CheckCircle2 size={14} /> {isSimulationMode ? "Simulation Ready" : `Reachable (${printer.kitchen.latencyMs}ms)`}
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <AlertTriangle size={14} /> Not Responding
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                  <span className="font-semibold text-zinc-600">Counter Bill Printer (USB)</span>
                  <span className="font-bold flex items-center gap-1.5">
                    {isCounterConnected ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Ready ({printer.counter?.printerName || "POS-58-Series"})
                      </span>
                    ) : printer.counter?.status === "NOT_READY" ? (
                      <span className="text-amber-700 flex items-center gap-1">
                        <AlertTriangle size={14} /> Driver Missing
                      </span>
                    ) : (
                      <span className="text-rose-700 flex items-center gap-1">
                        <XCircle size={14} /> Disconnected
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                  <span className="font-semibold text-zinc-600">Configured IP</span>
                  <span className="font-mono font-bold text-zinc-800">
                    {printer.kitchen?.printerIp || "192.168.1.233"}:{printer.kitchen?.printerPort || 9100}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="font-semibold text-zinc-600">Last Verified</span>
                  <span className="font-mono text-zinc-500">{printer.kitchen?.lastChecked || "--"}</span>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !isConnectorOnline}
                  className="flex-1 py-2.5 px-3 rounded-2xl border border-zinc-300 hover:bg-zinc-50 text-xs font-bold text-zinc-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw size={14} className={testingConnection ? "animate-spin text-[#CA340A]" : ""} />
                  <span>{testingConnection ? "Testing..." : "Test Connection"}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintTestKot}
                  disabled={testingPrint || !isConnectorOnline}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-[#CA340A] hover:bg-[#B73F1D] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-[#CA340A]/20"
                >
                  <FileText size={14} className={testingPrint ? "animate-bounce" : ""} />
                  <span>{testingPrint ? "Printing Slip..." : "Print Test KOT"}</span>
                </button>
              </div>

              {/* DIAGNOSTIC RESULT BOX */}
              {diagnosticResult && (
                <div
                  className={`p-4 rounded-2xl text-xs space-y-1 border animate-in fade-in ${
                    diagnosticResult.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : diagnosticResult.type === "warning"
                      ? "bg-amber-50 text-amber-900 border-amber-300"
                      : "bg-red-50 text-red-900 border-red-200"
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    {diagnosticResult.type === "success" ? (
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    )}
                    <span>{diagnosticResult.title}</span>
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-90">{diagnosticResult.message}</p>
                </div>
              )}
            </div>

            {/* PRINT AUDIT LOG CARD */}
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-[0_15px_35px_rgba(0,0,0,0.03)] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-zinc-600" />
                  <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#2C1710]">
                    Recent Print Audit Log
                  </h4>
                </div>
                <button
                  onClick={loadHistory}
                  disabled={loadingHistory || !isConnectorOnline}
                  className="text-[10px] font-bold text-[#CA340A] hover:underline cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              {!isConnectorOnline ? (
                <p className="text-xs text-zinc-400 py-3 text-center">
                  Start local connector to view live print logs.
                </p>
              ) : history.length === 0 ? (
                <p className="text-xs text-zinc-400 py-3 text-center">
                  No print jobs logged yet for this session.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {history.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 bg-[#FFF9F5] rounded-xl border border-zinc-200/60 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-[#2C1710]">
                          Table {log.tableNumber} • #{log.orderNumber}
                        </span>
                        <span className="block text-[10px] text-zinc-500 font-mono">
                          {log.kotId} • {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                          log.status === "PRINT_CONFIRMED" || log.status === "SENT_UNVERIFIED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {log.status === "SENT_UNVERIFIED"
                          ? "SENT"
                          : log.status === "PRINT_CONFIRMED"
                          ? "CONFIRMED"
                          : "FAILED"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* EXPANDABLE TECHNICAL DIAGNOSTICS */}
            <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-[0_15px_35px_rgba(0,0,0,0.03)] space-y-3">
              <button
                type="button"
                onClick={() => setShowTechDiagnostics(!showTechDiagnostics)}
                className="w-full flex items-center justify-between text-xs font-bold text-zinc-700 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Cpu size={15} className="text-[#CA340A]" />
                  Advanced Technical Diagnostics
                </span>
                {showTechDiagnostics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showTechDiagnostics && (
                <div className="pt-2 space-y-3 text-[11px] animate-in fade-in">
                  <div className="p-3 bg-zinc-950 text-zinc-200 rounded-2xl font-mono text-[10px] overflow-x-auto max-h-60">
                    <pre>{JSON.stringify({ kitchen: printer.kitchen, counter: printer.counter, virtualStatus, connectorOnline: printer.connectorOnline, version: printer.version }, null, 2)}</pre>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-stone-600 space-y-1">
                    <p className="font-bold text-stone-900">Diagnostics Notes:</p>
                    <p>• Kitchen socket: Raw ESC/POS byte streaming to TCP port 9100 without Windows spooler interception.</p>
                    <p>• Virtual socket: Raw ESC/POS byte streaming to TCP port 9102 (Simulation Mode).</p>
                    <p>• Counter spooler: Win32 Raw Datatype Spooler to USB001 via POS-58-Series Driver.</p>
                    <p>• Connector API: Bound strictly to loopback (127.0.0.1:4318) with CORS origin whitelisting.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
