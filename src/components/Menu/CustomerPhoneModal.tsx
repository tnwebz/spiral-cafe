"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Phone,
  ArrowRight,
  ShieldCheck,
  Utensils,
  ChevronLeft,
  CheckCircle2,
  Lock,
  Sparkles,
} from "lucide-react";
import { useCart } from "@/context/CartContext";

const TABLES = Array.from({ length: 15 }, (_, i) => `Table ${String(i + 1).padStart(2, "0")}`);

interface CustomerPhoneModalProps {
  currentTable?: string;
  onPhoneSaved?: (phone: string, table?: string) => void;
}

interface TableStatusInfo {
  tableNumber: string;
  isLocked: boolean;
  customerSessionId?: string;
  status?: string;
}

export default function CustomerPhoneModal({
  currentTable,
  onPhoneSaved,
}: CustomerPhoneModalProps) {
  const { tableNumber, setTableNumber, customerSessionId } = useCart();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"phone" | "table">("phone");
  const [phone, setPhone] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>(currentTable || tableNumber || "Table 01");
  const [tablesStatus, setTablesStatus] = useState<TableStatusInfo[]>([]);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync initial table from props or CartContext
  useEffect(() => {
    const active = currentTable || tableNumber || "Table 01";
    setSelectedTable(active);
  }, [currentTable, tableNumber]);

  // Check storage & splash screen coordination to open immediately after loading
  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem("spiral_customer_phone");
      if (savedPhone) {
        if (onPhoneSaved) onPhoneSaved(savedPhone, selectedTable);
        setIsOpen(false);
        return;
      }

      // Check if splash screen is running on the page
      const checkAndOpen = () => {
        const isSplashDone = sessionStorage.getItem("spiral_cafe_splash") === "true";
        if (isSplashDone) {
          setIsOpen(true);
        } else {
          // Poll until splash screen finishes, or fallback to 3.2s
          const interval = setInterval(() => {
            if (sessionStorage.getItem("spiral_cafe_splash") === "true") {
              clearInterval(interval);
              setIsOpen(true);
            }
          }, 300);

          const fallbackTimer = setTimeout(() => {
            clearInterval(interval);
            setIsOpen(true);
          }, 3400);

          return () => {
            clearInterval(interval);
            clearTimeout(fallbackTimer);
          };
        }
      };

      const cleanup = checkAndOpen();
      return cleanup;
    } catch {
      setIsOpen(true);
    }
  }, [onPhoneSaved, selectedTable]);

  // Fetch live table occupancy status when modal opens or step changes to table
  useEffect(() => {
    if (isOpen) {
      fetch("/api/tables/status")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.tables)) {
            setTablesStatus(data.tables);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, step]);

  const handleProceedToTable = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\D/g, "");

    // Validate 10-digit phone
    if (clean.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setError("");
    setStep("table");
  };

  const handleFinalSubmit = async () => {
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 10) {
      setStep("phone");
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!selectedTable) {
      setError("Please choose a table number to continue.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const activeSessionId =
        customerSessionId ||
        localStorage.getItem("spiral_customer_session_id") ||
        localStorage.getItem("spiral_session_id") ||
        `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      localStorage.setItem("spiral_customer_session_id", activeSessionId);
      localStorage.setItem("spiral_session_id", activeSessionId);
      localStorage.setItem("spiral_customer_phone", clean);
      localStorage.setItem("spiral_table_session", selectedTable);

      setTableNumber(selectedTable);

      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: clean,
          serviceSmsConsent: true,
          marketingConsent,
          tableNumber: selectedTable,
          sessionId: activeSessionId,
        }),
      });

      if (onPhoneSaved) {
        onPhoneSaved(clean, selectedTable);
      }

      setIsOpen(false);
    } catch (err) {
      console.error("Error saving customer session:", err);
      // Fallback local save
      localStorage.setItem("spiral_customer_phone", clean);
      localStorage.setItem("spiral_table_session", selectedTable);
      setTableNumber(selectedTable);
      if (onPhoneSaved) onPhoneSaved(clean, selectedTable);
      setIsOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EBDAD0] mb-4">
          {step === "table" ? (
            <button
              onClick={() => {
                setStep("phone");
                setError("");
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#CA340A] hover:underline cursor-pointer"
            >
              <ChevronLeft size={16} />
              <span>Change Phone</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#8C5E51]">
              <Sparkles size={14} className="text-[#CA340A]" />
              <span>Dine-In Check-In</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                step === "phone" ? "bg-[#CA340A] scale-110" : "bg-[#CA340A]/40"
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full ${
                step === "table" ? "bg-[#CA340A] scale-110" : "bg-[#E2C7BA]"
              }`}
            />
            <span className="text-[11px] font-bold text-[#8C5E51] ml-1 uppercase tracking-wider">
              {step === "phone" ? "Step 1 of 2" : "Step 2 of 2"}
            </span>
          </div>
        </div>

        {/* STEP 1: COLLECT PHONE NUMBER */}
        {step === "phone" && (
          <form onSubmit={handleProceedToTable} className="flex flex-col space-y-4">
            {/* Brand Top Header */}
            <div className="text-center">
              <div className="relative w-14 h-14 rounded-2xl bg-[#3A1710] p-1.5 mx-auto mb-2.5 flex items-center justify-center shadow-md">
                <Image
                  src="/logo.png"
                  alt="Spiral Cafe"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <h2 className="font-heading font-black text-xl sm:text-2xl text-[#2C1710] tracking-tight">
                Welcome to Spiral Cafe
              </h2>
              <p className="text-xs text-[#52525b] mt-1">
                Enter your mobile number to start your dine-in session
              </p>
            </div>

            {/* Input Form */}
            <div>
              <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                Mobile Number
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 font-mono font-bold text-sm text-[#52525b]">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError("");
                  }}
                  placeholder="98765 43210"
                  className="w-full pl-14 pr-3.5 py-3 bg-[#FFF9F5] border-2 border-[#CA340A]/20 focus:border-[#CA340A] rounded-2xl text-base font-bold text-[#2C1710] font-mono focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              {error && <p className="text-[11px] text-red-600 font-bold mt-1.5">{error}</p>}
            </div>

            {/* Privacy Note */}
            <div className="flex items-start gap-2 pt-0.5 text-[11px] text-[#52525b]">
              <ShieldCheck size={15} className="shrink-0 text-emerald-600 mt-0.5" />
              <span>We use this number to send digital invoices and order updates.</span>
            </div>

            {/* Marketing Opt-in Checkbox */}
            <label className="flex items-center gap-2 text-xs text-[#52525b] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="w-4 h-4 rounded text-[#CA340A] border-zinc-300 focus:ring-[#CA340A]"
              />
              <span>Send me offers, discounts and updates</span>
            </label>

            {/* Next Step CTA (Proceed to Table Selection) */}
            <button
              type="submit"
              className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              <span>CHOOSE YOUR TABLE</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* STEP 2: CHOOSE TABLE */}
        {step === "table" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="text-center mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#CA340A]/10 text-[#CA340A] flex items-center justify-center mx-auto mb-1.5">
                <Utensils size={20} />
              </div>
              <h3 className="font-heading font-black text-xl text-[#2C1710]">
                Choose Your Table
              </h3>
              <p className="text-xs text-[#52525b] mt-0.5">
                Mobile: <strong className="text-[#2C1710] font-mono">+91 {phone}</strong> • Pick your table (1 - 15)
              </p>
            </div>

            {/* 15 Table Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 my-2 overflow-y-auto max-h-[38vh] p-1">
              {TABLES.map((t) => {
                const isSelected = selectedTable === t;
                const num = t.replace("Table ", "");
                const info = tablesStatus.find((ts) => ts.tableNumber === t);
                const isOccupiedByOther =
                  info?.isLocked && info?.customerSessionId !== customerSessionId;
                const isMyActiveTable =
                  info?.isLocked && info?.customerSessionId === customerSessionId;

                return (
                  <button
                    key={t}
                    type="button"
                    disabled={isOccupiedByOther}
                    onClick={() => {
                      setSelectedTable(t);
                      setError("");
                    }}
                    className={`py-2.5 px-1.5 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border active:scale-95 ${
                      isOccupiedByOther
                        ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed opacity-60"
                        : isSelected
                        ? "bg-[#CA340A] text-white border-[#A82806] shadow-md ring-2 ring-[#CA340A]/30"
                        : "bg-white text-[#4A2117] border-[#EBDAD0] hover:border-[#CA340A] hover:bg-[#FFF8F3]"
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                      Table
                    </span>
                    <span className="font-heading font-extrabold text-base leading-tight mt-0.5">
                      {num}
                    </span>
                    {isOccupiedByOther ? (
                      <span className="text-[8px] font-bold bg-zinc-200 text-zinc-600 px-1 py-0.2 rounded-full mt-1 flex items-center gap-0.5">
                        <Lock size={8} /> Occupied
                      </span>
                    ) : isMyActiveTable ? (
                      <span className="text-[8px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded-full mt-1">
                        ✓ Yours
                      </span>
                    ) : isSelected ? (
                      <span className="text-[8px] font-bold bg-white/25 text-white px-1.5 py-0.2 rounded-full mt-1">
                        Selected
                      </span>
                    ) : (
                      <span className="text-[8px] text-emerald-700 font-bold mt-1">
                        Available
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {error && <p className="text-[11px] text-red-600 font-bold text-center mt-1">{error}</p>}

            {/* Selected Summary Bar */}
            <div className="mt-2 py-2 px-3 bg-[#FFF9F5] border border-[#CA340A]/20 rounded-xl flex items-center justify-between text-xs">
              <span className="text-[#52525b]">Selected Sitting:</span>
              <span className="font-heading font-black text-sm text-[#CA340A]">
                {selectedTable}
              </span>
            </div>

            {/* Final Continue CTA */}
            <button
              type="button"
              disabled={submitting || !selectedTable}
              onClick={handleFinalSubmit}
              className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-3"
            >
              <span>{submitting ? "Confirming Session..." : "CONTINUE TO MENU"}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
