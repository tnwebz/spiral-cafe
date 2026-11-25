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
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  User,
  Phone,
  FileText,
  Sparkles,
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

function getDishDiet(dish: { name?: string; dietType?: string }) {
  const nameLower = (dish.name || "").toLowerCase();
  if (nameLower.includes("non-veg") || nameLower.includes("non veg")) return "non-veg";
  if (nameLower.includes("(veg)") || nameLower.includes("[veg]") || nameLower.includes(" pure veg")) return "veg";
  if (dish.dietType?.toLowerCase() === "non-veg") return "non-veg";
  if (dish.dietType?.toLowerCase() === "veg") return "veg";
  if (/\b(chicken|prawn|mutton|fish|egg|pork|beef|meat)\b/i.test(dish.name || "")) return "non-veg";
  return "veg";
}

interface CartEntry {
  item: MenuItem;
  quantity: number;
  isParcel: boolean;
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
  const isSeparateTakeaway = defaultTableNumber === "TAKEAWAY";
  const effectiveTableNumber = defaultTableNumber;

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // Order Details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // Custom Product State
  const [showCustomProductForm, setShowCustomProductForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customIsParcel, setCustomIsParcel] = useState(false);

  // Cart: Map of key `${item.id}__${isParcel ? 'parcel' : 'dinein'}` -> CartEntry
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());
  const [taxRate, setTaxRate] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "SUCCESS" | "ERROR" | "WARNING"; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.config && typeof d.config.taxPercentage === "number") {
          setTaxRate(d.config.taxPercentage);
        }
      })
      .catch(() => {});
  }, []);

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

  // Helpers to get item quantities
  const getDishDineInQty = (dishId: string) => {
    const entry = cart.get(`${dishId}__dinein`);
    return entry ? entry.quantity : 0;
  };

  const getDishParcelQty = (dishId: string) => {
    const entry = cart.get(`${dishId}__parcel`);
    return entry ? entry.quantity : 0;
  };

  // Cart operations
  const handleAddItem = (item: MenuItem, isParcel: boolean = false) => {
    const key = `${item.id}__${isParcel ? "parcel" : "dinein"}`;
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, quantity: existing.quantity + 1 });
      } else {
        next.set(key, { item, quantity: 1, isParcel });
      }
      return next;
    });
  };

  const handleRemoveItem = (dishId: string, isParcel: boolean = false) => {
    const key = `${dishId}__${isParcel ? "parcel" : "dinein"}`;
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        next.delete(key);
      } else {
        next.set(key, { ...existing, quantity: existing.quantity - 1 });
      }
      return next;
    });
  };

  // Toggle single item between Dine-In and Parcel
  const handleToggleItemParcel = (cartKey: string) => {
    setCart((prev) => {
      const entry = prev.get(cartKey);
      if (!entry) return prev;

      const next = new Map(prev);
      next.delete(cartKey);

      const targetIsParcel = !entry.isParcel;
      const targetKey = `${entry.item.id}__${targetIsParcel ? "parcel" : "dinein"}`;
      const existingTarget = next.get(targetKey);

      if (existingTarget) {
        next.set(targetKey, {
          ...existingTarget,
          quantity: existingTarget.quantity + entry.quantity,
        });
      } else {
        next.set(targetKey, {
          ...entry,
          isParcel: targetIsParcel,
        });
      }
      return next;
    });
  };

  // Toggle all items in cart to Parcel or back to Dine-In
  const allAreParcel = useMemo(() => {
    const entries = Array.from(cart.values());
    return entries.length > 0 && entries.every((e) => e.isParcel);
  }, [cart]);

  const handleToggleAllParcel = () => {
    const targetParcel = !allAreParcel;
    setCart((prev) => {
      const next = new Map<string, CartEntry>();
      for (const entry of prev.values()) {
        const key = `${entry.item.id}__${targetParcel ? "parcel" : "dinein"}`;
        const existing = next.get(key);
        if (existing) {
          next.set(key, { ...existing, quantity: existing.quantity + entry.quantity });
        } else {
          next.set(key, { ...entry, isParcel: targetParcel });
        }
      }
      return next;
    });
  };

  const handleDeleteCompletely = (cartKey: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(cartKey);
      return next;
    });
  };

  const handleClearCart = () => setCart(new Map());

  // Add Custom / Off-Menu Product
  const handleAddCustomToCart = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim();
    const priceNum = parseFloat(customPrice);
    const qty = Math.max(1, Number(customQty) || 1);

    if (!trimmed) {
      alert("Please enter a product name.");
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      alert("Please enter a valid price.");
      return;
    }

    const customId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const customItem: MenuItem = {
      id: customId,
      name: trimmed,
      price: priceNum,
      categoryName: "Custom",
      dietType: "ALL",
      available: true,
    };

    const key = `${customId}__${customIsParcel ? "parcel" : "dinein"}`;
    setCart((prev) => {
      const next = new Map(prev);
      next.set(key, { item: customItem, quantity: qty, isParcel: customIsParcel });
      return next;
    });

    setCustomName("");
    setCustomPrice("");
    setCustomQty(1);
    setCustomIsParcel(false);
    setShowCustomProductForm(false);
  };

  // Calculations
  const cartEntriesList = Array.from(cart.entries()).map(([key, value]) => ({
    key,
    ...value,
  }));
  const totalItemsCount = cartEntriesList.reduce((sum, c) => sum + c.quantity, 0);
  const subtotal = cartEntriesList.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
  const tax = Math.round((subtotal * taxRate) / 100);
  const grandTotal = subtotal + tax;

  const hasAnyParcel = cartEntriesList.some((c) => c.isParcel) || isSeparateTakeaway;
  const hasAnyDineIn = cartEntriesList.some((c) => !c.isParcel) && !isSeparateTakeaway;

  // Submit Order (Places order in PENDING status without printing KOT immediately)
  const handleSubmitOrder = async () => {
    if (cart.size === 0 || submitting) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const payloadItems = cartEntriesList.map((c) => {
        const itemIsParcel = c.isParcel || isSeparateTakeaway;
        return {
          id: c.item.id,
          name: c.item.name,
          price: c.item.price,
          quantity: c.quantity,
          image: c.item.image,
          isParcel: itemIsParcel,
        };
      });

      const res = await fetch("/api/admin/takeaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: effectiveTableNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes: orderNotes.trim(),
          items: payloadItems,
          sendKotImmediately: false, // Place only, do not print KOT yet
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setFeedback({
          type: "SUCCESS",
          message: data.message || `Order #${data.order.orderNumber} placed successfully! You can send KOT from the table screen. ✅`,
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
        }, 1200);
      } else {
        setFeedback({
          type: "ERROR",
          message: data.error || "Failed to place order.",
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
      <div className="relative w-full max-w-5xl h-[92vh] bg-[#FFFBF7] rounded-3xl shadow-2xl border border-[#EBDAD0] flex flex-col overflow-hidden text-[#2C1710]">
        {/* HEADER */}
        <div className="px-5 py-3.5 bg-white/80 border-b border-[#EBDAD0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isSeparateTakeaway ? "bg-amber-100 text-amber-800" : "bg-[#CA340A]/10 text-[#CA340A]"
              }`}
            >
              {isSeparateTakeaway ? <ShoppingBag size={20} /> : <UtensilsCrossed size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#2C1710]">
                  {isSeparateTakeaway ? "Direct Order — Separate Take Away" : `Direct Order — Table ${defaultTableNumber}`}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    isSeparateTakeaway
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : hasAnyParcel && hasAnyDineIn
                      ? "bg-orange-100 text-[#CA340A] border border-orange-300"
                      : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  }`}
                >
                  {isSeparateTakeaway
                    ? "Separate Take Away"
                    : hasAnyParcel && hasAnyDineIn
                    ? "Dine-In & Take Away"
                    : hasAnyParcel
                    ? "Table Parcel"
                    : "Dine-In Table"}
                </span>
              </div>
              <p className="text-xs text-[#8C5E51]">
                {isSeparateTakeaway
                  ? "Standalone counter takeaway order (independent bill, not linked to table)"
                  : `Assign walk-in order directly to Floor Table ${defaultTableNumber}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div
            className={`px-5 py-2.5 text-xs font-bold flex items-center gap-2 ${
              feedback.type === "SUCCESS"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : feedback.type === "WARNING"
                ? "bg-amber-50 text-amber-900 border-b border-amber-300"
                : "bg-red-50 text-red-800 border-b border-red-200"
            }`}
          >
            {feedback.type === "SUCCESS" ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle
                size={16}
                className={feedback.type === "WARNING" ? "text-amber-600 shrink-0" : "text-red-600 shrink-0"}
              />
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
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dishes by name (e.g. Burger, Fries, Coffee)..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#EBDAD0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowCustomProductForm(!showCustomProductForm)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    showCustomProductForm
                      ? "bg-[#CA340A] text-white shadow-xs"
                      : "bg-orange-50 hover:bg-orange-100 text-[#CA340A] border border-orange-200"
                  }`}
                  title="Add custom off-menu product manually"
                >
                  <Plus size={14} />
                  <span>+ Custom Product</span>
                </button>
              </div>

              {/* Inline Custom Product Creator Form */}
              {showCustomProductForm && (
                <form
                  onSubmit={handleAddCustomToCart}
                  className="p-3.5 bg-white rounded-2xl border-2 border-orange-200 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  <div className="flex items-center justify-between border-b border-orange-100 pb-2">
                    <span className="text-[11px] font-black uppercase text-[#CA340A] flex items-center gap-1.5">
                      <Plus size={13} />
                      Add Custom / Manual Product to Order
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomProductForm(false)}
                      className="text-zinc-400 hover:text-zinc-600 text-xs p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        required
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Product Name (e.g. Cold Coffee, Omelette)..."
                        className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#EBDAD0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
                        autoFocus
                      />
                    </div>
                    <div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                          ₹
                        </span>
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                          placeholder="Price"
                          className="w-full pl-6 pr-2 py-2 bg-[#FFFBF7] border border-[#EBDAD0] rounded-xl text-xs font-bold text-[#CA340A] focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-zinc-600 select-none">
                      <input
                        type="checkbox"
                        checked={customIsParcel}
                        onChange={(e) => setCustomIsParcel(e.target.checked)}
                        className="rounded text-[#CA340A] focus:ring-[#CA340A] w-3.5 h-3.5"
                      />
                      <span>Mark as Takeaway / (parcel)</span>
                    </label>

                    <button
                      type="submit"
                      disabled={!customName.trim() || !customPrice}
                      className="px-4 py-2 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Plus size={13} />
                      <span>Add to Order</span>
                    </button>
                  </div>
                </form>
              )}

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
                    const dineInQty = getDishDineInQty(dish.id);
                    const parcelQty = getDishParcelQty(dish.id);
                    const hasSelection = dineInQty > 0 || parcelQty > 0;
                    const diet = getDishDiet(dish);
                    const isVeg = diet === "veg";
                    const hasImage = Boolean(dish.image && !brokenImages.has(dish.id));

                    return (
                      <div
                        key={dish.id}
                        className={`p-3 bg-white rounded-2xl border transition-all flex flex-col justify-between ${
                          hasSelection
                            ? "border-[#CA340A] shadow-md shadow-[#CA340A]/10 ring-1 ring-[#CA340A]"
                            : "border-[#EBDAD0] hover:border-zinc-300 shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {hasImage && (
                            <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-zinc-100 shrink-0">
                              <img
                                src={dish.image}
                                alt={dish.name}
                                className="w-full h-full object-cover"
                                onError={() =>
                                  setBrokenImages((prev) => new Set(prev).add(dish.id))
                                }
                              />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-1.5">
                              {/* Veg / Non-Veg Standard Indicator */}
                              <span
                                className={`inline-flex items-center justify-center w-3.5 h-3.5 border rounded-[3px] bg-white shrink-0 mt-0.5 ${
                                  isVeg ? "border-emerald-600" : "border-rose-600"
                                }`}
                                title={isVeg ? "Pure Vegetarian" : "Non-Vegetarian"}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isVeg ? "bg-emerald-600" : "bg-rose-600"
                                  }`}
                                />
                              </span>

                              <h4
                                className="font-heading font-bold text-xs text-[#2C1710] leading-snug line-clamp-2 min-h-[2.1rem] break-words"
                                title={dish.name}
                              >
                                {dish.name}
                              </h4>
                            </div>

                            <div className="mt-1 flex items-center justify-between gap-1 flex-wrap">
                              <span className="font-heading font-extrabold text-xs text-[#CA340A]">
                                ₹{dish.price}
                              </span>
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                  isVeg
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {isVeg ? "Veg" : "Non-Veg"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Dual Add Buttons: Dine-In vs Parcel */}
                        <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between gap-1 flex-wrap">
                          {/* 1. Dine-In Add / Counter */}
                          {dineInQty === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleAddItem(dish, false)}
                              className="py-1 px-2.5 bg-zinc-50 hover:bg-[#CA340A] hover:text-white text-zinc-700 font-bold text-[11px] rounded-lg border border-zinc-200 hover:border-transparent transition-all flex items-center gap-1 cursor-pointer"
                              title="Add for Dine-In"
                            >
                              <Plus size={12} />
                              <span>Add</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1 bg-[#FFF8F3] border border-[#CA340A]/30 rounded-lg p-0.5 text-xs text-[#CA340A]">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(dish.id, false)}
                                className="w-5 h-5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                                title="Decrease dine-in"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="font-bold text-[11px] min-w-[14px] text-center">
                                {dineInQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddItem(dish, false)}
                                className="w-5 h-5 rounded bg-[#CA340A] hover:bg-[#B73F1D] text-white flex items-center justify-center cursor-pointer transition-colors"
                                title="Increase dine-in"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          )}

                          {/* 2. Parcel Add / Counter */}
                          {parcelQty === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleAddItem(dish, true)}
                              className="py-1 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                              title="Add as Takeaway Parcel"
                            >
                              <ShoppingBag size={11} />
                              <span>Parcel</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-lg p-0.5 text-xs text-amber-950">
                              <ShoppingBag size={11} className="text-amber-700 ml-0.5" />
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(dish.id, true)}
                                className="w-5 h-5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 flex items-center justify-center cursor-pointer transition-colors"
                                title="Decrease parcel"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="font-bold text-[11px] min-w-[14px] text-center">
                                {parcelQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddItem(dish, true)}
                                className="w-5 h-5 rounded bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center cursor-pointer transition-colors"
                                title="Increase parcel"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
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
            <div className="space-y-3.5">
              {/* Order Details Header & Parcel Switch Action */}
              <div className="flex items-center justify-between pt-1">
                <h3 className="font-heading font-extrabold text-xs text-[#2C1710] uppercase tracking-wide">
                  Order Details ({totalItemsCount} items)
                </h3>
                <div className="flex items-center gap-1.5">
                  {cart.size > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleAllParcel}
                      className="text-[10px] font-extrabold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Turn entire order to Parcel / Dine-In"
                    >
                      <ShoppingBag size={11} />
                      <span>{allAreParcel ? "Turn All Dine-In" : "Turn All Parcel"}</span>
                    </button>
                  )}
                  {cart.size > 0 && (
                    <button
                      onClick={handleClearCart}
                      className="text-[10px] font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={11} />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
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
                {cartEntriesList.length === 0 ? (
                  <div className="py-7 text-center text-zinc-400 text-xs">
                    <ShoppingBag size={24} className="mx-auto mb-1.5 opacity-50" />
                    <span>No dishes added to order yet.</span>
                  </div>
                ) : (
                  cartEntriesList.map(({ key, item, quantity, isParcel }) => (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs gap-2 transition-all ${
                        isParcel
                          ? "bg-amber-50/70 border-amber-200/90"
                          : "bg-zinc-50 border-zinc-200/80"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[#2C1710] flex items-center gap-1.5 min-w-0">
                          <span className="line-clamp-1 break-words min-w-0" title={item.name}>{item.name}</span>
                          {/* Clickable Parcel Toggle Pill */}
                          <button
                            type="button"
                            onClick={() => handleToggleItemParcel(key)}
                            className={`px-1.5 py-0.2 rounded-md font-bold text-[10px] flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                              isParcel
                                ? "bg-amber-200 text-amber-950 border border-amber-400 hover:bg-amber-300"
                                : "bg-zinc-200 text-zinc-600 border border-zinc-300 hover:bg-amber-100 hover:text-amber-900 hover:border-amber-300"
                            }`}
                            title={isParcel ? "Click to switch to Dine-In" : "Click to turn to Parcel"}
                          >
                            <ShoppingBag size={10} />
                            <span>{isParcel ? "(parcel)" : "Dine-in"}</span>
                          </button>
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
                            onClick={() => handleRemoveItem(item.id, isParcel)}
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
                            onClick={() => handleAddItem(item, isParcel)}
                            className="w-5 h-5 rounded bg-[#CA340A] hover:bg-[#B73F1D] text-white flex items-center justify-center cursor-pointer transition-colors"
                            title="Increase quantity"
                          >
                            <Plus size={10} />
                          </button>
                        </div>

                        <span className="font-heading font-extrabold text-xs text-[#CA340A] min-w-[46px] text-right">
                          ₹{item.price * quantity}
                        </span>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCompletely(key)}
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

            {/* Bill Summary & Place Order Button */}
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

              {/* Primary Action Button: Only Place Order (Send KOT Later from Table) */}
              <button
                type="button"
                disabled={cart.size === 0 || submitting}
                onClick={handleSubmitOrder}
                className="w-full py-3.5 px-4 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#CA340A]/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Placing Order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>PLACE ORDER • ₹{grandTotal}</span>
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
