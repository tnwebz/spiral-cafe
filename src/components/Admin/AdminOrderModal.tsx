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
  existingOrderId?: string;
  existingOrderNumber?: string;
  onOrderCreated?: (order: any) => void;
}

export default function AdminOrderModal({
  isOpen,
  onClose,
  defaultTableNumber = "TAKEAWAY",
  existingOrderId,
  existingOrderNumber,
  onOrderCreated,
}: AdminOrderModalProps) {
  const isSeparateTakeaway = defaultTableNumber === "TAKEAWAY";
  const effectiveTableNumber = defaultTableNumber;

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("");
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
  const [customIsParcel, setCustomIsParcel] = useState(isSeparateTakeaway);

  // Cart: Map of key `${item.id}__${isParcel ? 'parcel' : 'dinein'}` -> CartEntry
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());
  const [taxRate, setTaxRate] = useState<number>(0);
  const [packagingFeePerParcelItem, setPackagingFeePerParcelItem] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "SUCCESS" | "ERROR" | "WARNING"; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.config) {
          if (typeof d.config.taxPercentage === "number") {
            setTaxRate(d.config.taxPercentage);
          }
          if (typeof d.config.packagingFee === "number") {
            setPackagingFeePerParcelItem(d.config.packagingFee);
          }
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

  // Extract unique categories (Without 'ALL' option)
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((i) => {
      if (i.categoryName) set.add(i.categoryName);
      else if (i.categoryId) set.add(i.categoryId);
    });
    return Array.from(set);
  }, [menuItems]);

  // Pre-select first category when loaded
  useEffect(() => {
    if (categories.length > 0 && (!activeCategory || activeCategory === "ALL" || !categories.includes(activeCategory))) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Filter menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((i) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return i.name.toLowerCase().includes(q);
      }
      if (activeCategory) {
        const cat = (i.categoryName || i.categoryId || "").toLowerCase();
        if (cat !== activeCategory.toLowerCase()) return false;
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

  // Add Item
  const handleAddItem = (item: MenuItem, isParcel: boolean) => {
    const forcedParcel = isSeparateTakeaway ? true : isParcel;
    const key = `${item.id}__${forcedParcel ? "parcel" : "dinein"}`;
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, quantity: existing.quantity + 1 });
      } else {
        next.set(key, { item, quantity: 1, isParcel: forcedParcel });
      }
      return next;
    });
  };

  // Remove / Decrease Item
  const handleRemoveItem = (itemId: string, isParcel: boolean) => {
    const forcedParcel = isSeparateTakeaway ? true : isParcel;
    const key = `${itemId}__${forcedParcel ? "parcel" : "dinein"}`;
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

  // Toggle parcel flag for a specific cart row
  const handleToggleItemParcel = (cartKey: string) => {
    if (isSeparateTakeaway) return; // In takeaway mode, strictly parcel only!
    setCart((prev) => {
      const entry = prev.get(cartKey);
      if (!entry) return prev;
      const next = new Map(prev);
      next.delete(cartKey);
      const newIsParcel = !entry.isParcel;
      const newKey = `${entry.item.id}__${newIsParcel ? "parcel" : "dinein"}`;
      const existingTarget = next.get(newKey);
      if (existingTarget) {
        next.set(newKey, {
          ...existingTarget,
          quantity: existingTarget.quantity + entry.quantity,
        });
      } else {
        next.set(newKey, {
          ...entry,
          isParcel: newIsParcel,
        });
      }
      return next;
    });
  };

  // Toggle ALL cart items to parcel or dine-in
  const allAreParcel = useMemo(() => {
    if (cart.size === 0) return false;
    for (const v of cart.values()) {
      if (!v.isParcel) return false;
    }
    return true;
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

  // Packaging fee strictly for takeaway orders or parcel items
  const totalParcelItems = cartEntriesList.filter((c) => c.isParcel).reduce((sum, c) => sum + c.quantity, 0);
  const totalPackagingFee = isSeparateTakeaway
    ? (totalItemsCount > 0 ? packagingFeePerParcelItem : 0)
    : (totalParcelItems > 0 ? totalParcelItems * packagingFeePerParcelItem : 0);

  const grandTotal = subtotal + tax + totalPackagingFee;

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

      if (existingOrderId) {
        // Appending new order items directly to this existing Takeaway order
        const res = await fetch(`/api/admin/orders/${existingOrderId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: payloadItems.map((it) => ({
              productId: it.id,
              name: it.name,
              price: it.price,
              quantity: it.quantity,
              image: it.image,
              notes: it.isParcel ? "[PARCEL]" : undefined,
            })),
            adminUser: "Cashier Staff",
          }),
        });

        const data = await res.json();
        if (data.success && data.order) {
          setFeedback({
            type: "SUCCESS",
            message: `Dishes added to Takeaway Order #${data.order.orderNumber} successfully! Total bill updated. ✅`,
          });
          setCart(new Map());
          if (onOrderCreated) {
            onOrderCreated(data.order);
          }
          setTimeout(() => {
            onClose();
          }, 800);
          return;
        } else {
          setFeedback({
            type: "ERROR",
            message: data.error || "Failed to add items to takeaway order.",
          });
          return;
        }
      }

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
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 md:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[96%] h-[94%] max-w-none max-h-none bg-[#FAF6F0] rounded-3xl border border-[#CA340A]/20 shadow-2xl flex flex-col overflow-hidden text-[#2C1710] font-sans animate-in zoom-in-95 duration-150">
        {/* ========================================================= */}
        {/* TOP HEADER (Orange & Half-White Brand Gallery Style) */}
        {/* ========================================================= */}
        <header className="h-16 bg-[#FFF9F5] border-b border-[#CA340A]/15 flex items-center justify-between shrink-0 shadow-2xs z-20">
          {/* Left: Brand / Table Info (Pinned to match left category bar width) */}
          <div className="w-56 sm:w-64 h-full bg-[#2C1710] text-[#FFF9F5] px-4 sm:px-5 flex items-center justify-between border-r border-[#CA340A]/20 shrink-0">
            <div className="flex items-center gap-3 truncate">
              <div className="w-9 h-9 rounded-xl bg-[#CA340A] flex items-center justify-center text-white shrink-0 shadow-xs">
                {isSeparateTakeaway ? <ShoppingBag size={18} /> : <UtensilsCrossed size={18} />}
              </div>
              <div className="truncate">
                <span className="font-heading font-black text-xs sm:text-sm tracking-wider block text-white truncate uppercase">
                  {isSeparateTakeaway
                    ? existingOrderNumber
                    ? `TAKEAWAY #${existingOrderNumber}`
                    : "TAKEAWAY"
                    : `TABLE ${defaultTableNumber}`}
                </span>
                <span className="text-[11px] text-[#E2C7BA] font-semibold block truncate">
                  {existingOrderNumber ? "Add Order / Items" : "Manual Order"}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Search Product Bar */}
          <div className="flex-1 max-w-3xl px-4 sm:px-6 flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Product..."
                className="w-full pl-11 pr-4 py-2.5 bg-white hover:bg-white border border-[#CA340A]/20 rounded-xl text-xs sm:text-sm font-semibold text-[#2C1710] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#CA340A] focus:border-[#CA340A] transition-all shadow-2xs"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Quick Custom Product toggle */}
            <button
              type="button"
              onClick={() => setShowCustomProductForm(!showCustomProductForm)}
              className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                showCustomProductForm
                  ? "bg-[#CA340A] text-white shadow-xs"
                  : "bg-white hover:bg-[#FFF0EB] text-[#CA340A] border border-[#CA340A]/30"
              }`}
              title="Add custom off-menu product"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">+ Custom Item</span>
            </button>
          </div>

          {/* Right: Close Button matching POS layout (Square box) */}
          <div className="h-full flex items-center pr-3 sm:pr-4">
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-xl bg-[#2C1710] hover:bg-[#CA340A] text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              aria-label="Close manual order"
              title="Close Manual Order (ESC)"
            >
              <X size={22} />
            </button>
          </div>
        </header>

        {/* FEEDBACK NOTIFICATION */}
        {feedback && (
          <div
            className={`px-5 py-2 text-xs font-bold flex items-center gap-2 shrink-0 ${
              feedback.type === "SUCCESS"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : feedback.type === "WARNING"
                ? "bg-amber-50 text-amber-900 border-b border-amber-300"
                : "bg-red-50 text-red-800 border-b border-red-200"
            }`}
          >
            {feedback.type === "SUCCESS" ? (
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle
                size={15}
                className={feedback.type === "WARNING" ? "text-amber-600 shrink-0" : "text-red-600 shrink-0"}
              />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3-COLUMN BODY: CATEGORIES (LEFT) | PRODUCTS (MIDDLE) | CART (RIGHT) */}
        {/* ========================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* ------------------------------------------------------- */}
          {/* COLUMN 1: CATEGORIES SIDEBAR (Exact POS Theme) */}
          {/* ------------------------------------------------------- */}
          <aside className="w-56 sm:w-64 bg-[#FFF9F5] flex flex-col h-full shrink-0 border-r border-[#CA340A]/15 overflow-y-auto py-3 pr-1.5">
            <div className="space-y-1.5">
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left font-black tracking-wide text-xs sm:text-sm uppercase transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? "bg-[#CA340A] text-white py-3.5 sm:py-4 px-4 sm:px-5 rounded-r-2xl shadow-md shadow-[#CA340A]/20 font-black translate-x-1"
                        : "text-[#52525b] hover:text-[#2C1710] hover:bg-[#FFF0EB] py-3 sm:py-3.5 px-4 sm:px-5 rounded-r-xl font-bold"
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    {isActive && (
                      <span className="w-2.5 h-2.5 rounded-full bg-white shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ------------------------------------------------------- */}
          {/* COLUMN 2: PRODUCTS GRID (Middle expansive canvas) */}
          {/* ------------------------------------------------------- */}
          <main className="flex-1 bg-[#FAF6F0] h-full overflow-y-auto p-4 sm:p-6 flex flex-col">
          {/* Custom Product Inline Creator Form (When expanded) */}
          {showCustomProductForm && (
            <form
              onSubmit={handleAddCustomToCart}
              className="mb-4 p-4 bg-white rounded-2xl border-2 border-[#CA340A]/20 shadow-md space-y-3 shrink-0 animate-in fade-in slide-in-from-top-1 duration-150"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="text-xs font-black uppercase text-[#CA340A] flex items-center gap-1.5">
                  <Plus size={14} />
                  Add Custom Off-Menu Item
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomProductForm(false)}
                  className="text-zinc-400 hover:text-zinc-600 text-xs p-1 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Product Name (e.g. Cold Coffee with Ice Cream)..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                    autoFocus
                  />
                </div>
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
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
                      className="w-full pl-7 pr-2 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-[#CA340A] focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                {isSeparateTakeaway ? (
                  <span className="text-xs font-bold text-[#CA340A] flex items-center gap-1.5 bg-[#FFF0EB] px-2.5 py-1 rounded-lg border border-[#CA340A]/30">
                    <ShoppingBag size={13} />
                    <span>Takeaway: Added as Parcel Only</span>
                  </span>
                ) : (
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-zinc-600 select-none">
                    <input
                      type="checkbox"
                      checked={customIsParcel}
                      onChange={(e) => setCustomIsParcel(e.target.checked)}
                      className="rounded text-[#CA340A] focus:ring-[#CA340A] w-4 h-4"
                    />
                    <span>Mark as Parcel / Takeaway</span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={!customName.trim() || !customPrice}
                  className="px-5 py-2 bg-[#CA340A] hover:bg-[#A72B08] text-white font-heading font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus size={14} />
                  <span>{existingOrderId ? "Add to Order" : "Add to Order"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Loading or Empty State */}
          {loadingMenu ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs py-16">
              <Loader2 size={28} className="animate-spin text-[#CA340A] mb-2" />
              <span>Loading menu catalog...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-xs py-16">
              <UtensilsCrossed size={36} className="mb-2 opacity-50 text-[#CA340A]" />
              <span className="font-semibold text-sm">No products found in category "{activeCategory}"</span>
              {searchQuery && <p className="text-xs text-zinc-500 mt-1">Try clearing your search query</p>}
            </div>
          ) : (
            /* Products Grid (Warm Alabaster & Orange Palette, comfortable vertical height) */
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredItems.map((dish) => {
                const dineInQty = getDishDineInQty(dish.id);
                const parcelQty = getDishParcelQty(dish.id);
                const totalInCart = dineInQty + parcelQty;
                const diet = getDishDiet(dish);
                const isVeg = diet === "veg";

                return (
                  <div
                    key={dish.id}
                    onClick={() => handleAddItem(dish, isSeparateTakeaway ? true : false)}
                    className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-150 flex flex-col justify-between min-h-[142px] cursor-pointer select-none group relative ${
                      totalInCart > 0
                        ? "border-[#CA340A] shadow-md ring-2 ring-[#CA340A]/20 bg-[#FFFBF7]"
                        : "border-[#CA340A]/15 hover:border-[#CA340A] hover:shadow-md"
                    }`}
                  >
                    {/* Top Right Floating Quantity Indicator Badge */}
                    {totalInCart > 0 && (
                      <span className="absolute -top-2.5 -right-2.5 min-w-[24px] h-[24px] px-1.5 rounded-full bg-[#CA340A] text-white text-xs font-black flex items-center justify-center shadow-md border-2 border-white z-10 animate-in zoom-in-75 duration-150">
                        {totalInCart}
                      </span>
                    )}

                    {/* Top: Dish Name + Diet Dot */}
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <h4
                          className="font-bold text-sm sm:text-base text-[#2C1710] leading-snug line-clamp-2 group-hover:text-[#CA340A] transition-colors"
                          title={dish.name}
                        >
                          {dish.name}
                        </h4>
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
                            isVeg ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                          title={isVeg ? "Pure Veg" : "Non-Veg"}
                        />
                      </div>
                    </div>

                    {/* Bottom: Price + Quick Controls (Enlarged for quick tapping) */}
                    <div className="mt-3.5 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <span className="font-heading font-black text-base sm:text-lg text-[#CA340A] tracking-tight shrink-0">
                        ₹{dish.price}
                      </span>

                      <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Direct Parcel button */}
                        <button
                          type="button"
                          onClick={() => handleAddItem(dish, true)}
                          className={`h-8 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                            (isSeparateTakeaway ? totalInCart : parcelQty) > 0
                              ? "bg-[#FFF0EB] text-[#CA340A] border border-[#CA340A]/40 shadow-2xs"
                              : "bg-zinc-100 hover:bg-[#FFF0EB] text-zinc-600 hover:text-[#CA340A]"
                          }`}
                          title={isSeparateTakeaway ? "Add to Takeaway" : "Add as Takeaway Parcel"}
                        >
                          <ShoppingBag size={14} className="shrink-0" />
                          <span className="text-xs whitespace-nowrap">{isSeparateTakeaway ? "Add Parcel" : "Parcel"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ------------------------------------------------------- */}
        {/* COLUMN 3: ORDER SUMMARY & BILLING DOCK (Right) */}
        {/* ------------------------------------------------------- */}
        <aside className="w-84 sm:w-96 lg:w-[400px] xl:w-[430px] bg-white border-l border-[#CA340A]/15 flex flex-col h-full shrink-0 shadow-lg z-10">
          {/* Cart Header */}
          <div className="p-4 border-b border-[#CA340A]/15 bg-[#FFF9F5] flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-heading font-extrabold text-sm text-[#2C1710] uppercase tracking-wide flex items-center gap-2">
                <span>Order Summary</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#CA340A] text-white text-xs font-mono font-bold shadow-xs">
                  {totalItemsCount}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 font-semibold">
                {isSeparateTakeaway ? "Direct Takeaway Order" : `Floor Table ${defaultTableNumber}`}
              </p>
            </div>

            {cart.size > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Customer / Note Details (Collapsible or Compact) */}
          <div className="p-3 border-b border-zinc-200 bg-white space-y-2 shrink-0 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Guest Name (Opt)"
                className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone (Opt)"
                className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
              />
            </div>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Kitchen Instructions (e.g. Less spicy)..."
              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
            />
          </div>

          {/* Scrollable Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cartEntriesList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs py-12">
                <ShoppingBag size={32} className="mb-2 opacity-40 text-[#CA340A]" />
                <span className="font-semibold text-zinc-600">Basket is empty</span>
                <p className="text-[11px] text-zinc-400 mt-0.5">Click any product in the center grid to add</p>
              </div>
            ) : (
              cartEntriesList.map(({ key, item, quantity, isParcel }) => (
                <div
                  key={key}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                    isParcel
                      ? "bg-[#FFF9F5] border-[#CA340A]/30"
                      : "bg-zinc-50 border-zinc-200/90"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[#2C1710] truncate" title={item.name}>
                      {item.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-zinc-500 font-mono">₹{item.price}</span>
                      {isSeparateTakeaway ? (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded uppercase bg-[#FFF0EB] text-[#CA340A] border border-[#CA340A]/40">
                          Parcel
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleItemParcel(key)}
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase transition-colors cursor-pointer ${
                            isParcel
                              ? "bg-[#FFF0EB] text-[#CA340A] border border-[#CA340A]/40"
                              : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                          }`}
                        >
                          {isParcel ? "Parcel" : "Dine-In"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Stepper */}
                    <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-zinc-200">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id, isParcel)}
                        className="w-5 h-5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="font-bold text-xs min-w-[16px] text-center font-mono">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddItem(item, isParcel)}
                        className="w-5 h-5 rounded bg-[#CA340A] hover:bg-[#A72B08] text-white flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    {/* Line total */}
                    <span className="font-extrabold text-xs text-zinc-900 min-w-[48px] text-right font-mono">
                      ₹{item.price * quantity}
                    </span>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDeleteCompletely(key)}
                      className="p-1 text-zinc-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Bottom Summary & Checkout Button */}
          <div className="p-4 border-t border-zinc-200 bg-zinc-50 space-y-3 shrink-0">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-bold font-mono">₹{subtotal}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>GST ({taxRate}%)</span>
                  <span className="font-bold font-mono">₹{tax}</span>
                </div>
              )}
              {totalPackagingFee > 0 && (
                <div className="flex justify-between text-amber-900">
                  <span>Packaging Fee</span>
                  <span className="font-bold font-mono">₹{totalPackagingFee}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-950 font-heading font-black text-base pt-1.5 border-t border-zinc-200">
                <span>Grand Total</span>
                <span className="text-[#CA340A] font-mono">₹{grandTotal}</span>
              </div>
            </div>

            {/* Place Order Button */}
            <button
              type="button"
              disabled={cart.size === 0 || submitting}
              onClick={handleSubmitOrder}
              className="w-full py-3.5 px-4 bg-[#CA340A] hover:bg-[#A72B08] text-white font-heading font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#CA340A]/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span>Submitting Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  <span>
                    {existingOrderId
                      ? `ADD TO ORDER • ₹${grandTotal}`
                      : isSeparateTakeaway
                      ? `PLACE TAKE AWAY • ₹${grandTotal}`
                      : `PLACE ORDER • ₹${grandTotal}`}
                  </span>
                </>
              )}
            </button>
          </div>
        </aside>
      </div>
      </div>
    </div>
  );
}
