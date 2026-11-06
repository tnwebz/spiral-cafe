"use client";

import React from "react";
import { MapPin, ArrowLeftRight, Clock, Footprints } from "lucide-react";

interface ActiveTableBannerProps {
  currentTable: string;
  hasActiveOrders: boolean;
  pendingTransfer?: {
    fromTable: string;
    toTable: string;
  } | null;
  motionEnabled: boolean;
  onToggleMotion: () => void;
  onRequestChangeTable: () => void;
}

export function ActiveTableBanner({
  currentTable,
  hasActiveOrders,
  pendingTransfer,
  motionEnabled,
  onToggleMotion,
  onRequestChangeTable,
}: ActiveTableBannerProps) {
  const displayTable = currentTable.replace("Table ", "");

  return (
    <div className="w-full bg-[#FFF8F3]/90 backdrop-blur-md border-b border-[#EBDAD0] py-2 px-3 sm:px-4 text-xs">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Table Identifier */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-[#B73F1D] text-white flex items-center justify-center font-heading font-extrabold text-xs shrink-0 shadow-xs">
            {displayTable}
          </div>

          <div className="flex items-center gap-1.5 truncate">
            <span className="font-heading font-extrabold text-xs sm:text-sm text-[#4A2117] truncate">
              Table {displayTable}
            </span>

            {hasActiveOrders && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                Dining Active
              </span>
            )}
          </div>
        </div>

        {/* Center: Pending transfer notification pill if active */}
        {pendingTransfer && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold animate-pulse truncate">
            <Clock size={12} className="shrink-0" />
            <span className="truncate">
              Transfer to Table {pendingTransfer.toTable} pending counter approval
            </span>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Motion reminders toggle pill */}
          {hasActiveOrders && (
            <button
              type="button"
              onClick={onToggleMotion}
              title={motionEnabled ? "Walking alerts on (click to turn off)" : "Walking alerts off (click to turn on)"}
              className={`px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                motionEnabled
                  ? "bg-amber-100/80 text-amber-900 border-amber-300"
                  : "bg-white text-zinc-400 border-zinc-200 hover:text-zinc-600"
              }`}
            >
              <Footprints size={12} className={motionEnabled ? "text-amber-700" : ""} />
              <span className="hidden md:inline">
                {motionEnabled ? "Movement Alert On" : "Enable Alerts"}
              </span>
            </button>
          )}

          {/* Change Table Button */}
          <button
            type="button"
            onClick={onRequestChangeTable}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#FFF8F3] text-[#B73F1D] border border-[#B73F1D]/30 text-[11px] font-heading font-extrabold shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeftRight size={12} />
            <span>Change Table</span>
          </button>
        </div>
      </div>
    </div>
  );
}

