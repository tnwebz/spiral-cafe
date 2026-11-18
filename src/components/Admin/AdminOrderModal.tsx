"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  X,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  UtensilsCrossed,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  User,
  Phone,
  FileText,
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  categoryId?: string;
  categoryName?: string;
  dietType?: string;
  available?: boolean;
}

interface AdminOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTableNumber?: string; // "TAKEAWAY" or "A1", "B2", etc.
  onOrderCreated?: (order: any) => void;
}

export default function AdminOrderModal({
  isOpen,
  onClose,
  defaultTableNumber = "TAKEAWAY",
  onOrderCreated,
}: AdminOrderModalProps) {
  const isTakeaway = defaultTableNumber === "TAKEAWAY";

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Order Details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // Cart: Map of item ID -> { item: MenuItem, quantity: number }
  const [cart, setCart] = useState<Map<string, { item: MenuItem; quantity: number }>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "SUCCESS" | "ERROR" | "WARNING"; message: string } | null>(null);

  // Load Menu items
  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    async function loadMenu() {
      setLoadingMenu(true);
      try {
        const res = await fetch("/api/menu/items");
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setMenuItems(data.items.filter((i: any) => i.available !== false));
        }
      } catch (err) {
        console.error("Failed to load menu items for admin order:", err);
      } finally {
        setLoadingMenu(false);
      }
    }
    loadMenu();
  }, [isOpen]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((i) => {
      if (i.categoryName) set.add(i.categoryName);
      else if (i.categoryId) set.add(i.categoryId);
    });
    return ["ALL", ...Array.from(set)];
  }, [menuItems]);

  // Filter menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((i) => {
      if (activeCategory !== "ALL") {
        const cat = (i.categoryName || i.categoryId || "").toLowerCase();
        if (cat !== activeCategory.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return i.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [menuItems, activeCategory, searchQuery]);

  // Cart operations
  const handleAddItem = (item: MenuItem) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (existing) {
        next.set(item.id, { item, quantity: existing.quantity + 1 });
      } else {
        next.set(item.id, { item, quantity: 1 });
      }
      return next;
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        next.delete(itemId);
      } else {
        next.set(itemId, { item: existing.item, quantity: existing.quantity - 1 });
      }
      return next;
    });
  };

  const handleDeleteCompletely = (itemId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  };

  const handleClearCart = () => setCart(new Map());

  // Calculations
  const cartItemsList = Array.from(cart.values());
  const totalItemsCount = cartItemsList.reduce((sum, c) => sum + c.quantity, 0);
  const subtotal = cartItemsList.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
  const tax = Math.round(subtotal * 0.05); // 5% GST
  const grandTotal = subtotal + tax;

  // Submit Order
  const handleSubmitOrder = async () => {
    if (cart.size === 0 || submitting) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const payloadItems = cartItemsList.map((c) => ({
        id: c.item.id,
        name: c.item.name,
        price: c.item.price,
        quantity: c.quantity,
        image: c.item.image,
      }));

      const res = await fetch("/api/admin/takeaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: defaultTableNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes: orderNotes.trim(),
          items: payloadItems,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        const isKotPrinted = Boolean(data.printedKot);
        setFeedback({
          type: isKotPrinted ? "SUCCESS" : "WARNING",
          message: data.message || (isKotPrinted ? "Take Away Order created and Kitchen KOT printed! ✅" : "Take Away Order placed! Kitchen printer offline — KOT pending."),
        });
        setCart(new Map());
        setCustomerName("");
        setCustomerPhone("");
        setOrderNotes("");
        if (onOrderCreated) {
          onOrderCreated(data.order);
        }
        setTimeout(() => {
          onClose();
        }, isKotPrinted ? 1400 : 3200);
      } else {
        setFeedback({
          type: "ERROR",
          message: data.error || "Failed to create order.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "ERROR",
        message: err.message || "Network error. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] bg-[#FFFBF7] rounded-3xl shadow-2xl border border-[#EBDAD0] flex flex-col overflow-hidden text-[#2C1710]">
        {/* HEADER */}
        <div className="px-5 py-4 bg-white/80 border-b border-[#EBDAD0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isTakeaway ? "bg-amber-100 text-amber-800" : "bg-[#CA340A]/10 text-[#CA340A]"
            }`}>
              {isTakeaway ? <ShoppingBag size={20} /> : <UtensilsCrossed size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#2C1710]">
                  {isTakeaway ? "Create Take Away Order" : `Direct Order — Table ${defaultTableNumber}`}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  isTakeaway ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                }`}>
                  {isTakeaway ? "Parcel Tagged" : "Dine-In Table"}
                </span>
              </div>
              <p className="text-xs text-[#8C5E51]">
                {isTakeaway
                  ? "Dishes will be marked as (parcel) on kitchen KOT receipts"
                  : `Assign walk-in order directly to Floor Table ${defaultTableNumber}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div className={`px-5 py-2.5 text-xs font-bold flex items-center gap-2 ${
            feedback.type === "SUCCESS"
              ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
              : feedback.type === "WARNING"
              ? "bg-amber-50 text-amber-900 border-b border-amber-300"
              : "bg-red-50 text-red-800 border-b border-red-200"
          }`}>
            {feedback.type === "SUCCESS" ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={16} className={feedback.type === "WARNING" ? "text-amber-600 shrink-0" : "text-red-600 shrink-0"} />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* BODY SPLIT: CATALOG (LEFT) + ORDER SUMMARY (RIGHT) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT: DISH CATALOG */}
          <div className="flex-1 flex flex-col border-r border-[#EBDAD0] overflow-hidden bg-white/40">
            {/* Search & Category Pills */}
            <div className="p-4 border-b border-[#EBDAD0] space-y-3 bg-white/60">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dishes by name (e.g. Burger, Fries, Coffee)..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#EBDAD0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                />
              </div>

              {/* Categories Scroll */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                      activeCategory === cat
                        ? "bg-[#CA340A] text-white shadow-xs"
                        : "bg-white text-zinc-600 border border-[#EBDAD0] hover:bg-zinc-50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Dishes Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingMenu ? (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs">
                  <Loader2 size={24} className="animate-spin text-[#CA340A] mb-2" />
                  <span>Loading menu items...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-400 text-xs">
                  <UtensilsCrossed size={32} className="mb-2" />
                  <span>No dishes found matching your query.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredItems.map((dish) => {
                    const cartEntry = cart.get(dish.id);
                    const qty = cartEntry ? cartEntry.quantity : 0;

                    return (
                      <div
                        key={dish.id}
                        className={`p-3 bg-white rounded-2xl border transition-all flex flex-col justify-between ${
                          qty > 0
                            ? "border-[#CA340A] shadow-md shadow-[#CA340A]/10 ring-1 ring-[#CA340A]"
                            : "border-[#EBDAD0] hover:border-zinc-300 shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {dish.image && (
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-100 shrink-0">
                              <Image
                                src={dish.image}
                                alt={dish.name}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-heading font-bold text-xs text-[#2C1710] truncate">
                              {dish.name}
                            </h4>
                            <span className="font-heading font-extrabold text-xs text-[#CA340A]">
                              ₹{dish.price}
                            </span>
                          </div>
                        </div>

                        {/* Quantity Counter */}
                        <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between">
                          {qty > 0 ? (
                            <div className="flex items-center justify-between w-full">
                              <button
                                onClick={() => handleRemoveItem(dish.id)}
                                className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="font-heading font-extrabold text-xs text-[#CA340A]">
                                {qty}
                              </span>
                              <button
                                onClick={() => handleAddItem(dish)}
                                className="w-7 h-7 rounded-lg bg-[#CA340A] hover:bg-[#B73F1D] text-white flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddItem(dish)}
                              className="w-full py-1.5 px-2 bg-zinc-50 hover:bg-[#CA340A] hover:text-white text-zinc-700 font-bold text-xs rounded-xl border border-zinc-200 hover:border-transparent transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus size={13} />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: ORDER SUMMARY & CUSTOMER INFO */}
          <div className="w-full md:w-80 lg:w-96 bg-white p-4 sm:p-5 flex flex-col justify-between overflow-y-auto shrink-0 border-t md:border-t-0 border-[#EBDAD0]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-extrabold text-sm text-[#2C1710] uppercase tracking-wide">
                  Order Details ({totalItemsCount} items)
                </h3>
                {cart.size > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Customer Info Form */}
              <div className="space-y-2 p-3 bg-[#FFFBF7] rounded-2xl border border-[#EBDAD0] text-xs">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#8C5E51] mb-1">
                    Customer Name (Optional)
                  </label>
                  <div className="relative">
                    <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Rahul / Walk-in"
                      className="w-full pl-8 pr-2 py-1.5 bg-white border border-[#EBDAD0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#8C5E51] mb-1">
                    Customer Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-8 pr-2 py-1.5 bg-white border border-[#EBDAD0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#8C5E51] mb-1">
                    Kitchen Instructions (Optional)
                  </label>
                  <div className="relative">
                    <FileText size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="e.g. Less spicy, extra sauce"
                      className="w-full pl-8 pr-2 py-1.5 bg-white border border-[#EBDAD0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
                    />
                  </div>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cartItemsList.length === 0 ? (
                  <div className="py-8 text-center text-zinc-400 text-xs">
                    <ShoppingBag size={24} className="mx-auto mb-1.5 opacity-50" />
                    <span>No dishes added to order yet.</span>
                  </div>
                ) : (
                  cartItemsList.map(({ item, quantity }) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 border border-zinc-100 text-xs gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[#2C1710] truncate">
                          {item.name}
                          {isTakeaway && (
                            <span className="text-[10px] text-amber-700 ml-1 font-semibold">
                              (parcel)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          ₹{item.price} each
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Stepper */}
                        <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-zinc-200">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="w-5 h-5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                            title="Decrease quantity"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="font-heading font-extrabold text-xs text-[#CA340A] min-w-[16px] text-center">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddItem(item)}
                            className="w-5 h-5 rounded bg-[#CA340A] hover:bg-[#B73F1D] text-white flex items-center justify-center cursor-pointer transition-colors"
                            title="Increase quantity"
                          >
                            <Plus size={10} />
                          </button>
                        </div>

                        <span className="font-heading font-extrabold text-xs text-[#CA340A] min-w-[50px] text-right">
                          ₹{item.price * quantity}
                        </span>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCompletely(item.id)}
                          className="p-1 rounded-md text-red-500 hover:text-white hover:bg-red-600 bg-red-50 border border-red-200/60 transition-all cursor-pointer"
                          title={`Remove ${item.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bill Summary & Place Button */}
            <div className="pt-3 border-t border-[#EBDAD0] space-y-3 mt-3">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-bold">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>GST (5%)</span>
                  <span className="font-bold">₹{tax}</span>
                </div>
                <div className="flex justify-between text-[#2C1710] font-heading font-extrabold text-sm pt-1 border-t border-zinc-200">
                  <span>Grand Total</span>
                  <span className="text-[#CA340A]">₹{grandTotal}</span>
                </div>
              </div>

              <button
                disabled={cart.size === 0 || submitting}
                onClick={handleSubmitOrder}
                className="w-full py-3 px-4 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#CA340A]/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Placing Order & Printing KOT...</span>
                  </>
                ) : (
                  <>
                    <Printer size={16} />
                    <span>PLACE ORDER & SEND KOT • ₹{grandTotal}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

