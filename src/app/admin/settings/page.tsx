"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/Admin/AdminLayout";
import PWAInstallCard from "@/components/Admin/PWAInstallCard";
import {
  Building,
  Percent,
  KeyRound,
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
  X,
} from "lucide-react";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  // Security Audit: Toggle visibility of terminal PINs
  const [showPins, setShowPins] = useState(false);

  // Data Management Password Verification Modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const handleVerifyAndOpenDataManagement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput) {
      setAuthError("Please enter your administrator password.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/admin/data-management/verify-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthModalOpen(false);
        setAdminPasswordInput("");
        router.push("/admin/settings/data-management");
      } else {
        setAuthError(data.error || "Incorrect password. Access denied.");
      }
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

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

        {/* PWA Desktop App Installation Card */}
        <PWAInstallCard />

        {/* Data Management Settings Card (Phase 2 Master Implementation) */}
        <div className="bg-gradient-to-br from-[#FFFDFB] to-[#FFF9F5] p-6 sm:p-7 rounded-2xl border-2 border-[#CA340A]/20 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#CA340A]/10 text-[#CA340A] flex items-center justify-center">
                <Database size={19} />
              </div>
              <h3 className="font-heading font-black text-lg text-[#2C1710]">
                Data Management
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#52525b] leading-relaxed">
              Monitor database storage, preserve business records, export historical data and access previous archives.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAdminPasswordInput("");
              setAuthError(null);
              setIsAuthModalOpen(true);
            }}
            className="px-5 py-3 bg-[#2C1710] hover:bg-[#432319] text-white rounded-xl text-xs sm:text-sm font-heading font-black shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Open Data Management</span>
            <ArrowRight size={14} />
          </button>
        </div>

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

          {/* Terminal PINs (Masked for Security Audit Compliance) */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CA340A]/15 shadow-xs space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-[#CA340A]" />
                <h3 className="font-heading font-black text-lg text-[#2C1710]">
                  Terminal Authorization PINs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPins(!showPins)}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 cursor-pointer"
              >
                {showPins ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showPins ? "Mask PINs" : "Show PINs"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#2C1710] mb-1.5 uppercase tracking-wider">
                  Admin PIN
                </label>
                <input
                  type={showPins ? "text" : "password"}
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
                  type={showPins ? "text" : "password"}
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
                  type={showPins ? "text" : "password"}
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

        {/* Data Management Administrator Verification Modal */}
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-[#FFFDFB] rounded-3xl p-6 sm:p-7 max-w-md w-full border border-[#EBDAD0] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#F0E4DC] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#2C1710] text-amber-400 flex items-center justify-center">
                    <Lock size={16} />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-base text-[#2C1710]">
                      Administrator Verification
                    </h3>
                    <p className="text-[11px] text-[#52525b]">
                      Enter your Spiral Cafe administrator password to proceed
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyAndOpenDataManagement} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#2C1710] uppercase tracking-wider mb-1.5">
                    Admin Password or Master PIN
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password..."
                    autoFocus
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Protected administrative operation. Access expires after 15 minutes.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="px-5 py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-heading font-black shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <ShieldCheck size={14} />
                    <span>{authLoading ? "Verifying..." : "Unlock Data Management"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
