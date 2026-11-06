"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, Check, X, AlertCircle, Clock, ShieldCheck, MapPin } from "lucide-react";

interface TableTransferModalProps {
  isOpen: boolean;
  currentTable: string;
  customerSessionId: string;
  customerPhone?: string;
  onClose: () => void;
  onTransferSuccess: (newTable: string) => void;
}

export function TableTransferModal({
  isOpen,
  currentTable,
  customerSessionId,
  customerPhone,
  onClose,
  onTransferSuccess,
}: TableTransferModalProps) {
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTargetTable, setSelectedTargetTable] = useState<string | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<any | null>(null);
  const [activeDiningVisit, setActiveDiningVisit] = useState<any | null>(null);

  const cleanCurrentTable = currentTable.replace("Table ", "");

  // Load floor tables and current transfer status
  const loadTablesAndStatus = async () => {
    setLoadingTables(true);
    setError(null);
    try {
      // 1. Fetch tables with 5-color status
      const res = await fetch(`/api/tables?visitorId=${encodeURIComponent(customerSessionId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.tables)) {
        setTables(data.tables);
      }

      // 2. Fetch pending transfer request status
      const trfRes = await fetch(
        `/api/tables/transfer?sessionId=${encodeURIComponent(customerSessionId)}&phone=${encodeURIComponent(
          customerPhone || ""
        )}`
      );
      const trfData = await trfRes.json();
      if (trfData.success) {
        if (trfData.pendingRequest) {
          setPendingRequest(trfData.pendingRequest);
        } else {
          setPendingRequest(null);
        }
        if (trfData.activeVisit) {
          setActiveDiningVisit(trfData.activeVisit);
        }
      }
    } catch (err: any) {
      console.warn("Table transfer modal fetch error:", err);
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTablesAndStatus();
      // Poll every 4 seconds while modal is open if a request is pending
      const interval = setInterval(() => {
        loadTablesAndStatus();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen, customerSessionId, customerPhone]);

  const handleSubmitTransfer = async () => {
    if (!selectedTargetTable) {
      setError("Please select an available table to transfer to.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tables/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST",
          fromTable: cleanCurrentTable,
          toTable: selectedTargetTable,
          customerSessionId,
          customerPhone,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to submit transfer request.");
        return;
      }

      if (data.isDirectTransfer) {
        // Immediate reservation transfer
        onTransferSuccess(selectedTargetTable);
        onClose();
      } else {
        // Pending admin approval
        setPendingRequest(data.request);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit transfer request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-70 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="w-full max-w-sm sm:max-w-md bg-[#FFF8F3] rounded-3xl p-5 sm:p-6 border border-[#EBDAD0] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EBDAD0]">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#B73F1D]/10 text-[#B73F1D] flex items-center justify-center shrink-0">
                <ArrowLeftRight size={20} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#B73F1D] bg-[#B73F1D]/10 px-2 py-0.5 rounded-full">
                  Dining Seat Change
                </span>
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#4A2117] mt-0.5">
                  Change Your Table
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Current Table & Session Banner */}
          <div className="my-3 p-3 bg-white rounded-2xl border border-[#EBDAD0] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[#B73F1D] text-white flex items-center justify-center font-heading font-extrabold text-xs shadow-xs">
                {cleanCurrentTable}
              </span>
              <div>
                <div className="text-[10px] font-bold text-[#8C5E51] uppercase">Current Table</div>
                <div className="font-heading font-extrabold text-xs text-[#4A2117]">
                  Table {cleanCurrentTable}
                </div>
              </div>
            </div>

            {activeDiningVisit && activeDiningVisit.hasActiveVisit && (
              <div className="text-right">
                <div className="text-[10px] font-bold text-[#8C5E51] uppercase">Session Bill</div>
                <div className="font-heading font-extrabold text-xs text-[#B73F1D]">
                  ₹{activeDiningVisit.grandTotal} ({activeDiningVisit.orders.length} orders)
                </div>
              </div>
            )}
          </div>

          {/* Pending Transfer Notice */}
          {pendingRequest && pendingRequest.status === "PENDING" ? (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/90 text-center space-y-3 my-2">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto animate-pulse">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="font-heading font-extrabold text-sm text-amber-950">
                  Transfer Request Pending Approval
                </h4>
                <p className="text-xs text-amber-800 mt-1">
                  Requested move to <strong>Table {pendingRequest.toTable}</strong>.
                </p>
                <p className="text-[11px] text-amber-700/90 mt-1">
                  Please inform the counter staff or wait for their approval. Your original Table{" "}
                  {cleanCurrentTable} remains securely locked.
                </p>
              </div>

              <div className="pt-1 flex justify-center">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-white text-amber-900 border border-amber-300 rounded-xl text-xs font-heading font-bold shadow-xs hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  Close & Wait
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-2 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-1.5 font-medium">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="text-[11px] font-bold text-[#8C5E51] uppercase tracking-wider mb-1.5">
                Select New Table:
              </div>

              {/* Floor Table Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto max-h-[38vh] p-1">
                {tables.map((t) => {
                  const isCurrent = t.tableNumber.toUpperCase() === cleanCurrentTable.toUpperCase();
                  const isSelected = selectedTargetTable === t.tableNumber;
                  const isOccupied =
                    t.color === "RED" || t.color === "YELLOW" || t.color === "GREEN";
                  const isReservedOther =
                    t.color === "BLUE" && t.reservation?.customerSessionId !== customerSessionId;

                  const canSelect = !isCurrent && !isOccupied && !isReservedOther;

                  return (
                    <button
                      key={t.tableNumber}
                      type="button"
                      disabled={!canSelect}
                      onClick={() => setSelectedTargetTable(t.tableNumber)}
                      className={`p-2.5 rounded-2xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#B73F1D] text-white border-[#B73F1D] shadow-md ring-2 ring-[#B73F1D]/30 scale-102"
                          : isCurrent
                          ? "bg-amber-100/60 text-[#4A2117] border-amber-300 opacity-60 cursor-not-allowed"
                          : !canSelect
                          ? "bg-zinc-100 text-zinc-400 border-zinc-200 opacity-60 cursor-not-allowed"
                          : "bg-white text-[#4A2117] border-[#EBDAD0] hover:border-[#B73F1D] hover:bg-[#FFF8F3]"
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-75">
                        Table
                      </span>
                      <span className="font-heading font-extrabold text-base sm:text-lg leading-tight">
                        {t.tableNumber}
                      </span>
                      <span className="text-[9px] font-semibold mt-0.5">
                        {isCurrent
                          ? "Current"
                          : isOccupied
                          ? "Occupied"
                          : isReservedOther
                          ? "Reserved"
                          : "Available"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 5-Color Legend */}
              <div className="flex items-center justify-around text-[10px] font-bold text-zinc-600 bg-white/70 rounded-xl p-2 border border-[#EBDAD0]/60 my-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-zinc-300 border border-zinc-400" />
                  ⚪ Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  🔵 Reserved
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  🟢 Occupied
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#EBDAD0]">
                <button
                  type="button"
                  disabled={!selectedTargetTable || submitting}
                  onClick={handleSubmitTransfer}
                  className="w-full py-3 bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] font-heading font-extrabold text-xs sm:text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        Request Move: Table {cleanCurrentTable} → Table{" "}
                        {selectedTargetTable || "..."}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 text-xs font-bold text-[#8C5E51] hover:text-[#4A2117] transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

