"use client";

import React, { useState, useEffect } from "react";
import { Order } from "@/lib/db";
import {
  Banknote,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Receipt,
  Calculator,
  Printer,
  RotateCw,
  Sparkles,
} from "lucide-react";
import {
  PrinterClient,
  CounterPrinterState,
  CustomerBillPayload,
} from "@/services/printerClient";

interface ReceivePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: (updatedOrder: Order) => void;
}

export default function ReceivePaymentModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: ReceivePaymentModalProps) {
  const [step, setStep] = useState<"FORM" | "SUCCESS">("FORM");
  const [method, setMethod] = useState<"CASH" | "ONLINE">("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [onlineMode, setOnlineMode] = useState<"CARD_MACHINE" | "UPI_QR" | "OTHER">(
    "CARD_MACHINE"
  );
  const [txnRef, setTxnRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paidOrder, setPaidOrder] = useState<Order | null>(null);

  // USB Bill Printer State
  const [counterPrinter, setCounterPrinter] = useState<CounterPrinterState | null>(null);
  const [isPrintingBill, setIsPrintingBill] = useState(false);
  const [billPrintSuccess, setBillPrintSuccess] = useState(false);
  const [billPrintError, setBillPrintError] = useState<string | null>(null);

  // Poll counter bill printer status when modal is open
  useEffect(() => {
    if (!isOpen) {
      setStep("FORM");
      setPaidOrder(null);
      setBillPrintSuccess(false);
      setBillPrintError(null);
      return;
    }

    let isMounted = true;

    const checkPrinter = async () => {
      try {
        const status = await PrinterClient.getCounterPrinterStatus();
        if (isMounted) {
          setCounterPrinter(status);
        }
      } catch {
        if (isMounted) {
          setCounterPrinter(null);
        }
      }
    };

    checkPrinter();
    const interval = setInterval(checkPrinter, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const total = order.grandTotal || 0;
  const numCash = parseFloat(cashReceived) || total;
  const changeToReturn = Math.max(0, numCash - total);

  const handleQuickCash = (amount: number) => {
    setCashReceived(String(amount));
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tables/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          paymentMethod: method,
          amountReceived: method === "CASH" ? numCash : total,
          changeGiven: method === "CASH" ? changeToReturn : 0,
          paymentTxnId:
            method === "ONLINE"
              ? txnRef || `${onlineMode}-${Date.now().toString().slice(-6)}`
              : undefined,
          adminUser: "Counter Billing Staff",
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setPaidOrder(data.order);
        setStep("SUCCESS");
      } else {
        setError(data.error || "Failed to confirm payment.");
      }
    } catch {
      setError("Network blip while recording payment.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBill = async () => {
    if (!order) return;
    setIsPrintingBill(true);
    setBillPrintError(null);

    const billPayload: CustomerBillPayload = {
      visitId: (order as any).visitId || `V-${order.id}`,
      billNumber:
        (order as any).billNumber ||
        (order.orderNumber ? order.orderNumber.replace(/^(ORD-|#)/, "") : String(Date.now()).slice(-4)),
      orderNumber: order.orderNumber || String(order.id),
      tableNumber: order.tableNumber || "T1",
      dateStr: new Date().toLocaleDateString("en-GB"),
      timeStr: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      terminalName: "Billing 1",
      paymentMode: method === "CASH" ? "CASH" : onlineMode === "CARD_MACHINE" ? "CARD" : "UPI",
      items: (order.items || []).map((it) => ({
        name: it.name,
        quantity: it.quantity || 1,
        price: it.price || 0,
        lineTotal: (it.price || 0) * (it.quantity || 1),
      })),
      totalItems: order.items?.length || 0,
      totalQuantity: order.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0,
      subtotal: order.subtotal || order.grandTotal || 0,
      tax: order.tax || 0,
      packagingFee: (order as any).packagingFee || 0,
      grandTotal: order.grandTotal || 0,
      isDuplicate: false,
    };

    const res = await PrinterClient.printCustomerBill(billPayload);
    setIsPrintingBill(false);

    if (res.success) {
      setBillPrintSuccess(true);
    } else {
      setBillPrintError(res.message || "Could not print customer bill.");
    }
  };

  const handleFinish = () => {
    if (paidOrder) {
      onSuccess(paidOrder);
    }
    onClose();
  };

  // Render Pill for Counter Bill Printer Status
  // GREEN  — Bill printer detected and reporting ready
  // RED    — USB printer disconnected
  // YELLOW — USB detected but printing readiness uncertain
  const renderPrinterPill = () => {
    if (!counterPrinter || counterPrinter.status === "OFFLINE") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
          Print Connector Offline
        </span>
      );
    }

    if (counterPrinter.status === "CONNECTED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Bill Printer Ready ({counterPrinter.printerName || "POS-58-Series"})
        </span>
      );
    }

    if (counterPrinter.status === "NOT_READY" || (counterPrinter as any).status === "WARNING") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-850 border border-amber-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          USB Detected (Readiness Uncertain)
        </span>
      );
    }

    // Default to RED: USB printer disconnected
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        USB Printer Disconnected
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-[#3A1710] text-[#FFF9F5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#CA340A] flex items-center justify-center text-white shadow-md">
              <Receipt size={22} />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-[#FFF9F5]">
                {step === "FORM" ? "Receive Settlement Payment" : "Payment Successful"}
              </h3>
              <p className="text-xs text-[#E2C7BA]">
                Table {order.tableNumber} • {order.orderNumber}
              </p>
            </div>
          </div>
          {step === "FORM" && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#E2C7BA] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Live USB Status Sub-bar */}
        <div className="px-5 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-stone-600 flex items-center gap-1.5">
              <Printer size={13} className="text-stone-500" />
              Counter Receipt:
            </span>
            {renderPrinterPill()}
          </div>
          <button
            type="button"
            onClick={handlePrintBill}
            disabled={isPrintingBill || counterPrinter?.status !== "CONNECTED"}
            className="px-2.5 py-1 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-[11px] font-extrabold text-[#3A1710] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            title={
              counterPrinter?.status === "CONNECTED"
                ? "Quick print bill receipt to counter USB printer (POS-58-Series)"
                : counterPrinter?.status === "NOT_READY"
                ? "Printer readiness uncertain. Check Windows printer queue."
                : "USB printer is unavailable or disconnected."
            }
          >
            <Printer
              size={12}
              className={
                isPrintingBill
                  ? "animate-spin text-[#CA340A]"
                  : counterPrinter?.status === "CONNECTED"
                  ? "text-[#CA340A]"
                  : "text-stone-400"
              }
            />
            <span>{isPrintingBill ? "Printing..." : "Print Bill"}</span>
          </button>
        </div>

        {/* STEP 1: PAYMENT ENTRY FORM */}
        {step === "FORM" && (
          <>
            {/* Bill Summary Banner */}
            <div className="bg-[#FFF9F5] p-5 border-b border-[#CA340A]/15 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Grand Total Due
                </span>
                <span className="text-2xl font-heading font-extrabold text-[#2C1710]">
                  ₹{total}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Items Ordered
                </span>
                <span className="text-sm font-bold text-zinc-700">
                  {order.items.reduce((acc, it) => acc + (it.quantity || 1), 0)} items
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-200">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod("CASH")}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
                    method === "CASH"
                      ? "border-[#15803D] bg-emerald-50 text-emerald-900 shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <Banknote size={22} className={method === "CASH" ? "text-[#15803D]" : ""} />
                  <span className="text-xs font-bold uppercase tracking-wider">CASH</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("ONLINE")}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
                    method === "ONLINE"
                      ? "border-[#2563EB] bg-blue-50 text-blue-900 shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <CreditCard size={22} className={method === "ONLINE" ? "text-[#2563EB]" : ""} />
                  <span className="text-xs font-bold uppercase tracking-wider">ONLINE / POS</span>
                </button>
              </div>

              {/* CASH SECTION */}
              {method === "CASH" && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1">
                      Cash Received (₹)
                    </label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder={`Exact ₹${total}`}
                      className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-zinc-300 rounded-xl text-base font-bold text-[#2C1710] focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickCash(total)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800"
                    >
                      Exact (₹{total})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickCash(Math.ceil(total / 100) * 100)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800"
                    >
                      ₹{Math.ceil(total / 100) * 100}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickCash(Math.ceil(total / 500) * 500 || 500)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800"
                    >
                      ₹{Math.ceil(total / 500) * 500 || 500}
                    </button>
                  </div>

                  {/* Change to Return */}
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Calculator size={15} /> Change to Return:
                    </span>
                    <span className="text-base font-heading font-extrabold text-emerald-950">
                      ₹{changeToReturn}
                    </span>
                  </div>
                </div>
              )}

              {/* ONLINE SECTION */}
              {method === "ONLINE" && (
                <div className="space-y-3 pt-1">
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-xs text-blue-900 space-y-1">
                    <p className="font-bold">External EDC Machine & QR Collection</p>
                    <p className="text-[11px] text-blue-800">
                      Collect ₹{total} via restaurant payment machine or counter UPI QR code, then
                      confirm below.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setOnlineMode("CARD_MACHINE")}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors ${
                        onlineMode === "CARD_MACHINE"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      Card Machine
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnlineMode("UPI_QR")}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors ${
                        onlineMode === "UPI_QR"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      UPI QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnlineMode("OTHER")}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors ${
                        onlineMode === "OTHER"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      Other / App
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2C1710] mb-1">
                      Card / UPI Transaction Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={txnRef}
                      onChange={(e) => setTxnRef(e.target.value)}
                      placeholder="e.g. UPI Ref / Auth Code"
                      className="w-full px-3 py-2 bg-[#FFF9F5] border border-zinc-300 rounded-xl text-xs font-mono font-semibold text-[#2C1710]"
                    />
                  </div>
                </div>
              )}

              {/* DIRECT COUNTER BILL PRINT BUTTON */}
              <div className="pt-2 space-y-2 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt size={13} className="text-[#CA340A]" />
                    Counter Receipt (58mm)
                  </span>
                  {billPrintSuccess && (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Printed Successfully
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handlePrintBill}
                  disabled={isPrintingBill || counterPrinter?.status !== "CONNECTED"}
                  className={`w-full py-3 px-4 rounded-2xl font-heading font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                    counterPrinter?.status === "CONNECTED"
                      ? "bg-[#3A1710] hover:bg-[#2C1710] text-white border border-[#3A1710] cursor-pointer active:scale-98"
                      : "bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-60"
                  }`}
                >
                  {isPrintingBill ? (
                    <>
                      <RotateCw size={15} className="animate-spin text-[#CA340A]" />
                      <span>Printing Customer Bill...</span>
                    </>
                  ) : billPrintSuccess ? (
                    <>
                      <Printer size={16} className="text-emerald-500" />
                      <span>Receipt Printed • Click to Print Again</span>
                    </>
                  ) : (
                    <>
                      <Printer
                        size={16}
                        className={counterPrinter?.status === "CONNECTED" ? "text-emerald-400" : "text-stone-400"}
                      />
                      <span>
                        {counterPrinter?.status === "CONNECTED"
                          ? "Print Counter Bill (58mm)"
                          : counterPrinter?.status === "NOT_READY"
                          ? "Printer Readiness Uncertain"
                          : "Printer Disconnected (USB)"}
                      </span>
                    </>
                  )}
                </button>

                {/* Status Help Notice when Printer Unavailable */}
                {counterPrinter?.status === "DISCONNECTED" && (
                  <p className="text-[11px] text-rose-700 font-semibold text-center flex items-center justify-center gap-1.5 pt-0.5">
                    <AlertCircle size={13} className="shrink-0 text-rose-600" />
                    <span>KP206B-UB USB cable is disconnected. Plug in printer to enable.</span>
                  </p>
                )}
                {counterPrinter?.status === "NOT_READY" && (
                  <p className="text-[11px] text-amber-800 font-semibold text-center flex items-center justify-center gap-1.5 pt-0.5">
                    <AlertCircle size={13} className="shrink-0 text-amber-600" />
                    <span>USB device detected, but Windows queue &apos;POS-58-Series&apos; readiness is uncertain.</span>
                  </p>
                )}
                {(!counterPrinter || counterPrinter.status === "OFFLINE") && (
                  <p className="text-[11px] text-stone-500 font-semibold text-center flex items-center justify-center gap-1.5 pt-0.5">
                    <AlertCircle size={13} className="shrink-0 text-stone-400" />
                    <span>Spiral Print Connector service is offline on port 4318.</span>
                  </p>
                )}

                {billPrintError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                    <span>{billPrintError}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#15803D] text-white text-xs font-bold hover:bg-[#166534] shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    "Processing..."
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Confirm Received
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* STEP 2: PAYMENT SUCCESSFUL & DECOUPLED BILL PRINT */}
        {step === "SUCCESS" && (
          <div className="p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Success Banner */}
            <div className="text-center space-y-2 py-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-lg font-heading font-extrabold text-[#2C1710]">
                Payment Recorded Successfully!
              </h4>
              <p className="text-xs text-zinc-600 font-medium">
                Amount received: <strong className="text-zinc-900 font-bold">₹{total}</strong> via{" "}
                <strong className="text-zinc-900 font-bold">{method}</strong>. Table {order.tableNumber} is now marked paid.
              </p>
            </div>

            {/* Bill Print Card */}
            <div className="bg-[#FFF9F5] p-4 rounded-2xl border border-[#CA340A]/15 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-[#CA340A]" />
                  <span className="text-xs font-bold text-zinc-900">
                    Customer Receipt Bill (58mm)
                  </span>
                </div>
                {renderPrinterPill()}
              </div>

              {billPrintSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Customer bill sent to counter printer!</span>
                </div>
              )}

              {billPrintError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{billPrintError}</span>
                </div>
              )}

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrintBill}
                disabled={isPrintingBill || counterPrinter?.status !== "CONNECTED"}
                className={`w-full py-3 px-4 rounded-xl font-heading font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                  counterPrinter?.status === "CONNECTED"
                    ? "bg-[#3A1710] hover:bg-[#2C1710] text-white cursor-pointer active:scale-98"
                    : "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                }`}
              >
                {isPrintingBill ? (
                  <>
                    <RotateCw size={15} className="animate-spin" />
                    Printing Customer Bill...
                  </>
                ) : (
                  <>
                    <Printer size={16} />
                    {billPrintSuccess ? "Print Bill Again" : "Print Customer Bill (58mm)"}
                  </>
                )}
              </button>

              {counterPrinter?.status !== "CONNECTED" && (
                <p className="text-[11px] text-zinc-500 text-center">
                  USB printer disconnected. You can plug in KP206B-UB now, or click Done below to finish.
                </p>
              )}
            </div>

            {/* Complete / Done Button */}
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3 px-4 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>Done (Return to Floor)</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
