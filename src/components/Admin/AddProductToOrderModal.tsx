"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  X,
  Search,
  Plus,
  Minus,
  UtensilsCrossed,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Sparkles,
  Tag,
} from "lucide-react";
import { Order } from "@/lib/db";

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

interface AddProductToOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  tableNumber: string;
  onItemAdded: (message: string) => void;
}

export default function AddProductToOrderModal({
  isOpen,
  onClose,
  order,
  tableNumber,
  onItemAdded,
}: AddProductToOrderModalProps) {
  const [activeTab, setActiveTab] = useState<"CATALOG" | "CUSTOM">("CATALOG");

  // Catalog State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [itemParcelFlags, setItemParcelFlags] = useState<Record<string, boolean>>({});
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // Custom Product State
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customIsParcel, setCustomIsParcel] = useState(false);
  const [customNote, setCustomNote] = useState("");

  // Action / Feedback state
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "SUCCESS" | "ERROR"; message: string } | null>(null);

  // Load Menu Items on open
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
        console.error("Failed to load menu items:", err);
      } finally {
        setLoadingMenu(false);
      }
    }
    loadMenu();
  }, [isOpen]);

  // Extract Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((i) => {
      if (i.categoryName) set.add(i.categoryName);
      else if (i.categoryId) set.add(i.categoryId);
    });
    return ["ALL", ...Array.from(set)];
  }, [menuItems]);

  // Filter Items
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

  // Helpers for Catalog Item Quantity & Parcel flag
  const getQty = (itemId: string) => itemQuantities[itemId] || 1;
  const setQty = (itemId: string, q: number) => {
    setItemQuantities((prev) => ({ ...prev, [itemId]: Math.max(1, q) }));
  };
  const toggleParcel = (itemId: string) => {
    setItemParcelFlags((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Add Catalog Item to Order
  const handleAddCatalogItem = async (dish: MenuItem) => {
    if (!order) return;
    const qty = getQty(dish.id);
    const isParcel = Boolean(itemParcelFlags[dish.id]);
    const finalName = isParcel && !dish.name.toLowerCase().includes("(parcel)")
      ? `${dish.name.trim()} - (parcel)`
      : dish.name.trim();

    setAddingId(dish.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            productId: dish.id,
            name: finalName,
            price: dish.price,
            quantity: qty,
            image: dish.image,
            notes: isParcel ? "[PARCEL]" : undefined,
          },
          adminUser: "Counter Staff",
        }),
      });

      const data = await res.json();
      if (data.success) {
        const msg = `Added ${qty}× "${finalName}" to Order #${order.orderNumber}`;
        setFeedback({ type: "SUCCESS", message: msg });
        onItemAdded(msg);
        // Reset item quantity back to 1
        setQty(dish.id, 1);
      } else {
        setFeedback({ type: "ERROR", message: data.error || "Failed to add item to order." });
      }
    } catch (err: any) {
      setFeedback({ type: "ERROR", message: err.message || "Network error. Failed to add item." });
    } finally {
      setAddingId(null);
    }
  };

  // Add Custom / Manual Product to Order
  const handleAddCustomProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const trimmedName = customName.trim();
    const priceNum = parseFloat(customPrice);
    const qtyNum = Math.max(1, Number(customQty) || 1);

    if (!trimmedName) {
      setFeedback({ type: "ERROR", message: "Please enter a product name." });
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setFeedback({ type: "ERROR", message: "Please enter a valid price (₹)." });
      return;
    }

    setAddingCustom(true);
    setFeedback(null);

    const parcelTag = customIsParcel && !trimmedName.toLowerCase().includes("(parcel)") ? " - (parcel)" : "";
    const finalName = `${trimmedName}${parcelTag}`;
    const finalNotes = `${customIsParcel ? "[PARCEL]" : ""} ${customNote.trim()}`.trim();

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            productId: `manual_${Date.now()}`,
            name: finalName,
            price: priceNum,
            quantity: qtyNum,
            notes: finalNotes || undefined,
          },
          adminUser: "Counter Staff",
        }),
      });

      const data = await res.json();
      if (data.success) {
        const msg = `Added ${qtyNum}× "${finalName}" (₹${priceNum}) to Order #${order.orderNumber}`;
        setFeedback({ type: "SUCCESS", message: msg });
        onItemAdded(msg);
        // Reset form
        setCustomName("");
        setCustomPrice("");
        setCustomQty(1);
        setCustomIsParcel(false);
        setCustomNote("");
      } else {
        setFeedback({ type: "ERROR", message: data.error || "Failed to add manual product." });
      }
    } catch (err: any) {
      setFeedback({ type: "ERROR", message: err.message || "Network error. Failed to add product." });
    } finally {
      setAddingCustom(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#FFFBF7] rounded-3xl shadow-2xl border border-[#EBDAD0] flex flex-col overflow-hidden text-[#2C1710]">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 bg-white/90 border-b border-[#EBDAD0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#CA340A]/10 text-[#CA340A] flex items-center justify-center shrink-0">
              <Plus size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#2C1710]">
                  Add Products to Order #{order.orderNumber}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-900 border border-orange-300">
                  Table {tableNumber}
                </span>
              </div>
              <p className="text-xs text-[#8C5E51]">
                Select from the menu catalog or enter a custom product manually
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* TAB TOGGLE: MENU CATALOG vs CUSTOM MANUAL PRODUCT */}
        <div className="px-5 pt-3 pb-2 bg-white/60 border-b border-[#EBDAD0] flex items-center justify-between gap-3 shrink-0">
          <div className="flex rounded-2xl p-1 bg-[#F5EBE1] border border-[#EBDAD0] gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("CATALOG")}
              className={`px-4 py-1.5 text-xs font-heading font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "CATALOG"
                  ? "bg-[#CA340A] text-white shadow-xs"
                  : "text-[#8C5E51] hover:text-[#2C1710]"
              }`}
            >
              <UtensilsCrossed size={13} />
              <span>Menu Catalog ({menuItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CUSTOM")}
              className={`px-4 py-1.5 text-xs font-heading font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "CUSTOM"
                  ? "bg-[#CA340A] text-white shadow-xs"
                  : "text-[#8C5E51] hover:text-[#2C1710]"
              }`}
            >
              <Sparkles size={13} />
              <span>+ Add Custom Product</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div
            className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between shrink-0 transition-all ${
              feedback.type === "SUCCESS"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : "bg-red-50 text-red-800 border-b border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "SUCCESS" ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-red-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* TAB 1: MENU CATALOG */}
        {activeTab === "CATALOG" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search and Category Filter */}
            <div className="p-4 border-b border-[#EBDAD0] space-y-3 bg-white/40 shrink-0">
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
                <div className="h-64 flex flex-col items-center justify-center text-zinc-400 text-xs space-y-2">
                  <UtensilsCrossed size={32} />
                  <span>No dishes found matching &quot;{searchQuery}&quot;</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("CUSTOM")}
                    className="mt-2 px-3.5 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-[#CA340A] font-bold text-xs transition-colors cursor-pointer"
                  >
                    + Add &quot;{searchQuery}&quot; as Custom Product
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredItems.map((dish) => {
                    const qty = getQty(dish.id);
                    const isParcel = Boolean(itemParcelFlags[dish.id]);
                    const isAddingThis = addingId === dish.id;
                    const diet = getDishDiet(dish);
                    const isVeg = diet === "veg";
                    const hasImage = Boolean(dish.image && !brokenImages.has(dish.id));

                    return (
                      <div
                        key={dish.id}
                        className="p-3.5 bg-white rounded-2xl border border-[#EBDAD0] hover:border-zinc-300 shadow-xs flex flex-col justify-between transition-all"
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
                                className="font-heading font-extrabold text-xs text-[#2C1710] leading-snug line-clamp-2 min-h-[2.1rem] break-words"
                                title={dish.name}
                              >
                                {dish.name}
                              </h4>
                            </div>

                            <div className="mt-1 flex items-center justify-between gap-1 flex-wrap">
                              <span className="font-heading font-black text-xs text-[#CA340A]">
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

                        {/* Controls: Quantity, Parcel Checkbox, and Add Button */}
                        <div className="mt-3 pt-2.5 border-t border-zinc-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            {/* Stepper */}
                            <div className="flex items-center gap-1 bg-[#F5EBE1] border border-[#EBDAD0] rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() => setQty(dish.id, qty - 1)}
                                className="w-6 h-6 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="font-heading font-black text-xs text-[#CA340A] min-w-[20px] text-center">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQty(dish.id, qty + 1)}
                                className="w-6 h-6 rounded-lg bg-[#CA340A] hover:bg-[#B73F1D] text-white flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <Plus size={11} />
                              </button>
                            </div>

                            {/* Takeaway / Parcel Toggle */}
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-zinc-600 select-none">
                              <input
                                type="checkbox"
                                checked={isParcel}
                                onChange={() => toggleParcel(dish.id)}
                                className="rounded text-[#CA340A] focus:ring-[#CA340A] w-3.5 h-3.5"
                              />
                              <span>Takeaway</span>
                            </label>
                          </div>

                          <button
                            type="button"
                            disabled={isAddingThis}
                            onClick={() => handleAddCatalogItem(dish)}
                            className="w-full py-2 px-3 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isAddingThis ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Adding...</span>
                              </>
                            ) : (
                              <>
                                <Plus size={13} />
                                <span>Add to Order #{order.orderNumber} (₹{dish.price * qty})</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOM / MANUAL PRODUCT FORM */}
        {activeTab === "CUSTOM" && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-center items-center">
            <form
              onSubmit={handleAddCustomProduct}
              className="w-full max-w-lg bg-white rounded-3xl p-6 border border-[#EBDAD0] shadow-sm space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2">
                  <Tag size={20} />
                </div>
                <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                  Enter Manual Product Details
                </h3>
                <p className="text-xs text-zinc-500">
                  Add any off-menu item, custom preparation, or beverage directly to Order #{order.orderNumber}
                </p>
              </div>

              {/* Product Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase text-[#8C5E51]">
                  Product / Dish Name *
                </label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Special Cold Coffee, Double Egg Omelette, Water 1L"
                  className="w-full px-3.5 py-2.5 bg-[#FFFBF7] border border-[#EBDAD0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                  autoFocus
                />
              </div>

              {/* Price & Quantity Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold uppercase text-[#8C5E51]">
                    Unit Price (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-zinc-500 text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="120"
                      className="w-full pl-8 pr-3 py-2.5 bg-[#FFFBF7] border border-[#EBDAD0] rounded-xl text-xs font-bold text-[#CA340A] focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold uppercase text-[#8C5E51]">
                    Quantity *
                  </label>
                  <div className="flex items-center gap-2 bg-[#FFFBF7] border border-[#EBDAD0] rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setCustomQty((prev) => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="font-heading font-black text-sm text-[#CA340A] flex-1 text-center">
                      {customQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomQty((prev) => prev + 1)}
                      className="w-8 h-8 rounded-lg bg-[#CA340A] hover:bg-[#B73F1D] text-white flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Takeaway / Parcel Checkbox */}
              <div className="p-3 bg-[#FFFBF7] rounded-xl border border-[#EBDAD0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-amber-700" />
                  <div>
                    <p className="text-xs font-bold text-[#2C1710]">Pack as Takeaway / Parcel</p>
                    <p className="text-[10px] text-zinc-500">Appends &quot;(parcel)&quot; to the ticket for the kitchen</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={customIsParcel}
                  onChange={(e) => setCustomIsParcel(e.target.checked)}
                  className="w-4 h-4 rounded text-[#CA340A] focus:ring-[#CA340A] cursor-pointer"
                />
              </div>

              {/* Kitchen Note */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase text-[#8C5E51]">
                  Kitchen Instructions (Optional)
                </label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="text"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Less sugar, extra ice, serve immediately"
                    className="w-full pl-8 pr-3 py-2 bg-[#FFFBF7] border border-[#EBDAD0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
                  />
                </div>
              </div>

              {/* Total Preview and Submit */}
              <div className="pt-2 flex items-center gap-3">
                <div className="text-left flex-1">
                  <span className="text-[11px] text-zinc-500 font-bold block">Total Amount:</span>
                  <span className="font-heading font-black text-base text-[#CA340A]">
                    ₹{(parseFloat(customPrice) || 0) * customQty}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={addingCustom || !customName.trim() || !customPrice}
                  className="flex-1 py-3 px-4 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {addingCustom ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Adding to Order...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Add Custom Product</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
