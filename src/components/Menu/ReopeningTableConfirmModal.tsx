"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, MapPin, Check, ArrowRight, X } from "lucide-react";

interface ReopeningTableConfirmModalProps {
  isOpen: boolean;
  tableNumber: string;
  orderCount?: number;
  currentBill?: number;
  onConfirmStillHere: () => void;
  onRequestTransfer: () => void;
}

export function ReopeningTableConfirmModal({
  isOpen,
  tableNumber,
  orderCount = 1,
  currentBill = 0,
  onConfirmStillHere,
  onRequestTransfer,
}: ReopeningTableConfirmModalProps) {
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
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EBDAD0]">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#B73F1D]/10 text-[#B73F1D] flex items-center justify-center shrink-0">
                <Coffee size={20} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                  Active Dining Session
                </span>
                <h3 className="font-heading font-extrabold text-base text-[#4A2117] mt-0.5">
                  Welcome Back!
                </h3>
              </div>
            </div>
            <button
              onClick={onConfirmStillHere}
              className="w-7 h-7 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Session Overview Card */}
          <div className="my-4 p-4 bg-white rounded-2xl border border-[#EBDAD0] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#8C5E51] uppercase tracking-wider">
                  Assigned Seat
                </span>
                <div className="font-heading font-extrabold text-xl text-[#4A2117]">
                  Table {displayTable}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-[#8C5E51] uppercase tracking-wider">
                  Current Bill
                </span>
                <div className="font-heading font-extrabold text-xl text-[#B73F1D]">
                  ₹{currentBill}
                </div>
              </div>
            </div>

            <p className="text-xs text-[#6B5E55] leading-relaxed">
              You have an active dining session with {orderCount} order(s). Are you still seated at{" "}
              <strong>Table {displayTable}</strong>?
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onConfirmStillHere}
              className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-heading font-extrabold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <Check size={16} />
              <span>Yes, Still Sitting at Table {displayTable}</span>
            </button>

            <button
              onClick={onRequestTransfer}
              className="w-full py-2.5 bg-white hover:bg-[#FFF8F3] text-[#B73F1D] border border-[#B73F1D]/30 font-heading font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <MapPin size={13} />
              <span>No, I Changed Seats (Transfer Table)</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

