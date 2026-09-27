"use client";

import React, { useRef } from "react";
import { Invoice } from "@/lib/db";
import { Printer, X, Download, Share2 } from "lucide-react";
import { formatReceipt58mm } from "@/lib/printer";

interface ThermalReceiptModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export default function ThermalReceiptModal({ invoice, onClose }: ThermalReceiptModalProps) {
  if (!invoice) return null;

  const handleBrowserPrint = () => {
    window.print();
  };

  const formattedLines = formatReceipt58mm(invoice);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-[#CA340A]/20 shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
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
            className="p-1 rounded-lg text-[#E2C7BA] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Receipt Output Container (Rendered exactly in 58mm monospaced simulation) */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-100 flex justify-center">
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
        <div className="p-4 border-t border-zinc-200 bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-[#52525b] hover:bg-zinc-50 transition-colors"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleBrowserPrint}
            className="flex-1 py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-heading font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Printer size={16} />
            <span>PRINT RECEIPT (58MM)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
