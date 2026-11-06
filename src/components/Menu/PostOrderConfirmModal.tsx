"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, MapPin, ArrowRight, X, Sparkles } from "lucide-react";

interface PostOrderConfirmModalProps {
  isOpen: boolean;
  orderNumber?: string;
  tableNumber: string;
  onContinue: () => void;
  onRequestTransfer: () => void;
}

export function PostOrderConfirmModal({
  isOpen,
  orderNumber,
  tableNumber,
  onContinue,
  onRequestTransfer,
}: PostOrderConfirmModalProps) {
  if (!isOpen) return null;

  const displayTable = tableNumber.replace("Table ", "");

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-70 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="w-full max-w-sm bg-[#FFF8F3] rounded-3xl p-5 border border-[#EBDAD0] shadow-2xl flex flex-col relative overflow-hidden"
        >
          {/* Top Status */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EBDAD0]">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                  Step 1: Order Placed
                </span>
                <h3 className="font-heading font-extrabold text-base text-[#4A2117] mt-0.5">
                  Order Received!
                </h3>
              </div>
            </div>
            <button
              onClick={onContinue}
              className="w-7 h-7 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Table delivery target */}
          <div className="my-4 p-4 bg-white rounded-2xl border border-[#EBDAD0] space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#8C5E51] uppercase tracking-wider">
                  Delivering To
                </span>
                <div className="font-heading font-extrabold text-lg text-[#4A2117]">
                  Table {displayTable}
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-[#B73F1D] text-white flex items-center justify-center font-heading font-extrabold text-base shadow-sm">
                {displayTable}
              </div>
            </div>

            {orderNumber && (
              <p className="text-[11px] font-semibold text-[#8C5E51]">
                Order Reference: <span className="font-bold text-[#4A2117]">#{orderNumber}</span>
              </p>
            )}

            <div className="p-2.5 bg-amber-50/90 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed font-medium">
              💡 <strong>Seat Change Policy:</strong> If you move to another table while waiting, tap &quot;Change Table&quot; so our service staff brings your food to the right table.
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onContinue}
              className="w-full py-3.5 bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] font-heading font-extrabold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Got It, Continue to Menu</span>
            </button>

            <button
              onClick={onRequestTransfer}
              className="w-full py-2.5 bg-white hover:bg-[#FFF8F3] text-[#8C5E51] hover:text-[#4A2117] border border-[#EBDAD0] font-heading font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <MapPin size={13} />
              <span>I Moved, Change Table</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

