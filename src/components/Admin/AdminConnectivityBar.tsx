"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";
import { OrderSyncState } from "@/hooks/useOrderSync";
import {
  Wifi,
  WifiOff,
  Database,
  Radio,
  RefreshCw,
  Printer,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Flame,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface AdminConnectivityBarProps {
  syncState: OrderSyncState;
}

export default function AdminConnectivityBar({ syncState }: AdminConnectivityBarProps) {
  const printer = usePrinterStatus(5000);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const isKitchenOnline = printer.connectorOnline && printer.kitchen.printerReachable;
  const isCounterOnline = printer.connectorOnline && printer.counter.ready;

  const handleManualSync = async () => {
    setSyncFeedback("Syncing...");
    const res = await syncState.syncOrders(false);
    if (res.success) {
      if (res.newCount > 0) {
        setSyncFeedback(`Retrieved ${res.newCount} new orders!`);
      } else {
        setSyncFeedback("All orders up-to-date");
      }
    } else {
      setSyncFeedback("Sync failed (Check connection)");
    }
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const formattedSyncTime = syncState.lastSyncTime
    ? syncState.lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  return (
    <div className="w-full flex flex-col gap-2 mb-4">
      {/* 1. TOP HARDWARE & CLOUD STATUS ROW */}
      <div className="bg-white/95 backdrop-blur-xs border border-[#CA340A]/15 rounded-2xl p-2.5 sm:px-4 sm:py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Status Badges Array */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Internet */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border ${
              syncState.isOnline
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200 animate-pulse"
            }`}
            title={syncState.isOnline ? "Internet connection verified" : "No Internet connection on this machine"}
          >
            {syncState.isOnline ? <Wifi size={13} className="text-emerald-600" /> : <WifiOff size={13} className="text-red-600" />}
            <span className="text-[11px] font-bold">{syncState.isOnline ? "Internet Active" : "Internet Offline"}</span>
          </div>

          {/* Cloud Database (Supabase) */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border ${
              !syncState.syncError
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
            title={syncState.syncError ? `Sync notice: ${syncState.syncError}` : "Supabase Cloud Database connected"}
          >
            <Database size={13} className={!syncState.syncError ? "text-emerald-600" : "text-amber-600"} />
            <span className="text-[11px] font-bold">
              {!syncState.syncError ? "Cloud DB Reachable" : "Cloud DB Unreachable"}
            </span>
          </div>

          {/* Realtime Stream */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border ${
              syncState.realtimeStatus === "CONNECTED"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : syncState.realtimeStatus === "CONNECTING"
                ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
            title={`Realtime WebSocket status: ${syncState.realtimeStatus}`}
          >
            <Radio
              size={13}
              className={
                syncState.realtimeStatus === "CONNECTED"
                  ? "text-emerald-600 animate-pulse"
                  : syncState.realtimeStatus === "CONNECTING"
                  ? "text-yellow-600 animate-spin"
                  : "text-red-600"
              }
            />
            <span className="text-[11px] font-bold">
              {syncState.realtimeStatus === "CONNECTED"
                ? "Realtime Live"
                : syncState.realtimeStatus === "CONNECTING"
                ? "Realtime Connecting..."
                : "Realtime Reconnecting"}
            </span>
          </div>

          {/* Kitchen Printer CN811 */}
          <Link
            href="/admin/printer"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border transition-all hover:opacity-90 ${
              isKitchenOnline
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
            title={
              isKitchenOnline
                ? `Kitchen Printer CN811 Online (${printer.kitchen.printerIp}:${printer.kitchen.printerPort})`
                : "Kitchen Printer Offline (Ethernet / Power cut)"
            }
          >
            <Printer size={13} className={isKitchenOnline ? "text-emerald-600" : "text-red-600"} />
            <span className="text-[11px] font-bold">
              {isKitchenOnline ? "Kitchen 80mm Ready" : "Kitchen Printer Offline"}
            </span>
          </Link>

          {/* Counter USB Printer */}
          <Link
            href="/admin/printer"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border transition-all hover:opacity-90 ${
              isCounterOnline
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-zinc-100 text-zinc-700 border-zinc-300"
            }`}
            title={
              isCounterOnline
                ? `Counter Bill Printer USB Ready (${printer.counter.printerName})`
                : "Counter USB Bill Printer Offline or Disconnected"
            }
          >
            <Receipt size={13} className={isCounterOnline ? "text-emerald-600" : "text-zinc-500"} />
            <span className="text-[11px] font-bold">
              {isCounterOnline ? "Counter 58mm USB Ready" : "Counter Bill Offline"}
            </span>
          </Link>
        </div>

        {/* Right: Sync Status & Manual Sync Action */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Sync Time Stamp */}
          <div className="text-[11px] text-[#52525b] font-medium hidden md:block">
            Synced: <span className="font-mono font-bold text-[#09090b]">{formattedSyncTime}</span>
          </div>

          {/* New Orders Pill if any */}
          {syncState.newOrdersRetrieved > 0 && (
            <button
              onClick={syncState.clearNewBadge}
              className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center gap-1 animate-bounce shadow-xs"
              title="Click to dismiss new orders notice"
            >
              <Zap size={12} />
              <span>+{syncState.newOrdersRetrieved} New Orders</span>
            </button>
          )}

          {/* Manual Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={syncState.isSyncing}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
              syncState.isSyncing
                ? "bg-[#CA340A]/10 text-[#CA340A] cursor-wait"
                : "bg-[#2C1710] text-[#FFF9F5] hover:bg-[#CA340A]"
            }`}
          >
            <RefreshCw size={13} className={syncState.isSyncing ? "animate-spin text-[#CA340A]" : ""} />
            <span>{syncState.isSyncing ? "Syncing Orders..." : "Sync Orders"}</span>
          </button>
        </div>
      </div>

      {/* 2. RECOVERY NOTICE / POWER-CUT ACTIVE BANNERS */}
      {!syncState.isOnline && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-2.5 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <div>
              <strong className="font-bold">Operating on Standalone / Hotspot Mode:</strong> Computer has no active cafe internet. Customers can continue ordering on mobile data; orders are safely preserved in the cloud database and will synchronize automatically when connection returns.
            </div>
          </div>
          <button
            onClick={handleManualSync}
            className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 text-[11px] shrink-0 ml-3"
          >
            Test Connection
          </button>
        </div>
      )}

      {/* 3. KITCHEN RECOVERY QUEUE BANNER */}
      {syncState.unprintedKotsCount > 0 && (
        <div className="bg-[#FFF9F5] border border-[#CA340A]/30 text-[#4A2117] rounded-xl px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Flame size={16} className="text-[#CA340A] shrink-0" />
            <div>
              <span className="font-bold text-[#CA340A] uppercase tracking-wide text-[11px] mr-1">
                Kitchen Recovery Queue:
              </span>
              <span>
                <strong>{syncState.unprintedKotsCount}</strong> order{syncState.unprintedKotsCount > 1 ? "s" : ""} awaiting kitchen printing or chef acknowledgment.
              </span>
              {!isKitchenOnline && (
                <span className="text-red-700 font-semibold ml-1">
                  (Kitchen printer is currently powered off/disconnected)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/tables"
              className="px-3 py-1 rounded-lg bg-[#CA340A] text-white font-bold text-[11px] hover:bg-[#A82A08] transition-colors flex items-center gap-1"
            >
              <span>Manage Kitchen Orders</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* Sync feedback toast message */}
      {syncFeedback && (
        <div className="text-[11px] font-semibold text-center text-[#CA340A] bg-[#FFF9F5] border border-[#CA340A]/20 py-1 rounded-lg animate-fade-in">
          {syncFeedback}
        </div>
      )}
    </div>
  );
}

