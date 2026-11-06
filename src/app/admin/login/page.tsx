"use client";

import React, { useState } from "react";
import Image from "next/image";
import { KeyRound, User, ArrowRight, CheckCircle2 } from "lucide-react";

export default function AdminLoginPage() {
  const [tab, setTab] = useState<"pin" | "password">("pin");

  // PIN Form State
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // Password Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const [loginSuccess, setLoginSuccess] = useState(false);

  const completeLoginAndRedirect = () => {
    setLoginSuccess(true);
    // The server has already set the secure HTTP-only session cookie (spiral_admin_token).
    // A full window navigation commits the cookie and loads the authorized dashboard.
    if (typeof window !== "undefined") {
      window.location.href = "/admin";
    }
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    if (!pin.trim()) {
      setPinError("Please enter your PIN");
      return;
    }

    setPinLoading(true);
    setPinError("");

    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        completeLoginAndRedirect();
      } else {
        setPinError(data.error || "Invalid PIN. Access denied.");
      }
    } catch {
      setPinError("Network error. Please try again.");
    } finally {
      setPinLoading(false);
    }
  };

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    if (!username || !password) {
      setPwdError("Both username and password are required.");
      return;
    }

    setPwdLoading(true);
    setPwdError("");

    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        completeLoginAndRedirect();
      } else {
        setPwdError(data.error || "Invalid username or password.");
      }
    } catch {
      setPwdError("Network error. Please try again.");
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#2C1710] flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Container */}
      <div className="w-full max-w-md bg-white border border-[#CA340A]/15 rounded-3xl shadow-xl p-6 sm:p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="relative w-16 h-16 rounded-2xl bg-[#3A1710] p-2 mx-auto mb-3 flex items-center justify-center shadow-md">
            <Image src="/logo.png" alt="Spiral Cafe" width={48} height={48} className="object-contain" />
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-[#2C1710] tracking-tight">
            Spiral Cafe
          </h1>
          <p className="text-xs text-[#52525b] mt-1">
            Restaurant Operations &amp; Administration
          </p>
        </div>

        {loginSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Authenticated! Redirecting to Dashboard...</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex bg-[#FFF9F5] p-1 rounded-2xl border border-[#CA340A]/15 mb-6">
          <button
            type="button"
            onClick={() => {
              setTab("pin");
              setPinError("");
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === "pin"
                ? "bg-[#CA340A] text-white shadow-xs"
                : "text-[#52525b] hover:text-[#2C1710]"
            }`}
          >
            <KeyRound size={14} />
            <span>Staff PIN Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("password");
              setPwdError("");
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === "password"
                ? "bg-[#CA340A] text-white shadow-xs"
                : "text-[#52525b] hover:text-[#2C1710]"
            }`}
          >
            <User size={14} />
            <span>Account Login</span>
          </button>
        </div>

        {/* PIN METHOD */}
        {tab === "pin" ? (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#2C1710] mb-2 text-center uppercase tracking-wider">
                Enter 4-Digit Terminal PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center py-3.5 px-4 bg-[#FFF9F5] border-2 border-[#CA340A]/20 focus:border-[#CA340A] rounded-2xl text-2xl font-black tracking-widest text-[#2C1710] focus:outline-none transition-all"
              />
            </div>

            {pinError && (
              <p className="text-xs text-[#B91C1C] font-semibold text-center">{pinError}</p>
            )}

            <button
              type="submit"
              disabled={pinLoading || loginSuccess}
              className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{pinLoading ? "Verifying..." : loginSuccess ? "Opening Dashboard..." : "ACCESS ADMIN DASHBOARD"}</span>
              <ArrowRight size={16} />
            </button>

            <div className="pt-4 border-t border-zinc-100 text-center">
              <p className="text-[11px] text-[#52525b]">
                Authorized restaurant staff credentials required.
              </p>
            </div>
          </form>
        ) : (
          /* USERNAME / PASSWORD METHOD */
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#2C1710] mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full py-2.5 px-3.5 bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2C1710] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2.5 px-3.5 bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] rounded-xl text-sm font-semibold text-[#2C1710] focus:outline-none transition-all"
              />
            </div>

            {pwdError && (
              <p className="text-xs text-[#B91C1C] font-semibold text-center">{pwdError}</p>
            )}

            <button
              type="submit"
              disabled={pwdLoading || loginSuccess}
              className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{pwdLoading ? "Authenticating..." : loginSuccess ? "Opening Dashboard..." : "SIGN IN"}</span>
              <ArrowRight size={16} />
            </button>

            <div className="pt-4 border-t border-zinc-100 text-center">
              <p className="text-[11px] text-[#52525b]">
                Authorized administration access only.
              </p>
            </div>
          </form>
        )}
      </div>

      <p className="text-[11px] text-[#52525b] mt-6 text-center">
        Secure Restaurant Management • Authorized Personnel Only
      </p>
    </div>
  );
}
