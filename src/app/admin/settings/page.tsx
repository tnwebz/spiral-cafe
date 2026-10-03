"use client";

import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import {
  Building,
  Percent,
  KeyRound,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const fetchData = async () => {
    try {
      const cfgRes = await fetch("/api/admin/settings");
      const cfgData = await cfgRes.json();
      if (cfgData.success) setConfig(cfgData.config);
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
      <div className="space-y-6 max-w-4xl pb-12">
        {/* Header */}
        <div className="border-b border-[#CA340A]/10 pb-4">
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] tracking-tight uppercase">
            Settings &amp; Configuration
          </h1>
          <p className="text-xs sm:text-sm text-[#52525b] mt-0.5">
            Configure cafe business information, GSTIN, tax percentage, and staff terminal PINs
          </p>
        </div>

        {toast && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between text-sm font-bold ${
              toast.error
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-zinc-500 hover:text-black font-semibold text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-6">
          {/* Cafe Profile */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CA340A]/15 shadow-xs space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building size={18} className="text-[#CA340A]" />
              <h3 className="font-heading font-black text-lg text-[#2C1710]">
                Cafe Business Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                  Cafe Name
                </label>
                <input
                  type="text"
                  value={config.cafeName}
                  onChange={(e) => setConfig({ ...config, cafeName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={config.cafePhone}
                  onChange={(e) => setConfig({ ...config, cafePhone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                Full Address (Printed on Invoices &amp; Receipts)
              </label>
              <textarea
                rows={2}
                value={config.cafeAddress}
                onChange={(e) => setConfig({ ...config, cafeAddress: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm text-[#2C1710] focus:outline-none focus:border-[#CA340A] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                GST Number (GSTIN)
              </label>
              <input
                type="text"
                value={config.gstNumber}
                onChange={(e) => setConfig({ ...config, gstNumber: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-mono font-bold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
              />
            </div>
          </div>

          {/* Taxes & Surcharges */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CA340A]/15 shadow-xs space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent size={18} className="text-[#CA340A]" />
              <h3 className="font-heading font-black text-lg text-[#2C1710]">
                Tax &amp; Service Fee Configuration
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
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
                  className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-bold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#52525b] mb-1.5 uppercase tracking-wider">
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
                  className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#52525b] focus:outline-none focus:border-[#CA340A]"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#52525b] mb-1.5 uppercase tracking-wider">
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
                  className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#52525b] focus:outline-none focus:border-[#CA340A]"
                />
              </div>
            </div>
          </div>

          {/* Terminal PINs */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CA340A]/15 shadow-xs space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound size={18} className="text-[#CA340A]" />
              <h3 className="font-heading font-black text-lg text-[#2C1710]">
                Terminal Authorization PINs
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                  Admin PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={config.adminPin}
                  onChange={(e) => setConfig({ ...config, adminPin: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-mono font-bold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                  Kitchen PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={config.kitchenPin}
                  onChange={(e) => setConfig({ ...config, kitchenPin: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-mono font-bold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                  Cashier PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={config.cashierPin}
                  onChange={(e) => setConfig({ ...config, cashierPin: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-mono font-bold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-7 py-3 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-sm font-heading font-black shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save size={16} />
              <span>{saving ? "Saving Changes..." : "SAVE CONFIGURATION"}</span>
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
