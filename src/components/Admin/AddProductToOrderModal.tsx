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
  const [activeCategory, setActiveCategory] = useState("");
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

  // Extract Categories (Without 'ALL' option)
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

  // Filter Items
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

  // Add Custom / Off-Menu Product
  const handleAddCustomProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const trimmed = customName.trim();
    const priceNum = parseFloat(customPrice);
    if (!trimmed || isNaN(priceNum) || priceNum < 0) {
      alert("Please provide a valid product name and price.");
      return;
    }

    setAddingCustom(true);
    setFeedback(null);

    const isParcel = customIsParcel;
    const finalName = isParcel && !trimmed.toLowerCase().includes("(parcel)")
      ? `${trimmed} - (parcel)`
      : trimmed;

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            productId: `custom_${Date.now()}`,
            name: finalName,
            price: priceNum,
            quantity: customQty,
            notes: isParcel ? `[PARCEL] ${customNote}`.trim() : customNote.trim() || undefined,
          },
          adminUser: "Counter Staff",
        }),
      });

      const data = await res.json();
      if (data.success) {
        const msg = `Added ${customQty}× "${finalName}" to Order #${order.orderNumber}`;
        setFeedback({ type: "SUCCESS", message: msg });
        onItemAdded(msg);
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
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[96vw] h-[92vh] lg:w-[75vw] lg:h-[75vh] max-w-[1450px] max-h-[850px] bg-[#FAF6F0] rounded-3xl border border-[#CA340A]/20 shadow-2xl flex flex-col overflow-hidden text-[#2C1710] font-sans animate-in zoom-in-95 duration-150">
        {/* ========================================================= */}
        {/* TOP HEADER (Orange & Half-White Brand Gallery Style) */}
        {/* ========================================================= */}
        <header className="h-14 bg-[#FFF9F5] border-b border-[#CA340A]/15 flex items-center justify-between shrink-0 shadow-2xs z-20">
          {/* Left: Brand / Table Info */}
          <div className="w-52 sm:w-60 h-full bg-[#2C1710] text-[#FFF9F5] px-4 flex items-center justify-between border-r border-[#CA340A]/20 shrink-0">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-lg bg-[#CA340A] flex items-center justify-center text-white shrink-0 shadow-xs">
                <Plus size={17} />
              </div>
              <div className="truncate">
                <span className="font-heading font-black text-xs tracking-wider block text-white truncate uppercase">
                  TABLE {tableNumber}
                </span>
                <span className="text-[10px] text-[#E2C7BA] font-semibold block truncate">
                  Add to Order #{order.orderNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Search Product Bar */}
          <div className="flex-1 max-w-2xl px-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Product..."
                className="w-full pl-10 pr-4 py-2 bg-white hover:bg-white border border-[#CA340A]/20 rounded-xl text-xs sm:text-sm font-semibold text-[#2C1710] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#CA340A] focus:border-[#CA340A] transition-all shadow-2xs"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Custom Product toggle */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "CUSTOM" ? "CATALOG" : "CUSTOM")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === "CUSTOM"
                  ? "bg-[#CA340A] text-white shadow-xs"
                  : "bg-white hover:bg-[#FFF0EB] text-[#CA340A] border border-[#CA340A]/30"
              }`}
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">
                {activeTab === "CUSTOM" ? "Catalog View" : "+ Custom Product"}
              </span>
            </button>
          </div>

          {/* Right: Close Button */}
          <div className="h-full flex items-center pr-3">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-[#2C1710] hover:bg-[#CA340A] text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              aria-label="Close"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* FEEDBACK NOTIFICATION */}
        {feedback && (
          <div
            className={`px-5 py-2 text-xs font-bold flex items-center justify-between shrink-0 ${
              feedback.type === "SUCCESS"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : "bg-red-50 text-red-800 border-b border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "SUCCESS" ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={15} className="text-red-600 shrink-0" />
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

        {/* ========================================================= */}
        {/* 2-COLUMN BODY: CATEGORIES (LEFT) | PRODUCTS (MIDDLE/RIGHT) */}
        {/* ========================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* COLUMN 1: CATEGORIES SIDEBAR */}
          <aside className="w-52 sm:w-60 bg-[#FFF9F5] flex flex-col h-full shrink-0 border-r border-[#CA340A]/15 overflow-y-auto py-2 pr-1">
            <div className="space-y-1">
              {categories.map((cat) => {
                const isActive = activeCategory === cat && activeTab === "CATALOG";
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveTab("CATALOG");
                      setActiveCategory(cat);
                    }}
                    className={`w-full text-left font-black tracking-wide text-xs uppercase transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? "bg-[#CA340A] text-white py-3.5 px-4 rounded-r-2xl shadow-md shadow-[#CA340A]/20 font-black translate-x-1"
                        : "text-[#52525b] hover:text-[#2C1710] hover:bg-[#FFF0EB] py-3 px-4 rounded-r-xl font-bold"
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-white shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* COLUMN 2: PRODUCTS OR CUSTOM FORM */}
          <main className="flex-1 bg-[#FAF6F0] h-full overflow-y-auto p-4 sm:p-5 flex flex-col">
          {activeTab === "CUSTOM" ? (
            <div className="flex-1 flex flex-col justify-center items-center py-8">
              <form
                onSubmit={handleAddCustomProduct}
                className="w-full max-w-lg bg-white rounded-3xl p-6 border border-zinc-200 shadow-md space-y-4"
              >
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2">
                    <Tag size={20} />
                  </div>
                  <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                    Enter Manual Product Details
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Add any off-menu item directly to Table {tableNumber} (Order #{order.orderNumber})
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold uppercase text-[#8C5E51]">
                    Product / Dish Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Special Cold Coffee, Double Egg Omelette"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                    autoFocus
                  />
                </div>

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
                        className="w-full pl-8 pr-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-[#CA340A] focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold uppercase text-[#8C5E51]">
                      Quantity *
                    </label>
                    <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-300 rounded-xl p-1">
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
                        className="w-8 h-8 rounded-lg bg-[#CA340A] hover:bg-[#A72B08] text-white flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={16} className="text-amber-700" />
                    <div>
                      <p className="text-xs font-bold text-zinc-900">Pack as Takeaway / Parcel</p>
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
                      className="w-full pl-8 pr-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
                    />
                  </div>
                </div>

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
                    className="flex-1 py-3 px-4 bg-[#CA340A] hover:bg-[#A72B08] text-white font-heading font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {addingCustom ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Adding...</span>
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
          ) : loadingMenu ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs py-16">
              <Loader2 size={28} className="animate-spin text-[#CA340A] mb-2" />
              <span>Loading menu catalog...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-xs py-16">
              <UtensilsCrossed size={36} className="mb-2 opacity-50" />
              <span className="font-semibold text-sm">No products found in category "{activeCategory}"</span>
              {searchQuery && <p className="text-xs text-zinc-500 mt-1">Try clearing your search query</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredItems.map((dish) => {
                const qty = getQty(dish.id);
                const isParcel = Boolean(itemParcelFlags[dish.id]);
                const isAddingThis = addingId === dish.id;
                const diet = getDishDiet(dish);
                const isVeg = diet === "veg";

                return (
                  <div
                    key={dish.id}
                    className="bg-white rounded-2xl p-4 border border-[#CA340A]/15 hover:border-[#CA340A] hover:shadow-md transition-all duration-150 flex flex-col justify-between min-h-[136px] group relative"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <h4
                          className="font-bold text-xs sm:text-sm text-[#2C1710] leading-snug line-clamp-2 group-hover:text-[#CA340A] transition-colors"
                          title={dish.name}
                        >
                          {dish.name}
                        </h4>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                            isVeg ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                          title={isVeg ? "Pure Veg" : "Non-Veg"}
                        />
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-zinc-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-heading font-black text-sm sm:text-base text-[#CA340A] tracking-tight">
                          ₹{dish.price}
                        </span>

                        {/* Stepper & Parcel Toggle (Enlarged for touch & quick tap) */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleParcel(dish.id)}
                            className={`h-7 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                              isParcel
                                ? "bg-[#FFF0EB] text-[#CA340A] border border-[#CA340A]/40 shadow-2xs"
                                : "bg-zinc-100 text-zinc-600 hover:bg-[#FFF0EB] hover:text-[#CA340A]"
                            }`}
                            title="Toggle parcel"
                          >
                            <ShoppingBag size={13} />
                            <span className="text-[10px]">Parcel</span>
                          </button>

                          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200">
                            <button
                              type="button"
                              onClick={() => setQty(dish.id, qty - 1)}
                              className="w-6 h-6 rounded-md bg-white hover:bg-zinc-200 text-zinc-800 flex items-center justify-center cursor-pointer text-xs font-bold shadow-2xs"
                            >
                              -
                            </button>
                            <span className="font-bold text-xs min-w-[20px] text-center font-mono text-[#2C1710]">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQty(dish.id, qty + 1)}
                              className="w-6 h-6 rounded-md bg-[#CA340A] text-white flex items-center justify-center cursor-pointer text-xs font-bold shadow-2xs hover:bg-[#A72B08]"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isAddingThis}
                        onClick={() => handleAddCatalogItem(dish)}
                        className="w-full py-2 px-3 bg-[#CA340A] hover:bg-[#A72B08] text-white font-heading font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
                      >
                        {isAddingThis ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Adding...</span>
                          </>
                        ) : (
                          <>
                            <Plus size={13} />
                            <span>Add {qty > 1 ? `(${qty}×)` : ""}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
      </div>
    </div>
  );
}
