"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/Admin/AdminLayout";
import PWAInstallCard from "@/components/Admin/PWAInstallCard";
import AnalyticsPinGate from "@/components/Admin/AnalyticsPinGate";
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
  Power,
} from "lucide-react";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  // Security Lock Protection (Same admin pass: 1234)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [checkingUnlock, setCheckingUnlock] = useState<boolean>(true);

  // Remember last non-zero tax rate when turning GST ON/OFF
  const [lastActiveTaxRate, setLastActiveTaxRate] = useState<number>(5);

  // Security Audit: Toggle visibility of terminal PINs
  const [showPins, setShowPins] = useState(false);

  // Data Management Password Verification Modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("spiral_settings_unlocked");
      if (saved === "true") {
        setIsUnlocked(true);
      }
    } catch {}
    setCheckingUnlock(false);
  }, []);

  const fetchData = async () => {
    try {
      const cfgRes = await fetch("/api/admin/settings");
      const cfgData = await cfgRes.json();
      if (cfgData.success) {
        setConfig(cfgData.config);
        const rate = parseFloat(cfgData.config.taxPercentage);
        if (!isNaN(rate) && rate > 0) {
          setLastActiveTaxRate(rate);
          try {
            localStorage.setItem("spiral_last_tax_rate", String(rate));
          } catch {}
        }
      }
    } catch (e) {
      console.error("Settings load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchData();
    }
  }, [isUnlocked]);

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
            taxPercentage: isNaN(parseFloat(config.taxPercentage))
              ? 0
              : Math.max(0, parseFloat(config.taxPercentage)),
            packagingFee: isNaN(parseFloat(config.packagingFee))
              ? 0
              : Math.max(0, parseFloat(config.packagingFee)),
            serviceCharge: isNaN(parseFloat(config.serviceCharge))
              ? 0
              : Math.max(0, parseFloat(config.serviceCharge)),
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

  const isGstOn = config ? parseFloat(config.taxPercentage) > 0 : false;

  const handleToggleGst = (turnOn: boolean) => {
    if (turnOn) {
      let rate = lastActiveTaxRate;
      if (!rate || rate <= 0) {
        try {
          const saved = localStorage.getItem("spiral_last_tax_rate");
          if (saved && parseFloat(saved) > 0) rate = parseFloat(saved);
        } catch {}
      }
      if (!rate || rate <= 0) rate = 5;
      setConfig((prev: any) => ({ ...prev, taxPercentage: rate }));
    } else {
      const current = parseFloat(config.taxPercentage);
      if (!isNaN(current) && current > 0) {
        setLastActiveTaxRate(current);
        try {
          localStorage.setItem("spiral_last_tax_rate", String(current));
        } catch {}
      }
      setConfig((prev: any) => ({ ...prev, taxPercentage: 0 }));
    }
  };

  if (checkingUnlock) {
    return (
      <AdminLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-[#CA340A] border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!isUnlocked) {
    return (
      <AdminLayout>
        <AnalyticsPinGate
          storageKey="spiral_settings_unlocked"
          title="Settings & Audit Protected"
          subtitle="Enter the 4-digit security PIN (1234) to view and manage cafe settings."
          onUnlock={() => setIsUnlocked(true)}
        />
      </AdminLayout>
    );
  }

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
        <div className="border-b border-[#CA340A]/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] tracking-tight uppercase">
              Settings &amp; Configuration
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b] mt-0.5">
              Configure cafe business information, GSTIN, tax percentage, and staff terminal PINs
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem("spiral_settings_unlocked");
              } catch {}
              setIsUnlocked(false);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-black/10 text-xs font-semibold text-zinc-700 hover:text-red-700 hover:border-red-200 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
            title="Lock Settings & Audit"
          >
            <Lock size={13} className="text-[#CA340A]" />
            <span>Lock Page</span>
          </button>
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
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CA340A]/15 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Percent size={18} className="text-[#CA340A]" />
                <h3 className="font-heading font-black text-lg text-[#2C1710]">
                  Tax &amp; Service Fee Configuration
                </h3>
              </div>

              {/* GST Quick ON / OFF Pill Badge */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-bold text-zinc-500">GST Status:</span>
                <span
                  className={`text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 ${
                    isGstOn
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-zinc-100 text-zinc-600 border border-zinc-300"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isGstOn ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`}
                  />
                  <span>{isGstOn ? `ON (${config.taxPercentage}%)` : "OFF (0%)"}</span>
                </span>
              </div>
            </div>

            {/* GST ON / OFF Dedicated Toggle Banner */}
            <div
              className={`p-4 rounded-2xl border transition-all duration-200 ${
                isGstOn
                  ? "bg-[#FFF9F5] border-[#CA340A]/20 shadow-2xs"
                  : "bg-zinc-50/80 border-zinc-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Power size={16} className={isGstOn ? "text-emerald-600" : "text-zinc-400"} />
                    <span className="font-heading font-black text-sm text-[#2C1710]">
                      Enable Goods &amp; Services Tax (GST)
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600">
                    {isGstOn
                      ? `GST is currently active. ${config.taxPercentage}% tax is charged on customer orders and bills.`
                      : "GST is turned OFF. 0% tax is charged on all customer bills and thermal receipts."}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                  <span className={`text-xs font-bold ${!isGstOn ? "text-zinc-900 font-extrabold" : "text-zinc-400"}`}>
                    OFF
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleGst(!isGstOn)}
                    className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#CA340A] focus:ring-offset-2 ${
                      isGstOn ? "bg-emerald-600" : "bg-zinc-300"
                    }`}
                    role="switch"
                    aria-checked={isGstOn}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isGstOn ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-bold ${isGstOn ? "text-emerald-700 font-extrabold" : "text-zinc-400"}`}>
                    ON
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-[#2C1710] uppercase tracking-wider">
                    GST / Tax (%)
                  </label>
                  {!isGstOn && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      0% (GST is OFF)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    disabled={!isGstOn}
                    value={isGstOn ? (config.taxPercentage ?? "") : "0"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig({ ...config, taxPercentage: val });
                      const num = parseFloat(val);
                      if (!isNaN(num) && num > 0) {
                        setLastActiveTaxRate(num);
                        try {
                          localStorage.setItem("spiral_last_tax_rate", String(num));
                        } catch {}
                      }
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      isGstOn
                        ? "bg-[#FFF9F5] border border-zinc-200 text-[#2C1710] focus:outline-none focus:border-[#CA340A]"
                        : "bg-zinc-100 border border-zinc-200 text-zinc-400 cursor-not-allowed opacity-75"
                    }`}
                    placeholder={isGstOn ? "e.g. 5" : "0"}
                  />
                  {!isGstOn && (
                    <button
                      type="button"
                      onClick={() => handleToggleGst(true)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#CA340A] hover:underline cursor-pointer"
                    >
                      Turn ON
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {isGstOn
                    ? "Enter percentage (e.g., 5 for 5% GST)."
                    : "GST is turned OFF. Toggle ON to re-enable tax."}
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#52525b] mb-1.5 uppercase tracking-wider">
                  Packaging Fee (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={config.packagingFee ?? ""}
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
                  value={config.serviceCharge ?? ""}
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
