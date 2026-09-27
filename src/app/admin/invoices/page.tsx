"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import ThermalReceiptModal from "@/components/Admin/ThermalReceipt";
import { Invoice } from "@/lib/db";
import {
  Receipt,
  Search,
  Printer,
  MessageSquare,
  Share2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Phone,
  Eye,
  Send,
} from "lucide-react";

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [smsSendingId, setSmsSendingId] = useState<string | null>(null);
  const [smsToast, setSmsToast] = useState<{ message: string; success: boolean } | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
      }
    } catch (e) {
      console.error("Fetch invoices error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleSendSms = async (invoice: Invoice) => {
    if (!invoice.customerPhone) {
      alert("No customer mobile number is attached to this invoice.");
      return;
    }

    setSmsSendingId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUser: "Admin" }),
      });
      const data = await res.json();
      setSmsToast({
        success: data.success,
        message: data.message || (data.success ? "SMS sent successfully." : "Failed to send SMS"),
      });
      fetchInvoices();
      setTimeout(() => setSmsToast(null), 5000);
    } catch {
      setSmsToast({ success: false, message: "Network error sending SMS." });
      setTimeout(() => setSmsToast(null), 5000);
    } finally {
      setSmsSendingId(null);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    return (
      q === "" ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.orderNumber.toLowerCase().includes(q) ||
      (inv.customerPhone && inv.customerPhone.includes(q)) ||
      inv.tableNumber.toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CA340A]/10 pb-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
              Tax Invoices &amp; Receipts
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b]">
              Immutable tax invoices, 58mm thermal receipts, and customer SMS delivery
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchInvoices}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#CA340A]/20 hover:bg-[#FFF9F5] text-xs font-bold text-[#2C1710] shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh Invoices</span>
            </button>
          </div>
        </div>

        {/* SMS Status Toast */}
        {smsToast && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md transition-all ${
              smsToast.success
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {smsToast.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{smsToast.message}</span>
            </div>
            <button
              onClick={() => setSmsToast(null)}
              className="text-zinc-500 hover:text-black font-normal"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Search Filter */}
        <div className="bg-white p-4 rounded-2xl border border-[#CA340A]/15 shadow-xs flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3 top-2.5 text-[#52525b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, order #, phone..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] focus:outline-none"
            />
          </div>

          <div className="text-xs text-[#52525b] font-semibold">
            Total Invoices: <strong className="text-[#2C1710]">{invoices.length}</strong>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#2C1710]">
              <thead className="bg-[#FFF9F5] text-[#52525b] font-extrabold uppercase tracking-wider text-[10px] border-b border-zinc-100">
                <tr>
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Order No</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Customer Phone</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">GST</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">SMS Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-[#52525b]">
                      No invoices found. Generate invoices from paid orders.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#CA340A]">
                        {inv.invoiceNumber}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[#2C1710]">
                        <Link
                          href={`/admin/orders/${inv.orderId}`}
                          className="hover:text-[#CA340A] hover:underline"
                        >
                          {inv.orderNumber}
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-[#2C1710]">
                        {inv.tableNumber}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[#52525b]">
                        {inv.customerPhone ? (
                          <span className="flex items-center gap-1">
                            <Phone size={10} className="text-[#CA340A]" />
                            {inv.customerPhone}
                          </span>
                        ) : (
                          <span className="text-zinc-400">N/A</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#52525b]">
                        <div>{new Date(inv.createdAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-zinc-400">
                          {new Date(inv.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium">
                        ₹{inv.subtotal}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium">
                        ₹{inv.tax}
                      </td>

                      <td className="py-3.5 px-4 text-right font-heading font-extrabold text-[#2C1710] text-sm">
                        ₹{inv.grandTotal}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                          {inv.paymentMethod}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {inv.smsSent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 size={11} /> Sent
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">Pending</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print 58mm */}
                          <button
                            onClick={() => setSelectedInvoiceForPrint(inv)}
                            className="px-2.5 py-1 rounded-lg bg-[#FFF9F5] border border-[#CA340A]/30 text-[#CA340A] hover:bg-[#CA340A] hover:text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                            title="View / Print 58mm Thermal Bill"
                          >
                            <Printer size={12} />
                            <span>View Bill</span>
                          </button>

                          {/* Send SMS */}
                          <button
                            disabled={!inv.customerPhone || smsSendingId === inv.id}
                            onClick={() => handleSendSms(inv)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-100 text-[#2C1710] hover:bg-[#2C1710] hover:text-white font-bold text-[11px] flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                            title={
                              inv.customerPhone
                                ? "Dispatch invoice link via SMS"
                                : "No phone number attached"
                            }
                          >
                            <Send size={11} />
                            <span>{smsSendingId === inv.id ? "..." : "SMS"}</span>
                          </button>

                          {/* Public View */}
                          <Link
                            href={`/invoice/${inv.secureToken}`}
                            target="_blank"
                            className="p-1 rounded-lg border border-zinc-200 text-zinc-600 hover:text-[#CA340A]"
                            title="Open Customer Invoice"
                          >
                            <Eye size={13} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ThermalReceiptModal
        invoice={selectedInvoiceForPrint}
        onClose={() => setSelectedInvoiceForPrint(null)}
      />
    </AdminLayout>
  );
}
