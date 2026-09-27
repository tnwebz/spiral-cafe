"use client";

import React, { useState } from "react";
import { Order } from "@/lib/db";
import { Banknote, CheckCircle2, AlertCircle, X, ShieldAlert } from "lucide-react";

interface CollectCashModalProps {
  order: Order | null;
  onClose: () => void;
  onSuccess: (updatedOrder: Order) => void;
}

export default function CollectCashModal({
  order,
  onClose,
  onSuccess,
}: CollectCashModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!order) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/collect-cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUser: "Counter Staff" }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess(data.order);
        onClose();
      } else {
        setError(data.error || "Failed to confirm cash collection.");
      }
    } catch {
      setError("Network error while confirming payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-[#3A1710] text-[#FFF9F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#15803D] flex items-center justify-center text-white shadow-xs">
              <Banknote size={20} />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-[#FFF9F5]">
                Confirm Cash Collection
              </h3>
              <p className="text-xs text-[#E2C7BA]">Cashier Payment Settlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#E2C7BA] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-[#FFF9F5] p-4 rounded-2xl border border-[#CA340A]/15 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#52525b] uppercase tracking-wider">Order No</span>
              <p className="font-heading font-extrabold text-lg text-[#2C1710]">
                {order.orderNumber}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-[#52525b] uppercase tracking-wider">Table</span>
              <p className="font-heading font-extrabold text-lg text-[#CA340A]">
                {order.tableNumber}
              </p>
            </div>
          </div>

          {/* Amount Due Box */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Exact Cash Amount To Collect
            </span>
            <div className="font-heading font-black text-3xl text-emerald-900 mt-1">
              ₹{order.grandTotal}
            </div>
            <p className="text-[11px] text-emerald-700 mt-1">
              Subtotal: ₹{order.subtotal} + Tax: ₹{order.tax}
            </p>
          </div>

          {/* Items Preview */}
          <div className="text-xs text-[#52525b] space-y-1 max-h-32 overflow-y-auto px-1">
            <p className="font-bold text-[#2C1710]">Ordered Items ({order.items.length}):</p>
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between items-center py-0.5 border-b border-zinc-100">
                <span className="truncate pr-2">
                  {it.name} × {it.quantity}
                </span>
                <span className="font-semibold text-[#2C1710]">₹{it.lineTotal}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-zinc-100 bg-[#FFF9F5] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-[#52525b] hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="px-5 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs font-heading font-extrabold shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 size={16} />
            <span>{loading ? "Processing..." : "CONFIRM CASH RECEIVED"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
