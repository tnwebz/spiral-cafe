"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lock, ShieldCheck, KeyRound, AlertCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface AnalyticsPinGateProps {
  onUnlock: () => void;
  title?: string;
  subtitle?: string;
}

const REQUIRED_PIN = "1234";

export default function AnalyticsPinGate({
  onUnlock,
  title = "Sales & Analytics Protected",
  subtitle = "Enter the 4-digit security PIN to view sales metrics and revenue reports.",
}: AnalyticsPinGateProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the hidden or primary input on mount
    inputRef.current?.focus();
  }, []);

  const handleVerify = (candidatePin: string) => {
    if (candidatePin.length !== 4) return;

    setIsVerifying(true);
    setError("");

    setTimeout(() => {
      if (candidatePin === REQUIRED_PIN) {
        try {
          sessionStorage.setItem("spiral_analytics_unlocked", "true");
        } catch {}
        onUnlock();
      } else {
        setError("Incorrect PIN. Please enter the valid 4-digit code.");
        setPin("");
        inputRef.current?.focus();
      }
      setIsVerifying(false);
    }, 150);
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError("");
      if (nextPin.length === 4) {
        handleVerify(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const handleClear = () => {
    setPin("");
    setError("");
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-zinc-200/90 shadow-[0_20px_45px_rgba(0,0,0,0.03),0_2px_8px_rgba(0,0,0,0.02)] p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Subtle top atmospheric bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-[#CA340A] to-rose-600" />

        {/* Back Link */}
        <div className="flex justify-start mb-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors py-1 px-2.5 rounded-lg hover:bg-zinc-100"
          >
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Security Shield Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#FFF9F5] border border-[#CA340A]/20 flex items-center justify-center text-[#CA340A] mb-4 shadow-xs">
          <Lock size={28} className="stroke-[2.2]" />
        </div>

        {/* Header Typography */}
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-zinc-950 tracking-tight mb-2">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600 max-w-sm mx-auto mb-6 leading-relaxed">
          {subtitle}
        </p>

        {/* Hidden keyboard input for accessibility and physical keyboards */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 4);
            setPin(val);
            setError("");
            if (val.length === 4) {
              handleVerify(val);
            }
          }}
          className="sr-only"
          autoFocus
        />

        {/* 4-Digit Display Indicators */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex justify-center items-center gap-3.5 mb-6 cursor-pointer"
        >
          {[0, 1, 2, 3].map((index) => {
            const hasDigit = pin.length > index;
            const digit = pin[index];
            return (
              <div
                key={index}
                className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-xl font-mono font-bold transition-all duration-200 ${
                  hasDigit
                    ? "border-[#CA340A] bg-[#FFF9F5] text-zinc-950 scale-105 shadow-xs"
                    : "border-zinc-200 bg-zinc-50/60 text-zinc-400"
                } ${error ? "border-rose-400 bg-rose-50/40 text-rose-700" : ""}`}
              >
                {hasDigit ? (showPin ? digit : "•") : ""}
              </div>
            );
          })}
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad Grid (Touch / Tablet friendly) */}
        <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto mb-5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isVerifying}
              onClick={() => handleKeyPress(num)}
              className="h-12 rounded-xl bg-zinc-50 hover:bg-[#FFF9F5] active:bg-[#CA340A] active:text-white border border-zinc-200 hover:border-[#CA340A]/30 text-lg font-bold text-zinc-800 transition-all cursor-pointer disabled:opacity-50"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            disabled={isVerifying || pin.length === 0}
            onClick={handleClear}
            className="h-12 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-600 transition-colors disabled:opacity-40 cursor-pointer"
          >
            CLEAR
          </button>

          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleKeyPress("0")}
            className="h-12 rounded-xl bg-zinc-50 hover:bg-[#FFF9F5] active:bg-[#CA340A] active:text-white border border-zinc-200 hover:border-[#CA340A]/30 text-lg font-bold text-zinc-800 transition-all cursor-pointer disabled:opacity-50"
          >
            0
          </button>

          <button
            type="button"
            disabled={isVerifying || pin.length === 0}
            onClick={handleDelete}
            className="h-12 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-700 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center"
            title="Backspace"
          >
            ⌫
          </button>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="flex items-center gap-1.5 hover:text-zinc-900 transition-colors cursor-pointer py-1 px-2 rounded-md hover:bg-zinc-100"
          >
            {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showPin ? "Hide Digits" : "Show Digits"}</span>
          </button>

          <span className="text-[11px] text-zinc-400 font-mono">
            Spiral Cafe Security
          </span>
        </div>
      </div>
    </div>
  );
}
