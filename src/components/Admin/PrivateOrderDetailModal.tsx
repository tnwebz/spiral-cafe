"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  Printer,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Banknote,
  ShieldAlert,
  MapPin,
  FileText,
} from "lucide-react";
import { PrinterClient, CustomerBillPayload } from "@/services/printerClient";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";

interface PrivateOrderDetailModalProps {
  order: any | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export default function PrivateOrderDetailModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}: PrivateOrderDetailModalProps) {
  const [currentOrder, setCurrentOrder] = useState<any | null>(order);
  const [sendingKot, setSendingKot] = useState(false);
  const [printingBill, setPrintingBill] = useState(false);
  const [settling, setSettling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [banner, setBanner] = useState<{ type: "SUCCESS" | "ERROR" | "WARNING"; message: string } | null>(null);

  const printer = usePrinterStatus(8000);

  useEffect(() => {
    setCurrentOrder(order);
    setBanner(null);
  }, [order]);

  if (!isOpen || !currentOrder) return null;

  const notes = currentOrder.notes || "";
  const hasKotConfirmed =
    notes.includes("[KOT_CONFIRMED") ||
    notes.includes("[KOT_MANUALLY_DELIVERED]") ||
    currentOrder.status === "PREPARING" ||
    currentOrder.status === "READY" ||
    currentOrder.status === "SERVED";

  const hasViewedExited =
    notes.includes("[KOT_VIEWED_EXITED]") ||
    notes.includes("[KOT_EXITED_WITHOUT_KOT]") ||
    notes.includes("[KOT_FAILED]") ||
    notes.includes("[KOT_UNKNOWN]");

  let statusColor: "RED" | "YELLOW" | "GREEN" = "RED";
  if (hasKotConfirmed) {
    statusColor = "GREEN";
  } else if (hasViewedExited) {
    statusColor = "YELLOW";
  } else {
    statusColor = "RED";
  }

  const isPendingKot = !hasKotConfirmed;

  // On closing without sending KOT, mark as exited so it turns Yellow (action needed)
  const handleCloseWithCheck = () => {
    if (isPendingKot && !hasViewedExited) {
      fetch(`/api/orders/${currentOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: `${currentOrder.notes || ""} [KOT_VIEWED_EXITED_AT_${Date.now()}]`,
        }),
        keepalive: true,
      }).catch(() => {});
    }
    onClose();
  };

  // 1. Dispatch Kitchen KOT (80mm)
  const handleSendKitchenKot = async () => {
    if (sendingKot) return;
    setSendingKot(true);
    setBanner(null);

    try {
      const result = await PrinterClient.dispatchPrivateKotPrint(currentOrder.id);

      if (result.success) {
        setBanner({
          type: "SUCCESS",
          message: result.message || "Kitchen KOT printed successfully! Order is in PREPARING. 🖨️✅",
        });
        setCurrentOrder((prev: any) =>
          prev
            ? {
                ...prev,
                notes: `${prev.notes || ""} [KOT_CONFIRMED:ROUND_1_AT_${Date.now()}]`,
                status: "PREPARING",
              }
            : null
        );
        onOrderUpdated();
      } else {
        setBanner({
          type: "WARNING",
          message: result.message || "Kitchen printer was unreachable. Check that connector app is running.",
        });
      }
    } catch (err: any) {
      setBanner({
        type: "ERROR",
        message: err.message || "Failed to reach printer to dispatch KOT.",
      });
    } finally {
      setSendingKot(false);
    }
  };

  // 2. Print 58mm Internal Bill Slip
  const handlePrintCustomerBill = async () => {
    if (printingBill) return;
    setPrintingBill(true);
    setBanner(null);

    try {
      const destTable =
        currentOrder.tableNumber === "COUNTER" ||
        currentOrder.tableNumber === "GIVE ON COUNTER"
          ? "COUNTER"
          : currentOrder.tableNumber;

      const billPayload: CustomerBillPayload = {
        visitId: `PRV-${currentOrder.id}`,
        billNumber: currentOrder.orderNumber || "PRV",
        orderNumber: currentOrder.orderNumber || "PRV",
        tableNumber: destTable || "COUNTER",
        dateStr: new Date(currentOrder.createdAt).toLocaleDateString("en-IN"),
        timeStr: new Date(currentOrder.createdAt).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        items: (currentOrder.items || []).map((it: any) => ({
          name: it.name,
          quantity: it.quantity,
          rate: it.price,
          amount: it.lineTotal || it.price * it.quantity,
        })),
        totalItems: (currentOrder.items || []).length,
        totalQuantity: (currentOrder.items || []).reduce(
          (acc: number, it: any) => acc + (it.quantity || 1),
          0
        ),
        subtotal: currentOrder.subtotal || currentOrder.grandTotal,
        grandTotal: currentOrder.grandTotal,
        paymentMode: "CASH",
      };

      const res = await PrinterClient.printCustomerBill(billPayload);
      if (res.success) {
        setBanner({ type: "SUCCESS", message: "58mm Bill slip printed at counter!" });
      } else {
        setBanner({ type: "ERROR", message: res.message || "Failed to print 58mm bill." });
      }
    } catch (err: any) {
      setBanner({ type: "ERROR", message: err.message || "Print failed." });
    } finally {
      setPrintingBill(false);
    }
  };

  // 3. Complete / Receive Payment (Makes order VANISH from active list)
  const handleReceivePaymentAndComplete = async () => {
    if (settling) return;
    setSettling(true);
    setBanner(null);

    try {
      const res = await fetch(`/api/orders/${currentOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          paymentStatus: "PAID",
          notes: `${currentOrder.notes || ""} [PAYMENT_RECEIVED:COMPLETED_AT_${Date.now()}]`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBanner({
          type: "SUCCESS",
          message: `Private Order #${currentOrder.orderNumber} completed & settled! ✅`,
        });
        setTimeout(() => {
          onOrderUpdated();
          onClose();
        }, 700);
      } else {
        setBanner({
          type: "ERROR",
          message: data.error || "Failed to complete private order.",
        });
        setSettling(false);
      }
    } catch (err: any) {
      setBanner({
        type: "ERROR",
        message: err.message || "Network error completing order.",
      });
      setSettling(false);
    }
  };

  // 4. Cancel Order
  const handleCancelOrder = async () => {
    if (!confirm(`Cancel Private Order #${currentOrder.orderNumber}?`)) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${currentOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json();
      if (data.success) {
        onOrderUpdated();
        onClose();
      } else {
        setBanner({ type: "ERROR", message: data.error || "Failed to cancel order." });
      }
    } catch {
      setBanner({ type: "ERROR", message: "Failed to cancel order." });
    } finally {
      setCancelling(false);
    }
  };

  const elapsedMins = Math.max(
    0,
    Math.floor((Date.now() - new Date(currentOrder.createdAt).getTime()) / 60000)
  );

  const destination =
    currentOrder.tableNumber === "COUNTER" ||
    currentOrder.tableNumber === "GIVE ON COUNTER" ||
    !currentOrder.tableNumber
      ? "GIVE ON COUNTER"
      : `TABLE ${currentOrder.tableNumber.toUpperCase()}`;

  const purpose = currentOrder.privatePurpose || "STAFF";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-[#EBDAD0] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EBDAD0] bg-[#FFFBF7] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                statusColor === "RED"
                  ? "bg-rose-100 text-rose-800 border-2 border-rose-300"
                  : statusColor === "YELLOW"
                  ? "bg-amber-100 text-amber-900 border-2 border-amber-300"
                  : "bg-emerald-100 text-emerald-900 border-2 border-emerald-300"
              }`}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#2C1710]">
                  #{currentOrder.orderNumber}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300">
                  PRIVATE: {purpose}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1">
                  <MapPin size={10} />
                  <span>{destination}</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 ${
                    statusColor === "RED"
                      ? "bg-rose-500 text-white shadow-xs animate-pulse"
                      : statusColor === "YELLOW"
                      ? "bg-amber-400 text-amber-950 font-bold shadow-xs"
                      : "bg-emerald-600 text-white shadow-xs"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      statusColor === "RED"
                        ? "bg-white animate-ping"
                        : statusColor === "YELLOW"
                        ? "bg-amber-950"
                        : "bg-white"
                    }`}
                  />
                  {statusColor === "RED"
                    ? "NEW ORDER (KOT PENDING)"
                    : statusColor === "YELLOW"
                    ? "ACTION NEEDED (MISSED KOT)"
                    : "KOT SENT (PREPARING)"}
                </span>
              </div>
              <p className="text-xs text-[#8C5E51] mt-0.5 flex items-center gap-2">
                <Clock size={12} />
                <span>{elapsedMins}m ago</span>
                {currentOrder.privateNote && (
                  <>
                    <span>•</span>
                    <span className="text-zinc-600 italic">
                      &quot;{currentOrder.privateNote}&quot;
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseWithCheck}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Feedback Banner */}
        {banner && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b ${
              banner.type === "SUCCESS"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : banner.type === "WARNING"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {banner.type === "SUCCESS" ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertTriangle size={15} />
            )}
            <span>{banner.message}</span>
          </div>
        )}

        {/* Items List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
            <span>Ordered Dishes ({(currentOrder.items || []).length})</span>
          </div>

          <div className="divide-y divide-zinc-100 border rounded-2xl bg-[#FFFBF7]/50 border-[#EBDAD0] overflow-hidden">
            {(currentOrder.items || []).map((it: any, idx: number) => (
              <div key={it.id || idx} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-heading font-extrabold text-zinc-900">{it.name}</div>
                  <div className="text-[11px] text-zinc-500">
                    ₹{it.price} × {it.quantity}
                  </div>
                  {it.notes && (
                    <div className="text-[10px] text-amber-800 font-medium italic mt-0.5">
                      Note: {it.notes}
                    </div>
                  )}
                </div>
                <div className="font-mono font-bold text-zinc-900">
                  ₹{it.lineTotal || it.price * it.quantity}
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Summary */}
          <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-sm font-heading font-extrabold text-[#2C1710]">
            <span>Grand Total</span>
            <span className="text-[#CA340A] text-base">₹{currentOrder.grandTotal}</span>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 sm:p-5 border-t border-[#EBDAD0] bg-[#FFFBF7] space-y-2.5">
          {/* Printer Warning if KOT pending and printer offline */}
          {isPendingKot && printer.status !== "CONNECTED" && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <span>Kitchen printer is disconnected. Check connection before printing.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Dispatch KOT to Kitchen */}
            {isPendingKot ? (
              <button
                onClick={handleSendKitchenKot}
                disabled={sendingKot}
                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer bg-[#CA340A] hover:bg-[#B73F1D]"
              >
                {sendingKot ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>Dispatch Kitchen KOT</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Kitchen KOT Dispatched</span>
              </div>
            )}

            {/* 2. Print 58mm Bill Slip */}
            <button
              onClick={handlePrintCustomerBill}
              disabled={printingBill}
              className="py-2.5 px-3 rounded-xl text-xs font-bold bg-white border border-zinc-300 text-zinc-800 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {printingBill ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              <span>Print Bill (58mm)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {/* 3. Received Payment & Complete (Makes order VANISH) */}
            <button
              onClick={handleReceivePaymentAndComplete}
              disabled={settling}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-heading font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {settling ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Banknote size={15} />
              )}
              <span>Received Payment & Finish (Vanish)</span>
            </button>

            {/* 4. Cancel Order */}
            <button
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="py-3 px-3 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
              title="Cancel Private Order"
            >
              {cancelling ? <Loader2 size={13} className="animate-spin" /> : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
