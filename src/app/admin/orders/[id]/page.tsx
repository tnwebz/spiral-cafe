"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import CollectCashModal from "@/components/Admin/CollectCashModal";
import ThermalReceiptModal from "@/components/Admin/ThermalReceipt";
import { Order, Invoice } from "@/lib/db";
import {
  ArrowLeft,
  ShoppingBag,
  Clock,
  Banknote,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Printer,
  Phone,
  User,
  Utensils,
  Share2,
} from "lucide-react";

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCashModal, setShowCashModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      const data = await res.json();
      if (data.success && data.order) {
        setOrder(data.order);

        // Fetch invoice if attached
        if (data.order.invoiceId) {
          const invRes = await fetch(`/api/invoices/${data.order.invoiceId}`);
          const invData = await invRes.json();
          if (invData.success) {
            setInvoice(invData.invoice);
          }
        }
      } else {
        setError("Order not found.");
      }
    } catch {
      setError("Failed to load order.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleGenerateInvoice = async () => {
    if (!order) return;
    setGeneratingInvoice(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, adminUser: "Admin" }),
      });
      const data = await res.json();
      if (data.success) {
        setInvoice(data.invoice);
        fetchOrder();
        setShowReceiptModal(true);
      } else {
        alert(data.error || "Failed to generate invoice.");
      }
    } catch {
      alert("Error generating invoice.");
    } finally {
      setGeneratingInvoice(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-20 text-center text-[#52525b]">
          <p className="font-semibold text-sm">Loading order details...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error || !order) {
    return (
      <AdminLayout>
        <div className="p-8 text-center bg-white rounded-2xl border border-red-200 text-red-700">
          <AlertCircle size={36} className="mx-auto mb-2 text-red-500" />
          <h2 className="font-bold text-lg">{error || "Order Not Found"}</h2>
          <Link
            href="/admin/orders"
            className="inline-block mt-4 px-4 py-2 bg-[#CA340A] text-white rounded-xl text-xs font-bold"
          >
            Back to Orders
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const isPaid = order.paymentStatus === "PAID";
  const isCashUnpaid = order.paymentMethod === "CASH" && !isPaid;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Back and Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CA340A]/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/orders"
              className="p-2 rounded-xl bg-white border border-zinc-200 text-[#52525b] hover:text-[#2C1710] hover:bg-[#FFF9F5] transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-black text-2xl text-[#2C1710]">
                  {order.orderNumber}
                </h1>
                <span className="px-2.5 py-0.5 bg-[#CA340A]/10 text-[#CA340A] text-xs font-bold rounded-full">
                  {order.tableNumber}
                </span>
              </div>
              <p className="text-xs text-[#52525b]">
                Placed on {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {isCashUnpaid && (
              <button
                onClick={() => setShowCashModal(true)}
                className="px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Banknote size={14} />
                <span>Collect Cash</span>
              </button>
            )}

            {!order.invoiceNumber ? (
              <button
                disabled={!isPaid || generatingInvoice}
                onClick={handleGenerateInvoice}
                title={
                  isPaid
                    ? "Generate official tax invoice"
                    : "Payment required before invoice generation"
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isPaid
                    ? "bg-[#CA340A] hover:bg-[#A82806] text-white shadow-xs cursor-pointer"
                    : "bg-zinc-100 text-zinc-400 opacity-60 cursor-not-allowed"
                }`}
              >
                <Receipt size={14} />
                <span>{generatingInvoice ? "Generating..." : "Generate Invoice"}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowReceiptModal(true)}
                className="px-4 py-2 bg-white border border-[#CA340A]/30 text-[#CA340A] hover:bg-[#CA340A] hover:text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer size={14} />
                <span>Print 58mm Receipt</span>
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: ITEMS & TOTALS */}
          <div className="md:col-span-2 space-y-6">
            {/* Ordered Items Table */}
            <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs p-5">
              <h3 className="font-heading font-extrabold text-base text-[#2C1710] mb-4 flex items-center gap-2">
                <Utensils size={16} className="text-[#CA340A]" />
                <span>Ordered Items Snapshot ({order.items.length})</span>
              </h3>

              <div className="divide-y divide-zinc-100">
                {order.items.map((it) => (
                  <div key={it.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#2C1710]">{it.name}</h4>
                      <p className="text-xs text-[#52525b]">
                        ₹{it.price} × {it.quantity}
                      </p>
                      {it.notes && (
                        <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                          Note: {it.notes}
                        </p>
                      )}
                    </div>
                    <div className="font-heading font-extrabold text-sm text-[#2C1710]">
                      ₹{it.lineTotal}
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Notes */}
              {order.notes && (
                <div className="mt-4 p-3 bg-[#FFF9F5] border border-[#CA340A]/20 rounded-xl text-xs text-[#2C1710]">
                  <strong className="text-[#CA340A]">Special Instructions:</strong> {order.notes}
                </div>
              )}

              {/* Price Breakdown */}
              <div className="mt-6 pt-4 border-t border-zinc-100 space-y-2 text-xs text-[#52525b]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#2C1710]">₹{order.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST / Tax</span>
                  <span className="font-semibold text-[#2C1710]">₹{order.tax}</span>
                </div>
                {order.packagingFee > 0 && (
                  <div className="flex justify-between">
                    <span>Packaging Fee</span>
                    <span className="font-semibold text-[#2C1710]">₹{order.packagingFee}</span>
                  </div>
                )}
                {order.serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Service Charge</span>
                    <span className="font-semibold text-[#2C1710]">₹{order.serviceCharge}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-heading font-black text-[#2C1710] pt-2 border-t border-zinc-200">
                  <span>Grand Total</span>
                  <span className="text-[#CA340A]">₹{order.grandTotal}</span>
                </div>
              </div>
            </div>

            {/* Kitchen Operations Timeline */}
            <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs p-5">
              <h3 className="font-heading font-extrabold text-base text-[#2C1710] mb-4 flex items-center gap-2">
                <Clock size={16} className="text-[#CA340A]" />
                <span>Kitchen &amp; Operational Timeline</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-bold text-[#2C1710]">Ticket Created:</span>
                  <span className="text-[#52525b]">{new Date(order.createdAt).toLocaleString()}</span>
                </div>

                {order.preparingAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="font-bold text-[#2C1710]">Preparation Started:</span>
                    <span className="text-[#52525b]">{new Date(order.preparingAt).toLocaleTimeString()}</span>
                  </div>
                )}

                {order.readyAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="font-bold text-[#2C1710]">Marked Ready:</span>
                    <span className="text-[#52525b]">{new Date(order.readyAt).toLocaleTimeString()}</span>
                  </div>
                )}

                {order.paidAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="font-bold text-[#2C1710]">Payment Confirmed:</span>
                    <span className="text-[#52525b]">{new Date(order.paidAt).toLocaleString()}</span>
                  </div>
                )}

                {order.completedAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                    <span className="font-bold text-[#2C1710]">Ticket Completed:</span>
                    <span className="text-[#52525b]">{new Date(order.completedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: CUSTOMER, PAYMENT & INVOICE STATUS */}
          <div className="space-y-6">
            {/* Customer Box */}
            <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs p-5">
              <h3 className="font-heading font-extrabold text-sm text-[#2C1710] mb-3 flex items-center gap-2">
                <User size={15} className="text-[#CA340A]" />
                <span>Customer Details</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-zinc-400 block">Mobile Phone:</span>
                  <span className="font-mono font-bold text-[#2C1710] text-sm">
                    {order.customerPhone ? `+91 ${order.customerPhone}` : "Walk-in Guest"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Table Assignment:</span>
                  <span className="font-bold text-[#CA340A]">{order.tableNumber}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Session ID:</span>
                  <span className="font-mono text-[10px] text-zinc-500 break-all">
                    {order.customerSessionId}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Box */}
            <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs p-5">
              <h3 className="font-heading font-extrabold text-sm text-[#2C1710] mb-3 flex items-center gap-2">
                <Banknote size={15} className="text-[#CA340A]" />
                <span>Payment State</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#52525b]">Payment Method:</span>
                  <span className="font-bold uppercase text-[#2C1710]">
                    {order.paymentMethod}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#52525b]">Payment Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isPaid
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>

                {order.paymentTxnId && (
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Transaction Ref:</span>
                    <span className="font-mono text-[11px] text-[#2C1710]">
                      {order.paymentTxnId}
                    </span>
                  </div>
                )}

                {isCashUnpaid && (
                  <div className="pt-2">
                    <button
                      onClick={() => setShowCashModal(true)}
                      className="w-full py-2 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <Banknote size={14} />
                      <span>Collect Cash &amp; Settle</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Box */}
            <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs p-5">
              <h3 className="font-heading font-extrabold text-sm text-[#2C1710] mb-3 flex items-center gap-2">
                <Receipt size={15} className="text-[#CA340A]" />
                <span>Invoice Record</span>
              </h3>

              {order.invoiceNumber ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-zinc-400 block">Invoice Number:</span>
                    <span className="font-mono font-bold text-[#CA340A] text-sm">
                      {order.invoiceNumber}
                    </span>
                  </div>

                  <button
                    onClick={() => setShowReceiptModal(true)}
                    className="w-full py-2 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <Printer size={14} />
                    <span>Print 58mm Thermal Receipt</span>
                  </button>

                  {invoice?.secureToken && (
                    <Link
                      href={`/invoice/${invoice.secureToken}`}
                      target="_blank"
                      className="w-full py-1.5 text-center text-xs font-semibold text-[#52525b] hover:text-[#CA340A] block underline"
                    >
                      View Customer Public Invoice
                    </Link>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#52525b] space-y-2">
                  <p>Invoice has not been generated for this order yet.</p>
                  {!isPaid ? (
                    <div className="p-2.5 bg-amber-50 rounded-xl text-amber-800 text-[11px] border border-amber-200">
                      Payment required before invoice generation.
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerateInvoice}
                      disabled={generatingInvoice}
                      className="w-full py-2 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      {generatingInvoice ? "Generating..." : "Generate Invoice"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CollectCashModal
        order={showCashModal ? order : null}
        onClose={() => setShowCashModal(false)}
        onSuccess={(updated) => {
          setOrder(updated);
          setShowCashModal(false);
        }}
      />

      <ThermalReceiptModal
        invoice={showReceiptModal ? invoice : null}
        onClose={() => setShowReceiptModal(false)}
      />
    </AdminLayout>
  );
}
