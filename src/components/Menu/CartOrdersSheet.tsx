"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { useCart, PlacedOrder } from "@/context/CartContext";

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
    processOnlinePayment,
  } = useCart();

  const [orderNotes, setOrderNotes] = useState("");
  const [editingTable, setEditingTable] = useState(false);
  const [tempTable, setTempTable] = useState(tableNumber);
  const [paymentModalOrder, setPaymentModalOrder] = useState<PlacedOrder | null>(null);
  const [onlineProcessing, setOnlineProcessing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const handleConfirmOrder = async () => {
    setOrderError(null);
    const res = await placeOrder(orderNotes);
    if (!res.success) {
      setOrderError(res.error || "Failed to place order.");
    } else {
      setOrderNotes("");
    }
  };

  const handleSaveTable = () => {
    if (tempTable.trim()) {
      setTableNumber(tempTable);
      setEditingTable(false);
    }
  };

  const handlePayOnlineSubmit = async (orderId: string) => {
    setOnlineProcessing(true);
    const res = await processOnlinePayment(orderId);
    setOnlineProcessing(false);
    if (res.success) {
      setPaymentModalOrder(null);
    } else {
      alert(res.error || "Payment failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ y: "100%", opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-lg h-[92vh] sm:h-[95vh] mt-auto bg-[#FFF8F3] rounded-t-3xl sm:rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border-t border-[#EBDAD0]"
      >
        {/* Top Handle for mobile gestures */}
        <div className="w-12 h-1.5 bg-[#E2C7BA] rounded-full mx-auto mt-3 shrink-0" />

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
                  setTempTable(tableNumber);
                  setEditingTable(true);
                }}
                className="font-bold text-[#B73F1D] underline inline-flex items-center gap-1 cursor-pointer"
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

        {/* Table Edit Modal */}
        {editingTable && (
          <div className="p-4 bg-[#EBDAD0]/40 border-b border-[#EBDAD0] flex items-center gap-2">
            <input
              type="text"
              value={tempTable}
              onChange={(e) => setTempTable(e.target.value)}
              placeholder="e.g. Table 08"
              className="px-3 py-1.5 bg-white border border-[#E2C7BA] rounded-xl text-xs font-bold text-[#4A2117] focus:outline-none focus:ring-1 focus:ring-[#B73F1D] flex-1"
            />
            <button
              onClick={handleSaveTable}
              className="px-3 py-1.5 bg-[#B73F1D] text-cream text-xs font-bold rounded-xl"
            >
              Save
            </button>
            <button
              onClick={() => setEditingTable(false)}
              className="px-2.5 py-1.5 bg-white text-[#8C5E51] text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
          </div>
        )}

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
                  disabled={isPlacingOrder}
                  onClick={handleConfirmOrder}
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

                    {/* PAYMENT SECTION - Active ONLY when Order is READY */}
                    <div className="mt-1 pt-3 border-t border-[#EBDAD0]">
                      {!isReady && !isCompleted && (
                        <div className="p-3 bg-[#EBDAD0]/30 rounded-2xl text-center text-xs text-[#8C5E51]">
                          <Clock size={14} className="inline mr-1 text-[#B73F1D]" />
                          <span>Payment options will be enabled once your meal is ready.</span>
                        </div>
                      )}

                      {isReady && order.paymentStatus === "UNPAID" && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col gap-2.5">
                          <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-xs">
                            <Sparkles size={14} />
                            <span>YOUR FOOD IS READY! Choose payment method:</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <button
                              onClick={() => setPaymentModalOrder(order)}
                              className="py-2.5 px-3 bg-[#B73F1D] text-cream hover:bg-[#9D3E22] font-heading font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                            >
                              <CreditCard size={14} />
                              <span>PAY ONLINE</span>
                            </button>

                            <button
                              onClick={() => selectCashPayment(order.id)}
                              className="py-2.5 px-3 bg-white text-[#4A2117] border border-[#EBDAD0] hover:bg-[#F7ECE4] font-heading font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                            >
                              <Banknote size={14} />
                              <span>PAY CASH</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {order.paymentStatus === "PENDING_CASH" && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center text-xs text-amber-800 font-bold flex items-center justify-center gap-1.5">
                          <Banknote size={15} />
                          <span>Cash payment requested. Please pay at counter or to your server.</span>
                        </div>
                      )}

                      {order.paymentStatus === "PAID" && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-xs text-emerald-800 font-extrabold flex items-center justify-center gap-1.5">
                          <CheckCircle2 size={15} />
                          <span>Payment Received • PAID (Thank you!)</span>
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

      {/* Online Payment Modal */}
      <AnimatePresence>
        {paymentModalOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#EBDAD0] text-center"
            >
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <CreditCard size={24} />
              </div>
              <h3 className="font-heading font-extrabold text-lg text-[#4A2117]">
                Online Payment Gateway
              </h3>
              <p className="text-xs text-[#8C5E51] mt-0.5">
                Spiral Cafe • Order #{paymentModalOrder.orderNumber}
              </p>

              <div className="my-5 p-4 bg-[#FFF8F3] rounded-2xl border border-[#EBDAD0] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#8C5E51]">Amount Payable:</span>
                <span className="font-heading font-extrabold text-xl text-[#B73F1D]">
                  ₹{paymentModalOrder.grandTotal}
                </span>
              </div>

              {/* Simulated Payment Providers */}
              <div className="flex justify-center gap-2 mb-4 text-[10px] font-bold text-[#8C5E51]">
                <span className="px-2 py-1 bg-gray-100 rounded">UPI</span>
                <span className="px-2 py-1 bg-gray-100 rounded">GPay</span>
                <span className="px-2 py-1 bg-gray-100 rounded">PhonePe</span>
                <span className="px-2 py-1 bg-gray-100 rounded">Card</span>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  disabled={onlineProcessing}
                  onClick={() => handlePayOnlineSubmit(paymentModalOrder.id)}
                  className="w-full py-3 bg-[#B73F1D] hover:bg-[#9D3E22] text-cream font-heading font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {onlineProcessing ? "VERIFYING TRANSACTION..." : `PAY NOW • ₹${paymentModalOrder.grandTotal}`}
                </button>
                <button
                  onClick={() => setPaymentModalOrder(null)}
                  className="w-full py-2 bg-gray-100 text-[#4A2117] font-bold text-xs rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
