"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  Download,
  X,
  Wifi,
  Network,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sliders,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { PrinterClient, PrinterState } from "@/services/printerClient";
import type { PrinterSettings } from "@/lib/tables";

interface PrinterStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionState?: PrinterState | null;
  onRefreshStatus?: () => void;
}

export default function PrinterStatusModal({
  isOpen,
  onClose,
  connectionState,
  onRefreshStatus,
}: PrinterStatusModalProps) {
  const [activeTab, setActiveTab] = useState<"status" | "settings">("status");
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

  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<PrinterState | null>(
    connectionState || null
  );
  const [testPrintLoading, setTestPrintLoading] = useState(false);
  const [testPrintMessage, setTestPrintMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load current saved settings from backend
    fetch("/api/tables/printer-settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.settings) {
          setSettings(d.settings);
        }
      })
      .catch(() => {});

    // Run connection probe
    handleProbe();
  }, [isOpen]);

  const handleProbe = async () => {
    setProbing(true);
    setTestPrintMessage(null);
    try {
      const state = await PrinterClient.getPrinterStatus(true);
      setProbeResult(state);
      if (onRefreshStatus) onRefreshStatus();
    } catch (e: any) {
      console.warn("Probe error:", e);
    } finally {
      setProbing(false);
    }
  };

  const handleTestPrint = async () => {
    setTestPrintLoading(true);
    setTestPrintMessage(null);

    try {
      const res = await PrinterClient.printTestReceipt();

      if (res.success) {
        setTestPrintMessage({
          type: "success",
          text: `Test KOT successfully printed to CN811-UEWB (${res.durationMs || 45}ms)!`,
        });
      } else {
        setTestPrintMessage({
          type: "error",
          text:
            res.message ||
            "Printer did not respond. Check printer power, Ethernet cable to router, or start connector ('npm run printer:start').",
        });
      }
    } catch (err: any) {
      setTestPrintMessage({
        type: "error",
        text: err.message || "Test print failed.",
      });
    } finally {
      setTestPrintLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/tables/printer-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      // Also sync to local connector if online
      await PrinterClient.updateConnectorConfig({
        printerIp: settings.ipAddress,
        printerPort: settings.port,
        printerName: settings.printerModel,
      }).catch(() => {});

      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        handleProbe();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaveLoading(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = probeResult?.status === "CONNECTED";
  const isWarning = probeResult?.status === "WARNING";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-[#3A1710] text-[#FFF9F5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
                isConnected
                  ? "bg-emerald-600"
                  : isWarning
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            >
              <Printer size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-extrabold text-base text-[#FFF9F5]">
                  Kitchen Printer
                </h3>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : isWarning
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                  }`}
                >
                  {isConnected ? "READY" : isWarning ? "WARNING" : "DISCONNECTED"}
                </span>
              </div>
              <p className="text-xs text-[#E2C7BA]">Model: CN811-UEWB (80mm Direct ESC/POS TCP)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#E2C7BA] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-5 pt-3">
          <button
            onClick={() => setActiveTab("status")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "status"
                ? "border-[#CA340A] text-[#CA340A]"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Network size={14} />
            Status & Diagnostics
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "settings"
                ? "border-[#CA340A] text-[#CA340A]"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Sliders size={14} />
            Hardware Configuration
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {activeTab === "status" && (
            <div className="space-y-4">
              {/* Status Details Card */}
              <div className="bg-[#FFF9F5] p-4 rounded-2xl border border-[#CA340A]/15 space-y-2.5 text-xs text-[#2C1710]">
                <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                  <span className="font-semibold text-zinc-600">Local Print Connector</span>
                  <span className="font-bold flex items-center gap-1">
                    {probeResult?.connectorOnline ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Active (127.0.0.1:4318)
                      </span>
                    ) : (
                      <span className="text-red-700 flex items-center gap-1">
                        <XCircle size={14} /> Offline (Start connector)
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                  <span className="font-semibold text-zinc-600">Physical Protocol</span>
                  <span className="font-bold text-zinc-800 flex items-center gap-1">
                    <Network size={13} className="text-[#CA340A]" /> Raw TCP Socket (No QZ Tray)
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                  <span className="font-semibold text-zinc-600">Printer IP / Port</span>
                  <span className="font-mono font-bold text-zinc-800">
                    {probeResult?.printerIp || settings.ipAddress}:{probeResult?.printerPort || settings.port}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-zinc-200/60">
                  <span className="font-semibold text-zinc-600">Paper Width</span>
                  <span className="font-bold text-zinc-800">80mm Thermal Receipt</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-zinc-600">Last Status Check</span>
                  <span className="font-mono text-zinc-600">
                    {probeResult?.lastChecked || "Just now"}
                  </span>
                </div>
              </div>

              {/* Status Message or Warning */}
              {probeResult?.error && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                    isConnected
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {isConnected ? (
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  )}
                  <span>{probeResult.error}</span>
                </div>
              )}

              {/* Test Print Output Message */}
              {testPrintMessage && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
                    testPrintMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {testPrintMessage.type === "success" ? (
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={16} className="shrink-0 mt-0.5" />
                  )}
                  <span>{testPrintMessage.text}</span>
                </div>
              )}

              {/* Download Connector Shortcut when Offline */}
              {!probeResult?.connectorOnline && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-2">
                  <div className="text-[11px] text-red-900">
                    <span className="font-bold block">Connector Not Running</span>
                    Install standalone connector on billing PC
                  </div>
                  <a
                    href="/downloads/SpiralCafe-Printer-Setup.exe"
                    download="SpiralCafe-Printer-Setup.exe"
                    className="px-3 py-1.5 rounded-xl bg-[#CA340A] text-white font-bold text-xs hover:bg-[#B73F1D] flex items-center gap-1.5 shrink-0 shadow-xs"
                  >
                    <Download size={13} />
                    <span>Download Setup</span>
                  </a>
                </div>
              )}

              {/* Power cut & Network advisory */}
              <div className="p-3 bg-zinc-100 rounded-xl text-[11px] text-zinc-600 space-y-1">
                <p className="font-bold text-zinc-800 flex items-center gap-1">
                  <ShieldAlert size={13} className="text-[#CA340A]" />
                  Anti-Replay Protection Enabled:
                </p>
                <p>
                  Zero spool queue: If power or Wi-Fi drops, print attempts fail fast within 3s without loop retries.
                  Orders stay pending on the counter screen so staff can resend with one click.
                </p>
              </div>

              {/* Diagnostic Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleProbe}
                  disabled={probing}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={14} className={probing ? "animate-spin" : ""} />
                  {probing ? "Checking..." : "Check Connection"}
                </button>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={testPrintLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#B73F1D] shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <FileText size={14} />
                  {testPrintLoading ? "Printing..." : "Test Print 80mm"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <form onSubmit={handleSaveSettings} className="space-y-3.5">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 size={15} />
                  <span>Printer settings saved persistently!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#2C1710] mb-1">
                  Printer Model
                </label>
                <input
                  type="text"
                  value={settings.printerModel}
                  onChange={(e) => setSettings({ ...settings, printerModel: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFF9F5] border border-zinc-300 rounded-xl text-xs font-bold text-[#2C1710]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1">
                    Printer IP Address
                  </label>
                  <input
                    type="text"
                    value={settings.ipAddress}
                    onChange={(e) => setSettings({ ...settings, ipAddress: e.target.value })}
                    placeholder="192.168.1.233"
                    className="w-full px-3 py-2 bg-[#FFF9F5] border border-zinc-300 rounded-xl text-xs font-mono font-bold text-[#2C1710]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={settings.port}
                    onChange={(e) =>
                      setSettings({ ...settings, port: parseInt(e.target.value, 10) || 9100 })
                    }
                    className="w-full px-3 py-2 bg-[#FFF9F5] border border-zinc-300 rounded-xl text-xs font-mono font-bold text-[#2C1710]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2C1710] mb-1">
                  Terminal Name
                </label>
                <input
                  type="text"
                  value={settings.terminalName}
                  onChange={(e) =>
                    setSettings({ ...settings, terminalName: e.target.value })
                  }
                  placeholder="Billing 1"
                  className="w-full px-3 py-2 bg-[#FFF9F5] border border-zinc-300 rounded-xl text-xs font-semibold text-[#2C1710]"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="flex-1 py-2 px-4 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#B73F1D] shadow-md transition-all disabled:opacity-50"
                >
                  {saveLoading ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
