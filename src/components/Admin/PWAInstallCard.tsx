"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Download,
  CheckCircle2,
  Monitor,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HelpCircle,
  HardDriveDownload,
  Info,
} from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function PWAInstallCard() {
  const { canInstall, isInstalled, isInstalling, platform, browserName, installApp } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);

  const handleInstallClick = async () => {
    if (canInstall) {
      const outcome = await installApp();
      if (outcome === "accepted") {
        setInstallFeedback("Installation accepted! Spiral Cafe POS will appear on your desktop and taskbar.");
      } else if (outcome === "dismissed") {
        setInstallFeedback("Installation prompt was dismissed. You can install anytime using the browser address bar icon.");
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CA340A]/15 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-zinc-200/80 shadow-xs shrink-0 bg-white">
            <Image
              src="/app-logo.png"
              alt="Spiral Cafe POS Logo"
              width={56}
              height={56}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-black text-lg text-[#2C1710]">
                Spiral Cafe POS Web App (PWA)
              </h3>
              {isInstalled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={12} />
                  Installed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <Sparkles size={12} />
                  Installable
                </span>
              )}
            </div>
            <p className="text-xs text-[#52525b] mt-0.5">
              Launch Spiral Cafe as a standalone desktop app on Windows with taskbar integration
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-2">
          {isInstalled ? (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>Running as Standalone App</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="px-5 py-2.5 rounded-xl bg-[#CA340A] hover:bg-[#A82806] text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <Download size={15} />
              <span>{isInstalling ? "Installing..." : canInstall ? "Install Spiral Cafe POS" : "How to Install App"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="px-3 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Toggle installation guide"
          >
            <HelpCircle size={14} className="text-zinc-500" />
            <span>Guide</span>
            {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {installFeedback && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info size={15} className="text-amber-700 shrink-0" />
            <span>{installFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setInstallFeedback(null)}
            className="text-amber-700 hover:text-amber-950 font-bold ml-2 text-[11px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-[#FFF9F5] border border-orange-100 flex items-start gap-3">
          <Monitor size={18} className="text-[#CA340A] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-[#2C1710] block">Dedicated Window</span>
            <span className="text-[#52525b] text-[11px] leading-relaxed">
              Opens without browser tabs or address bar for an immersive POS cash register experience.
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FFF9F5] border border-orange-100 flex items-start gap-3">
          <HardDriveDownload size={18} className="text-[#CA340A] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-[#2C1710] block">Windows Integration</span>
            <span className="text-[#52525b] text-[11px] leading-relaxed">
              Pin to your Windows Taskbar or Desktop for 1-click startup at the billing counter.
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FFF9F5] border border-orange-100 flex items-start gap-3">
          <Smartphone size={18} className="text-[#CA340A] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-[#2C1710] block">Hardware &amp; Security</span>
            <span className="text-[#52525b] text-[11px] leading-relaxed">
              Preserves Print Connector on port 4318, HTTP-only admin auth, and real-time syncing.
            </span>
          </div>
        </div>
      </div>

      {/* Browser Installation Guide (Collapsible or Prompt Fallback) */}
      {showGuide && (
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">
              Browser Installation Instructions ({platform === "windows" ? "Windows PC" : "Mobile / Tablet"})
            </span>
            <span className="text-zinc-500 text-[11px]">Detected: {browserName.toUpperCase()}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Microsoft Edge */}
            <div className="p-3.5 rounded-xl bg-white border border-zinc-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-zinc-900">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span>Microsoft Edge (Recommended for Windows)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-zinc-600 text-[11px] leading-relaxed">
                <li>Look for the <strong>App available (⊞)</strong> icon on the right side of the URL address bar.</li>
                <li>Click <strong>Install</strong> when the dialog appears.</li>
                <li>Or open Edge menu <strong>(...)</strong> &rarr; <strong>Apps</strong> &rarr; <strong>Install Spiral Cafe POS</strong>.</li>
                <li>Check <em>Pin to taskbar</em> and <em>Pin to Start</em> for easy access.</li>
              </ol>
            </div>

            {/* Google Chrome */}
            <div className="p-3.5 rounded-xl bg-white border border-zinc-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-zinc-900">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <span>Google Chrome / Brave</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-zinc-600 text-[11px] leading-relaxed">
                <li>Look for the <strong>Install icon (📥)</strong> in the right corner of the address bar.</li>
                <li>Click <strong>Install Spiral Cafe POS</strong>.</li>
                <li>Or click Chrome menu <strong>(⋮)</strong> &rarr; <strong>Save and share</strong> &rarr; <strong>Install Spiral Cafe POS</strong>.</li>
                <li>The POS window will immediately pop open as an independent app.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Quick Download Utilities for Admin */}
      <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
        <span className="font-medium">Direct Downloads &amp; Resources:</span>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/app-logo.png"
            download="SpiralCafe-Logo.png"
            className="text-[#CA340A] hover:underline font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} />
            <span>Download Official High-Res Logo (.png)</span>
          </a>
          <span>•</span>
          <a
            href="/downloads/SpiralCafe-Printer-Setup.exe"
            download="SpiralCafe-Printer-Setup.exe"
            className="text-zinc-700 hover:text-black font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} />
            <span>Print Connector Setup v1.2.0 (.exe)</span>
          </a>
          <span>•</span>
          <a
            href="/manifest.json"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-500 hover:text-zinc-700 inline-flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink size={12} />
            <span>View Manifest</span>
          </a>
        </div>
      </div>
    </div>
  );
}

