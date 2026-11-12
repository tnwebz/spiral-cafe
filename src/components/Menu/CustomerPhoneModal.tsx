"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  ArrowRight,
  ArrowLeftRight,
  X,
  Utensils,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  UtensilsCrossed,
  Leaf,
  RotateCcw,
  Check,
  Salad,
  Drumstick,
} from "lucide-react";
import FoodIcon from "@/components/FoodIcon";
import { useCart, FoodPreference, CustomerProfile } from "@/context/CartContext";

interface CustomerPhoneModalProps {
  currentTable?: string;
  onPhoneSaved?: (phone: string, table?: string) => void;
}

export default function CustomerPhoneModal({
  currentTable,
  onPhoneSaved,
}: CustomerPhoneModalProps) {
  const {
    tableNumber,
    setTableNumber,
    customerSessionId,
    resetCustomerSession,
    foodPreference,
    setFoodPreference,
    customerProfile,
    setCustomerProfile,
  } = useCart();

  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"welcome_back" | "phone" | "preference" | "table_select">("phone");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tablesList, setTablesList] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState(tableNumber || currentTable || "");
  const [loadingTables, setLoadingTables] = useState(false);
  const [conflictVisitTable, setConflictVisitTable] = useState<string | null>(null);
  const [targetTransferTable, setTargetTransferTable] = useState<string>("");
  const [showCounterTransferModal, setShowCounterTransferModal] = useState(false);

  // Fetch live tables overview with 5 colors & check active visit immediately
  const fetchTablesList = async (overrideSession?: string, overridePhone?: string) => {
    setLoadingTables(true);
    try {
      const savedPhone =
        overridePhone ||
        phone.replace(/\D/g, "").slice(-10) ||
        (typeof window !== "undefined" ? localStorage.getItem("spiral_customer_phone") : "") ||
        "";
      const sess = overrideSession || customerSessionId;
      const res = await fetch(
        `/api/tables?visitorId=${encodeURIComponent(sess)}&phone=${encodeURIComponent(savedPhone || "")}`
      );
      const d = await res.json();
      if (d.success && Array.isArray(d.tables)) {
        setTablesList(d.tables);
      }
      if (d.activeCustomerVisit && d.activeCustomerVisit.hasActiveVisit && d.activeCustomerVisit.tableNumber) {
        const rawT = String(d.activeCustomerVisit.tableNumber);
        const cleanT = rawT.replace(/^table[\s\-_]*/i, "").trim().toUpperCase();
        const legacyMap: Record<string, string> = {
          "1": "A1", "01": "A1", "2": "A2", "02": "A2",
          "3": "B1", "03": "B1", "4": "B2", "04": "B2",
          "5": "B3", "05": "B3", "6": "B4", "06": "B4",
          "7": "B5", "07": "B5", "8": "B6", "08": "B6",
          "9": "C1", "09": "C1", "10": "C2",
          "11": "C3", "12": "F1", "13": "F2", "14": "F3", "15": "F4"
        };
        const normalized = legacyMap[cleanT] || cleanT;
        setConflictVisitTable(normalized);
      } else {
        setConflictVisitTable(null);
      }
    } catch {}
    finally {
      setLoadingTables(false);
    }
  };

  const handleContinueWithActiveTable = (rawTable: string) => {
    const clean = rawTable.replace(/^Table\s*/i, "").trim();
    setTableNumber(clean);
    setSelectedTable(clean);
    setIsOpen(false);
    const savedPhone =
      phone.replace(/\D/g, "").slice(-10) ||
      (typeof window !== "undefined" ? localStorage.getItem("spiral_customer_phone") : "") ||
      "";
    if (onPhoneSaved && savedPhone) {
      onPhoneSaved(savedPhone, clean);
    }
    router.push("/menu");
  };

  // Check returning customer session on load (30-day retention window)
  useEffect(() => {
    if (pathname?.startsWith("/admin") || pathname?.startsWith("/kitchen")) {
      return;
    }
    try {
      const savedProfileStr = localStorage.getItem("spiral_customer_profile");
      const savedPhone = localStorage.getItem("spiral_customer_phone");

      const checkAndTrigger = () => {
        if (savedProfileStr) {
          try {
            const parsed: CustomerProfile = JSON.parse(savedProfileStr);
            const isExpired = parsed.expiresAt
              ? Date.now() > new Date(parsed.expiresAt).getTime()
              : false;

            if (!isExpired && parsed.maskedPhone) {
              // Returning Customer within 30 days: show Welcome Back Screen
              fetchTablesList();
              setStep("welcome_back");
              setIsOpen(true);
              return;
            } else {
              // Session expired after 30 days -> prompt for phone again
              localStorage.removeItem("spiral_customer_profile");
              localStorage.removeItem("spiral_customer_phone");
              setStep("phone");
              setIsOpen(true);
              return;
            }
          } catch {
            setStep("phone");
            setIsOpen(true);
            return;
          }
        }

        if (savedPhone && savedPhone.length >= 10) {
          // If legacy raw phone was saved without profile, show welcome back with masked number
          const masked = `******${savedPhone.slice(-4)}`;
          const profile: CustomerProfile = {
            maskedPhone: masked,
            foodPreference: foodPreference || "ALL",
            lastVisited: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };
          localStorage.setItem("spiral_customer_profile", JSON.stringify(profile));
          setCustomerProfile(profile);
          fetchTablesList();
          setStep("welcome_back");
          setIsOpen(true);
          return;
        }

        // First-time customer: show Phone Entry
        setStep("phone");
        setIsOpen(true);
      };

      // Coordinate with splash screen
      const isSplashDone = sessionStorage.getItem("spiral_cafe_splash") === "true";
      if (isSplashDone) {
        checkAndTrigger();
      } else {
        const interval = setInterval(() => {
          if (sessionStorage.getItem("spiral_cafe_splash") === "true") {
            clearInterval(interval);
            checkAndTrigger();
          }
        }, 250);

        const timeout = setTimeout(() => {
          clearInterval(interval);
          checkAndTrigger();
        }, 3200);

        return () => {
          clearInterval(interval);
          clearTimeout(timeout);
        };
      }
    } catch {
      setIsOpen(true);
    }
  }, [setCustomerProfile, foodPreference]);

  // Handler for First-Time Phone Submission -> Moves to Food Preference Screen
  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\D/g, "");

    if (clean.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    const savedPhone =
      typeof window !== "undefined" ? localStorage.getItem("spiral_customer_phone") : null;
    if (savedPhone && savedPhone !== clean) {
      // Different phone number detected! Isolate customer session completely
      resetCustomerSession(clean);
      setConflictVisitTable(null);
      setSelectedTable("");
    }

    setError("");
    setStep("preference");
  };

  // Handler for Food Preference Selection (Saves 30-day session & closes modal)
  const handleSelectPreference = async (pref: FoodPreference) => {
    const clean = phone.replace(/\D/g, "").slice(-10);
    const savedPhone =
      typeof window !== "undefined" ? localStorage.getItem("spiral_customer_phone") : null;
    let activeSession = customerSessionId;

    if (!savedPhone || savedPhone !== clean) {
      activeSession = resetCustomerSession(clean);
      setConflictVisitTable(null);
      setSelectedTable("");
    }

    setSubmitting(true);
    setError("");

    try {
      const masked = `******${clean.slice(-4)}`;
      const profile: CustomerProfile = {
        maskedPhone: masked,
        foodPreference: pref,
        lastVisited: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // 1. Update CartContext
      setFoodPreference(pref);
      setCustomerProfile(profile);

      // 2. Browser Storage (masked for display, full for backend order requests)
      localStorage.setItem("spiral_customer_phone", clean);
      localStorage.setItem("spiral_customer_profile", JSON.stringify(profile));

      // 3. Register with backend
      await fetch("/api/customers/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: clean,
          foodPreference: pref,
          tableNumber: selectedTable || tableNumber || currentTable || "",
          sessionId: activeSession,
        }),
      });

      if (onPhoneSaved) {
        onPhoneSaved(clean, selectedTable || tableNumber || currentTable || "");
      }

      await fetchTablesList(activeSession, clean);
      setStep("table_select");
    } catch (err) {
      console.error("Preference save error:", err);
      await fetchTablesList(activeSession, clean);
      setStep("table_select");
    } finally {
      setSubmitting(false);
    }
  };

  // Handler for Returning Customer: "Continue"
  const handleWelcomeBackContinue = () => {
    // Refresh last visited timestamp and extend 30-day expiry
    if (customerProfile) {
      const updated: CustomerProfile = {
        ...customerProfile,
        lastVisited: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      setCustomerProfile(updated);
      try {
        localStorage.setItem("spiral_customer_profile", JSON.stringify(updated));
      } catch {}
    }

    const savedPhone = typeof window !== "undefined" ? localStorage.getItem("spiral_customer_phone") : null;
    if (savedPhone && onPhoneSaved) {
      onPhoneSaved(savedPhone, tableNumber || currentTable || "A1");
    }

    fetchTablesList();
    setStep("table_select");
  };

  // Handler for Reserving Table in Step 3
  const handleReserveTable = async (tableNum: string) => {
    const cleanActive = conflictVisitTable?.replace(/^Table\s*/i, "").trim().toUpperCase();
    if (cleanActive && cleanActive === tableNum.toUpperCase()) {
      handleContinueWithActiveTable(tableNum);
      return;
    }

    if (cleanActive && cleanActive !== tableNum.toUpperCase()) {
      setError(
        `You currently have an active dining session at Table ${cleanActive}. To move to Table ${tableNum}, please click "Change Table" to request a table transfer.`
      );
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const clean =
        phone.replace(/\D/g, "").slice(-10) ||
        (typeof window !== "undefined" ? localStorage.getItem("spiral_customer_phone") : "") ||
        "";

      const res = await fetch("/api/tables/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: tableNum,
          customerSessionId,
          customerPhone: clean,
        }),
      });

      const d = await res.json();
      if (d.success) {
        setTableNumber(tableNum);
        setSelectedTable(tableNum);
        if (onPhoneSaved) {
          onPhoneSaved(clean, tableNum);
        }
        setIsOpen(false);
        router.push("/menu");
      } else if (d.conflictActiveVisit && d.currentActiveTable) {
        setConflictVisitTable(d.currentActiveTable);
        setError(d.error || `You already have an active dining visit at ${d.currentActiveTable}.`);
      } else {
        setError(d.error || `Table ${tableNum} is currently reserved or occupied.`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to reserve table.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handler for Returning Customer: "Not you? Change"
  const handleNotYouChange = () => {
    // End remembered customer session, clear storage, and return to phone entry
    resetCustomerSession();
    setConflictVisitTable(null);
    setSelectedTable("");
    setPhone("");
    setError("");
    setStep("phone");
  };

  if (!isOpen || pathname?.startsWith("/admin") || pathname?.startsWith("/kitchen")) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#FFF8F3] rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-sm sm:max-w-md w-full p-6 sm:p-7 relative overflow-hidden flex flex-col">
        {/* ========================================================= */}
        {/* SCENARIO 2: RETURNING CUSTOMER (WELCOME BACK) */}
        {/* ========================================================= */}
        {step === "welcome_back" && (
          <div className="space-y-5 text-center">
            {/* Cafe Logo */}
            <div className="relative w-16 h-16 rounded-3xl bg-[#3A1710] p-2 mx-auto flex items-center justify-center shadow-lg">
              <Image
                src="/logo.png"
                alt="Spiral Cafe"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider mb-2 border border-emerald-200">
                Recognized Guest
              </span>
              <h2 className="font-heading font-black text-2xl text-[#2C1710] tracking-tight">
                WELCOME BACK!
              </h2>
              <p className="text-xs text-[#6B5E55] mt-1 font-medium">
                Continue with your saved mobile number?
              </p>
            </div>

            {/* Masked Number & Preference Badge Display */}
            <div className="bg-white rounded-2xl p-4 border border-[#EBDAD0] shadow-xs space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-zinc-400 font-mono">+91</span>
                <span className="font-mono font-extrabold text-xl text-[#2C1710] tracking-wider">
                  {customerProfile?.maskedPhone ||
                    (typeof window !== "undefined" && localStorage.getItem("spiral_customer_phone")
                      ? `******${localStorage.getItem("spiral_customer_phone")!.slice(-4)}`
                      : "******3210")}
                </span>
              </div>

              <div className="pt-2 border-t border-zinc-100 flex items-center justify-center gap-2 text-xs">
                <span className="text-zinc-500 font-medium">Saved Preference:</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {customerProfile?.foodPreference === "VEG_ONLY" ? (
                    <>
                      <FoodIcon nameOrId="veg" className="w-3.5 h-3.5" />
                      <span>Veg Only</span>
                    </>
                  ) : (
                    <>
                      <FoodIcon nameOrId="non-veg" className="w-4.5 h-3.5" />
                      <span>Veg &amp; Non-Veg</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Actions: Active Table Prompt OR Continue */}
            {conflictVisitTable ? (
              <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 text-xs space-y-2 text-center shadow-xs">
                <div className="flex items-center justify-center gap-1.5 font-heading font-extrabold text-amber-950 text-sm">
                  <span>📍</span>
                  <span>Active Session at Table {conflictVisitTable.replace(/^Table\s*/i, "")}</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  You already placed orders at Table {conflictVisitTable.replace(/^Table\s*/i, "")}. Would you like to continue?
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleContinueWithActiveTable(conflictVisitTable)}
                    className="flex-1 py-3 px-3 bg-[#CA340A] hover:bg-[#B73F1D] text-white rounded-xl text-xs font-heading font-extrabold shadow-md shadow-[#CA340A]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Continue at Table {conflictVisitTable.replace(/^Table\s*/i, "")}</span>
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fetchTablesList();
                      setStep("table_select");
                    }}
                    className="flex-1 py-3 px-3 bg-white border border-[#CA340A] text-[#CA340A] hover:bg-amber-50 rounded-xl text-xs font-heading font-bold transition-all cursor-pointer"
                  >
                    Change Table
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleWelcomeBackContinue}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#CA340A] text-white font-heading font-extrabold text-sm hover:bg-[#B73F1D] shadow-lg shadow-[#CA340A]/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <span>Continue to Menu</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleNotYouChange}
              className="w-full py-2 text-xs font-bold text-[#8C5E51] hover:text-[#2C1710] hover:underline cursor-pointer transition-colors"
            >
              Not you? Change number
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCENARIO 1 - SCREEN 1: FIRST-TIME WELCOME & PHONE ENTRY */}
        {/* ========================================================= */}
        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="text-center space-y-2">
              <div className="relative w-14 h-14 rounded-2xl bg-[#3A1710] p-1.5 mx-auto flex items-center justify-center shadow-md">
                <Image
                  src="/logo.png"
                  alt="Spiral Cafe"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>

              <div>
                <h2 className="font-heading font-black text-xl text-[#2C1710] tracking-tight">
                  WELCOME TO OUR CAFE
                </h2>
                <p className="text-xs text-[#6B5E55] mt-0.5 font-medium">
                  Enter your mobile number to view menu &amp; order
                </p>
              </div>
            </div>

            {/* Phone Number Input */}
            <div>
              <label
                htmlFor="customer-phone-input"
                className="block text-xs font-bold text-[#4A2117] mb-1.5"
              >
                Mobile Number
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center gap-1 text-zinc-500 font-bold text-sm pointer-events-none border-r border-zinc-200 pr-2">
                  <span className="text-xs">🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  id="customer-phone-input"
                  type="tel"
                  maxLength={10}
                  autoFocus
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setPhone(val);
                    if (error) setError("");
                  }}
                  className="w-full pl-22 pr-4 py-3 rounded-2xl bg-white border border-[#EBDAD0] text-[#2C1710] font-mono text-base font-bold placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#CA340A]/40 focus:border-[#CA340A] shadow-2xs transition-all"
                />
              </div>
              {error && (
                <p className="text-xs text-red-600 font-bold mt-1.5 flex items-center gap-1">
                  <span>⚠️</span> {error}
                </p>
              )}
            </div>

            {/* Privacy notice */}
            <div className="flex items-center gap-2 p-2.5 bg-white/70 rounded-xl border border-[#EBDAD0]/60 text-[11px] text-[#8C5E51]">
              <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
              <span>We remember your preference so you don&apos;t have to type again.</span>
            </div>

            {/* Continue CTA */}
            <button
              type="submit"
              disabled={phone.replace(/\D/g, "").length < 10}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#CA340A] text-white font-heading font-extrabold text-sm hover:bg-[#B73F1D] shadow-lg shadow-[#CA340A]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* ========================================================= */}
        {/* SCENARIO 1 - SCREEN 2: FOOD PREFERENCE SELECTION */}
        {/* ========================================================= */}
        {step === "preference" && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-[11px] font-extrabold text-[#CA340A] uppercase tracking-wider">
                Step 2 of 2
              </span>
              <h2 className="font-heading font-black text-xl text-[#2C1710] tracking-tight">
                WHAT DO YOU PREFER?
              </h2>
              <p className="text-xs text-[#6B5E55] font-medium">
                Choose your diet type. You can switch this anytime in the menu.
              </p>
            </div>

            {/* Preference Cards */}
            <div className="space-y-3 pt-2">
              {/* Option 1: VEG ONLY */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSelectPreference("VEG_ONLY")}
                className="w-full p-4 rounded-2xl bg-white border-2 border-emerald-500/40 hover:border-emerald-600 hover:bg-emerald-50/40 transition-all text-left flex items-center justify-between group shadow-xs cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform p-1.5">
                    <FoodIcon nameOrId="veg" className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-sm text-[#2C1710]">
                      VEG ONLY
                    </h3>
                    <p className="text-[11px] text-[#6B5E55]">
                      Show only 100% pure vegetarian items
                    </p>
                  </div>
                </div>
                <span className="w-6 h-6 rounded-full border border-emerald-500 flex items-center justify-center text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check size={14} />
                </span>
              </button>

              {/* Option 2: VEG & NON-VEG */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSelectPreference("ALL")}
                className="w-full p-4 rounded-2xl bg-white border-2 border-[#3A1710]/20 hover:border-[#3A1710] hover:bg-amber-50/40 transition-all text-left flex items-center justify-between group shadow-xs cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#3A1710]/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform p-1.5">
                    <FoodIcon nameOrId="non-veg" className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-sm text-[#2C1710]">
                      VEG &amp; NON-VEG
                    </h3>
                    <p className="text-[11px] text-[#6B5E55]">
                      Explore the complete culinary menu
                    </p>
                  </div>
                </div>
                <span className="w-6 h-6 rounded-full border border-[#3A1710] flex items-center justify-center text-[#3A1710] opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check size={14} />
                </span>
              </button>
            </div>

            <p className="text-[11px] text-[#8C5E51] text-center pt-1">
              Remembered for 30 days on this device.
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: CHOOSE YOUR TABLE & TEMPORARY LOCK */}
        {/* ========================================================= */}
        {step === "table_select" && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-[11px] font-extrabold text-[#CA340A] uppercase tracking-wider">
                Step 3 of 3
              </span>
              <h2 className="font-heading font-black text-xl text-[#2C1710] tracking-tight">
                {conflictVisitTable ? "DINING TABLE" : "SELECT YOUR TABLE"}
              </h2>
              <p className="text-xs text-[#6B5E55] font-medium">
                {conflictVisitTable
                  ? `You are currently seated at Table ${conflictVisitTable}.`
                  : "Choose your floor table to reserve it for 10 minutes."}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-700 text-center">
                {error}
              </div>
            )}

            {conflictVisitTable && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-2">
                <div className="font-heading font-extrabold text-amber-950 text-center">
                  📍 Active Visit at Table {conflictVisitTable}
                </div>
                <p className="text-[11px] text-amber-800 text-center">
                  You already have an active dining session. Would you like to continue at Table {conflictVisitTable}?
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleContinueWithActiveTable(conflictVisitTable)}
                    className="flex-1 py-2 bg-[#CA340A] text-white rounded-xl text-xs font-heading font-bold shadow-xs hover:bg-[#B73F1D] cursor-pointer"
                  >
                    Continue at Table {conflictVisitTable}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetTransferTable("");
                      setShowCounterTransferModal(true);
                    }}
                    className="flex-1 py-2 bg-white border border-[#CA340A] text-[#CA340A] rounded-xl text-xs font-heading font-bold hover:bg-amber-50 cursor-pointer"
                  >
                    Change Table
                  </button>
                </div>
              </div>
            )}

            {loadingTables ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 border-2 border-[#CA340A] border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs font-bold text-zinc-500">Checking table availability...</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 max-h-[42vh] overflow-y-auto p-1">
                {(tablesList.length > 0
                  ? tablesList
                  : [
                      { tableNumber: "A1", color: "WHITE" },
                      { tableNumber: "A2", color: "WHITE" },
                      { tableNumber: "B1", color: "WHITE" },
                      { tableNumber: "B2", color: "WHITE" },
                      { tableNumber: "B3", color: "WHITE" },
                      { tableNumber: "B4", color: "WHITE" },
                      { tableNumber: "B5", color: "WHITE" },
                      { tableNumber: "B6", color: "WHITE" },
                      { tableNumber: "C1", color: "WHITE" },
                      { tableNumber: "C2", color: "WHITE" },
                      { tableNumber: "C3", color: "WHITE" },
                      { tableNumber: "F1", color: "WHITE" },
                      { tableNumber: "F2", color: "WHITE" },
                      { tableNumber: "F3", color: "WHITE" },
                      { tableNumber: "F4", color: "WHITE" },
                    ]
                ).map((t: any) => {
                  const cleanActive = conflictVisitTable?.replace(/^Table\s*/i, "").trim().toUpperCase();
                  const isMyTable = cleanActive
                    ? t.tableNumber.toUpperCase() === cleanActive
                    : Boolean(t.isMyActiveTable);

                  const isSelected = !cleanActive && selectedTable === t.tableNumber;
                  const isAvailable =
                    isMyTable ||
                    t.color === "WHITE" ||
                    (t.color === "BLUE" && t.reservation?.customerSessionId === customerSessionId);
                  const isBlueOther =
                    !isMyTable &&
                    t.color === "BLUE" &&
                    t.reservation?.customerSessionId !== customerSessionId;
                  const isOccupiedOther =
                    !isMyTable &&
                    (t.color === "RED" || t.color === "YELLOW" || t.color === "GREEN");

                  const isDimmed = !isMyTable && !isAvailable;

                  return (
                    <button
                      key={t.tableNumber}
                      type="button"
                      disabled={isDimmed || submitting}
                      onClick={() => {
                        if (isMyTable) {
                          handleContinueWithActiveTable(t.tableNumber);
                        } else if (cleanActive) {
                          setTargetTransferTable(t.tableNumber);
                          setShowCounterTransferModal(true);
                        } else {
                          handleReserveTable(t.tableNumber);
                        }
                      }}
                      className={`p-3 rounded-2xl flex flex-col items-center justify-center border transition-all ${
                        isMyTable
                          ? "bg-emerald-50 text-emerald-950 border-2 border-emerald-600 shadow-md ring-2 ring-emerald-500/30 scale-102 cursor-pointer"
                          : isSelected
                          ? "bg-[#CA340A] text-white border-[#CA340A] shadow-md ring-2 ring-[#CA340A]/30 scale-102 cursor-pointer"
                          : isDimmed
                          ? "opacity-35 pointer-events-none select-none filter blur-[0.6px] bg-zinc-100/70 text-zinc-400 border-zinc-200 cursor-not-allowed"
                          : "bg-white text-[#2C1710] border-[#EBDAD0] hover:border-[#CA340A] hover:bg-amber-50/40 shadow-xs hover:shadow-md cursor-pointer"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isMyTable
                              ? "bg-emerald-500 animate-pulse"
                              : isSelected
                              ? "bg-white"
                              : isAvailable
                              ? "bg-zinc-300"
                              : isBlueOther
                              ? "bg-blue-500"
                              : t.color === "RED"
                              ? "bg-red-500"
                              : t.color === "YELLOW"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                          Table
                        </span>
                      </span>
                      <span className="font-heading font-extrabold text-lg sm:text-xl leading-none">
                        {t.tableNumber}
                      </span>
                      <span className="text-[9px] font-semibold mt-1">
                        {isMyTable
                          ? "Your Table"
                          : isBlueOther
                          ? "Reserved"
                          : isOccupiedOther
                          ? "Occupied"
                          : "Available"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend as requested:
                ⚪ Available
                🔵 Reserved
                🔴🟡🟢 Occupied
                ⚠️ If your table shows occupied, please contact the counter. */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-around text-[11px] font-bold text-zinc-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 border border-zinc-400" />
                  Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Reserved
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </span>
                  Occupied
                </span>
              </div>
              <p className="text-[10px] text-amber-900 text-center font-semibold pt-0.5">
                ⚠️ If your table shows occupied, please contact the counter.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Professional Pop-up Modal for Table Transfer Request */}
      <AnimatePresence>
        {showCounterTransferModal && (
          <div className="fixed inset-0 z-70 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", damping: 26, stiffness: 360 }}
              className="w-full max-w-sm bg-[#FFF8F3] rounded-3xl p-5 border border-[#EBDAD0] shadow-2xl space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#EBDAD0]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                    <ArrowLeftRight size={18} />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-sm text-[#4A2117]">
                      Table Transfer Notice
                    </h3>
                    <p className="text-[11px] text-[#8C5E51]">
                      Currently at Table {conflictVisitTable || "Your Table"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCounterTransferModal(false)}
                  className="w-7 h-7 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Informative Content */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#EBDAD0] space-y-2 text-xs text-[#6B5E55] leading-relaxed">
                <p className="font-semibold text-[#4A2117]">
                  To change your table from Table {conflictVisitTable || "your current table"}{targetTransferTable ? ` to Table ${targetTransferTable}` : ""}, please inform the café counter staff.
                </p>
                <p className="text-[11px] text-[#8C5E51]">
                  Our staff will immediately transfer your table from the counter using the <strong>Transfer Table</strong> option. All your ordered items and session details will be preserved with zero data loss.
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => setShowCounterTransferModal(false)}
                className="w-full py-3 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Got It • Return
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
