"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Invoice } from "@/lib/db";
import {
  Receipt,
  CheckCircle2,
  Printer,
  Share2,
  ArrowLeft,
  Utensils,
  Phone,
  MapPin,
} from "lucide-react";

export default function CustomerInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [cafe, setCafe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invoices/by-token/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setInvoice(data.invoice);
          setCafe(data.cafe);
        } else {
          setError(data.error || "Invoice not found or invalid token.");
        }
      })
      .catch(() => {
        setError("Network error loading invoice.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center text-[#2C1710] p-4">
        <Receipt size={32} className="animate-bounce text-[#CA340A] mb-3" />
        <p className="font-semibold text-sm">Retrieving your Spiral Cafe digital invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center text-[#2C1710] p-4">
        <div className="bg-white p-8 rounded-3xl border border-red-200 shadow-lg text-center max-w-sm w-full">
          <h2 className="font-bold text-lg text-red-700 mb-2">Invalid Invoice Link</h2>
          <p className="text-xs text-zinc-500 mb-4">{error}</p>
          <Link
            href="/menu"
            className="px-4 py-2 bg-[#CA340A] text-white rounded-xl text-xs font-bold inline-block"
          >
            Go to Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF9F5] text-[#2C1710] p-4 sm:p-8 flex flex-col items-center">
      {/* Top Actions for Mobile/Web */}
      <div className="w-full max-w-lg mb-4 flex items-center justify-between no-print">
        <Link
          href="/menu"
          className="flex items-center gap-1.5 text-xs font-bold text-[#52525b] hover:text-[#CA340A]"
        >
          <ArrowLeft size={14} />
          <span>Back to Menu</span>
        </Link>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#CA340A]/30 text-[#CA340A] hover:bg-[#CA340A] hover:text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Printer size={14} />
          <span>Print / Save Receipt</span>
        </button>
      </div>

      {/* Tax Invoice Bill Card */}
      <div className="w-full max-w-lg bg-white rounded-3xl border border-[#CA340A]/15 shadow-xl p-6 sm:p-8 relative overflow-hidden print:shadow-none print:border-none print:p-0">
        {/* Paid Stamp */}
        <div className="absolute -right-10 top-6 rotate-45 bg-[#15803D] text-white text-[10px] font-black uppercase py-1 px-12 tracking-widest shadow-xs">
          PAID INVOICE
        </div>

        {/* Cafe Header */}
        <div className="text-center pb-6 border-b border-zinc-100">
          <div className="relative w-14 h-14 rounded-2xl bg-[#3A1710] p-1.5 mx-auto mb-2.5 flex items-center justify-center shadow-md">
            <Image src="/logo.png" alt="Spiral Cafe" width={40} height={40} className="object-contain" />
          </div>
          <h1 className="font-heading font-black text-2xl tracking-tight text-[#2C1710]">
            SPIRAL CAFE
          </h1>
          <p className="text-xs text-[#52525b] max-w-xs mx-auto mt-1 flex items-center justify-center gap-1">
            <MapPin size={11} className="shrink-0 text-[#CA340A]" />
            <span>{cafe?.address || "Opposite Government Hospital, Chengalpattu, Tamil Nadu"}</span>
          </p>
          <p className="text-[11px] text-[#52525b] mt-1 font-mono">
            GSTIN: <strong>{cafe?.gstNumber || "33AAAAA0000A1Z5"}</strong> • Ph: {cafe?.phone || "+91 98765 43210"}
          </p>
        </div>

        {/* Invoice Metadata */}
        <div className="py-4 border-b border-zinc-100 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-zinc-400 block text-[10px] font-bold uppercase">Invoice No</span>
            <span className="font-mono font-bold text-[#CA340A] text-sm">{invoice.invoiceNumber}</span>
          </div>
          <div className="text-right">
            <span className="text-zinc-400 block text-[10px] font-bold uppercase">Order No</span>
            <span className="font-mono font-bold text-[#2C1710] text-sm">{invoice.orderNumber}</span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[10px] font-bold uppercase">Table</span>
            <span className="font-bold text-[#2C1710]">{invoice.tableNumber}</span>
          </div>
          <div className="text-right">
            <span className="text-zinc-400 block text-[10px] font-bold uppercase">Date &amp; Time</span>
            <span className="text-[#52525b]">
              {new Date(invoice.createdAt).toLocaleDateString()} {new Date(invoice.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Items List */}
        <div className="py-4 border-b border-zinc-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-400 font-bold uppercase text-[10px] border-b border-zinc-100 pb-1">
                <th className="text-left pb-2">Item Description</th>
                <th className="text-center pb-2">Qty</th>
                <th className="text-right pb-2">Price</th>
                <th className="text-right pb-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {invoice.items.map((it: any, idx: number) => (
                <tr key={idx} className="py-2">
                  <td className="py-2.5 font-semibold text-[#2C1710]">{it.name}</td>
                  <td className="py-2.5 text-center font-bold text-[#52525b]">{it.quantity}</td>
                  <td className="py-2.5 text-right text-[#52525b]">₹{it.unitPrice}</td>
                  <td className="py-2.5 text-right font-bold text-[#2C1710]">₹{it.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pricing Summary */}
        <div className="py-4 border-b border-zinc-100 space-y-1.5 text-xs text-[#52525b]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-[#2C1710]">₹{invoice.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span>GST / Tax</span>
            <span className="font-semibold text-[#2C1710]">₹{invoice.tax}</span>
          </div>
          {invoice.packagingFee > 0 && (
            <div className="flex justify-between">
              <span>Packaging Charge</span>
              <span className="font-semibold text-[#2C1710]">₹{invoice.packagingFee}</span>
            </div>
          )}
          {invoice.serviceCharge > 0 && (
            <div className="flex justify-between">
              <span>Service Charge</span>
              <span className="font-semibold text-[#2C1710]">₹{invoice.serviceCharge}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-heading font-black text-[#2C1710] pt-2 border-t border-zinc-200">
            <span>Total Paid</span>
            <span className="text-[#CA340A]">₹{invoice.grandTotal}</span>
          </div>
        </div>

        {/* Payment Confirmation */}
        <div className="pt-4 flex items-center justify-between text-xs bg-[#FFF9F5] p-3 rounded-2xl border border-[#CA340A]/10 mt-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#15803D]" />
            <div>
              <span className="font-bold text-[#2C1710]">Payment Method: {invoice.paymentMethod}</span>
              <span className="block text-[10px] text-[#52525b]">Status: Fully Paid &amp; Confirmed</span>
            </div>
          </div>
          <span className="font-mono text-[10px] text-zinc-400">Verified</span>
        </div>

        {/* Footer */}
        <div className="text-center pt-6 text-xs text-[#52525b]">
          <p className="font-bold text-[#2C1710]">Thank you for dining with us!</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            This is a computer generated digital invoice.
          </p>
        </div>
      </div>
    </main>
  );
}
