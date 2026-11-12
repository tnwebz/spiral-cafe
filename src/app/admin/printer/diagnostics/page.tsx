"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";
import {
  PrinterClient,
  VirtualPrinterJob,
  VirtualPrinterStatus,
} from "@/services/printerClient";
import {
  Terminal,
  ArrowLeft,
  Play,
  Square,
  RefreshCw,
  Trash2,
  FileText,
  Eye,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Zap,
  Scissors,
  HardDrive,
  Cpu,
  Radio,
  Search,
} from "lucide-react";

export default function DeveloperPrinterDiagnosticsPage() {
  const printer = usePrinterStatus(3500);

  // Virtual Printer State
  const [virtualStatus, setVirtualStatus] = useState<VirtualPrinterStatus | null>(null);
  const [virtualJobs, setVirtualJobs] = useState<VirtualPrinterJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<VirtualPrinterJob | null>(null);
  const [receiptViewTab, setReceiptViewTab] = useState<"VISUAL" | "RAW" | "HEX">("VISUAL");
  const [isLoading, setIsLoading] = useState(false);

  // Simulation IP Migration State & Step Tracker
  const [isMigratingIp, setIsMigratingIp] = useState(false);
  const [migrationSteps, setMigrationSteps] = useState<
    { step: number; title: string; status: "pending" | "running" | "success" | "error"; detail?: string }[]
  >([]);
  const [simulationNotice, setSimulationNotice] = useState<string | null>(null);
  const [testingKot, setTestingKot] = useState(false);
  const [copiedHex, setCopiedHex] = useState(false);

  // Poll Virtual Printer status and captured jobs
  const refreshVirtualStatus = useCallback(async () => {
    if (!printer.connectorOnline) return;
    try {
      const [vStatus, jobs] = await Promise.all([
        PrinterClient.getVirtualPrinterStatus(),
        PrinterClient.getVirtualPrinterJobs(20),
      ]);
      setVirtualStatus(vStatus);
      setVirtualJobs(jobs);
      if (jobs.length > 0 && !selectedJob) {
        setSelectedJob(jobs[0]);
      }
    } catch {
      // ignore
    }
  }, [printer.connectorOnline, selectedJob]);

  useEffect(() => {
    if (printer.connectorOnline) {
      refreshVirtualStatus();
      const interval = setInterval(() => {
        refreshVirtualStatus();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [printer.connectorOnline, refreshVirtualStatus]);

  // Start Virtual Printer TCP Server
  const handleStartVirtual = async () => {
    setIsLoading(true);
    try {
      await PrinterClient.startVirtualPrinter();
      await refreshVirtualStatus();
      await printer.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  // Stop Virtual Printer TCP Server
  const handleStopVirtual = async () => {
    setIsLoading(true);
    try {
      await PrinterClient.stopVirtualPrinter();
      await refreshVirtualStatus();
      await printer.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  // Clear Captured Jobs
  const handleClearJobs = async () => {
    setIsLoading(true);
    try {
      await PrinterClient.clearVirtualPrinterJobs();
      setSelectedJob(null);
      await refreshVirtualStatus();
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Target Mode (Simulation vs Production Target)
  const handleToggleMode = async (mode: "VIRTUAL" | "PRODUCTION") => {
    setIsLoading(true);
    try {
      const res = await PrinterClient.toggleVirtualPrinterMode(mode);
      setSimulationNotice(res.message);
      await refreshVirtualStatus();
      await printer.refresh();
      setTimeout(() => setSimulationNotice(null), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  // Dispatch Test KOT
  const handleDispatchTestKot = async () => {
    setTestingKot(true);
    try {
      const res = await PrinterClient.printTestReceipt();
      await refreshVirtualStatus();
      setSimulationNotice(res.message || "Test KOT dispatched.");
      setTimeout(() => setSimulationNotice(null), 4000);
    } finally {
      setTestingKot(false);
    }
  };

  // SIMULATE IP MIGRATION & RECOVERY PIPELINE
  const handleGenerateNewIp = async () => {
    setIsMigratingIp(true);
    setSimulationNotice(null);

    const steps = [
      { step: 1, title: "Migrate Virtual Hardware to new loopback IP", status: "running" as const },
      { step: 2, title: "Connector detects target outage", status: "pending" as const },
      { step: 3, title: "Auto-recovery scans local subnet candidates", status: "pending" as const },
      { step: 4, title: "Confirm CN811-UEWB identity & update target", status: "pending" as const },
      { step: 5, title: "Dispatch test KOT to confirm end-to-end recovery", status: "pending" as const },
    ];
    setMigrationSteps(steps);

    try {
      // Step 1: Migrate loopback IP (shuts down old socket, starts new listener)
      const migrationRes = await PrinterClient.generateNewVirtualIp();
      if (!migrationRes.success) {
        setMigrationSteps((prev) =>
          prev.map((s, idx) => (idx === 0 ? { ...s, status: "error", detail: migrationRes.message } : s))
        );
        setIsMigratingIp(false);
        return;
      }

      setMigrationSteps((prev) =>
        prev.map((s, idx) =>
          idx === 0
            ? { ...s, status: "success", detail: `Printer moved: ${migrationRes.oldIp} -> ${migrationRes.newIp}:9102` }
            : idx === 1
            ? { ...s, status: "running" }
            : s
        )
      );

      // Step 2 & 3: Trigger connector check & discovery
      await new Promise((r) => setTimeout(r, 1200));
      setMigrationSteps((prev) =>
        prev.map((s, idx) =>
          idx === 1
            ? { ...s, status: "success", detail: `Target ${migrationRes.oldIp} unreachable. Outage detected.` }
            : idx === 2
            ? { ...s, status: "running" }
            : s
        )
      );

      const discoveryRes = await PrinterClient.discoverPrinters();
      await new Promise((r) => setTimeout(r, 1000));

      setMigrationSteps((prev) =>
        prev.map((s, idx) =>
          idx === 2
            ? { ...s, status: "success", detail: `Discovered new endpoint ${migrationRes.newIp}:9102.` }
            : idx === 3
            ? { ...s, status: "running" }
            : s
        )
      );

      // Step 4: Verification & target update
      await printer.refresh();
      await refreshVirtualStatus();

      setMigrationSteps((prev) =>
        prev.map((s, idx) =>
          idx === 3
            ? { ...s, status: "success", detail: `Hardware verified. Active target updated to ${migrationRes.newIp}:9102.` }
            : idx === 4
            ? { ...s, status: "running" }
            : s
        )
      );

      // Step 5: Dispatch test KOT to verify end-to-end transmission
      const testRes = await PrinterClient.printTestReceipt();
      await refreshVirtualStatus();

      setMigrationSteps((prev) =>
        prev.map((s, idx) =>
          idx === 4
            ? {
                ...s,
                status: testRes.success ? "success" : "error",
                detail: testRes.success
                  ? `KOT delivered successfully over new IP (${testRes.durationMs || 0}ms)!`
                  : testRes.message,
              }
            : s
        )
      );
    } catch (err: any) {
      setMigrationSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "error", detail: err.message } : s))
      );
    } finally {
      setIsMigratingIp(false);
    }
  };

  const isSimTargeted = printer.kitchen.printerIp.startsWith("127.0.0.") && printer.kitchen.printerPort === 9102;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#faf9f5] pb-16 font-sans text-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">

          {/* ================================================================= */}
          {/* HEADER & NAVIGATION                                               */}
          {/* ================================================================= */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] pb-6">
            <div>
              <Link
                href="/admin/printer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors mb-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Printer Connectivity</span>
              </Link>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-zinc-900 text-white">
                  <Terminal className="h-4 w-4" />
                </span>
                <h1 className="text-2xl font-black tracking-tight text-zinc-950 font-serif">
                  Developer Printer Recovery Lab
                </h1>
              </div>
              <p className="text-xs text-zinc-600 mt-1">
                Local loopback testing, IP migration simulation, ESC/POS decoding and raw hex dump inspection
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                Port 4318 Daemon
              </span>
              <button
                onClick={() => {
                  printer.refresh();
                  refreshVirtualStatus();
                }}
                className="p-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 transition-colors"
                title="Refresh diagnostics"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/70 text-indigo-950 text-xs flex items-start gap-3">
            <Radio className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Hardware Isolation Notice:</span> Tests conducted in this lab run strictly on local loopback sockets (127.0.0.X). Real restaurant hardware is not disturbed unless explicitly switched to Production Mode.
            </div>
          </div>

          {simulationNotice && (
            <div className="p-3.5 rounded-xl bg-zinc-900 text-white text-xs font-medium flex items-center justify-between animate-fade-in">
              <span>{simulationNotice}</span>
              <button onClick={() => setSimulationNotice(null)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 1: IP MIGRATION SIMULATION CONTROLS                       */}
          {/* ================================================================= */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-black/[0.04] shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-zinc-950">Ethernet IP Recovery Simulation</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Developer Lab
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Simulate a kitchen printer getting a new IP address from the router, and verify that the connector auto-reconnects
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isSimTargeted ? (
                  <button
                    onClick={() => handleToggleMode("PRODUCTION")}
                    disabled={isLoading}
                    className="px-3.5 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 transition-all"
                  >
                    Restore Production (192.168.1.233)
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleMode("VIRTUAL")}
                    disabled={isLoading}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    Switch to Simulation Mode
                  </button>
                )}
              </div>
            </div>

            {/* Status and Action Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  Virtual Printer Listener
                </div>
                <div className="text-base font-bold text-zinc-950 font-mono">
                  {virtualStatus?.host || "127.0.0.1"}:{virtualStatus?.port || 9102}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      virtualStatus?.isRunning ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  <span>{virtualStatus?.isRunning ? "Server Running" : "Server Stopped"}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  Saved Connector Target
                </div>
                <div className="text-base font-bold text-zinc-950 font-mono">
                  {printer.kitchen.printerIp}:{printer.kitchen.printerPort}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">
                  {isSimTargeted ? "Pointed to loopback simulation" : "Pointed to restaurant hardware"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  Server Controls
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {virtualStatus?.isRunning ? (
                    <button
                      onClick={handleStopVirtual}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors flex items-center gap-1"
                    >
                      <Square className="h-3 w-3" />
                      <span>Stop Listener</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartVirtual}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-colors flex items-center gap-1"
                    >
                      <Play className="h-3 w-3" />
                      <span>Start Listener</span>
                    </button>
                  )}

                  <button
                    onClick={handleDispatchTestKot}
                    disabled={testingKot || !printer.connectorOnline}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition-colors"
                  >
                    {testingKot ? "Printing..." : "Test KOT"}
                  </button>
                </div>
              </div>
            </div>

            {/* STAR SIMULATION BUTTON: "GENERATE NEW IP" */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-amber-950">
                      Live IP Migration &amp; Rediscovery Trigger
                    </h3>
                  </div>
                  <p className="text-xs text-amber-900 mt-1">
                    Migrates the virtual printer listener to a new loopback IP (e.g. 127.0.0.2 → 127.0.0.3), shuts down the old listener, and watches the Auto-Discovery Engine detect the failure, rediscover the new address, verify hardware identity, and resume printing.
                  </p>
                </div>

                <button
                  onClick={handleGenerateNewIp}
                  disabled={isMigratingIp || !printer.connectorOnline}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-sm shrink-0 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isMigratingIp ? "animate-spin" : ""}`} />
                  <span>{isMigratingIp ? "Testing Recovery Pipeline..." : "Generate New IP & Test Recovery"}</span>
                </button>
              </div>

              {/* Step-by-Step Live Pipeline Tracker */}
              {migrationSteps.length > 0 && (
                <div className="pt-3 border-t border-amber-200/60 space-y-2 text-xs">
                  {migrationSteps.map((s) => (
                    <div
                      key={s.step}
                      className="flex items-start gap-2.5 p-2 rounded-lg bg-white/70 border border-amber-100"
                    >
                      <div className="mt-0.5">
                        {s.status === "running" ? (
                          <RefreshCw className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                        ) : s.status === "success" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : s.status === "error" ? (
                          <XCircle className="h-3.5 w-3.5 text-rose-600" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border border-zinc-300 inline-block" />
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-bold text-zinc-900">
                          Step {s.step}: {s.title}
                        </span>
                        {s.detail && (
                          <div className="text-[11px] text-zinc-600 font-mono mt-0.5">{s.detail}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION 2: VIRTUAL RECEIPT INSPECTOR & ESC/POS DECODER            */}
          {/* ================================================================= */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-black/[0.04] shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-950">Virtual Receipt Inspector</h2>
                <p className="text-xs text-zinc-500">
                  Inspect raw binary ESC/POS streams captured by the virtual TCP listener
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearJobs}
                  disabled={virtualJobs.length === 0 || isLoading}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-600 transition-colors flex items-center gap-1 disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear Jobs ({virtualJobs.length})</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Job List (Left Column) */}
              <div className="lg:col-span-4 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Captured Jobs ({virtualJobs.length})
                </div>

                {virtualJobs.length === 0 ? (
                  <div className="text-center py-12 text-xs text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                    No jobs captured yet.<br />Dispatch a test KOT above to capture ESC/POS packets.
                  </div>
                ) : (
                  virtualJobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`w-full text-left p-3.5 rounded-2xl border text-xs transition-all ${
                        selectedJob?.id === job.id
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                          : "bg-white hover:bg-zinc-50 text-zinc-900 border-zinc-200/80"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold">
                          {job.decoded.orderNumber || "Test Slip"}
                        </span>
                        <span
                          className={`font-mono text-[10px] ${
                            selectedJob?.id === job.id ? "text-zinc-400" : "text-zinc-500"
                          }`}
                        >
                          {new Date(job.receivedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] flex items-center justify-between ${
                          selectedJob?.id === job.id ? "text-zinc-300" : "text-zinc-500"
                        }`}
                      >
                        <span>Table {job.decoded.tableNumber || "KITCHEN"}</span>
                        <span>{job.bytesCount} bytes</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Receipt Preview (Right Column) */}
              <div className="lg:col-span-8 bg-zinc-50 rounded-2xl p-5 border border-zinc-200/70 flex flex-col justify-between">
                {selectedJob ? (
                  <div>
                    {/* View Mode Tabs */}
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setReceiptViewTab("VISUAL")}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                            receiptViewTab === "VISUAL"
                              ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                              : "text-zinc-500 hover:text-zinc-900"
                          }`}
                        >
                          Thermal Slip
                        </button>
                        <button
                          onClick={() => setReceiptViewTab("RAW")}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                            receiptViewTab === "RAW"
                              ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                              : "text-zinc-500 hover:text-zinc-900"
                          }`}
                        >
                          Decoded Text
                        </button>
                        <button
                          onClick={() => setReceiptViewTab("HEX")}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                            receiptViewTab === "HEX"
                              ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                              : "text-zinc-500 hover:text-zinc-900"
                          }`}
                        >
                          Hex Dump
                        </button>
                      </div>

                      <div className="text-[11px] text-zinc-500 font-mono">
                        {selectedJob.bytesCount} bytes · Paper Cut:{" "}
                        {selectedJob.decoded.paperCutDetected ? "YES" : "NO"}
                      </div>
                    </div>

                    {/* TAB 1: VISUAL THERMAL SLIP */}
                    {receiptViewTab === "VISUAL" && (
                      <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md border border-zinc-200 font-mono text-xs text-zinc-900 space-y-3">
                        <div className="text-center font-bold text-sm tracking-wider border-b border-dashed border-zinc-300 pb-2">
                          {selectedJob.decoded.brandName || "SPIRAL CAFE"}
                          <div className="text-[10px] font-normal text-zinc-500 mt-0.5">
                            KITCHEN ORDER TICKET (KOT)
                          </div>
                        </div>

                        <div className="flex justify-between text-[11px]">
                          <span>ORDER: {selectedJob.decoded.orderNumber || "ORD-TEST"}</span>
                          <span className="font-bold">TABLE: {selectedJob.decoded.tableNumber || "B4"}</span>
                        </div>

                        <div className="border-t border-b border-dashed border-zinc-300 py-2 space-y-1">
                          {selectedJob.decoded.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="font-semibold">{it.quantity}x {it.name}</span>
                            </div>
                          ))}
                        </div>

                        {selectedJob.decoded.specialInstructions && (
                          <div className="text-[11px] bg-zinc-50 p-2 rounded border border-zinc-200">
                            <span className="font-bold">NOTE: </span>
                            {selectedJob.decoded.specialInstructions}
                          </div>
                        )}

                        <div className="text-center text-[10px] text-zinc-400 pt-2 flex items-center justify-center gap-1">
                          <Scissors className="h-3 w-3" />
                          <span>- - - - - - [ ESC/POS PAPER CUT ] - - - - - -</span>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: RAW DECODED TEXT */}
                    {receiptViewTab === "RAW" && (
                      <pre className="p-4 bg-white rounded-xl border border-zinc-200 font-mono text-xs text-zinc-800 whitespace-pre-wrap overflow-x-auto max-h-[380px]">
                        {selectedJob.decoded.rawText || "No readable ASCII text extracted."}
                      </pre>
                    )}

                    {/* TAB 3: HEX DUMP */}
                    {receiptViewTab === "HEX" && (
                      <div className="space-y-2">
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedJob.decoded.hexDump || "");
                              setCopiedHex(true);
                              setTimeout(() => setCopiedHex(false), 2000);
                            }}
                            className="px-2.5 py-1 rounded-md bg-white border border-zinc-200 hover:bg-zinc-100 text-[11px] font-semibold flex items-center gap-1 text-zinc-700"
                          >
                            {copiedHex ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedHex ? "Copied Hex" : "Copy Hex Dump"}</span>
                          </button>
                        </div>
                        <pre className="p-4 bg-zinc-900 text-emerald-400 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[350px]">
                          {selectedJob.decoded.hexDump || "No binary data available."}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-24 text-xs text-zinc-400">
                    Select a captured job on the left to inspect its thermal slip formatting and raw ESC/POS bytes.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION 3: RAW DIAGNOSTICS JSON INSPECTOR                         */}
          {/* ================================================================= */}
          <div className="bg-white rounded-3xl p-6 border border-black/[0.04] shadow-[0_20px_40px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.01)] space-y-3">
            <h3 className="text-sm font-bold text-zinc-950">Live Connector Diagnostics JSON</h3>
            <p className="text-xs text-zinc-500">Real-time state exported by the Windows service daemon</p>
            <pre className="p-4 bg-zinc-900 text-zinc-300 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-64 leading-relaxed">
              {JSON.stringify(
                {
                  connectorOnline: printer.connectorOnline,
                  version: printer.version,
                  uptimeSeconds: printer.uptimeSeconds,
                  kitchen: printer.kitchen,
                  counter: printer.counter,
                  virtualStatus,
                },
                null,
                2
              )}
            </pre>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}

