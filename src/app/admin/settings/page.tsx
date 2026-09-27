"use client";

import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import { AuditLog } from "@/lib/db";
import {
  Settings,
  ShieldCheck,
  Building,
  Percent,
  KeyRound,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [logSearch, setLogSearch] = useState("");

  const fetchData = async () => {
    try {
      const [cfgRes, logRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/audit-logs"),
      ]);

      const cfgData = await cfgRes.json();
      const logData = await logRes.json();

      if (cfgData.success) setConfig(cfgData.config);
      if (logData.success) setLogs(logData.logs || []);
    } catch (e) {
      console.error("Settings load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            cafeName: config.cafeName,
            cafeAddress: config.cafeAddress,
            cafePhone: config.cafePhone,
            gstNumber: config.gstNumber,
            taxPercentage: parseFloat(config.taxPercentage) || 5,
            packagingFee: parseFloat(config.packagingFee) || 0,
            serviceCharge: parseFloat(config.serviceCharge) || 0,
            kitchenPin: config.kitchenPin,
            cashierPin: config.cashierPin,
            adminPin: config.adminPin,
          },
          adminUser: "Admin Manager",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToast({ message: "Settings and tax rules saved successfully." });
        fetchData();
      } else {
        setToast({ message: data.error || "Failed to save settings.", error: true });
      }
    } catch {
      setToast({ message: "Network error saving settings.", error: true });
    } finally {
      setSaving(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    const q = logSearch.toLowerCase();
    return (
      q === "" ||
      l.action.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.adminUser.toLowerCase().includes(q)
    );
  });

  if (loading || !config) {
    return (
      <AdminLayout>
        <div className="py-20 text-center text-[#52525b]">
          <p className="font-semibold text-sm">Loading system configuration...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="border-b border-[#CA340A]/10 pb-4">
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
            Settings &amp; Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-[#52525b]">
            Configure cafe tax percentage, GSTIN credentials, terminal PINs, and review security audit logs
          </p>
        </div>

        {toast && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold ${
              toast.error
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-zinc-500 hover:text-black font-normal"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: CONFIG FORM */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* Cafe Profile */}
              <div className="bg-white p-6 rounded-3xl border border-[#CA340A]/15 shadow-xs space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building size={16} className="text-[#CA340A]" />
                  <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                    Cafe Business Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                      Cafe Name
                    </label>
                    <input
                      type="text"
                      value={config.cafeName}
                      onChange={(e) => setConfig({ ...config, cafeName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#2C1710] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={config.cafePhone}
                      onChange={(e) => setConfig({ ...config, cafePhone: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#2C1710] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                    Full Address (Printed on Invoices &amp; Receipts)
                  </label>
                  <textarea
                    rows={2}
                    value={config.cafeAddress}
                    onChange={(e) => setConfig({ ...config, cafeAddress: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs text-[#2C1710] focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                    GST Number (GSTIN)
                  </label>
                  <input
                    type="text"
                    value={config.gstNumber}
                    onChange={(e) => setConfig({ ...config, gstNumber: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-mono font-bold text-[#2C1710] focus:outline-none"
                  />
                </div>
              </div>

              {/* Taxes & Surcharges */}
              <div className="bg-white p-6 rounded-3xl border border-[#CA340A]/15 shadow-xs space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Percent size={16} className="text-[#CA340A]" />
                  <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                    Tax &amp; Service Fee Configuration
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                      GST / Tax (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={config.taxPercentage}
                      onChange={(e) =>
                        setConfig({ ...config, taxPercentage: e.target.value })
                      }
                      className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-bold text-[#2C1710] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#52525b] mb-1 uppercase tracking-wider">
                      Packaging Fee (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={config.packagingFee}
                      onChange={(e) =>
                        setConfig({ ...config, packagingFee: e.target.value })
                      }
                      className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#52525b] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#52525b] mb-1 uppercase tracking-wider">
                      Service Charge (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={config.serviceCharge}
                      onChange={(e) =>
                        setConfig({ ...config, serviceCharge: e.target.value })
                      }
                      className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#52525b] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Terminal PINs */}
              <div className="bg-white p-6 rounded-3xl border border-[#CA340A]/15 shadow-xs space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound size={16} className="text-[#CA340A]" />
                  <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                    Terminal Authorization PINs
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                      Admin PIN
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={config.adminPin}
                      onChange={(e) => setConfig({ ...config, adminPin: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-mono font-bold text-[#2C1710] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                      Kitchen PIN
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={config.kitchenPin}
                      onChange={(e) => setConfig({ ...config, kitchenPin: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-mono font-bold text-[#2C1710] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                      Cashier PIN
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={config.cashierPin}
                      onChange={(e) => setConfig({ ...config, cashierPin: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs font-mono font-bold text-[#2C1710] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-heading font-extrabold shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save size={15} />
                  <span>{saving ? "Saving Changes..." : "SAVE CONFIGURATION"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN: AUDIT LOG */}
          <div className="bg-white p-6 rounded-3xl border border-[#CA340A]/15 shadow-xs flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={18} className="text-[#CA340A]" />
              <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                Security Audit Log
              </h3>
            </div>
            <p className="text-xs text-[#52525b] mb-4">
              Real-time audit trail of payment settlements, invoice issuances, and menu edits
            </p>

            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search audit trail..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2.5 pr-1 divide-y divide-zinc-100 text-xs">
              {filteredLogs.length === 0 ? (
                <p className="py-8 text-center text-zinc-400">No logs found.</p>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="pt-2">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span className="font-bold text-[#CA340A]">{log.action}</span>
                      <span>
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[#2C1710] font-medium text-[11px] mt-0.5">
                      {log.details}
                    </p>
                    <span className="text-[10px] text-zinc-500">By: {log.adminUser}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
