"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Phone, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

interface CustomerPhoneModalProps {
  currentTable: string;
  onPhoneSaved: (phone: string) => void;
}

export default function CustomerPhoneModal({
  currentTable,
  onPhoneSaved,
}: CustomerPhoneModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check if phone already stored in local/session storage
    try {
      const savedPhone = localStorage.getItem("spiral_customer_phone");
      if (savedPhone) {
        onPhoneSaved(savedPhone);
        setIsOpen(false);
      } else {
        // Show modal after small delay
        const timer = setTimeout(() => setIsOpen(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      setIsOpen(true);
    }
  }, [onPhoneSaved]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\D/g, "");

    // Validate Indian 10-digit mobile number
    if (clean.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const sessionId =
        localStorage.getItem("spiral_session_id") ||
        `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      localStorage.setItem("spiral_session_id", sessionId);
      localStorage.setItem("spiral_customer_phone", clean);

      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: clean,
          serviceSmsConsent: true,
          marketingConsent,
          tableNumber: currentTable,
          sessionId,
        }),
      });

      onPhoneSaved(clean);
      setIsOpen(false);
    } catch {
      // Fallback
      localStorage.setItem("spiral_customer_phone", clean);
      onPhoneSaved(clean);
      setIsOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-sm w-full p-6 sm:p-7 relative overflow-hidden">
        {/* Brand Top Header */}
        <div className="text-center mb-5">
          <div className="relative w-14 h-14 rounded-2xl bg-[#3A1710] p-1.5 mx-auto mb-3 flex items-center justify-center shadow-md">
            <Image src="/logo.png" alt="Spiral Cafe" width={40} height={40} className="object-contain" />
          </div>
          <h2 className="font-heading font-black text-xl text-[#2C1710] tracking-tight">
            Welcome to Spiral Cafe
          </h2>
          <p className="text-xs text-[#52525b] mt-1">
            Enter your mobile number to start your dine-in session
          </p>

          <div className="mt-3 inline-block px-3 py-1 bg-[#FFF9F5] border border-[#CA340A]/20 rounded-full text-xs font-bold text-[#CA340A]">
            {currentTable || "Dine-In Table"}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
              Mobile Number
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 font-mono font-bold text-xs text-[#52525b]">
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
                className="w-full pl-12 pr-3.5 py-3 bg-[#FFF9F5] border-2 border-[#CA340A]/20 focus:border-[#CA340A] rounded-2xl text-base font-bold text-[#2C1710] font-mono focus:outline-none"
                autoFocus
              />
            </div>
            {error && <p className="text-[11px] text-red-600 font-bold mt-1">{error}</p>}
          </div>

          {/* Privacy Note */}
          <div className="flex items-start gap-2 pt-1 text-[11px] text-[#52525b]">
            <ShieldCheck size={14} className="shrink-0 text-emerald-600 mt-0.5" />
            <span>We use this number to send digital invoices and order updates.</span>
          </div>

          {/* Marketing Opt-in Checkbox (NOT preselected) */}
          <label className="flex items-center gap-2 text-xs text-[#52525b] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="w-4 h-4 rounded text-[#CA340A] border-zinc-300 focus:ring-[#CA340A]"
            />
            <span>Send me offers, discounts and updates</span>
          </label>

          {/* Continue CTA */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            <span>{submitting ? "Starting Session..." : "CONTINUE TO MENU"}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
