"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  Lock,
  Printer,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Layers,
  ChefHat,
  RefreshCw,
} from "lucide-react";
import { menuData } from "@/data/menu";
import { DynamicMenuItem } from "@/lib/db";
import FoodIcon from "@/components/FoodIcon";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";
import PrinterStatusModal from "@/components/Admin/PrinterStatusModal";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  notes?: string;
}

type PrivatePurpose = "STAFF" | "OWNER" | "OTHER_INTERNAL";

export default function PrivateOrderPage() {
  const router = useRouter();

  // Menu items state
  const [menuItems, setMenuItems] = useState<DynamicMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [foodFilter, setFoodFilter] = useState<"ALL" | "VEG" | "NON-VEG">("ALL");

  // Private Order Details
  const [purpose, setPurpose] = useState<PrivatePurpose>("STAFF");
  const [privateNote, setPrivateNote] = useState("");

  // Cart
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Placed Order Result Modal
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);
  const [printingKot, setPrintingKot] = useState(false);
  const [kotPrintStatus, setKotPrintStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  const [kotPrintWarning, setKotPrintWarning] = useState<string | null>(null);
  const [kotPrintSuccess, setKotPrintSuccess] = useState<string | null>(null);
  const [manualSentNotice, setManualSentNotice] = useState<string | null>(null);

  // Kitchen Printer Live Status Hook (TCP 9100 CN811-UEWB)
  const printer = usePrinterStatus(8000);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);

  // Fetch dynamic menu
  const fetchMenu = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/menu/items");
      const json = await res.json();
      if (json.success && Array.isArray(json.items) && json.items.length > 0) {
        setMenuItems(json.items);
      } else {
        // Fallback to static menu data
        const fallback: DynamicMenuItem[] = menuData.map((it: any) => ({
          id: it.id,
          name: it.name,
          categoryId: it.categoryId || it.category?.toLowerCase() || "general",
          categoryName: it.category || "General",
          price: it.price,
          description: it.description || "",
          image: it.image || "",
          dietType: it.isVeg === false ? "non-veg" : "veg",
          badge: "none",
          rating: 4.8,
          reviewsCount: 100,
          available: it.isAvailable ?? true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        setMenuItems(fallback);
      }
    } catch (e) {
      console.warn("Using static menu fallback for private order:", e);
      const fallback: DynamicMenuItem[] = menuData.map((it: any) => ({
        id: it.id,
        name: it.name,
        categoryId: it.categoryId || it.category?.toLowerCase() || "general",
        categoryName: it.category || "General",
        price: it.price,
        description: it.description || "",
        image: it.image || "",
        dietType: it.isVeg === false ? "non-veg" : "veg",
        badge: "none",
        rating: 4.8,
        reviewsCount: 100,
        available: it.isAvailable ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      setMenuItems(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((it) => {
      const cat = it.categoryName || it.categoryId;
      if (cat) set.add(cat.toUpperCase());
    });
    return ["ALL", ...Array.from(set)];
  }, [menuItems]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.available) return false;

      // Category filter
      const itemCat = (item.categoryName || item.categoryId || "").toUpperCase();
      if (activeCategory !== "all" && itemCat !== activeCategory.toUpperCase()) {
        return false;
      }

      // Veg filter
      const isVegItem = item.dietType === "veg";
      if (foodFilter === "VEG" && !isVegItem) return false;
      if (foodFilter === "NON-VEG" && isVegItem) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = (item.categoryName || item.categoryId || "").toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesDesc) return false;
      }

      return true;
    });
  }, [menuItems, activeCategory, foodFilter, searchQuery]);

  // Cart operations
  const updateQuantity = (item: DynamicMenuItem, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (!existing && delta > 0) {
        next.set(item.id, {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          image: item.image || "",
        });
      } else if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          next.delete(item.id);
        } else {
          next.set(item.id, { ...existing, quantity: newQty });
        }
      }
      return next;
    });
  };

  const cartList = useMemo(() => Array.from(cart.values()), [cart]);
  const totalCartCount = useMemo(
    () => cartList.reduce((acc, it) => acc + it.quantity, 0),
    [cartList]
  );
  const totalCartAmount = useMemo(
    () => cartList.reduce((acc, it) => acc + it.price * it.quantity, 0),
    [cartList]
  );

  // Submit Private Order
  const handlePlacePrivateOrder = async () => {
    if (cartList.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/private-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          privateNote,
          items: cartList.map((it) => ({
            productId: it.id,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            image: it.image,
            notes: it.notes,
          })),
        }),
      });

      const json = await res.json();
      if (json.success && json.order) {
        setPlacedOrder(json.order);
        setCart(new Map());
        setIsDrawerOpen(false);
        // Automatically attempt to dispatch kitchen KOT
        dispatchPrivateKot(json.order.id);
      } else {
        alert(json.error || "Failed to create private order");
      }
    } catch (err: any) {
      console.error("Private order submission failed:", err);
      alert("Network error: Could not place private order.");
    } finally {
      setSubmitting(false);
    }
  };

  // Dispatch Kitchen KOT
  const dispatchPrivateKot = async (orderId: string) => {
    setPrintingKot(true);
    setKotPrintWarning(null);
    setKotPrintSuccess(null);
    setManualSentNotice(null);
    try {
      const res = await fetch("/api/admin/private-orders/kot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (json.success && json.printed) {
        setKotPrintSuccess(
          `KOT Ticket #${json.kotId || "GIVE ON COUNTER"} successfully sent to Kitchen CN811-UEWB printer!`
        );
        setKotPrintStatus({
          success: true,
          message: json.message || "Kitchen KOT sent to Kitchen CN811-UEWB (GIVE ON COUNTER)",
        });
      } else {
        const warning =
          json.warning ||
          "Print connection was interrupted. Please check with kitchen before resending to avoid duplicate tickets.";
        setKotPrintWarning(warning);
        setKotPrintStatus({
          success: false,
          message: warning,
        });
      }
    } catch (e: any) {
      const warning =
        "Print connection was interrupted. Please check with kitchen before resending to avoid duplicate tickets.";
      setKotPrintWarning(warning);
      setKotPrintStatus({
        success: false,
        message: "Could not reach local print connector on port 4318",
      });
    } finally {
      setPrintingKot(false);
    }
  };

  const handleMarkManualSent = () => {
    setKotPrintWarning(null);
    setManualSentNotice("Order recorded as manually handed over to the kitchen.");
    setKotPrintStatus({
      success: true,
      message: "Order recorded as manually handed over to the kitchen.",
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C1710] pb-32">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#2C1710]/10 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/tables"
              className="p-2 rounded-2xl bg-white border border-black/10 text-zinc-700 hover:bg-zinc-100 transition-colors shadow-2xs"
              title="Back to Tables Floor"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3A1710] text-[#FFF9F5] text-[10px] font-bold tracking-wider uppercase shadow-xs">
                  <Lock size={10} className="text-[#E2C7BA]" />
                  <span>Private Mode</span>
                </span>
                <h1 className="font-heading font-extrabold text-sm sm:text-base text-[#1a120c]">
                  Internal & Staff Ordering
                </h1>
              </div>
              <p className="text-[11px] text-[#2C1710]/70">
                Isolated internal tickets • Never affects customer sales or floor tables
              </p>
            </div>
          </div>

          {/* Prominent Counter Destination Pill & Kitchen Printer Status */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {/* Kitchen Printer Live Status Pill */}
            <button
              onClick={() => setPrinterModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white border border-black/10 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-xs cursor-pointer"
              title="Kitchen Thermal Printer Status (CN811-UEWB)"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  printer.status === "CONNECTED"
                    ? "bg-emerald-500 animate-pulse"
                    : printer.status === "WARNING"
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
              />
              <Printer size={15} />
              <span className="hidden sm:inline">
                {printer.status === "CONNECTED"
                  ? "Kitchen Printer Ready"
                  : printer.status === "WARNING"
                  ? "Printer Warning"
                  : "Printer Disconnected"}
              </span>
            </button>

            <div className="px-3.5 py-1.5 rounded-2xl bg-emerald-600 text-white font-black text-xs sm:text-sm tracking-wide shadow-sm flex items-center gap-1.5 animate-pulse">
              <span>📍 GIVE ON COUNTER</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Purpose Selector & Internal Notes Bar */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">
                1. Order Purpose
              </span>
              <div className="flex items-center gap-2 mt-1">
                {(
                  [
                    { id: "STAFF", label: "Staff (Food / Duty)" },
                    { id: "OWNER", label: "Owner (Personal / Friends)" },
                    { id: "OTHER_INTERNAL", label: "Other Internal" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPurpose(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      purpose === p.id
                        ? "bg-[#3A1710] text-white shadow-xs"
                        : "bg-[#FAF7F2] text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Internal Note Input */}
            <div className="sm:w-72">
              <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">
                Internal Note (Optional)
              </span>
              <input
                type="text"
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                placeholder="e.g. Chef lunch, Recipe test..."
                className="mt-1 w-full px-3 py-1.5 bg-[#FAF7F2] border border-black/10 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#3A1710]"
              />
            </div>
          </div>
        </section>

        {/* Search & Food Preference Filter */}
        <section className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food, coffee, burgers, drinks..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#CA340A]/30 shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Veg / Non-Veg Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-black/10 rounded-2xl shadow-xs self-start sm:self-auto">
            <button
              onClick={() => setFoodFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                foodFilter === "ALL"
                  ? "bg-[#3A1710] text-white shadow-2xs"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <FoodIcon nameOrId="veg-non-veg" className="w-4 h-3.5 shrink-0" />
              <span>All Items</span>
            </button>
            <button
              onClick={() => setFoodFilter("VEG")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                foodFilter === "VEG"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <FoodIcon nameOrId="veg" className="w-3.5 h-3.5 shrink-0" />
              <span>Veg</span>
            </button>
            <button
              onClick={() => setFoodFilter("NON-VEG")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                foodFilter === "NON-VEG"
                  ? "bg-red-600 text-white shadow-2xs"
                  : "text-red-700 hover:bg-red-50"
              }`}
            >
              <FoodIcon nameOrId="chicken" className="w-3.5 h-3.5 shrink-0" />
              <span>Non-Veg</span>
            </button>
          </div>
        </section>

        {/* Category Chips Scroll */}
        <section className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat.toLowerCase())}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory.toUpperCase() === cat
                  ? "bg-[#CA340A] text-white shadow-md shadow-[#CA340A]/20"
                  : "bg-white border border-black/10 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <FoodIcon nameOrId={cat} className="w-4 h-4 shrink-0" />
              <span>{cat}</span>
            </button>
          ))}
        </section>

        {/* Product Grid */}
        <section>
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw size={28} className="animate-spin text-[#CA340A] mx-auto" />
              <p className="text-xs text-zinc-500 font-semibold">Loading menu items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-black/5 shadow-sm space-y-2">
              <p className="text-sm font-bold text-zinc-700">No menu items found</p>
              <p className="text-xs text-zinc-500">Try adjusting your search or category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const inCart = cart.get(item.id);
                const qty = inCart?.quantity || 0;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-black/5 p-3.5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Thumbnail */}
                      <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-zinc-100 mb-3">
                        <Image
                          src={
                            item.image ||
                            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop"
                          }
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-cover"
                        />
                        {/* Veg / Non-Veg Indicator */}
                        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-xs p-1 rounded-md shadow-xs">
                          <span
                            className={`block w-2.5 h-2.5 rounded-full ${
                              item.dietType === "veg" ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Title & Category */}
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        {item.categoryName || item.categoryId}
                      </span>
                      <h3 className="font-heading font-extrabold text-sm text-[#1a120c] line-clamp-1">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5 mb-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Price & Quantity Controls */}
                    <div className="flex items-center justify-between pt-2 border-t border-black/5 mt-2">
                      <span className="font-heading font-extrabold text-sm text-[#CA340A]">
                        ₹{item.price}
                      </span>

                      {qty === 0 ? (
                        <button
                          onClick={() => updateQuantity(item, 1)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3A1710] text-white text-xs font-bold hover:bg-[#2C1710] transition-colors shadow-2xs cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Add</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 bg-[#FAF7F2] border border-black/10 rounded-xl p-1 shadow-2xs">
                          <button
                            onClick={() => updateQuantity(item, -1)}
                            className="w-6 h-6 rounded-lg bg-white text-zinc-700 flex items-center justify-center font-bold hover:bg-zinc-100 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-extrabold text-[#1a120c] w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => updateQuantity(item, 1)}
                            className="w-6 h-6 rounded-lg bg-[#3A1710] text-white flex items-center justify-center font-bold hover:bg-[#2C1710] transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#1a120c] text-white p-3.5 rounded-3xl shadow-2xl border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#CA340A] text-white flex items-center justify-center font-black text-sm shadow-md">
                {totalCartCount}
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">
                  Private Order Total
                </p>
                <p className="font-heading font-extrabold text-base text-white">
                  ₹{totalCartAmount.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-[#1a120c] text-xs font-extrabold hover:bg-zinc-100 transition-all cursor-pointer shadow-sm"
            >
              <span>Review & Place</span>
              <ShoppingBag size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Private Cart Drawer / Modal */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-black/10 flex items-center justify-between bg-[#FAF7F2]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-[#3A1710] text-[#FFF9F5] text-[10px] font-bold uppercase">
                    🔒 Private Order
                  </span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    GIVE ON COUNTER
                  </span>
                </div>
                <h2 className="font-heading font-extrabold text-base text-[#1a120c] mt-1">
                  Confirm Internal Ticket
                </h2>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-full hover:bg-zinc-200 transition-colors text-zinc-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Purpose & Note summary */}
            <div className="px-4 sm:px-5 py-3 bg-zinc-50 border-b border-black/5 flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-500">Purpose: </span>
                <span className="font-bold text-[#1a120c]">{purpose}</span>
              </div>
              {privateNote && (
                <div className="text-right max-w-[200px] truncate text-zinc-500">
                  Note: <span className="font-semibold text-zinc-800">{privateNote}</span>
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {cartList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FAF7F2] border border-black/5"
                >
                  <div className="flex-1">
                    <h4 className="font-bold text-xs sm:text-sm text-[#1a120c]">{item.name}</h4>
                    <p className="text-[11px] text-zinc-500">₹{item.price} each</p>
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-black/10 rounded-xl p-1 shadow-2xs">
                    <button
                      onClick={() =>
                        updateQuantity(
                          menuItems.find((m) => m.id === item.id) || (item as any),
                          -1
                        )
                      }
                      className="w-6 h-6 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center font-bold hover:bg-zinc-200"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="text-xs font-extrabold text-[#1a120c] w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(
                          menuItems.find((m) => m.id === item.id) || (item as any),
                          1
                        )
                      }
                      className="w-6 h-6 rounded-lg bg-[#3A1710] text-white flex items-center justify-center font-bold hover:bg-[#2C1710]"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  <div className="text-right w-16">
                    <span className="font-heading font-extrabold text-xs sm:text-sm text-[#CA340A]">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Drawer Footer & Checkout Action */}
            <div className="p-4 sm:p-5 border-t border-black/10 bg-[#FAF7F2] space-y-3">
              <div className="flex items-center justify-between font-heading font-extrabold">
                <span className="text-sm text-zinc-700">Internal Consumption Total</span>
                <span className="text-lg text-[#1a120c]">
                  ₹{totalCartAmount.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Kitchen Printer Live Status Bar inside drawer */}
              <div
                className={`text-xs p-3 rounded-2xl border transition-all ${
                  printer.status === "CONNECTED"
                    ? "bg-white border-black/5 text-zinc-700"
                    : "bg-amber-50 border-amber-300 text-amber-950 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        printer.status === "CONNECTED"
                          ? "bg-emerald-500 animate-pulse"
                          : printer.status === "WARNING"
                          ? "bg-amber-500"
                          : "bg-red-500 animate-pulse"
                      }`}
                    />
                    <Printer
                      size={15}
                      className={printer.status === "CONNECTED" ? "text-zinc-600" : "text-amber-700"}
                    />
                    <span className="text-xs font-bold">
                      Kitchen Printer:{" "}
                      {printer.status === "CONNECTED"
                        ? "Online (CN811-UEWB)"
                        : printer.status === "WARNING"
                        ? "Warning"
                        : "Disconnected"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrinterModalOpen(true)}
                    className="text-[11px] text-[#CA340A] font-bold hover:underline cursor-pointer"
                  >
                    Printer Info
                  </button>
                </div>
                {printer.status !== "CONNECTED" && (
                  <p className="text-[11px] text-amber-800 mt-1.5 pl-4">
                    Kitchen printer is currently unreachable. You can still confirm the order; you can retry KOT or mark manually sent on the next step.
                  </p>
                )}
              </div>

              <p className="text-[10px] text-zinc-500">
                Notice: This order is isolated and will only appear in Private Sales Analytics. It will
                not affect customer floor tables or tax billing.
              </p>

              <button
                onClick={handlePlacePrivateOrder}
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-[#CA340A] text-white font-extrabold text-sm hover:bg-[#B73F1D] transition-all shadow-md shadow-[#CA340A]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Sending KOT to Kitchen...</span>
                  </>
                ) : (
                  <>
                    <Printer size={16} />
                    <span>Confirm & Send KOT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Order Success & Kitchen KOT Modal */}
      {placedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 border border-black/10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-[#3A1710] text-[#FFF9F5] text-xs font-bold tracking-wider">
                {placedOrder.orderNumber}
              </span>
              <h2 className="font-heading font-extrabold text-xl text-[#1a120c] mt-2">
                Private Order Placed!
              </h2>
              <div className="inline-block mt-1 px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs">
                📍 Destination: GIVE ON COUNTER
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Purpose: <strong className="text-zinc-800">{placedOrder.privatePurpose}</strong> • Value:{" "}
                <strong className="text-zinc-800">₹{placedOrder.grandTotal}</strong>
              </p>
            </div>

            {/* Printing In Progress */}
            {printingKot && !kotPrintWarning && !kotPrintSuccess && (
              <div className="p-3.5 bg-stone-50 text-stone-800 rounded-2xl text-xs flex items-center justify-center gap-2 border border-stone-200">
                <RefreshCw size={14} className="animate-spin text-[#CA340A]" />
                <span className="font-medium text-stone-600">Transmitting KOT to Kitchen CN811-UEWB...</span>
              </div>
            )}

            {/* KOT Printing Success Notice */}
            {kotPrintSuccess && (
              <div className="p-3.5 bg-emerald-50 text-emerald-950 rounded-2xl text-xs flex items-center gap-2.5 border border-emerald-200 text-left">
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                <div>
                  <p className="font-bold">KOT Sent to Kitchen ✅</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">{kotPrintSuccess}</p>
                </div>
              </div>
            )}

            {/* Manual Sent Notice */}
            {manualSentNotice && (
              <div className="p-3.5 bg-stone-100 text-stone-900 rounded-2xl text-xs flex items-center gap-2.5 border border-stone-200 text-left">
                <ChefHat size={18} className="shrink-0 text-[#CA340A]" />
                <div>
                  <p className="font-bold text-stone-950">Manual KOT Recorded</p>
                  <p className="text-[11px] text-stone-600 mt-0.5">{manualSentNotice}</p>
                </div>
              </div>
            )}

            {/* Warning / Disconnection Banner matching Image 2 */}
            {kotPrintWarning && (
              <div className="p-4 bg-amber-50 text-amber-900 rounded-2xl text-xs space-y-2 border border-amber-300 shadow-xs text-left">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-950">
                      ⚠ Kitchen Printer Interrupted
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {kotPrintWarning}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => dispatchPrivateKot(placedOrder.id)}
                    disabled={printingKot}
                    className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    {printingKot ? "Retrying..." : "Resend KOT"}
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkManualSent}
                    className="flex-1 py-1.5 px-3 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Mark Manually Sent
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setPlacedOrder(null);
                  setKotPrintStatus(null);
                  setKotPrintWarning(null);
                  setKotPrintSuccess(null);
                  setManualSentNotice(null);
                }}
                className="flex-1 py-3 rounded-2xl bg-zinc-100 text-zinc-800 font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                New Private Order
              </button>

              <Link
                href="/admin/tables"
                className="flex-1 py-3 rounded-2xl bg-[#CA340A] text-white font-bold text-xs hover:bg-[#B73F1D] transition-colors cursor-pointer text-center"
              >
                Floor Tables
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Printer Status Diagnostic Modal */}
      <PrinterStatusModal
        isOpen={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        connectionState={printer}
        onRefreshStatus={() => printer.refresh()}
      />
    </div>
  );
}

