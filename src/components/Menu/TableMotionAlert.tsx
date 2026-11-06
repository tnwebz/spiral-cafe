"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Footprints, MapPin, Check, ArrowRight, X } from "lucide-react";

interface TableMotionAlertProps {
  isOpen: boolean;
  currentTable: string;
  onDismiss: () => void;
  onRequestTransfer: () => void;
}

export function TableMotionAlert({
  isOpen,
  currentTable,
  onDismiss,
  onRequestTransfer,
}: TableMotionAlertProps) {
  if (!isOpen) return null;

  const displayTable = currentTable.replace("Table ", "");

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-70 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="w-full max-w-sm bg-[#FFF8F3] rounded-3xl p-5 border border-[#EBDAD0] shadow-2xl flex flex-col relative overflow-hidden"
        >
          {/* Top Decorative Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EBDAD0]">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
                <Footprints size={20} className="animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                  Movement Reminder
                </span>
                <h3 className="font-heading font-extrabold text-base text-[#4A2117] mt-0.5">
                  Changed Your Table?
                </h3>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="w-7 h-7 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>

          {/* Current Table Context */}
          <div className="my-4 p-3.5 bg-white rounded-2xl border border-[#EBDAD0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8C5E51] font-semibold">Active Dining Table:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#B73F1D] text-white font-heading font-extrabold text-sm shadow-xs">
                <MapPin size={13} />
                Table {displayTable}
              </span>
            </div>
            <p className="text-xs text-[#6B5E55] leading-relaxed">
              We noticed some movement. If you have moved to another seat, please update your table so your freshly prepared meal reaches you without delay.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={onRequestTransfer}
              className="w-full py-3 bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] font-heading font-extrabold text-xs sm:text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <span>Yes, Request Table Change</span>
              <ArrowRight size={15} />
            </button>

            <button
              onClick={onDismiss}
              className="w-full py-2.5 bg-white hover:bg-[#FFF8F3] text-[#4A2117] border border-[#EBDAD0] font-heading font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check size={14} className="text-emerald-600" />
              <span>I&apos;m still at Table {displayTable}</span>
            </button>
          </div>

          <p className="text-[10px] text-zinc-400 text-center mt-2.5">
            Your table never changes automatically. Admin approval ensures correct delivery.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

