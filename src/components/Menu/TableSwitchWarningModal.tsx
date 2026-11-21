"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, ArrowLeftRight, CheckCircle2, Clock } from "lucide-react";

interface TableSwitchWarningModalProps {
  isOpen: boolean;
  assignedTable: string;
  targetTable: string;
  onContinueAssignedTable: () => void;
  onRequestTableChange: () => void;
  isSubmittingRequest?: boolean;
  requestStatus?: "IDLE" | "PENDING" | "APPROVED" | "REJECTED";
  statusMessage?: string | null;
}

export default function TableSwitchWarningModal({
  isOpen,
  assignedTable,
  targetTable,
  onContinueAssignedTable,
  onRequestTableChange,
  isSubmittingRequest = false,
  requestStatus = "IDLE",
  statusMessage = null,
}: TableSwitchWarningModalProps) {
  if (!isOpen) return null;

  const cleanAssigned = (assignedTable || "Your Table").replace(/^Table\s*/i, "").toUpperCase();
  const cleanTarget = (targetTable || "New Table").replace(/^Table\s*/i, "").toUpperCase();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="w-full max-w-sm sm:max-w-md bg-[#FFFDFB] rounded-3xl p-6 border border-[#EBDAD0] shadow-2xl space-y-4 text-center relative overflow-hidden"
        >
          {/* Subtle warm atmospheric glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-2xl pointer-events-none -z-10" />

          {/* Icon */}
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center shadow-xs">
            {requestStatus === "PENDING" ? (
              <Clock size={28} className="animate-pulse" />
            ) : requestStatus === "APPROVED" ? (
              <CheckCircle2 size={28} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={28} />
            )}
          </div>

          {/* Title & Message */}
          <div className="space-y-1.5">
            <h3 className="font-heading font-black text-xl text-[#2C1710] leading-tight">
              You&apos;re already assigned to Table {cleanAssigned}
            </h3>
            <p className="text-xs sm:text-sm text-[#6B5E55] leading-relaxed">
              You&apos;re trying to switch to Table {cleanTarget}. Please contact our cafe staff to change your table.
            </p>
          </div>

          {/* Visual Table Route Badge */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-center gap-3 text-xs font-bold text-[#4A2117]">
            <span className="px-2.5 py-1 bg-white rounded-xl border border-amber-200 shadow-2xs">
              Current: Table {cleanAssigned}
            </span>
            <ArrowRight size={14} className="text-amber-600 shrink-0" />
            <span className="px-2.5 py-1 bg-amber-100/80 rounded-xl border border-amber-300 text-amber-900 shadow-2xs">
              Target: Table {cleanTarget}
            </span>
          </div>

          {/* Dynamic Status Notification */}
          {requestStatus === "PENDING" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-800 font-semibold space-y-1 text-center">
              <p className="font-heading font-extrabold text-blue-900">
                Request Sent to Counter
              </p>
              <p>
                {statusMessage || "Your table-change request has been sent. Please wait for staff approval."}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-blue-600 font-normal">
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Waiting for admin approval...</span>
              </div>
            </div>
          )}

          {requestStatus === "REJECTED" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 font-semibold text-center">
              {statusMessage || "Table change request was declined by staff."}
            </div>
          )}

          {requestStatus === "APPROVED" && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-semibold text-center">
              {statusMessage || `Table changed to Table ${cleanTarget} successfully.`}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onContinueAssignedTable}
              className="w-full py-3.5 px-4 bg-[#B73F1D] hover:bg-[#9D3E22] text-white font-heading font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Continue with Table {cleanAssigned}</span>
            </button>

            {requestStatus !== "PENDING" && requestStatus !== "APPROVED" && (
              <button
                type="button"
                disabled={isSubmittingRequest}
                onClick={onRequestTableChange}
                className="w-full py-3 px-4 bg-white hover:bg-amber-50/60 text-[#B73F1D] font-heading font-bold text-xs rounded-2xl border border-[#B73F1D]/40 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmittingRequest ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#B73F1D] border-t-transparent rounded-full animate-spin" />
                    <span>Sending Request...</span>
                  </>
                ) : (
                  <>
                    <ArrowLeftRight size={14} />
                    <span>Request Table Change</span>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
