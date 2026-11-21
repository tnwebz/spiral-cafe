"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Clock,
  CheckCircle2,
  Flame,
  Utensils,
  CreditCard,
  Banknote,
  Sparkles,
  ArrowRight,
  Edit2,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useCart, PlacedOrder } from "@/context/CartContext";
import OrderSuccessModal from "./OrderSuccessModal";

const DEFAULT_FLOOR_TABLES = [
  "A1", "A2",
  "B1", "B2", "B3", "B4", "B5", "B6",
  "C1", "C2", "C3",
  "F1", "F2", "F3", "F4",
];

export default function CartOrdersSheet() {
  const {
    isCartOpen,
    setIsCartOpen,
    activeSheetTab,
    setActiveSheetTab,
    cart,
    tableNumber,
    setTableNumber,
    customerSessionId,
    tableReservation,
    transferTableReservation,
    refreshTableReservation,
    totalItems,
    subtotal,
    taxPercentage,
    tax,
    packagingFee,
    grandTotal,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    placeOrder,
    isPlacingOrder,
    placedOrders,
    activeTableOrder,
    notifyAddingFood,
    selectCashPayment,
    batchSelectCashPayment,
    switchPaymentMethod,
    processOnlinePayment,
  } = useCart();

  const [orderServingMode, setOrderServingMode] = useState<"DINE_IN" | "TAKEAWAY">(
    tableNumber === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN"
  );
  const [isPayingAllCash, setIsPayingAllCash] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [showTableModal, setShowTableModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showContactCounterModal, setShowContactCounterModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(tableNumber || "A1");
  const [availableTables, setAvailableTables] = useState<string[]>(DEFAULT_FLOOR_TABLES);
  const [overviewTables, setOverviewTables] = useState<
    Array<{
      tableNumber: string;
      color: "WHITE" | "BLUE" | "RED" | "YELLOW" | "GREEN";
      status: string;
      capacity: number;
      reservation?: {
        remainingSeconds: number;
        customerPhone?: string;
      };
    }>
  >([]);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{
    [orderId: string]: { type: "info" | "error" | "cancelled"; message: string };
  }>({});
  const [orderError, setOrderError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalOrder, setSuccessModalOrder] = useState<PlacedOrder | null>(null);
  const [tablesStatus, setTablesStatus] = useState<
    Array<{
      tableNumber: string;
      isLocked: boolean;
      activeOrderId?: string;
      orderNumber?: string;
      customerSessionId?: string;
    }>
  >([]);

  useEffect(() => {
    if (tableNumber) {
      setSelectedTable(tableNumber);
      if (tableNumber === "TAKEAWAY") {
        setOrderServingMode("TAKEAWAY");
      } else {
        setOrderServingMode("DINE_IN");
      }
    }
  }, [tableNumber]);

  useEffect(() => {
    if (showTableModal) {
      // Fetch dynamic tables with full 5-color status
      fetch(`/api/tables?visitorId=${encodeURIComponent(customerSessionId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.tables) && d.tables.length > 0) {
            setOverviewTables(d.tables);
            setAvailableTables(d.tables.map((t: any) => t.tableNumber));
          }
        })
        .catch(() => {});

      // Fetch occupancy status fallback
      fetch("/api/tables/status")
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.tables)) {
            setTablesStatus(d.tables);
          }
        })
        .catch(() => {});
    }
  }, [showTableModal, customerSessionId]);

  if (!isCartOpen) return null;

  const handleSelectTable = async (table: string) => {
    setOrderError(null);
    const tableItem = overviewTables.find((t) => t.tableNumber === table);

    // If occupied with active order
    if (
      tableItem &&
      (tableItem.color === "RED" || tableItem.color === "YELLOW" || tableItem.color === "GREEN")
    ) {
      setOrderError(
        `Table ${table} is currently occupied with an active dining session. If your table shows occupied, please contact the counter.`
      );
      return;
    }

    // If temporarily reserved by someone else
    if (tableItem && tableItem.color === "BLUE") {
      const isMyRes =
        (tableReservation?.tableNumber === table && !tableReservation.isExpired) ||
        selectedTable === table;
      if (!isMyRes) {
        setOrderError(
          `Table ${table} is temporarily reserved by another customer. Please choose an available table.`
        );
        return;
      }
    }

    // Transfer or create reservation atomically
    const res = await transferTableReservation(table);
    if (!res.success) {
      setOrderError(res.error || `Failed to reserve Table ${table}.`);
      return;
    }

    setTableNumber(table);
    setSelectedTable(table);
    setOrderServingMode("DINE_IN");
    setShowTableModal(false);

    if (cart.length > 0) {
      setShowConfirmModal(true);
    }
  };

  const handleFinalConfirmOrder = async () => {
    setOrderError(null);
    let targetTable = selectedTable || tableNumber || "A1";

    if (orderServingMode === "DINE_IN" && (targetTable === "TAKEAWAY" || tableNumber === "TAKEAWAY")) {
      setShowConfirmModal(false);
      setShowTableModal(true);
      return;
    }

    const isTakeaway = orderServingMode === "TAKEAWAY";
    let notes = orderNotes.trim();
    if (isTakeaway && !notes.includes("[TAKEAWAY]")) {
      notes = `[TAKEAWAY] [PARCEL] ${notes}`.trim();
    }

    const res = await placeOrder(notes, targetTable, isTakeaway);
    if (!res.success) {
      setOrderError(res.error || "Failed to place order.");
    } else {
      setShowConfirmModal(false);
      setOrderNotes("");
      if (res.order) {
        setSuccessModalOrder(res.order);
        setShowSuccessModal(true);
      }
    }
  };

  const handlePayOnline = async (order: PlacedOrder) => {
    setPayingOrderId(order.id);
    setPaymentNotice((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });

    const res = await processOnlinePayment(order.id);
    setPayingOrderId(null);

    if (res.success) {
      setPaymentNotice((prev) => ({
        ...prev,
        [order.id]: {
          type: "info",
          message: "Payment received! Thank you.",
        },
      }));
    } else {
      const isCancelled =
        res.error?.toLowerCase().includes("cancel") ||
        res.error?.toLowerCase().includes("dismiss") ||
        res.error?.toLowerCase().includes("guest");

      setPaymentNotice((prev) => ({
        ...prev,
        [order.id]: {
          type: isCancelled ? "cancelled" : "error",
          message: isCancelled
            ? "Online payment was cancelled. You can retry paying online or choose Cash on Delivery / Counter below."
            : res.error || "Payment was not completed. Please retry or choose Cash on Delivery.",
        },
      }));
    }
  };

  const handleSelectCash = async (orderId: string) => {
    setPaymentNotice((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    const ok = await selectCashPayment(orderId);
    if (!ok) {
      setPaymentNotice((prev) => ({
        ...prev,
        [orderId]: {
          type: "error",
          message: "Could not request cash payment. Please check with counter.",
        },
      }));
    }
  };

  const handleSwitchToOnline = async (order: PlacedOrder) => {
    await switchPaymentMethod(order.id, "ONLINE");
    await handlePayOnline(order);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ y: "100%", opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-lg md:max-w-md h-[92vh] sm:h-[95vh] md:h-full mt-auto md:mt-0 bg-[#FFF8F3] rounded-t-3xl sm:rounded-t-3xl md:rounded-l-3xl md:rounded-r-none shadow-2xl md:shadow-[-10px_0_40px_rgba(74,33,23,0.15)] flex flex-col overflow-hidden border-t md:border-t-0 md:border-l border-[#EBDAD0]"
      >
        {/* Top Handle for mobile gestures */}
        <div className="w-12 h-1.5 bg-[#E2C7BA] rounded-full mx-auto mt-3 shrink-0 md:hidden" />

        {/* Sheet Header */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[#EBDAD0]/80">
          <div>
            <h2 className="text-xl font-heading font-extrabold text-[#4A2117]">
              MY ORDERS
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[#8C5E51] font-medium">
              {tableNumber === "TAKEAWAY" ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-amber-800 flex items-center gap-1">
                    <ShoppingBag size={12} />
                    <span>Take Away Mode</span>
                  </span>
                  <button
                    onClick={() => {
                      setSelectedTable("A1");
                      setShowTableModal(true);
                    }}
                    className="font-bold text-[#B73F1D] underline inline-flex items-center gap-0.5 cursor-pointer hover:text-[#9D3E22]"
                    title="Tap to select floor table to dine in"
                  >
                    <span>(Switch to Table)</span>
                    <Edit2 size={11} />
                  </button>
                </div>
              ) : (
                <>
                  <span>Dining at</span>
                  <button
                    onClick={() => {
                      setSelectedTable(tableNumber || "A1");
                      setShowTableModal(true);
                    }}
                    className="font-bold text-[#B73F1D] underline inline-flex items-center gap-1 cursor-pointer hover:text-[#9D3E22]"
                    title="Tap to change table"
                  >
                    <span>Table {tableNumber.replace(/^Table\s*/i, "")}</span>
                    <Edit2 size={11} />
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(false)}
            className="w-9 h-9 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-2 bg-[#F7ECE4] mx-4 my-2.5 rounded-2xl gap-1 shrink-0 border border-[#EBDAD0]">
          <button
            onClick={() => setActiveSheetTab("cart")}
            className={`flex-1 py-2 text-xs font-heading font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSheetTab === "cart"
                ? "bg-[#B73F1D] text-cream shadow-sm"
                : "text-[#8C5E51] hover:text-[#4A2117]"
            }`}
          >
            <ShoppingBag size={14} />
            <span>New Basket ({totalItems})</span>
          </button>

          <button
            onClick={() => setActiveSheetTab("orders")}
            className={`flex-1 py-2 text-xs font-heading font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSheetTab === "orders"
                ? "bg-[#B73F1D] text-cream shadow-sm"
                : "text-[#8C5E51] hover:text-[#4A2117]"
            }`}
          >
            <Clock size={14} />
            <span>My Placed Orders ({placedOrders.length})</span>
          </button>
        </div>

        {/* Tab 1: New Order Basket */}
        {activeSheetTab === "cart" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 flex flex-col justify-between">
            <div>
              {/* Basket Status Pill */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[11px] font-bold text-[#8C5E51] uppercase tracking-wider">
                  New Order Basket
                </span>
                <span className="text-[10px] font-bold bg-[#E2C7BA]/50 text-[#9D3E22] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Status: UNPLACED
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-[#EBDAD0]/50 flex items-center justify-center text-[#B73F1D] mb-3">
                    <ShoppingBag size={28} />
                  </div>
                  <h3 className="font-heading font-bold text-base text-[#4A2117]">
                    Your basket is empty
                  </h3>
                  <p className="text-xs text-[#8C5E51] mt-1 max-w-xs">
                    Explore our burgers, wings, sandos, and pasta to add delicious food to your order.
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-5 px-5 py-2 bg-[#B73F1D] text-cream font-heading font-bold text-xs rounded-full shadow-sm"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white rounded-2xl border border-[#EBDAD0] shadow-xs flex items-center gap-3"
                    >
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-heading font-bold text-sm text-[#4A2117] truncate">
                          {item.name}
                        </h4>
                        <div className="text-xs text-[#B73F1D] font-bold mt-0.5">
                          ₹{item.price}
                        </div>

                        {/* Quantity Controller & Delete */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 bg-[#FFF8F3] border border-[#B73F1D]/30 rounded-full px-1 py-0.5">
                            <button
                              onClick={() => decreaseQuantity(item.id)}
                              className="w-5 h-5 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-cream flex items-center justify-center font-bold text-xs"
                            >
                              <Minus size={11} strokeWidth={3} />
                            </button>
                            <span className="font-bold text-xs text-[#4A2117] min-w-[14px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => increaseQuantity(item.id)}
                              className="w-5 h-5 rounded-full bg-primary text-cream hover:bg-primary-dark flex items-center justify-center font-bold text-xs"
                            >
                              <Plus size={11} strokeWidth={3} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-[#4A2117]">
                              ₹{item.price * item.quantity}
                            </span>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-400 hover:text-red-600 p-1"
                              aria-label="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Special Cooking Note */}
                  <div className="mt-2">
                    <label className="text-[11px] font-bold text-[#8C5E51] mb-1 block">
                      Kitchen Special Request (Optional):
                    </label>
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="e.g. Less spicy, extra napkins, serve together..."
                      rows={2}
                      className="w-full p-2.5 bg-white border border-[#EBDAD0] rounded-xl text-xs text-[#4A2117] focus:outline-none focus:ring-1 focus:ring-[#B73F1D] resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bill Summary & Confirm Button */}
            {cart.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#EBDAD0] flex flex-col gap-3">
                {/* Serving Mode Selector: Dine-In Table vs Take Away (Parcel) */}
                <div className="bg-white p-3.5 rounded-2xl border border-[#EBDAD0] shadow-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-heading font-extrabold text-[#4A2117] uppercase tracking-wide">
                      Order Serving Type
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#FFF8F3] text-[#CA340A] border border-[#CA340A]/20">
                      {orderServingMode === "DINE_IN" ? "Dine-In Table" : "Take Away (Parcel)"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOrderServingMode("DINE_IN");
                        if (tableNumber === "TAKEAWAY" || selectedTable === "TAKEAWAY") {
                          setShowTableModal(true);
                        }
                      }}
                      className={`py-2 px-3 rounded-xl font-heading font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        orderServingMode === "DINE_IN"
                          ? "bg-[#B73F1D] text-white border-[#B73F1D] shadow-xs"
                          : "bg-[#FFF8F3] text-[#8C5E51] border-[#EBDAD0] hover:border-[#B73F1D]/50 hover:text-[#4A2117]"
                      }`}
                    >
                      <Utensils size={14} />
                      <span>🍽️ Dine-In Table</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOrderServingMode("TAKEAWAY");
                      }}
                      className={`py-2 px-3 rounded-xl font-heading font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        orderServingMode === "TAKEAWAY"
                          ? "bg-amber-700 text-white border-amber-700 shadow-xs"
                          : "bg-[#FFF8F3] text-[#8C5E51] border-[#EBDAD0] hover:border-amber-700/50 hover:text-[#4A2117]"
                      }`}
                    >
                      <ShoppingBag size={14} />
                      <span>🛍️ Take Away (Parcel)</span>
                    </button>
                  </div>

                  {/* Contextual guidance */}
                  {orderServingMode === "DINE_IN" && (tableNumber === "TAKEAWAY" || selectedTable === "TAKEAWAY") ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-amber-900 font-medium">Please choose an available table to sit down:</span>
                      <button
                        type="button"
                        onClick={() => setShowTableModal(true)}
                        className="px-2.5 py-1 bg-[#B73F1D] hover:bg-[#9D3E22] text-white font-heading font-bold text-[11px] rounded-lg shadow-xs cursor-pointer"
                      >
                        Choose Table
                      </button>
                    </div>
                  ) : orderServingMode === "TAKEAWAY" && tableNumber && tableNumber !== "TAKEAWAY" ? (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-medium flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                      <span>
                        Your parcel will be packed for takeaway and billed with <strong>Table {tableNumber.replace(/^Table\s*/i, "")}</strong>.
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#EBDAD0] text-xs flex flex-col gap-1.5">
                  <div className="flex justify-between text-[#8C5E51]">
                    <span>Item Subtotal</span>
                    <span className="font-bold text-[#4A2117]">₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-[#8C5E51]">
                    <span>Taxes (GST {taxPercentage}%)</span>
                    <span className="font-bold text-[#4A2117]">₹{tax}</span>
                  </div>
                  {packagingFee > 0 && (
                    <div className="flex justify-between text-[#8C5E51]">
                      <span>Packaging Fee</span>
                      <span className="font-bold text-[#4A2117]">₹{packagingFee}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-[#B73F1D] pt-1.5 border-t border-[#EBDAD0]">
                    <span>Grand Total</span>
                    <span>₹{grandTotal}</span>
                  </div>
                </div>

                {orderError && (
                  <div className="p-2.5 bg-red-100 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                    {orderError}
                  </div>
                )}

                {orderServingMode === "TAKEAWAY" && tableNumber && tableNumber !== "TAKEAWAY" ? (
                  <button
                    disabled={isPlacingOrder}
                    onClick={() => {
                      setSelectedTable(tableNumber);
                      setShowConfirmModal(true);
                    }}
                    className="w-full py-3.5 bg-amber-700 hover:bg-amber-800 text-[#FFF8F3] font-heading font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPlacingOrder ? (
                      <span>ADDING PARCEL TO ORDER...</span>
                    ) : (
                      <>
                        <ShoppingBag size={16} />
                        <span>ADD TAKE AWAY PARCEL TO TABLE {tableNumber.replace(/^Table\s*/i, "")} • ₹{grandTotal}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                ) : orderServingMode === "DINE_IN" && (tableNumber === "TAKEAWAY" || selectedTable === "TAKEAWAY") ? (
                  <button
                    onClick={() => setShowTableModal(true)}
                    className="w-full py-3.5 bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] font-heading font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    <Utensils size={16} />
                    <span>CHOOSE FREE TABLE & ORDER • ₹{grandTotal}</span>
                    <ArrowRight size={16} />
                  </button>
                ) : activeTableOrder ? (
                  <div className="flex flex-col gap-2">
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-[11px] text-amber-900 font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping shrink-0" />
                      <span>
                        Adding items to active dining order for <strong>{tableNumber}</strong> (<strong>#{activeTableOrder.orderNumber}</strong>). Items will be consolidated into your single table bill.
                      </span>
                    </div>
                    <button
                      disabled={isPlacingOrder}
                      onClick={() => {
                        setSelectedTable(tableNumber || "A1");
                        setShowConfirmModal(true);
                      }}
                      className="w-full py-3.5 bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] font-heading font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isPlacingOrder ? (
                        <span>ADDING TO ORDER...</span>
                      ) : (
                        <>
                          <span>ADD TO TABLE {tableNumber.replace(/^Table\s*/i, "")} ORDER • ₹{grandTotal}</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const activeT = (tableNumber || selectedTable || "A1").replace(/^Table\s*/i, "");
                      setSelectedTable(activeT);
                      setShowConfirmModal(true);
                    }}
                    className="w-full py-3.5 bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] font-heading font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>
                      {orderServingMode === "TAKEAWAY"
                        ? `PLACE TAKE AWAY ORDER • ₹${grandTotal}`
                        : `PLACE ORDER AT TABLE ${(tableNumber || selectedTable || "A1").replace(/^Table\s*/i, "")} • ₹${grandTotal}`}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Placed Orders */}
        {activeSheetTab === "orders" && (() => {
          const sortedOrders = [...placedOrders]
            .filter((o) => o.status !== "CANCELLED" && o.paymentStatus !== "PAID")
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          const acceptedOrders = sortedOrders.filter(
            (o) =>
              o.status === "PREPARING" ||
              o.status === "READY" ||
              o.status === "COMPLETED" ||
              (o.notes || "").includes("[KOT_CONFIRMED")
          );
          const pendingOrders = sortedOrders.filter(
            (o) =>
              o.status === "PENDING" && !(o.notes || "").includes("[KOT_CONFIRMED")
          );

          const acceptedTotal = acceptedOrders.reduce((sum, o) => sum + o.grandTotal, 0);
          const pendingTotal = pendingOrders.reduce((sum, o) => sum + o.grandTotal, 0);
          const combinedVisitTotal = acceptedTotal + pendingTotal;

          return (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 flex flex-col gap-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-[#8C5E51] uppercase tracking-wider">
                  Dining Orders ({sortedOrders.length})
                </span>
                <button
                  onClick={async () => {
                    await notifyAddingFood(true);
                    setIsCartOpen(false);
                  }}
                  className="text-xs font-bold text-[#B73F1D] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>+ ADD MORE FOOD</span>
                </button>
              </div>

              {sortedOrders.length > 0 && (
                <div className="p-4 bg-white rounded-3xl border border-[#EBDAD0] shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-[#8C5E51] uppercase tracking-wider">
                      {acceptedTotal > 0 ? `CURRENT TABLE BILL (${tableNumber})` : `PENDING ORDER (${tableNumber})`}
                    </div>
                    <div className="text-[11px] text-[#8C5E51] font-medium">
                      {acceptedTotal > 0 && pendingTotal > 0 ? (
                        <span>
                          Accepted: ₹{acceptedTotal} • Pending: ₹{pendingTotal}
                        </span>
                      ) : acceptedTotal > 0 ? (
                        "All accepted orders combined"
                      ) : (
                        "Awaiting counter KOT approval"
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-heading font-extrabold text-2xl text-[#B73F1D]">
                      ₹{acceptedTotal > 0 ? acceptedTotal : pendingTotal}
                    </div>
                    {acceptedTotal > 0 && pendingTotal > 0 && (
                      <div className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mt-0.5 inline-block">
                        +₹{pendingTotal} pending
                      </div>
                    )}
                  </div>
                </div>
              )}

              {sortedOrders.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-[#EBDAD0]/50 flex items-center justify-center text-[#B73F1D] mb-3">
                    <Utensils size={28} />
                  </div>
                  <h3 className="font-heading font-bold text-base text-[#4A2117]">
                    No orders placed yet
                  </h3>
                  <p className="text-xs text-[#8C5E51] mt-1 max-w-xs">
                    Your placed orders for {tableNumber} will appear here with live kitchen status updates.
                  </p>
                  <button
                    onClick={() => setActiveSheetTab("cart")}
                    className="mt-5 px-5 py-2 bg-[#B73F1D] text-cream font-heading font-bold text-xs rounded-full shadow-sm"
                  >
                    View Basket
                  </button>
                </div>
              ) : (
                sortedOrders.map((order) => {
                  const isPending = order.status === "PENDING";
                  const isPreparing = order.status === "PREPARING";
                  const isReady = order.status === "READY";
                  const isCompleted = order.status === "COMPLETED";
                  const isKotSent =
                    isPreparing ||
                    isReady ||
                    isCompleted ||
                    (order.notes || "").includes("[KOT_CONFIRMED");

                  const timeFormatted = new Date(order.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={order.id}
                      className="p-4 bg-white rounded-3xl border border-[#EBDAD0] shadow-sm flex flex-col gap-3.5"
                    >
                      {/* Header line */}
                      <div className="flex items-start justify-between border-b border-[#EBDAD0]/70 pb-2.5">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5">
                            {isKotSent || isCompleted ? (
                              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full">
                                ACCEPTED & COOKING
                              </span>
                            ) : (
                              <span className="text-amber-800 font-extrabold bg-amber-50 px-2 py-0.5 rounded-full">
                                SAVED IN CLOUD (AWAITING REVIEW)
                              </span>
                            )}
                          </div>
                          <h4 className="font-heading font-extrabold text-base text-[#4A2117] mt-1">
                            #{order.orderNumber}
                          </h4>
                          <div className="text-[11px] text-[#8C5E51] font-medium flex items-center gap-2 mt-0.5">
                            <span>{order.tableNumber}</span>
                            <span>•</span>
                            <span>{timeFormatted}</span>
                            {((order.notes || "").includes("[TAKEAWAY]") ||
                              (order.notes || "").includes("[PARCEL]") ||
                              order.tableNumber === "TAKEAWAY") ? (
                              <>
                                <span>•</span>
                                <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-full text-[10px]">
                                  🛍️ Take Away (Parcel)
                                </span>
                              </>
                            ) : (
                              <>
                                <span>•</span>
                                <span className="font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full text-[10px]">
                                  🍽️ Dine-In Table
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                      {/* Status Badge */}
                      <div>
                        {!isKotSent && !isCompleted && order.status !== "CANCELLED" && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-extrabold flex items-center gap-1 shadow-xs">
                            <Clock size={12} /> {order.items.some(i => (i.round || 1) > 1) ? "ADD-ON PENDING" : "SAVED — AWAITING REVIEW"}
                          </span>
                        )}
                        {isKotSent && !isCompleted && order.status !== "CANCELLED" && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-extrabold flex items-center gap-1 shadow-sm">
                            <Flame size={12} /> ACCEPTED & COOKING
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-800 border border-gray-300 rounded-full text-xs font-extrabold flex items-center gap-1">
                            <CheckCircle2 size={12} /> COMPLETED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Items List Grouped by Round */}
                    {(() => {
                      const roundsMap: { [round: number]: typeof order.items } = {};
                      order.items.forEach((it) => {
                        const r = it.round || 1;
                        if (!roundsMap[r]) roundsMap[r] = [];
                        roundsMap[r].push(it);
                      });
                      const roundKeys = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);
                      const latestRound = roundKeys.length > 0 ? Math.max(...roundKeys) : 1;

                      return (
                        <div className="flex flex-col gap-2.5 py-1">
                          {roundKeys.map((rnd) => {
                            const isPastRound = rnd < latestRound;
                            let roundStatusLabel = "Sent to Kitchen";
                            if (isPastRound || order.status === "COMPLETED") {
                              roundStatusLabel = "Served";
                            } else if (order.status === "READY") {
                              roundStatusLabel = "Ready to Serve";
                            } else if (order.status === "PREPARING") {
                              roundStatusLabel = "Cooking";
                            }

                            return (
                              <div key={rnd} className="flex flex-col gap-1.5">
                                {roundKeys.length > 1 && (
                                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#8C5E51] bg-[#F7EFE9] px-2.5 py-1 rounded-lg">
                                    <span>{rnd === 1 ? "Round 1 (Initial Order)" : `Round ${rnd} (Add-on)`}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                          isPastRound || order.status === "COMPLETED"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : order.status === "PREPARING"
                                            ? "bg-blue-100 text-blue-800 animate-pulse"
                                            : "bg-amber-100 text-amber-800"
                                        }`}
                                      >
                                        {roundStatusLabel}
                                      </span>
                                      <span>{roundsMap[rnd].length} items</span>
                                    </div>
                                  </div>
                                )}
                                {roundsMap[rnd].map((it) => {
                                  const cleanNote = (it.notes || "").replace(/\[ROUND:\d+\]/g, "").trim();
                                  return (
                                    <div key={it.id} className="flex justify-between items-center text-xs">
                                      <div className="flex flex-col">
                                        <span className="text-[#4A2117] font-semibold">
                                          {it.name} <strong className="text-[#B73F1D]">×{it.quantity}</strong>
                                        </span>
                                        {cleanNote && (
                                          <span className="text-[10px] text-[#8C5E51] italic">{cleanNote}</span>
                                        )}
                                      </div>
                                      <span className="text-[#8C5E51] font-bold">₹{it.lineTotal}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    <div className="flex justify-between items-center pt-2 border-t border-[#EBDAD0]/60 text-xs">
                      <span className="text-[#8C5E51] font-semibold">TOTAL BILL</span>
                      <span className="font-heading font-extrabold text-sm text-[#B73F1D]">
                        ₹{order.grandTotal}
                      </span>
                    </div>

                    {/* Vertical Progress Tracker */}
                    <div className="p-3.5 bg-[#FFF8F3] rounded-2xl border border-[#EBDAD0] mt-1">
                      <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live Order Progress
                      </div>

                      <div className={`flex flex-col gap-3.5 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 ${
                        isKotSent ? "before:bg-emerald-500" : "before:bg-[#EBDAD0]"
                      }`}>
                        {/* State 1: Order Received (always green tick) */}
                        <div className="relative">
                          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs bg-emerald-600 text-white">
                            ✓
                          </div>
                          <div className="font-heading font-bold text-xs text-emerald-950">
                            ORDER SAVED IN CLOUD
                          </div>
                          <p className="text-[11px] text-[#8C5E51]">
                            {isKotSent
                              ? "Order received & approved by counter team."
                              : "Order securely saved in cloud. Awaiting counter review & kitchen dispatch."}
                          </p>
                        </div>

                        {/* State 2: Started to Cooking (Ticked when admin accepts order & sends KOT!) */}
                        <div className="relative">
                          <div
                            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs transition-colors ${
                              isKotSent
                                ? "bg-emerald-600 text-white shadow-emerald-200"
                                : "bg-[#EBDAD0] text-[#8C5E51]"
                            }`}
                          >
                            {isKotSent ? "✓" : "2"}
                          </div>
                          <div
                            className={`font-heading font-bold text-xs ${
                              isKotSent ? "text-emerald-800 font-extrabold" : "text-[#4A2117]"
                            }`}
                          >
                            ACCEPTED & COOKING
                          </div>
                          <p className="text-[11px] text-[#8C5E51]">
                            {isKotSent
                              ? "KOT printed in kitchen. Chef has started preparing your order!"
                              : "Order will enter kitchen queue once confirmed by counter."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* PAYMENT SECTION - Persists until Order is fully PAID */}
                    <div className="mt-1 pt-3 border-t border-[#EBDAD0]">
                      {/* Notice / Cancellation banner if online payment was closed or failed */}
                      {paymentNotice[order.id] && order.paymentStatus !== "PAID" && (
                        <div
                          className={`mb-3 p-3 rounded-2xl text-xs font-medium flex items-start gap-2 shadow-xs ${
                            paymentNotice[order.id].type === "cancelled"
                              ? "bg-amber-50 border border-amber-200 text-amber-900"
                              : paymentNotice[order.id].type === "info"
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                              : "bg-red-50 border border-red-200 text-red-800"
                          }`}
                        >
                          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-700" />
                          <div className="flex-1">
                            <span className="font-bold block mb-0.5">
                              {paymentNotice[order.id].type === "cancelled"
                                ? "Payment Cancelled / Incomplete"
                                : paymentNotice[order.id].type === "info"
                                ? "Payment Notice"
                                : "Payment Failed"}
                            </span>
                            <span>{paymentNotice[order.id].message}</span>
                          </div>
                          <button
                            onClick={() => {
                              setPaymentNotice((prev) => {
                                const next = { ...prev };
                                delete next[order.id];
                                return next;
                              });
                            }}
                            className="text-[#8C5E51] hover:text-[#4A2117] p-0.5 cursor-pointer"
                            aria-label="Dismiss notice"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {/* State 1: Cancelled Order */}
                      {order.status === "CANCELLED" && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-center text-xs text-red-700 font-bold">
                          Order Cancelled
                        </div>
                      )}

                      {/* State 2: PAID (Confirmed receipt) */}
                      {order.paymentStatus === "PAID" && (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
                          <div className="flex items-center gap-2.5 text-emerald-800">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                              <CheckCircle2 size={18} />
                            </div>
                            <div>
                              <div className="font-heading font-extrabold text-xs text-emerald-900">
                                Payment Received • PAID (₹{order.grandTotal})
                              </div>
                              <p className="text-[11px] text-emerald-700 font-medium">
                                Paid via {order.paymentMethod === "CASH" ? "Cash at Counter" : "Online Gateway"}. Thank you!
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* State 3: PENDING_CASH (Cash on delivery / counter selected) */}
                      {order.status !== "CANCELLED" && order.paymentStatus === "PENDING_CASH" && (
                        <div className="p-3.5 bg-[#FFFBF7] border border-[#CA340A]/30 rounded-2xl flex flex-col gap-2.5 shadow-xs">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#CA340A]/10 flex items-center justify-center text-[#CA340A] shrink-0 mt-0.5">
                              <Banknote size={17} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="font-heading font-extrabold text-xs text-amber-950 uppercase tracking-wide">
                                  Pay at Counter Selected
                                </div>
                                <span className="font-heading font-extrabold text-xs text-[#CA340A]">
                                  ₹{order.grandTotal}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#8C5E51] mt-0.5 leading-relaxed">
                                Please pay <strong className="text-[#4A2117]">₹{order.grandTotal}</strong> via Cash or UPI at the counter when settling your order.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* State 4: UNPAID ticket balance */}
                      {order.status !== "CANCELLED" && order.paymentStatus !== "PAID" && order.paymentStatus !== "PENDING_CASH" && (
                        <div className="p-3 bg-[#FFF9F5] border border-[#EBDAD0] rounded-2xl flex items-center justify-between text-xs shadow-xs">
                          <div className="flex items-center gap-2 text-[#4A2117] font-semibold">
                            <Banknote size={15} className="text-[#CA340A]" />
                            <span>Ticket #{order.orderNumber} Balance</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-extrabold text-sm text-[#CA340A]">
                              ₹{order.grandTotal}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                              Unpaid
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
                })
              )}

              {/* UNIFIED VISIT SETTLEMENT BAR (Single Pay at Counter Button for All Orders) */}
              {sortedOrders.length > 0 && (() => {
                const unpaidOrders = sortedOrders.filter(
                  (o) => o.status !== "CANCELLED" && o.paymentStatus !== "PAID"
                );
                const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + o.grandTotal, 0);
                const allCashPending = unpaidOrders.length > 0 && unpaidOrders.every((o) => o.paymentStatus === "PENDING_CASH");
                const allPaid = sortedOrders.every((o) => o.paymentStatus === "PAID" || o.status === "CANCELLED");

                if (allPaid) {
                  return (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-3xl text-center flex flex-col items-center gap-2 shadow-xs mt-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 size={22} />
                      </div>
                      <div className="font-heading font-extrabold text-sm text-emerald-900">
                        All Orders Fully Settled
                      </div>
                      <p className="text-xs text-emerald-700">
                        Thank you for dining with Spiral Cafe! Have a wonderful day.
                      </p>
                    </div>
                  );
                }

                if (unpaidTotal > 0) {
                  return (
                    <div className="sticky bottom-0 z-10 p-4 bg-white/95 backdrop-blur-md rounded-3xl border-2 border-[#CA340A]/20 shadow-[0_-10px_25px_rgba(74,33,23,0.08)] flex flex-col gap-3 mt-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-bold text-[#8C5E51] uppercase tracking-wider">
                            Total Visit Bill ({unpaidOrders.length} {unpaidOrders.length > 1 ? "Orders" : "Order"})
                          </div>
                          <div className="text-[11px] text-[#4A2117] font-medium">
                            {tableNumber === "TAKEAWAY"
                              ? "Take Away Counter Order"
                              : `Table ${tableNumber.replace(/^Table\s*/i, "")} Visit Balance`}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#8C5E51] block uppercase font-bold">Total Payable</span>
                          <span className="font-heading font-extrabold text-2xl text-[#CA340A]">
                            ₹{unpaidTotal}
                          </span>
                        </div>
                      </div>

                      {allCashPending ? (
                        <div className="p-3 bg-[#FFFBF7] border border-[#CA340A]/30 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#CA340A]/10 text-[#CA340A] flex items-center justify-center shrink-0">
                              <Banknote size={18} />
                            </div>
                            <div>
                              <div className="font-heading font-extrabold text-xs text-[#4A2117] uppercase">
                                Pay at Counter Selected (₹{unpaidTotal})
                              </div>
                              <p className="text-[11px] text-[#8C5E51]">
                                Please pay ₹{unpaidTotal} at the counter via Cash or UPI when settling your visit.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          disabled={isPayingAllCash}
                          onClick={async () => {
                            setIsPayingAllCash(true);
                            const unpaidIds = unpaidOrders.map((o) => o.id);
                            await batchSelectCashPayment(unpaidIds);
                            setIsPayingAllCash(false);
                          }}
                          className="w-full py-3.5 px-4 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                        >
                          {isPayingAllCash ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>REQUESTING CASH SETTLEMENT...</span>
                            </>
                          ) : (
                            <>
                              <Banknote size={17} />
                              <span>PAY AT COUNTER (₹{unpaidTotal})</span>
                            </>
                          )}
                        </button>
                      )}

                      <div className="text-[10px] text-center text-[#8C5E51] font-medium">
                        Pay via Cash or UPI directly at the cafe counter when settling your bill
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          );
        })()}
      </motion.div>

      {/* 1-15 Table Selection Modal */}
      <AnimatePresence>
        {showTableModal && (
          <div className="fixed inset-0 z-60 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-sm sm:max-w-md bg-[#FFF8F3] rounded-3xl p-5 border border-[#EBDAD0] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#EBDAD0]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-[#B73F1D]/10 text-[#B73F1D] flex items-center justify-center shrink-0">
                    <Utensils size={18} />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-[#4A2117]">
                      CHOOSE YOUR TABLE
                    </h3>
                    <p className="text-[11px] text-[#8C5E51] font-medium">
                      Select your floor table to confirm order
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTableModal(false)}
                  className="w-8 h-8 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close table picker"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Floor Tables Grid with 5-Color System */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 my-4 overflow-y-auto max-h-[46vh] p-1">
                {availableTables.map((t) => {
                  const isSelected = (selectedTable || tableNumber) === t;
                  const item = overviewTables.find((o) => o.tableNumber === t);
                  const color = item?.color || "WHITE";

                  const isOccupied = color === "RED" || color === "YELLOW" || color === "GREEN";
                  const isReservedOther = color === "BLUE" && !isSelected && tableReservation?.tableNumber !== t;
                  const isMyReservation = (color === "BLUE" && (isSelected || tableReservation?.tableNumber === t)) || (isSelected && !isOccupied);

                  return (
                    <button
                      key={t}
                      disabled={isOccupied || isReservedOther}
                      onClick={() => handleSelectTable(t)}
                      className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border active:scale-95 ${
                        isOccupied
                          ? "bg-zinc-100/80 text-zinc-400 border-zinc-200 cursor-not-allowed opacity-60 filter blur-[0.3px]"
                          : isReservedOther
                          ? "bg-blue-50/70 text-blue-400 border-blue-200 cursor-not-allowed opacity-75"
                          : isMyReservation
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/40"
                          : "bg-white text-[#4A2117] border-[#EBDAD0] hover:border-[#CA340A] hover:bg-amber-50/40 shadow-xs"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        Table
                      </span>
                      <span className="font-heading font-extrabold text-lg sm:text-xl leading-tight mt-0.5">
                        {t}
                      </span>
                      {isOccupied ? (
                        <span className="text-[9px] font-bold text-zinc-500 mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                          Occupied
                        </span>
                      ) : isReservedOther ? (
                        <span className="text-[9px] font-bold text-blue-700 mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Reserved
                        </span>
                      ) : isMyReservation ? (
                        <span className="text-[9px] font-bold text-white mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                          Your Table
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-600 font-bold mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                          Available
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend & Counter Warning */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-3 pb-1 border-t border-[#EBDAD0] text-[11px] font-bold text-[#8C5E51]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 border border-zinc-400"></span>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span>Reserved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-400"></span>
                  <span>Occupied</span>
                </div>
              </div>

              <div className="text-[11px] text-center text-amber-900 bg-amber-50 rounded-xl p-2 border border-amber-200 font-semibold my-2">
                ⚠️ If your table shows occupied, please contact the counter.
              </div>

              {/* Footer */}
              <div className="pt-2.5 border-t border-[#EBDAD0] flex items-center justify-between text-xs text-[#8C5E51]">
                <span>
                  Currently selected:{" "}
                  <strong className="text-[#B73F1D]">
                    {(selectedTable || tableNumber || "A1").startsWith("Table ")
                      ? (selectedTable || tableNumber || "A1")
                      : `Table ${selectedTable || tableNumber || "A1"}`}
                  </strong>
                </span>
                <button
                  onClick={() => setShowTableModal(false)}
                  className="text-xs font-bold text-[#8C5E51] hover:text-[#4A2117] px-2 py-1 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Order Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-60 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-sm sm:max-w-md bg-[#FFF8F3] rounded-3xl p-5 border border-[#EBDAD0] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#EBDAD0]">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                    orderServingMode === "TAKEAWAY" ? "bg-amber-100 text-amber-800" : "bg-[#B73F1D]/10 text-[#B73F1D]"
                  }`}>
                    {orderServingMode === "TAKEAWAY" ? <ShoppingBag size={18} /> : <Utensils size={18} />}
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-[#4A2117]">
                      {orderServingMode === "TAKEAWAY" ? "CONFIRM TAKE AWAY (PARCEL)" : "Confirm Your Table"}
                    </h3>
                    <p className="text-[11px] text-[#8C5E51] font-medium">
                      {orderServingMode === "TAKEAWAY"
                        ? tableNumber && tableNumber !== "TAKEAWAY"
                          ? `Packaged for takeaway • Billed with Table ${tableNumber.replace(/^Table\s*/i, "")}`
                          : "Packaged for takeaway • Counter pickup"
                        : `You're sitting at Table ${(selectedTable || tableNumber || "A1").replace(/^Table\s*/i, "")}, right?`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-8 h-8 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close confirmation"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Selected Table Card */}
              {orderServingMode !== "TAKEAWAY" && (
                <div className="my-3 p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/90 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#B73F1D] text-white flex items-center justify-center font-heading font-extrabold text-base shadow-sm">
                        {(selectedTable || tableNumber || "A1").replace(/^Table\s*/i, "")}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#8C5E51] uppercase tracking-wider">
                          Assigned Table
                        </div>
                        <div className="font-heading font-black text-sm text-[#4A2117]">
                          Table {(selectedTable || tableNumber || "A1").replace(/^Table\s*/i, "")}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowContactCounterModal(true)}
                      className="text-xs font-bold text-[#B73F1D] hover:underline px-2.5 py-1.5 rounded-xl hover:bg-white border border-[#B73F1D]/20 cursor-pointer"
                    >
                      Change Table?
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8C5E51] leading-relaxed pt-1 border-t border-amber-200/60">
                    Your order will be sent to Table {(selectedTable || tableNumber || "A1").replace(/^Table\s*/i, "")}. Kindly remain at the same table while we prepare and serve your food.
                  </p>
                </div>
              )}

              {/* Items List */}
              <div className="text-[11px] font-bold text-[#8C5E51] uppercase tracking-wider mb-1 px-1">
                Order Items ({totalItems})
              </div>
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 max-h-[24vh]">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-white/90 rounded-xl border border-[#EBDAD0]/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-muted">
                        <Image src={item.image} alt={item.name} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#4A2117] truncate">{item.name}</div>
                        <div className="text-[11px] text-[#8C5E51]">
                          ₹{item.price} × {item.quantity}
                        </div>
                      </div>
                    </div>
                    <span className="font-extrabold text-[#B73F1D] shrink-0">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>
                ))}
              </div>

              {/* Kitchen Request Notes */}
              <div className="mt-2.5 mb-2">
                <label className="text-[11px] font-bold text-[#8C5E51] mb-1 block">
                  Kitchen Instructions (Optional):
                </label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Less spicy, extra sauce, serve hot..."
                  rows={2}
                  className="w-full p-2 bg-white border border-[#EBDAD0] rounded-xl text-xs text-[#4A2117] focus:outline-none focus:ring-1 focus:ring-[#B73F1D] resize-none"
                />
              </div>

              {/* Bill Summary */}
              <div className="bg-white p-3 rounded-2xl border border-[#EBDAD0] text-xs flex flex-col gap-1 mb-3">
                <div className="flex justify-between text-[#8C5E51]">
                  <span>Item Subtotal</span>
                  <span className="font-bold text-[#4A2117]">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-[#8C5E51]">
                  <span>GST ({taxPercentage}%)</span>
                  <span className="font-bold text-[#4A2117]">₹{tax}</span>
                </div>
                {packagingFee > 0 && (
                  <div className="flex justify-between text-[#8C5E51]">
                    <span>Packaging Fee</span>
                    <span className="font-bold text-[#4A2117]">₹{packagingFee}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-[#B73F1D] pt-1 border-t border-[#EBDAD0]">
                  <span>Grand Total</span>
                  <span>₹{grandTotal}</span>
                </div>
              </div>

              {orderError && (
                <div className="mb-2 p-2 bg-red-100 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                  {orderError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  disabled={isPlacingOrder}
                  onClick={handleFinalConfirmOrder}
                  className="w-full py-3.5 bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] font-heading font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isPlacingOrder ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>PLACING ORDER...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {orderServingMode === "TAKEAWAY"
                          ? `Yes, Confirm Take Away Order • ₹${grandTotal}`
                          : `Yes, Place Order • ₹${grandTotal}`}
                      </span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-2.5 text-center text-xs font-bold text-[#8C5E51] hover:text-[#4A2117] bg-white border border-[#EBDAD0] hover:bg-[#FFF8F3] rounded-xl transition-colors cursor-pointer"
                >
                  Go Back
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contact Counter Notice Modal */}
      <AnimatePresence>
        {showContactCounterModal && (
          <div className="fixed inset-0 z-70 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-sm bg-[#FFF8F3] rounded-3xl p-5 border border-[#EBDAD0] shadow-2xl space-y-4 text-center relative"
            >
              <button
                type="button"
                onClick={() => setShowContactCounterModal(false)}
                className="absolute right-4 top-4 w-7 h-7 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={15} />
              </button>

              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                <Utensils size={24} />
              </div>

              <div className="space-y-1">
                <h3 className="font-heading font-extrabold text-base text-[#4A2117]">
                  Want to Change Your Table?
                </h3>
                <p className="text-xs text-[#8C5E51]">
                  You are currently assigned to{" "}
                  <strong className="text-[#CA340A]">
                    Table {(selectedTable || tableNumber || "A1").replace(/^Table\s*/i, "")}
                  </strong>
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-[#EBDAD0] text-xs text-[#6B5E55] leading-relaxed text-left space-y-2">
                <p className="font-semibold text-[#4A2117]">
                  Please reach out to the café counter staff.
                </p>
                <p className="text-[11px] text-[#8C5E51]">
                  Our team will check live table availability and transfer your table session directly from our counter system. All your food selections, orders, and table details will be preserved seamlessly!
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowContactCounterModal(false)}
                className="w-full py-3 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Got It • Return to Order
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Order Placement Success Modal */}
      <OrderSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        orderNumber={successModalOrder?.orderNumber}
        tableNumber={successModalOrder?.tableNumber || selectedTable || tableNumber}
        totalAmount={successModalOrder?.grandTotal ?? grandTotal}
      />
    </div>
  );
}
