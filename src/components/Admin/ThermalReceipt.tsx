"use client";

import React, { useState, useEffect } from "react";
import { Invoice } from "@/lib/db";
import {
  Printer,
  X,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  Edit2,
  Send,
} from "lucide-react";
import { formatReceipt58mm } from "@/lib/printer";

interface ThermalReceiptModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onSmsSent?: () => void;
}

export default function ThermalReceiptModal({
  invoice,
  onClose,
  onSmsSent,
}: ThermalReceiptModalProps) {
  if (!invoice) return null;

  const [phone, setPhone] = useState(invoice.customerPhone || "");
  const [isEditingPhone, setIsEditingPhone] = useState(!invoice.customerPhone);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsSentState, setSmsSentState] = useState(invoice.smsSent);
  const [smsResult, setSmsResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    setPhone(invoice.customerPhone || "");
    setIsEditingPhone(!invoice.customerPhone);
    setSmsSentState(invoice.smsSent);
    setSmsResult(null);
  }, [invoice]);

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleSendSms = async () => {
    const digits = phone.replace(/\D/g, "");
    const cleanPhone = digits.length >= 10 ? digits.slice(-10) : "";
    if (!cleanPhone) {
      setSmsResult({
        success: false,
        message: "Please enter a valid 10-digit mobile number.",
      });
      setIsEditingPhone(true);
      return;
    }

    if (!invoice?.id) {
      setSmsResult({
        success: false,
        message: "Invoice data is missing or not yet generated.",
      });
      return;
    }

    setSendingSms(true);
    setSmsResult(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUser: "Admin",
          phoneNumber: cleanPhone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSmsSentState(true);
        setPhone(cleanPhone);
        setSmsResult({
          success: true,
          message: `SMS dispatched successfully to +91 ${cleanPhone}!`,
        });
        setIsEditingPhone(false);
        onSmsSent?.();
      } else {
        setSmsResult({
          success: false,
          message: data.error || data.message || "Failed to dispatch SMS.",
        });
      }
    } catch {
      setSmsResult({
        success: false,
        message: "Network error while sending SMS.",
      });
    } finally {
      setSendingSms(false);
    }
  };

  const formattedLines = formatReceipt58mm(invoice);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-[#3A1710] text-white">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-[#CA340A]" />
            <h3 className="font-heading font-extrabold text-sm text-[#FFF9F5]">
              58mm Thermal Receipt Preview
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#E2C7BA] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close receipt"
          >
            <X size={18} />
          </button>
        </div>

        {/* SMS Delivery Panel */}
        <div className="p-3.5 bg-[#FFF9F5] border-b border-[#CA340A]/15 text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-[#2C1710]">
              <Smartphone size={14} className="text-[#CA340A]" />
              <span>Customer Mobile SMS:</span>
            </div>

            {smsSentState ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold flex items-center gap-1 border border-emerald-300">
                <CheckCircle2 size={11} /> SMS DELIVERED
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-extrabold border border-amber-300">
                SMS PENDING
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditingPhone ? (
              <div className="flex-1 flex items-center gap-1.5">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter 10-digit mobile number"
                  className="flex-1 px-2.5 py-1.5 bg-white border border-[#CA340A]/30 rounded-xl text-xs text-[#2C1710] font-mono focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(false)}
                  disabled={!phone.trim()}
                  className="px-2.5 py-1.5 bg-[#2C1710] text-white rounded-xl text-[11px] font-bold cursor-pointer disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-[#CA340A]/20">
                <span className="font-mono font-bold text-xs text-[#2C1710]">
                  {phone ? `+91 ${phone}` : "No phone number attached"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="text-[11px] text-[#CA340A] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 size={11} />
                  <span>Change</span>
                </button>
              </div>
            )}
          </div>

          {smsResult && (
            <div
              className={`p-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 ${
                smsResult.success
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {smsResult.success ? (
                <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle size={13} className="shrink-0 text-red-600" />
              )}
              <span>{smsResult.message}</span>
            </div>
          )}
        </div>

        {/* Receipt Output Container (Rendered exactly in 58mm monospaced simulation) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-100 flex justify-center">
          <div
            id="printable-thermal-receipt"
            className="receipt-print-area bg-white text-black p-4 rounded-lg shadow-sm border border-zinc-300 font-mono text-xs leading-tight w-[58mm] min-w-[58mm] max-w-[58mm]"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            <pre className="whitespace-pre font-mono text-[11px] leading-[1.3] text-black m-0 p-0 select-text">
              {formattedLines}
            </pre>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-3.5 border-t border-zinc-200 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-[#52525b] hover:bg-zinc-50 transition-colors cursor-pointer text-center"
          >
            Close
          </button>

          <div className="flex items-center gap-2 flex-1">
            {/* SEND SMS ACTION */}
            <button
              type="button"
              disabled={sendingSms || (!phone.trim() && isEditingPhone)}
              onClick={handleSendSms}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-heading font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-60"
            >
              {sendingSms ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>SENDING SMS...</span>
                </>
              ) : (
                <>
                  <MessageSquare size={14} />
                  <span>{smsSentState ? "RESEND SMS" : "SEND SMS"}</span>
                </>
              )}
            </button>

            {/* PRINT RECEIPT ACTION */}
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="flex-1 py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-heading font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <Printer size={14} />
              <span>PRINT (58MM)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
