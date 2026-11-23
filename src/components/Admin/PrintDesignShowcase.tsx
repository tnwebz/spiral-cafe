"use client";

import React, { useState } from "react";
import {
  Printer,
  Copy,
  Check,
  Eye,
  FileText,
  RotateCcw,
} from "lucide-react";

type OrderScenario = "mixed" | "dine_in" | "takeaway";

interface SampleItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isParcel?: boolean;
}

export default function PrintDesignShowcase() {
  const [scenario, setScenario] = useState<OrderScenario>("mixed");
  const [copiedCol, setCopiedCol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"PAPER" | "RAW">("PAPER");

  // Interactive controls
  const [tableInput, setTableInput] = useState<string>("A1");
  const [dateInput, setDateInput] = useState<string>("22/11/2026");
  const [orderNumInput, setOrderNumInput] = useState<string>("106");
  const [hasSpecialRequest, setHasSpecialRequest] = useState<boolean>(true);
  const [specialRequest, setSpecialRequest] = useState<string>(
    "Less spicy, serve fries extra hot with garlic mayo dip"
  );
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE" | "UPI">("CASH");

  // Sample items based on active scenario matching exact approved reference
  const getItemsForScenario = (): SampleItem[] => {
    switch (scenario) {
      case "dine_in":
        return [
          { id: "1", name: "Hazelnut Iced Latte", quantity: 1, price: 170, isParcel: false },
          { id: "2", name: "Drippy Cheese Fries", quantity: 1, price: 170, isParcel: false },
          { id: "3", name: "Chicken Popcorn", quantity: 1, price: 175, isParcel: false },
        ];
      case "takeaway":
        return [
          { id: "1", name: "Hazelnut Iced Latte", quantity: 1, price: 170, isParcel: true },
          { id: "2", name: "Drippy Cheese Fries", quantity: 1, price: 170, isParcel: true },
          { id: "3", name: "Chicken Popcorn", quantity: 1, price: 175, isParcel: true },
        ];
      case "mixed":
      default:
        return [
          { id: "1", name: "Hazelnut Iced Latte", quantity: 1, price: 170, isParcel: false },
          { id: "2", name: "Drippy Cheese Fries", quantity: 1, price: 170, isParcel: true },
          { id: "3", name: "Chicken Popcorn", quantity: 1, price: 175, isParcel: true },
        ];
    }
  };

  const currentItems = getItemsForScenario();
  const totalItems = currentItems.length;
  const totalQuantity = currentItems.reduce((acc, it) => acc + it.quantity, 0);
  const subtotal = currentItems.reduce((acc, it) => acc + it.price * it.quantity, 0); // 170 + 170 + 175 = 515.00
  const gstTax = 26.0; // 5% of 515 = 25.75 rounded to 26.00 matching reference
  const hasParcel = currentItems.some((it) => it.isParcel) || scenario === "takeaway";
  const packagingFee = hasParcel ? 15.0 : 0.0;
  const grandTotal = subtotal + gstTax + packagingFee; // 515 + 26 + 15 = 556.00 matching reference exactly!

  const hasDineInItem = currentItems.some((it) => !it.isParcel);
  const hasParcelItem = currentItems.some((it) => it.isParcel);
  const isMixed = scenario === "mixed" || (hasDineInItem && hasParcelItem);
  const isAllTakeaway = scenario === "takeaway" || (!hasDineInItem && hasParcelItem);

  const displayTable = isAllTakeaway ? "TAKEAWAY" : tableInput.toUpperCase();

  // Plaintext generator for copy / raw ESC/POS view
  const getKitchenKotText = (): string => {
    const W = 32;
    const div = "-".repeat(W);
    let banner = isMixed
      ? " *** DINE IN & TAKE AWAY *** \n"
      : isAllTakeaway
      ? " *** TAKE AWAY *** \n"
      : " *** DINE IN *** \n";

    let out = `          SPIRAL CAFE\n${banner}           TABLE ${displayTable}\n${div}\n`;
    out += `Order: #${orderNumInput}${" ".repeat(Math.max(1, W - 9 - orderNumInput.length - 16))}Date: ${dateInput}\n`;
    out += `${div}\nITEM                         QTY\n${div}\n`;
    currentItems.forEach((it) => {
      const tag = it.isParcel || isAllTakeaway ? "(Parcel)" : "(Dine In)";
      const fullName = `${it.name} - ${tag}`;
      const qtyStr = String(it.quantity);
      const pad = Math.max(1, W - fullName.length - qtyStr.length);
      out += `${fullName}${" ".repeat(pad)}${qtyStr}\n`;
    });
    out += `${div}\nTotal Items: ${totalItems}${" ".repeat(Math.max(1, W - 14 - 13))}Total Qty: ${totalQuantity}\n`;
    if (hasSpecialRequest && specialRequest) {
      out += `${div}\nSPECIAL REQUEST:\n"${specialRequest}"\n`;
    }
    out += `${div}\n        —— ORDER SLIP ——\n`;
    return out;
  };

  const getCounterKotText = (): string => {
    const W = 32;
    const div = "-".repeat(W);
    let banner = isMixed
      ? " *** DINE IN & TAKE AWAY *** \n"
      : isAllTakeaway
      ? " *** TAKE AWAY *** \n"
      : " *** DINE IN *** \n";

    let out = `! EMERGENCY KOT (COUNTER SLIP) !\n${banner}`;
    out += `TABLE: ${displayTable}   |   DATE: ${dateInput}\n${div}\n`;
    out += `ITEM                         QTY\n${div}\n`;
    currentItems.forEach((it) => {
      const tag = it.isParcel || isAllTakeaway ? "(Parcel)" : "(Dine In)";
      const fullName = `${it.name} - ${tag}`;
      const qtyStr = String(it.quantity);
      const pad = Math.max(1, W - fullName.length - qtyStr.length);
      out += `${fullName}${" ".repeat(pad)}${qtyStr}\n`;
    });
    out += `${div}\nItems: ${totalItems}${" ".repeat(Math.max(1, W - 9 - 7))}Qty: ${totalQuantity}\n`;
    out += `- - - - - - - - - - - - - - - - \n`;
    if (hasSpecialRequest && specialRequest) {
      out += `SPECIAL REQUEST:\n"${specialRequest}"\n- - - - - - - - - - - - - - - - \n`;
    }
    out += `     - - - 58MM TEAR - - -\n`;
    return out;
  };

  const getCounterBillText = (): string => {
    const W = 32;
    const div = "-".repeat(W);
    const doubleDiv = "=".repeat(W);
    let out = `Estimate             Spiral Cafe\n${div}\n`;
    out += `TABLE: ${displayTable}   |   DATE: ${dateInput}\n${div}\n`;
    out += `Item         Qty  Pr.(Rs) Amt(Rs)\n${div}\n`;
    currentItems.forEach((it) => {
      const pr = it.price.toFixed(2).padStart(7, " ");
      const amt = (it.price * it.quantity).toFixed(2).padStart(8, " ");
      const qty = String(it.quantity).padStart(3, " ");
      const tag = it.isParcel || isAllTakeaway ? "(Parcel)" : "(Dine In)";
      const fullName = `${it.name} ${tag}`;
      if (fullName.length <= 13) {
        out += `${fullName.padEnd(13, " ")} ${qty} ${pr} ${amt}\n`;
      } else {
        out += `${fullName.substring(0, 13)} ${qty} ${pr} ${amt}\n`;
        out += `${fullName.substring(13)}\n`;
      }
    });
    out += `${div}\n`;
    out += `Total Qty${" ".repeat(Math.max(1, W - 9 - String(totalQuantity).length))}${totalQuantity}\n`;
    out += `Total Summary${" ".repeat(Math.max(1, W - 13 - subtotal.toFixed(2).length))}${subtotal.toFixed(2)}\n`;
    out += `GST Tax (5%)${" ".repeat(Math.max(1, W - 12 - gstTax.toFixed(2).length))}${gstTax.toFixed(2)}\n`;
    if (packagingFee > 0) {
      out += `Packaging Fee${" ".repeat(Math.max(1, W - 13 - packagingFee.toFixed(2).length))}${packagingFee.toFixed(2)}\n`;
    }
    out += `${doubleDiv}\nGRAND TOTAL${" ".repeat(Math.max(1, W - 11 - `Rs ${grandTotal.toFixed(2)}`.length))}Rs ${grandTotal.toFixed(2)}\n`;
    out += `Payment Mode: ${paymentMode}\n`;
    out += `- - - - - - - - - - - - - - - - \n`;
    out += `     Thanks visit again!!!\n`;
    return out;
  };

  const copyToClipboard = (text: string, col: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCol(col);
      setTimeout(() => setCopiedCol(null), 2000);
    }
  };

  const triggerBrowserPrint = (contentId: string) => {
    const el = document.getElementById(contentId);
    if (!el) return;
    const printWindow = window.open("", "_blank", "width=400,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spiral Cafe - Thermal Print</title>
          <style>
            @page { margin: 0; }
            body {
              margin: 4mm 6mm;
              background: #fff;
              color: #000;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 11px;
              line-height: 1.25;
            }
            .slip { width: 48mm; max-width: 48mm; margin: 0 auto; }
            hr { border: 0; border-top: 1px solid #000; margin: 4px 0; }
            .dotted-hr { border: 0; border-top: 1px dotted #888; margin: 4px 0; }
            .double-hr { border: 0; border-top: 2px solid #000; margin: 4px 0; }
            .banner { background: #000; color: #fff; text-align: center; font-weight: bold; padding: 2px 0; }
            .shaded { background: #f0f0f0; padding: 2px 4px; }
            .bold { font-weight: bold; }
            .center { text-align: center; }
            .flex-between { display: flex; justify-content: space-between; align-items: baseline; }
          </style>
        </head>
        <body>
          <div class="slip">
            ${el.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-[#FAF9F5] rounded-3xl p-6 sm:p-8 border border-black/[0.06] shadow-[0_20px_40px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] space-y-6">
      {/* Top Header & Presets */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-white">
              Approved 58mm Reference
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              384 dots @ 203 DPI • Printable Width ~48mm
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-heading font-black text-zinc-950 mt-1">
            Exact 3 Thermal Receipt Designs
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            Matching the physical approved receipt design: bold typography, reverse-color banners, compact line spacing, and precise column alignments.
          </p>
        </div>

        {/* View Mode & Preset Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scenario Selector */}
          <div className="flex items-center p-1 bg-white rounded-2xl border border-zinc-300 shadow-2xs">
            <button
              onClick={() => setScenario("mixed")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                scenario === "mixed"
                  ? "bg-black text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Mixed (Reference)
            </button>
            <button
              onClick={() => setScenario("dine_in")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                scenario === "dine_in"
                  ? "bg-black text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              All Dine-In
            </button>
            <button
              onClick={() => setScenario("takeaway")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                scenario === "takeaway"
                  ? "bg-black text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              All Take Away
            </button>
          </div>

          {/* Paper View vs Raw Text Toggle */}
          <div className="flex items-center p-1 bg-white rounded-2xl border border-zinc-300 shadow-2xs">
            <button
              onClick={() => setViewMode("PAPER")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === "PAPER"
                  ? "bg-black text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>White Paper</span>
            </button>
            <button
              onClick={() => setViewMode("RAW")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === "RAW"
                  ? "bg-black text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>ESC/POS Text</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Customization Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-600">Table:</span>
            <input
              type="text"
              value={tableInput}
              onChange={(e) => setTableInput(e.target.value.toUpperCase())}
              className="w-14 px-2 py-0.5 bg-zinc-50 border border-zinc-300 rounded-md font-mono font-bold text-center text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-600">Order:</span>
            <input
              type="text"
              value={orderNumInput}
              onChange={(e) => setOrderNumInput(e.target.value)}
              className="w-14 px-2 py-0.5 bg-zinc-50 border border-zinc-300 rounded-md font-mono font-bold text-center text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-600">Date:</span>
            <input
              type="text"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-24 px-2 py-0.5 bg-zinc-50 border border-zinc-300 rounded-md font-mono font-bold text-center text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-600">Special Request:</span>
            <input
              type="checkbox"
              checked={hasSpecialRequest}
              onChange={(e) => setHasSpecialRequest(e.target.checked)}
              className="rounded accent-black cursor-pointer"
            />
          </div>
        </div>

        {hasSpecialRequest && (
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <input
              type="text"
              value={specialRequest}
              onChange={(e) => setSpecialRequest(e.target.value)}
              placeholder="Special kitchen instruction..."
              className="w-full px-2.5 py-1 bg-zinc-50 border border-zinc-300 rounded-md text-xs"
            />
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 3-COLUMN WINDOW: EXACT APPROVED RECEIPT DESIGNS (ALL 58MM)            */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start justify-items-center">
        {/* =================================================================== */}
        {/* 1. KITCHEN KOT — MAIN ORDER SLIP                                    */}
        {/* =================================================================== */}
        <div className="w-full max-w-[310px] flex flex-col items-center">
          {/* Header Action Bar */}
          <div className="w-full mb-2 flex items-center justify-between px-1">
            <span className="font-heading font-black text-xs text-zinc-900 tracking-tight">
              1. Kitchen KOT
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyToClipboard(getKitchenKotText(), "kitchen")}
                className="p-1 rounded-md hover:bg-zinc-200 text-zinc-600 transition-colors"
                title="Copy slip text"
              >
                {copiedCol === "kitchen" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => triggerBrowserPrint("kitchen-kot-preview")}
                className="p-1 rounded-md hover:bg-zinc-200 text-zinc-600 transition-colors"
                title="Print slip"
              >
                <Printer className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {viewMode === "PAPER" ? (
            /* EXACT VISUAL PHYSICAL RECEIPT 1: KITCHEN KOT */
            <div className="w-full bg-white text-black font-sans shadow-[0_12px_30px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] rounded-2xl border border-zinc-200 overflow-hidden select-text">
              <div id="kitchen-kot-preview" className="px-5 pt-5 pb-4 space-y-1.5">
                {/* 1. Centered SPIRAL CAFE */}
                <div className="text-center font-black text-lg tracking-wider text-black">
                  SPIRAL CAFE
                </div>

                {/* 2. Reverse Banner: *** DINE IN & TAKE AWAY *** */}
                <div className="text-center">
                  <div className="bg-black text-white text-center font-black text-[11px] py-1 px-3 tracking-wider inline-block">
                    {isMixed
                      ? "*** DINE IN & TAKE AWAY ***"
                      : isAllTakeaway
                      ? "*** TAKE AWAY ***"
                      : "*** DINE IN ***"}
                  </div>
                </div>

                {/* 3. Large centered bold Table: TABLE A1 */}
                <div className="text-center font-black text-xl tracking-tight text-black pt-0.5">
                  TABLE {displayTable}
                </div>

                {/* Separator */}
                <div className="border-t border-black/80 my-1" />

                {/* 4. Order: #106 | Date: 22/11/2026 */}
                <div className="flex justify-between items-baseline text-xs text-black">
                  <span className="font-black">Order: #{orderNumInput}</span>
                  <span className="font-semibold text-zinc-800">Date: {dateInput}</span>
                </div>

                {/* Separator */}
                <div className="border-t border-black/80 my-1" />

                {/* 5. Shaded ITEM | QTY row */}
                <div className="bg-zinc-100 py-1 px-1.5 flex justify-between font-black text-xs text-black tracking-wider">
                  <span>ITEM</span>
                  <span>QTY</span>
                </div>

                {/* 6. Product rows in bold */}
                <div className="space-y-1.5 py-1">
                  {currentItems.map((item) => {
                    const tag = item.isParcel || isAllTakeaway ? "(Parcel)" : "(Dine In)";
                    return (
                      <div
                        key={item.id}
                        className="flex justify-between items-baseline text-xs"
                      >
                        <span className="font-black text-black leading-snug pr-2">
                          {item.name} - {tag}
                        </span>
                        <span className="font-black text-black text-sm shrink-0">
                          {item.quantity}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Separator */}
                <div className="border-t border-black/80 my-1" />

                {/* 7. Total Items: 3 | Total Qty: 3 */}
                <div className="flex justify-between font-black text-xs text-black">
                  <span>Total Items: {totalItems}</span>
                  <span>Total Qty: {totalQuantity}</span>
                </div>

                {/* Separator & Special Request (only if present) */}
                {hasSpecialRequest && specialRequest && (
                  <>
                    <div className="border-t border-black/80 my-1" />
                    <div className="bg-zinc-100/90 p-2.5 rounded-xs border border-zinc-200/90 text-left my-1.5 space-y-0.5">
                      <div className="font-black text-[10.5px] uppercase tracking-wider text-black">
                        SPECIAL REQUEST:
                      </div>
                      <div className="italic font-bold text-xs text-black leading-snug">
                        &quot;{specialRequest}&quot;
                      </div>
                    </div>
                  </>
                )}

                {/* 8. Footer: —— ORDER SLIP —— */}
                <div className="text-center font-black text-xs tracking-wider pt-3 pb-1 flex items-center justify-center gap-2 text-black">
                  <span className="w-8 h-[1px] bg-black inline-block" />
                  <span>ORDER SLIP</span>
                  <span className="w-8 h-[1px] bg-black inline-block" />
                </div>
              </div>

              {/* Serrated Tear Cut (Bottom) */}
              <div className="w-full h-3 bg-white flex items-end">
                <svg
                  className="w-full h-2 text-zinc-100 fill-current"
                  viewBox="0 0 120 8"
                  preserveAspectRatio="none"
                >
                  <path d="M0,8 L3,0 L6,8 L9,0 L12,8 L15,0 L18,8 L21,0 L24,8 L27,0 L30,8 L33,0 L36,8 L39,0 L42,8 L45,0 L48,8 L51,0 L54,8 L57,0 L60,8 L63,0 L66,8 L69,0 L72,8 L75,0 L78,8 L81,0 L84,8 L87,0 L90,8 L93,0 L96,8 L99,0 L102,8 L105,0 L108,8 L111,0 L114,8 L117,0 L120,8 Z" />
                </svg>
              </div>
            </div>
          ) : (
            <pre className="w-full p-4 bg-zinc-900 text-emerald-400 font-mono text-xs leading-tight rounded-2xl overflow-x-auto border border-zinc-800 shadow-inner max-h-[500px]">
              {getKitchenKotText()}
            </pre>
          )}
        </div>

        {/* =================================================================== */}
        {/* 2. EMERGENCY KOT — COUNTER BACKUP SLIP                              */}
        {/* =================================================================== */}
        <div className="w-full max-w-[310px] flex flex-col items-center">
          {/* Header Action Bar */}
          <div className="w-full mb-2 flex items-center justify-between px-1">
            <span className="font-heading font-black text-xs text-zinc-900 tracking-tight">
              2. Emergency KOT (Counter)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyToClipboard(getCounterKotText(), "counter-kot")}
                className="p-1 rounded-md hover:bg-zinc-200 text-zinc-600 transition-colors"
                title="Copy slip text"
              >
                {copiedCol === "counter-kot" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => triggerBrowserPrint("counter-kot-preview")}
                className="p-1 rounded-md hover:bg-zinc-200 text-zinc-600 transition-colors"
                title="Print slip"
              >
                <Printer className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {viewMode === "PAPER" ? (
            /* EXACT VISUAL PHYSICAL RECEIPT 2: EMERGENCY KOT */
            <div className="w-full bg-white text-black font-sans shadow-[0_12px_30px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] rounded-2xl border border-zinc-200 overflow-hidden select-text">
              <div id="counter-kot-preview" className="px-5 pt-5 pb-3 space-y-1.5">
                {/* 1. Centered: ! EMERGENCY KOT (COUNTER SLIP) ! */}
                <div className="text-center font-black text-xs tracking-wider text-black">
                  ! EMERGENCY KOT (COUNTER SLIP) !
                </div>

                {/* 2. Reverse Banner: *** DINE IN & TAKE AWAY *** */}
                <div className="text-center">
                  <div className="bg-black text-white text-center font-black text-[11px] py-1 px-3 tracking-wider inline-block">
                    {isMixed
                      ? "*** DINE IN & TAKE AWAY ***"
                      : isAllTakeaway
                      ? "*** TAKE AWAY ***"
                      : "*** DINE IN ***"}
                  </div>
                </div>

                {/* 3. Centered compact row: TABLE: A1 | DATE: 22/11/2026 */}
                <div className="text-center font-black text-xs text-black py-0.5">
                  TABLE: {displayTable} &nbsp;&nbsp;|&nbsp;&nbsp; DATE: {dateInput}
                </div>

                {/* Separator */}
                <div className="border-t border-black/80 my-1" />

                {/* 4. Shaded ITEM | QTY row */}
                <div className="bg-zinc-100 py-1 px-1.5 flex justify-between font-black text-xs text-black tracking-wider">
                  <span>ITEM</span>
                  <span>QTY</span>
                </div>

                {/* 5. Product rows in bold */}
                <div className="space-y-1.5 py-1">
                  {currentItems.map((item) => {
                    const tag = item.isParcel || isAllTakeaway ? "(Parcel)" : "(Dine In)";
                    return (
                      <div
                        key={item.id}
                        className="flex justify-between items-baseline text-xs"
                      >
                        <span className="font-black text-black leading-snug pr-2">
                          {item.name} - {tag}
                        </span>
                        <span className="font-black text-black text-sm shrink-0">
                          {item.quantity}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Separator */}
                <div className="border-t border-black/80 my-1" />

                {/* 6. Items: 3 | Qty: 3 */}
                <div className="flex justify-between font-black text-xs text-black">
                  <span>Items: {totalItems}</span>
                  <span>Qty: {totalQuantity}</span>
                </div>

                {/* Dotted separator & Special Request (only if present) */}
                {hasSpecialRequest && specialRequest && (
                  <>
                    <div className="border-t border-dotted border-zinc-400 my-1.5" />
                    <div className="bg-zinc-100/90 p-2.5 rounded-xs border border-zinc-200/90 text-left my-1 space-y-0.5">
                      <div className="font-black text-[10.5px] uppercase tracking-wider text-black">
                        SPECIAL REQUEST:
                      </div>
                      <div className="italic font-bold text-xs text-black leading-snug">
                        &quot;{specialRequest}&quot;
                      </div>
                    </div>
                  </>
                )}

                {/* 7. Dotted Tear Line: - - - - - 58MM TEAR - - - - - */}
                <div className="pt-3 pb-1 text-center text-[10px] text-zinc-400 font-mono tracking-wider flex items-center justify-center gap-1.5">
                  <span>- - - - - - - -</span>
                  <span>58MM TEAR</span>
                  <span>- - - - - - - -</span>
                </div>
              </div>

              {/* Serrated Tear Cut (Bottom) */}
              <div className="w-full h-3 bg-white flex items-end">
                <svg
                  className="w-full h-2 text-zinc-100 fill-current"
                  viewBox="0 0 120 8"
                  preserveAspectRatio="none"
                >
                  <path d="M0,8 L3,0 L6,8 L9,0 L12,8 L15,0 L18,8 L21,0 L24,8 L27,0 L30,8 L33,0 L36,8 L39,0 L42,8 L45,0 L48,8 L51,0 L54,8 L57,0 L60,8 L63,0 L66,8 L69,0 L72,8 L75,0 L78,8 L81,0 L84,8 L87,0 L90,8 L93,0 L96,8 L99,0 L102,8 L105,0 L108,8 L111,0 L114,8 L117,0 L120,8 Z" />
                </svg>
              </div>
            </div>
          ) : (
            <pre className="w-full p-4 bg-zinc-900 text-amber-400 font-mono text-xs leading-tight rounded-2xl overflow-x-auto border border-zinc-800 shadow-inner max-h-[500px]">
              {getCounterKotText()}
            </pre>
          )}
        </div>

        {/* =================================================================== */}
        {/* 3. CUSTOMER BILL / ESTIMATE                                         */}
        {/* =================================================================== */}
        <div className="w-full max-w-[310px] flex flex-col items-center">
          {/* Header Action Bar */}
          <div className="w-full mb-2 flex items-center justify-between px-1">
            <span className="font-heading font-black text-xs text-zinc-900 tracking-tight">
              3. Customer Bill / Estimate
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyToClipboard(getCounterBillText(), "counter-bill")}
                className="p-1 rounded-md hover:bg-zinc-200 text-zinc-600 transition-colors"
                title="Copy bill text"
              >
                {copiedCol === "counter-bill" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => triggerBrowserPrint("counter-bill-preview")}
                className="p-1 rounded-md hover:bg-zinc-200 text-zinc-600 transition-colors"
                title="Print bill"
              >
                <Printer className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {viewMode === "PAPER" ? (
            /* EXACT VISUAL PHYSICAL RECEIPT 3: COMPACT CUSTOMER BILL / ESTIMATE */
            <div className="w-full bg-white text-black font-sans shadow-[0_12px_30px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] rounded-2xl border border-zinc-200 overflow-hidden select-text">
              <div id="counter-bill-preview" className="px-4.5 pt-4 pb-3 space-y-1">
                {/* 1. Header: Estimate (left, bold) and Spiral Cafe (right, large bold) */}
                <div className="flex justify-between items-baseline text-black">
                  <span className="font-black text-sm tracking-tight">Estimate</span>
                  <span className="font-black text-base tracking-tight">Spiral Cafe</span>
                </div>

                {/* Separator */}
                <div className="border-t border-black/80 my-0.5" />

                {/* 2. Centered compact row: TABLE: A1 | DATE: 22/11/2026 */}
                <div className="text-center font-black text-xs text-black py-0.5">
                  TABLE: {displayTable} &nbsp;&nbsp;|&nbsp;&nbsp; DATE: {dateInput}
                </div>

                {/* Separator */}
                <div className="border-t border-black/80 my-0.5" />

                {/* 3. Column Headers: Item | Qty | Pr.(₹) | Amt(₹) */}
                <div className="flex justify-between items-baseline font-black text-xs text-black py-0.5">
                  <span className="w-[48%] text-left">Item</span>
                  <span className="w-[10%] text-center">Qty</span>
                  <span className="w-[21%] text-right">Pr.(₹)</span>
                  <span className="w-[21%] text-right">Amt(₹)</span>
                </div>

                {/* 4. Products: Name and tag inline beside each other */}
                <div className="space-y-1 py-0.5">
                  {currentItems.map((item) => {
                    const tag = item.isParcel || isAllTakeaway ? "(Parcel)" : "(Dine In)";
                    return (
                      <div key={item.id} className="text-xs flex justify-between items-baseline leading-snug">
                        <span className="w-[48%] font-black text-black pr-1">
                          {item.name} <span className="font-bold text-[10.5px] whitespace-nowrap">{tag}</span>
                        </span>
                        <span className="w-[10%] text-center font-black text-black">
                          {item.quantity}
                        </span>
                        <span className="w-[21%] text-right font-medium text-black">
                          {item.price.toFixed(2)}
                        </span>
                        <span className="w-[21%] text-right font-black text-black">
                          {(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Separator */}
                <div className="border-t border-black/80 my-0.5" />

                {/* 5. Summary Breakdown (Total Items removed; Total Qty kept) */}
                <div className="space-y-0.5 text-xs text-black">
                  <div className="flex justify-between font-black">
                    <span>Total Qty</span>
                    <span>{totalQuantity}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total Summary</span>
                    <span>{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>GST Tax (5%)</span>
                    <span>{gstTax.toFixed(2)}</span>
                  </div>
                  {packagingFee > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>Packaging Fee</span>
                      <span>{packagingFee.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Double horizontal line */}
                <div className="border-t-2 border-b-2 border-black py-1 my-1 flex justify-between items-baseline">
                  <span className="font-black text-sm tracking-wide">GRAND TOTAL</span>
                  <span className="font-black text-lg tracking-tight">
                    ₹ {grandTotal.toFixed(2)}
                  </span>
                </div>

                {/* Payment Mode */}
                <div className="text-xs font-bold text-black pt-0.5">
                  Payment Mode: {paymentMode}
                </div>

                {/* Dotted separator */}
                <div className="border-t border-dotted border-zinc-400 my-1.5" />

                {/* Footer Brand Message (Only Thanks visit again) */}
                <div className="text-center pt-0.5 pb-1">
                  <div className="font-black text-xs text-black tracking-tight">
                    Thanks visit again!!!
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <pre className="w-full p-4 bg-zinc-900 text-blue-400 font-mono text-xs leading-tight rounded-2xl overflow-x-auto border border-zinc-800 shadow-inner max-h-[500px]">
              {getCounterBillText()}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
