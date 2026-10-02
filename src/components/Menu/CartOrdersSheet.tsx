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

const TABLES = Array.from({ length: 15 }, (_, i) => `Table ${String(i + 1).padStart(2, "0")}`);

export default function CartOrdersSheet() {
  const {
    isCartOpen,
    setIsCartOpen,
    activeSheetTab,
    setActiveSheetTab,
    cart,
    tableNumber,
    setTableNumber,
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
    selectCashPayment,
    switchPaymentMethod,
    processOnlinePayment,
  } = useCart();

  const [orderNotes, setOrderNotes] = useState("");
  const [showTableModal, setShowTableModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(tableNumber || "Table 01");
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{
    [orderId: string]: { type: "info" | "error" | "cancelled"; message: string };
  }>({});
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (tableNumber) {
      setSelectedTable(tableNumber);
    }
  }, [tableNumber]);

  if (!isCartOpen) return null;

  const handleSelectTable = (table: string) => {
    setTableNumber(table);
    setSelectedTable(table);
    setShowTableModal(false);
    // As requested: "by clicking that the table number have to show from 1-15 by clicking that the confirm order have to open"
    if (cart.length > 0) {
      setShowConfirmModal(true);
    }
  };

  const handleFinalConfirmOrder = async () => {
    setOrderError(null);
    const targetTable = selectedTable || tableNumber || "Table 01";
    const res = await placeOrder(orderNotes, targetTable);
    if (!res.success) {
      setOrderError(res.error || "Failed to place order.");
    } else {
      setShowConfirmModal(false);
      setOrderNotes("");
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
              <span>Dining at</span>
              <button
                onClick={() => {
                  setSelectedTable(tableNumber || "Table 01");
                  setShowTableModal(true);
                }}
                className="font-bold text-[#B73F1D] underline inline-flex items-center gap-1 cursor-pointer hover:text-[#9D3E22]"
                title="Tap to change table (1-15)"
              >
                <span>{tableNumber}</span>
                <Edit2 size={11} />
              </button>
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
          <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col justify-between">
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

                <button
                  onClick={() => {
                    setSelectedTable(tableNumber || "Table 01");
                    setShowTableModal(true);
                  }}
                  className="w-full py-3.5 bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] font-heading font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <span>CHOOSE TABLE &amp; PLACE ORDER • ₹{grandTotal}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Placed Orders */}
        {activeSheetTab === "orders" && (
          <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-[#8C5E51] uppercase tracking-wider">
                My Placed Orders ({placedOrders.length})
              </span>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-xs font-bold text-[#B73F1D] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>+ ADD MORE FOOD</span>
              </button>
            </div>

            {placedOrders.length === 0 ? (
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
              placedOrders.map((order) => {
                const isPending = order.status === "PENDING";
                const isPreparing = order.status === "PREPARING";
                const isReady = order.status === "READY";
                const isCompleted = order.status === "COMPLETED";

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
                        <div className="text-[10px] text-[#8C5E51] font-bold uppercase tracking-wider">
                          ORDER TICKET
                        </div>
                        <h4 className="font-heading font-extrabold text-base text-[#4A2117]">
                          #{order.orderNumber}
                        </h4>
                        <div className="text-[11px] text-[#8C5E51] font-medium flex items-center gap-2 mt-0.5">
                          <span>{order.tableNumber}</span>
                          <span>•</span>
                          <span>{timeFormatted}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isPending && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-extrabold flex items-center gap-1">
                            <Clock size={12} /> PENDING
                          </span>
                        )}
                        {isPreparing && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded-full text-xs font-extrabold flex items-center gap-1 animate-pulse">
                            <Flame size={12} /> IN THE KITCHEN
                          </span>
                        )}
                        {isReady && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-extrabold flex items-center gap-1 shadow-sm">
                            <Sparkles size={12} /> READY FOR DINE-IN
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-800 border border-gray-300 rounded-full text-xs font-extrabold flex items-center gap-1">
                            <CheckCircle2 size={12} /> COMPLETED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="flex flex-col gap-1.5 py-1">
                      {order.items.map((it) => (
                        <div key={it.id} className="flex justify-between items-center text-xs">
                          <span className="text-[#4A2117] font-semibold">
                            {it.name} <strong className="text-[#B73F1D]">×{it.quantity}</strong>
                          </span>
                          <span className="text-[#8C5E51] font-bold">₹{it.lineTotal}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-[#EBDAD0]/60 text-xs">
                      <span className="text-[#8C5E51] font-semibold">TOTAL BILL</span>
                      <span className="font-heading font-extrabold text-sm text-[#B73F1D]">
                        ₹{order.grandTotal}
                      </span>
                    </div>

                    {/* Vertical Progress Tracker */}
                    <div className="p-3.5 bg-[#FFF8F3] rounded-2xl border border-[#EBDAD0] mt-1">
                      <div className="text-[11px] font-bold text-[#8C5E51] uppercase tracking-wider mb-2.5">
                        Live Order Progress
                      </div>

                      <div className="flex flex-col gap-3 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2C7BA]">
                        {/* State 1 */}
                        <div className="relative">
                          <div
                            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isPending || isPreparing || isReady || isCompleted
                                ? "bg-[#B73F1D] text-cream"
                                : "bg-[#E2C7BA] text-[#4A2117]"
                            }`}
                          >
                            ✓
                          </div>
                          <div className="font-heading font-bold text-xs text-[#4A2117]">
                            ORDER RECEIVED
                          </div>
                          <p className="text-[11px] text-[#8C5E51]">
                            Sent to the kitchen, waiting to prepare.
                          </p>
                        </div>

                        {/* State 2 */}
                        <div className="relative">
                          <div
                            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isPreparing || isReady || isCompleted
                                ? "bg-[#B73F1D] text-cream"
                                : "bg-[#E2C7BA] text-[#8C5E51]"
                            }`}
                          >
                            {isPreparing ? "…" : isReady || isCompleted ? "✓" : "2"}
                          </div>
                          <div
                            className={`font-heading font-bold text-xs ${
                              isPreparing ? "text-[#B73F1D]" : "text-[#4A2117]"
                            }`}
                          >
                            IN THE KITCHEN
                          </div>
                          <p className="text-[11px] text-[#8C5E51]">
                            Chef is preparing your fresh meal.
                          </p>
                        </div>

                        {/* State 3 */}
                        <div className="relative">
                          <div
                            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isReady || isCompleted
                                ? "bg-emerald-600 text-white"
                                : "bg-[#E2C7BA] text-[#8C5E51]"
                            }`}
                          >
                            {isReady || isCompleted ? "★" : "3"}
                          </div>
                          <div
                            className={`font-heading font-bold text-xs ${
                              isReady ? "text-emerald-700" : "text-[#4A2117]"
                            }`}
                          >
                            READY FOR DINE-IN
                          </div>
                          <p className="text-[11px] text-[#8C5E51]">
                            Your order is ready. Please enjoy your meal!
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

                      {/* State 3: PENDING_CASH (Cash on delivery / counter selected, with instant option to pay online) */}
                      {order.status !== "CANCELLED" && order.paymentStatus === "PENDING_CASH" && (
                        <div className="p-3.5 bg-[#FFFBF7] border border-amber-300 rounded-2xl flex flex-col gap-2.5 shadow-xs">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                              <Banknote size={17} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="font-heading font-extrabold text-xs text-amber-950 uppercase tracking-wide">
                                  Cash on Delivery / Counter Selected
                                </div>
                                <span className="font-heading font-extrabold text-xs text-[#B73F1D]">
                                  ₹{order.grandTotal}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#8C5E51] mt-0.5 leading-relaxed">
                                Please pay <strong className="text-[#4A2117]">₹{order.grandTotal}</strong> in cash to your server or at the cashier counter.
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#EBDAD0]/70 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-[#8C5E51] font-medium">Need to pay online instead?</span>
                            <button
                              disabled={payingOrderId === order.id}
                              onClick={() => handleSwitchToOnline(order)}
                              className="py-1.5 px-3 bg-[#B73F1D] text-cream hover:bg-[#9D3E22] font-heading font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                            >
                              {payingOrderId === order.id ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  <span>OPENING...</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard size={13} />
                                  <span>PAY ONLINE (₹{order.grandTotal})</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* State 4A: UNPAID & Food Still Preparing (Payment locked until food is Ready) */}
                      {order.status !== "CANCELLED" && order.paymentStatus !== "PAID" && !isReady && !isCompleted && (
                        <div className="p-3.5 bg-[#FFF9F5] border border-[#EBDAD0] rounded-2xl flex flex-col gap-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[#4A2117] font-heading font-extrabold text-xs">
                              <Utensils size={14} className="text-[#B73F1D]" />
                              <span>PAYMENT OPENS WHEN FOOD IS READY</span>
                            </div>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300/70 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                              DINE-IN
                            </span>
                          </div>

                          <p className="text-[11px] text-[#8C5E51] leading-relaxed">
                            Your food is being freshly prepared in the kitchen. Payment options (Online UPI / Cards or Cash) will unlock automatically as soon as your order is <strong className="text-[#B73F1D]">Ready for Dine-In</strong>.
                          </p>

                          <div className="flex items-center justify-between pt-2 border-t border-[#EBDAD0]/60 text-[11px]">
                            <span className="text-[#8C5E51] font-semibold">Bill Amount:</span>
                            <span className="font-heading font-black text-sm text-[#B73F1D]">₹{order.grandTotal}</span>
                          </div>
                        </div>
                      )}

                      {/* State 4B: UNPAID & Food IS READY FOR DINE-IN -> Payment options unlocked */}
                      {order.status !== "CANCELLED" && order.paymentStatus !== "PAID" && order.paymentStatus !== "PENDING_CASH" && (isReady || isCompleted) && (
                        <div className="p-3.5 bg-gradient-to-br from-[#FFF9F5] to-white border-2 border-emerald-500/40 rounded-2xl flex flex-col gap-2.5 shadow-md animate-in fade-in-50 duration-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-emerald-950 font-heading font-extrabold text-xs">
                              <Sparkles size={14} className="text-emerald-600" />
                              <span>FOOD IS READY • CHOOSE PAYMENT METHOD</span>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                              PAY NOW
                            </span>
                          </div>

                          <p className="text-[11px] text-[#8C5E51]">
                            Your order is ready! Select how you would like to pay for Ticket #{order.orderNumber}:
                          </p>

                          <div className="grid grid-cols-2 gap-2 mt-0.5">
                            <button
                              disabled={payingOrderId === order.id}
                              onClick={() => handlePayOnline(order)}
                              className="py-2.5 px-3 bg-[#B73F1D] text-cream hover:bg-[#9D3E22] font-heading font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                            >
                              {payingOrderId === order.id ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>OPENING RAZORPAY...</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard size={14} />
                                  <span>PAY ONLINE (₹{order.grandTotal})</span>
                                </>
                              )}
                            </button>

                            <button
                              disabled={payingOrderId === order.id}
                              onClick={() => handleSelectCash(order.id)}
                              className="py-2.5 px-3 bg-white text-[#4A2117] border border-[#EBDAD0] hover:bg-[#F7ECE4] font-heading font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                            >
                              <Banknote size={14} />
                              <span>PAY CASH</span>
                            </button>
                          </div>

                          <div className="text-[10px] text-center text-[#8C5E51] font-medium pt-0.5">
                            Online (UPI, GPay, PhonePe, Cards) or Cash on Delivery / Counter
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
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
                      Select table number (1 - 15) to confirm order
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

              {/* 15 Table Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 my-4 overflow-y-auto max-h-[50vh] p-1">
                {TABLES.map((t) => {
                  const isSelected = (selectedTable || tableNumber) === t;
                  const num = t.replace("Table ", "");
                  return (
                    <button
                      key={t}
                      onClick={() => handleSelectTable(t)}
                      className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border active:scale-95 ${
                        isSelected
                          ? "bg-[#B73F1D] text-cream border-[#9D3E22] shadow-md ring-2 ring-[#B73F1D]/30"
                          : "bg-white text-[#4A2117] border-[#EBDAD0] hover:border-[#B73F1D] hover:bg-[#FFF8F3]"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        Table
                      </span>
                      <span className="font-heading font-extrabold text-lg leading-tight mt-0.5">
                        {num}
                      </span>
                      {isSelected ? (
                        <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.2 rounded-full mt-1">
                          Active
                        </span>
                      ) : (
                        <span className="text-[9px] text-[#8C5E51] font-medium mt-1">
                          Tap to select
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="pt-2.5 border-t border-[#EBDAD0] flex items-center justify-between text-xs text-[#8C5E51]">
                <span>
                  Currently selected:{" "}
                  <strong className="text-[#B73F1D]">{selectedTable || tableNumber}</strong>
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
                  <div className="w-9 h-9 rounded-2xl bg-[#B73F1D]/10 text-[#B73F1D] flex items-center justify-center shrink-0">
                    <ShoppingBag size={18} />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-[#4A2117]">
                      CONFIRM DINE-IN ORDER
                    </h3>
                    <p className="text-[11px] text-[#8C5E51] font-medium">
                      Review your order before sending to kitchen
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
              <div className="my-3 p-3 bg-white rounded-2xl border border-[#EBDAD0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#B73F1D] text-cream flex items-center justify-center font-heading font-extrabold text-base shadow-sm">
                    {(selectedTable || tableNumber).replace("Table ", "")}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#8C5E51] uppercase tracking-wider">
                      Dine-in Table
                    </div>
                    <div className="font-heading font-extrabold text-sm text-[#4A2117]">
                      {selectedTable || tableNumber}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setShowTableModal(true);
                  }}
                  className="text-xs font-bold text-[#B73F1D] hover:underline px-2.5 py-1.5 rounded-xl hover:bg-[#FFF8F3] border border-[#B73F1D]/20 cursor-pointer"
                >
                  Change Table
                </button>
              </div>

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
                      <span>CONFIRM &amp; PLACE ORDER • ₹{grandTotal}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-2 text-center text-xs font-bold text-[#8C5E51] hover:text-[#4A2117] transition-colors cursor-pointer"
                >
                  Back to Basket
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
