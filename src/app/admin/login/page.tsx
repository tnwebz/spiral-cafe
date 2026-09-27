"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, KeyRound, User, ArrowRight, CheckCircle2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
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

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        router.push("/admin");
      } else {
        setPinError(data.error || "Invalid PIN. Default Admin PIN is 1234.");
      }
    } catch {
      setPinError("Network error. Please try again.");
    } finally {
      setPinLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        router.push("/admin");
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
                autoFocus
              />
            </div>

            {pinError && (
              <p className="text-xs text-[#B91C1C] font-semibold text-center">{pinError}</p>
            )}

            <button
              type="submit"
              disabled={pinLoading}
              className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{pinLoading ? "Verifying..." : "ACCESS ADMIN DASHBOARD"}</span>
              <ArrowRight size={16} />
            </button>

            <div className="pt-4 border-t border-zinc-100 text-center">
              <p className="text-[11px] text-[#52525b]">
                Default Quick PIN: <strong className="text-[#2C1710]">1234</strong> (Admin) or{" "}
                <strong className="text-[#2C1710]">5678</strong> (Cashier)
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
              disabled={pwdLoading}
              className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{pwdLoading ? "Authenticating..." : "SIGN IN"}</span>
              <ArrowRight size={16} />
            </button>

            <div className="pt-4 border-t border-zinc-100 text-center">
              <p className="text-[11px] text-[#52525b]">
                Default Account: <strong className="text-[#2C1710]">admin</strong> /{" "}
                <strong className="text-[#2C1710]">spiral2026</strong>
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
