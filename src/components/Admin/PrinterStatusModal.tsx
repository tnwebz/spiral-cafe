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
  Receipt,
  Usb,
} from "lucide-react";
import {
  PrinterClient,
  PrinterState,
  CounterPrinterState,
  DualPrinterState,
} from "@/services/printerClient";
import type { PrinterSettings } from "@/lib/tables";
import { CONNECTOR_RELEASE } from "@/lib/connectorDownloads";

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
  const [counterResult, setCounterResult] = useState<CounterPrinterState | null>(null);
  const [testPrintLoading, setTestPrintLoading] = useState(false);
  const [testCounterPrintLoading, setTestCounterPrintLoading] = useState(false);
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
      const dual = await PrinterClient.getDualPrinterStatus(true);
      setProbeResult(dual.kitchen);
      setCounterResult(dual.counter);
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
          text: `Test KOT successfully printed to Kitchen CN811-UEWB (${res.durationMs || 45}ms)!`,
        });
      } else {
        setTestPrintMessage({
          type: "error",
          text:
            res.message ||
            "Kitchen printer did not respond. Check printer power, Ethernet cable to router, or start connector.",
        });
      }
    } catch (err: any) {
      setTestPrintMessage({
        type: "error",
        text: err.message || "Kitchen test print failed.",
      });
    } finally {
      setTestPrintLoading(false);
    }
  };

  const handleTestCounterPrint = async () => {
    setTestCounterPrintLoading(true);
    setTestPrintMessage(null);

    try {
      const res = await PrinterClient.printTestCustomerBill();

      if (res.success) {
        setTestPrintMessage({
          type: "success",
          text: `Test 58mm ticket successfully printed to Counter USB printer (${res.durationMs || 50}ms)!`,
        });
      } else {
        setTestPrintMessage({
          type: "error",
          text:
            res.message ||
            "Counter USB printer did not respond. Check printer power switch and USB cable to laptop.",
        });
      }
    } catch (err: any) {
      setTestPrintMessage({
        type: "error",
        text: err.message || "Counter test print failed.",
      });
    } finally {
      setTestCounterPrintLoading(false);
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
  const isCounterConnected = Boolean(counterResult?.ready || counterResult?.status === "CONNECTED");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-[#3A1710] text-[#FFF9F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
                isConnected || isCounterConnected
                  ? "bg-emerald-600"
                  : "bg-red-500"
              }`}
            >
              <Printer size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-extrabold text-base text-[#FFF9F5]">
                  Thermal Printer Fleet
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                  }`}
                >
                  Kitchen: {isConnected ? "ONLINE" : "OFFLINE"}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isCounterConnected
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  Counter: {isCounterConnected ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
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
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-5 pt-3 shrink-0">
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
            Kitchen Hardware IP
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === "status" && (
            <div className="space-y-4">
              {/* Connector Service Status */}
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs">
                <span className="font-semibold text-zinc-600 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${probeResult?.connectorOnline ? "bg-emerald-500" : "bg-red-500"}`} />
                  Windows Local Connector (Service)
                </span>
                <span className="font-bold flex items-center gap-1">
                  {probeResult?.connectorOnline ? (
                    <span className="text-emerald-700 font-mono text-[11px] flex items-center gap-1">
                      <CheckCircle2 size={13} /> 127.0.0.1:4318 Active
                    </span>
                  ) : (
                    <span className="text-red-700 font-mono text-[11px] flex items-center gap-1">
                      <XCircle size={13} /> Connector Offline
                    </span>
                  )}
                </span>
              </div>

              {/* CARD 1: Kitchen Printer (80mm Ethernet) */}
              <div className="bg-[#FFF9F5] p-4 rounded-2xl border border-[#CA340A]/15 space-y-2.5 text-xs text-[#2C1710]">
                <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Printer size={16} className="text-[#CA340A]" />
                    <span className="font-bold text-sm text-[#3A1710]">Kitchen Printer (80mm)</span>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isConnected
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-red-100 text-red-800 border border-red-300"
                    }`}
                  >
                    {isConnected ? "CONNECTED" : "OFFLINE"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block">Model & Protocol</span>
                    <span className="font-semibold text-zinc-800">CN811-UEWB (Raw TCP)</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">IP Target & Port</span>
                    <span className="font-mono font-bold text-zinc-800">
                      {probeResult?.printerIp || settings.ipAddress}:{probeResult?.printerPort || settings.port}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    disabled={testPrintLoading}
                    className="py-1.5 px-3 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#B73F1D] shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <FileText size={13} />
                    {testPrintLoading ? "Printing..." : "Test Kitchen KOT (80mm)"}
                  </button>
                </div>
              </div>

              {/* CARD 2: Counter KOT & Bill Printer (58mm USB) */}
              <div className="bg-[#FFF9F5] p-4 rounded-2xl border border-[#CA340A]/15 space-y-2.5 text-xs text-[#2C1710]">
                <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-emerald-700" />
                    <span className="font-bold text-sm text-[#3A1710]">Counter KOT & Bill Printer (58mm)</span>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isCounterConnected
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {isCounterConnected ? "READY" : "DISCONNECTED"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block">Physical Interface</span>
                    <span className="font-semibold text-zinc-800 flex items-center gap-1">
                      <Usb size={12} className="text-[#CA340A]" />
                      Laptop Direct USB ({counterResult?.portName || "USB002"})
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Windows Print Queue</span>
                    <span className="font-mono font-bold text-zinc-800">
                      {counterResult?.printerName || "POS58 Printer"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Hardware Present</span>
                    <span className={`font-semibold ${counterResult?.deviceFound ? "text-emerald-700" : "text-amber-700"}`}>
                      {counterResult?.deviceFound ? "Yes (Detected on USB)" : "No (Turn on / Plug in)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Paper Size</span>
                    <span className="font-semibold text-zinc-800">58mm Thermal Roll</span>
                  </div>
                </div>

                {!counterResult?.deviceFound && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <span className="font-bold block">Printer Not Detected on USB:</span>
                      1. Check printer power rocker switch is <b>ON</b> (blue/green LED light).<br />
                      2. Ensure 12V power adapter is plugged in tightly.<br />
                      3. Verify USB cable is firmly inserted into laptop port.
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTestCounterPrint}
                    disabled={testCounterPrintLoading}
                    className="py-1.5 px-3 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Receipt size={13} />
                    {testCounterPrintLoading ? "Printing..." : "Test Counter KOT / Bill (58mm)"}
                  </button>
                </div>
              </div>

              {/* Status Message or Warning */}
              {probeResult?.error && !isConnected && (
                <div className="p-3 rounded-xl text-xs flex items-start gap-2 border bg-amber-50 text-amber-800 border-amber-200">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>Kitchen error: {probeResult.error}</span>
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
                    href={CONNECTOR_RELEASE.installer.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#CA340A] text-white font-bold text-xs hover:bg-[#B73F1D] flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Download Setup</span>
                  </a>
                </div>
              )}

              {/* Diagnostic Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleProbe}
                  disabled={probing}
                  className="w-full py-2.5 px-3 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={14} className={probing ? "animate-spin" : ""} />
                  {probing ? "Probing Both Printers..." : "Refresh Hardware Status"}
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
