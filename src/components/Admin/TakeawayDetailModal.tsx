"use client";

import React, { useState } from "react";
import { Order, OrderItem } from "@/lib/db";
import { PrinterClient, CustomerBillPayload } from "@/services/printerClient";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";
import {
  X,
  ShoppingBag,
  Printer,
  Trash2,
  Plus,
  Minus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Banknote,
  Send,
  User,
  Phone,
  Clock,
} from "lucide-react";

interface TakeawayDetailModalProps {
  order: any | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export default function TakeawayDetailModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}: TakeawayDetailModalProps) {
  const [currentOrder, setCurrentOrder] = useState<any>(order);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [sendingKot, setSendingKot] = useState(false);
  const [printingBill, setPrintingBill] = useState(false);
  const [collectingCash, setCollectingCash] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [banner, setBanner] = useState<{ type: "SUCCESS" | "ERROR" | "WARNING"; message: string } | null>(null);
  const printer = usePrinterStatus(10000);

  React.useEffect(() => {
    setCurrentOrder(order);
    setBanner(null);
  }, [order]);

  if (!isOpen || !currentOrder) return null;

  const isPendingKot =
    currentOrder.status === "PENDING" &&
    !(currentOrder.notes || "").includes("[KOT_CONFIRMED");

  const customerMatch = currentOrder.notes?.match(/\[CUSTOMER_NAME:([^\]]+)\]/);
  const customerName = customerMatch ? customerMatch[1].trim() : "";
  const cleanSpecialReq = (currentOrder.notes || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\|/g, "")
    .trim();

  // 1. Quantity Adjuster
  const handleUpdateItemQty = async (item: OrderItem, newQty: number) => {
    if (newQty <= 0) {
      return handleDeleteItem(item);
    }
    const itemKey = item.id || item.name;
    setUpdatingItemId(itemKey);

    try {
      const res = await fetch(`/api/admin/orders/${currentOrder.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, itemName: item.name, quantity: newQty }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setCurrentOrder(data.order);
        onOrderUpdated();
      } else {
        setBanner({ type: "ERROR", message: data.error || "Failed to update quantity." });
      }
    } catch {
      setBanner({ type: "ERROR", message: "Network error updating item." });
    } finally {
      setUpdatingItemId(null);
    }
  };

  // 2. Delete Entire Item
  const handleDeleteItem = async (item: OrderItem) => {
    const itemKey = item.id || item.name;
    setUpdatingItemId(itemKey);
    setBanner({ type: "SUCCESS", message: `"${item.name}" removed from order.` });

    try {
      const res = await fetch(`/api/admin/orders/${currentOrder.id}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, itemName: item.name }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setCurrentOrder(data.order);
        onOrderUpdated();
        setBanner({ type: "SUCCESS", message: `"${item.name}" removed from order.` });
      } else {
        setBanner({ type: "ERROR", message: data.error || "Failed to remove item." });
      }
    } catch {
      setBanner({ type: "ERROR", message: "Network error deleting item." });
    } finally {
      setUpdatingItemId(null);
    }
  };

  // 3. Dispatch Kitchen KOT (80mm Ethernet)
  const handleSendKitchenKot = async () => {
    setSendingKot(true);
    setBanner(null);

    try {
      const printRes = await PrinterClient.dispatchKotPrint(
        currentOrder.id,
        1,
        "Billing 1",
        !isPendingKot
      );

      if (printRes.success) {
        setBanner({ type: "SUCCESS", message: "Kitchen KOT dispatched successfully to CN811-UEWB!" });
        setCurrentOrder((prev: any) =>
          prev
            ? {
                ...prev,
                notes: `${prev.notes || ""} [KOT_CONFIRMED:ROUND_1]`,
                status: "PREPARING",
              }
            : null
        );
        onOrderUpdated();
      } else {
        setBanner({
          type: "WARNING",
          message: printRes.message || "Kitchen printer offline. You can use 'Counter KOT (58mm)'.",
        });
      }
    } catch (err: any) {
      setBanner({ type: "ERROR", message: err.message || "KOT dispatch failed." });
    } finally {
      setSendingKot(false);
    }
  };

  // 4. Emergency Counter KOT (58mm USB)
  const handlePrintCounterKot = async () => {
    setSendingKot(true);
    setBanner(null);

    try {
      const kotPayload = {
        kotId: `KOT-${currentOrder.orderNumber}-01`,
        orderNumber: currentOrder.orderNumber,
        tableNumber: "TAKEAWAY",
        round: 1,
        terminalName: "Billing 1",
        dateStr: new Date().toLocaleDateString("en-IN"),
        timeStr: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        items: (currentOrder.items || []).map((it: any) => ({
          name: it.name,
          quantity: it.quantity,
          notes: it.notes,
        })),
        totalItems: (currentOrder.items || []).length,
        totalQuantity: (currentOrder.items || []).reduce((acc: number, it: any) => acc + (it.quantity || 1), 0),
        specialInstructions: cleanSpecialReq || undefined,
      };

      const res = await PrinterClient.printKotAtCounter(kotPayload);
      if (res.success) {
        setBanner({ type: "SUCCESS", message: "Emergency KOT printed on 58mm Counter Printer!" });
        setCurrentOrder((prev: any) =>
          prev
            ? {
                ...prev,
                notes: `${prev.notes || ""} [KOT_CONFIRMED:ROUND_1_COUNTER]`,
                status: "PREPARING",
              }
            : null
        );
        onOrderUpdated();
      } else {
        setBanner({ type: "ERROR", message: res.message || "Failed to print counter KOT." });
      }
    } catch (err: any) {
      setBanner({ type: "ERROR", message: err.message || "Print failed." });
    } finally {
      setSendingKot(false);
    }
  };

  // 5. Print 58mm Customer Bill
  const handlePrintCustomerBill = async () => {
    setPrintingBill(true);
    setBanner(null);

    try {
      const billPayload: CustomerBillPayload = {
        visitId: currentOrder.id,
        orderNumber: currentOrder.orderNumber,
        tableNumber: "TAKEAWAY",
        paymentMode: currentOrder.paymentMethod || "CASH",
        dateStr: new Date().toLocaleDateString("en-IN"),
        timeStr: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        terminalName: "Billing 1",
        items: (currentOrder.items || []).map((it: any) => ({
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          lineTotal: it.lineTotal || it.price * it.quantity,
        })),
        totalItems: (currentOrder.items || []).length,
        totalQuantity: (currentOrder.items || []).reduce((acc: number, it: any) => acc + (it.quantity || 1), 0),
        subtotal: currentOrder.subtotal,
        tax: currentOrder.tax,
        packagingFee: currentOrder.packagingFee || 0,
        grandTotal: currentOrder.grandTotal,
        isDuplicate: false,
      };

      const res = await PrinterClient.printCustomerBill(billPayload);
      if (res.success) {
        setBanner({ type: "SUCCESS", message: "58mm Customer Bill printed successfully!" });
      } else {
        setBanner({ type: "ERROR", message: res.message || "Failed to print bill." });
      }
    } catch (err: any) {
      setBanner({ type: "ERROR", message: err.message || "Print failed." });
    } finally {
      setPrintingBill(false);
    }
  };

  // 6. Collect Cash & Settle
  const handleCollectCashAndSettle = async () => {
    if (!confirm(`Confirm cash collection of ₹${currentOrder.grandTotal} for Takeaway #${currentOrder.orderNumber}?`)) {
      return;
    }

    setCollectingCash(true);
    setBanner(null);

    try {
      const res = await fetch(`/api/admin/orders/${currentOrder.id}/collect-cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUser: "Counter Staff" }),
      });

      const data = await res.json();
      if (data.success) {
        // Auto print bill on collection
        handlePrintCustomerBill().catch(() => {});
        onOrderUpdated();
        onClose();
      } else {
        setBanner({ type: "ERROR", message: data.error || "Failed to collect payment." });
      }
    } catch {
      setBanner({ type: "ERROR", message: "Failed to collect payment." });
    } finally {
      setCollectingCash(false);
    }
  };

  // 7. Cancel Takeaway Order
  const handleCancelOrder = async () => {
    if (!confirm(`Are you sure you want to CANCEL Takeaway Order #${currentOrder.orderNumber}?`)) {
      return;
    }

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-[#EBDAD0] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EBDAD0] bg-[#FFFBF7] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <ShoppingBag size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#2C1710]">
                  #{currentOrder.orderNumber}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                  TAKE AWAY (PARCEL)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isPendingKot
                      ? "bg-red-100 text-red-700 border border-red-200 animate-pulse"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {isPendingKot ? "KOT PENDING" : "KOT CONFIRMED"}
                </span>
              </div>
              <p className="text-xs text-[#8C5E51] mt-0.5 flex items-center gap-2">
                <Clock size={12} />
                <span>{elapsedMins}m ago</span>
                {customerName && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-zinc-700">
                      <User size={12} /> {customerName}
                    </span>
                  </>
                )}
                {currentOrder.customerPhone && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> +91 {currentOrder.customerPhone}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
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

        {/* Body Items List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
            <span>Ordered Dishes ({(currentOrder.items || []).length})</span>
            <span>Quantity / Price</span>
          </div>

          <div className="divide-y divide-zinc-100 border rounded-2xl bg-[#FFFBF7]/50 border-[#EBDAD0] overflow-hidden">
            {(currentOrder.items || []).map((it: OrderItem, idx: number) => {
              const isUpdatingThis = updatingItemId === (it.id || it.name);
              const cleanNote = (it.notes || "").replace(/\[[^\]]+\]/g, "").trim();

              return (
                <div
                  key={it.id || idx}
                  className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-white transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-[#2C1710] text-sm truncate">{it.name}</h4>
                    <p className="text-[11px] text-zinc-500">₹{it.price} each</p>
                    {cleanNote && (
                      <p className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md mt-1 inline-block border border-amber-200">
                        Note: {cleanNote}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Stepper (- / qty / +) */}
                    <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl p-1 shadow-2xs">
                      <button
                        type="button"
                        disabled={isUpdatingThis}
                        onClick={() => handleUpdateItemQty(it, it.quantity - 1)}
                        className="w-6 h-6 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                        title="Decrease quantity"
                      >
                        <Minus size={11} />
                      </button>

                      <span className="font-heading font-extrabold text-xs text-[#CA340A] min-w-[20px] text-center px-1">
                        {isUpdatingThis ? (
                          <Loader2 size={11} className="animate-spin inline text-[#CA340A]" />
                        ) : (
                          it.quantity
                        )}
                      </span>

                      <button
                        type="button"
                        disabled={isUpdatingThis}
                        onClick={() => handleUpdateItemQty(it, it.quantity + 1)}
                        className="w-6 h-6 rounded-lg bg-[#CA340A] hover:bg-[#B73F1D] text-white flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                        title="Increase quantity"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    {/* Total */}
                    <span className="font-heading font-extrabold text-sm text-[#2C1710] min-w-[50px] text-right">
                      ₹{it.lineTotal || it.price * (it.quantity || 1)}
                    </span>

                    {/* Delete Item Button */}
                    <button
                      type="button"
                      disabled={isUpdatingThis}
                      onClick={() => handleDeleteItem(it)}
                      className="p-1.5 rounded-xl text-red-500 hover:text-white hover:bg-red-600 bg-red-50 border border-red-200/60 transition-all cursor-pointer disabled:opacity-50"
                      title={`Remove ${it.name} from takeaway`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Kitchen Special Request */}
          {cleanSpecialReq && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-950">
              <span className="font-bold text-amber-900 uppercase text-[10px] block">
                Kitchen Special Request:
              </span>
              <p className="mt-0.5 font-semibold italic">"{cleanSpecialReq}"</p>
            </div>
          )}

          {/* Price Breakdown */}
          <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal</span>
              <span className="font-bold text-zinc-800">₹{currentOrder.subtotal}</span>
            </div>
            {(currentOrder.tax || 0) > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>GST Tax</span>
                <span className="font-bold text-zinc-800">₹{currentOrder.tax}</span>
              </div>
            )}
            {((currentOrder as any).packagingFee || 0) > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Packaging Fee</span>
                <span className="font-bold text-zinc-800">₹{(currentOrder as any).packagingFee}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-zinc-200 text-sm font-heading font-extrabold text-[#2C1710]">
              <span>Grand Total</span>
              <span className="text-[#CA340A] text-base">₹{currentOrder.grandTotal}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 sm:p-5 border-t border-[#EBDAD0] bg-[#FFFBF7] space-y-2.5">
          {/* Printer Warning if KOT pending and kitchen printer not connected */}
          {isPendingKot && printer.status !== "CONNECTED" && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>Kitchen printer is disconnected. Use Counter KOT (58mm) or retry.</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Dispatch KOT - Only shown when KOT is PENDING */}
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

            {/* 2. Counter Emergency KOT */}
            <button
              onClick={handlePrintCounterKot}
              disabled={sendingKot}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                isPendingKot
                  ? "bg-amber-100 border border-amber-300 text-amber-950 hover:bg-amber-200"
                  : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
              title="Print 58mm emergency KOT at counter"
            >
              <Printer size={13} />
              <span>Counter KOT (58mm)</span>
            </button>

            {/* 3. Print 58mm Customer Bill */}
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
            {/* 4. Settle / Collect Cash */}
            <button
              onClick={handleCollectCashAndSettle}
              disabled={collectingCash}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-heading font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {collectingCash ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Banknote size={15} />
              )}
              <span>Collect Cash & Complete (₹{currentOrder.grandTotal})</span>
            </button>

            {/* 5. Cancel Takeaway */}
            <button
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="py-3 px-3 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
              title="Cancel Takeaway"
            >
              {cancelling ? <Loader2 size={13} className="animate-spin" /> : "Cancel Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
