"use client";

import React, { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import Link from "next/link";
import {
  ClipboardCheck,
  CheckCircle2,
  Circle,
  Search,
  RefreshCw,
  ArrowLeft,
  Calendar,
  Sparkles,
  Save,
  Check,
  Lock,
  RotateCcw,
} from "lucide-react";
import {
  InventoryCategory,
  InventoryDay,
  InventoryDayItem,
  getKolkataDateString,
} from "@/types/inventory";

interface GroupedCategory {
  category: InventoryCategory;
  items: InventoryDayItem[];
  total: number;
  counted: number;
  isDone: boolean;
}

export default function StockChecklistPage() {
  const todayDate = useMemo(() => getKolkataDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);

  // Reopen Day Register for Corrections
  const reopenDay = async () => {
    if (!day) return;
    setReopening(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/inventory/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayId: day.id,
          action: "reopen",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to reopen day register");
      }
      setDay(json.day);
      setSuccessToast("✅ Register reopened for corrections! You can now update counts.");
      setTimeout(() => setSuccessToast(null), 4000);
      fetchChecklist(selectedDate);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reopen day register");
    } finally {
      setReopening(false);
    }
  };

  const [day, setDay] = useState<InventoryDay | null>(null);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [grouped, setGrouped] = useState<GroupedCategory[]>([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalCounted: 0,
    progressPercent: 0,
    isComplete: false,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Local physical quantity input state map (ingredientId -> number string)
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const fetchChecklist = async (dateStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/checklist?date=${dateStr}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load checklist");

      setDay(json.day);
      setCategories(json.categories || []);
      setGrouped(json.grouped || []);
      setStats(json.stats || { totalItems: 0, totalCounted: 0, progressPercent: 0, isComplete: false });

      // Populate inputValues from existing closing_actual_qty
      const initialInputs: Record<string, string> = {};
      (json.grouped || []).forEach((g: GroupedCategory) => {
        g.items.forEach((item: InventoryDayItem) => {
          if (item.closing_actual_qty !== null && item.closing_actual_qty !== undefined) {
            initialInputs[item.ingredient_id] = item.closing_actual_qty.toString();
          }
        });
      });
      setInputValues(initialInputs);
    } catch (err: any) {
      console.error("Checklist fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist(selectedDate);
  }, [selectedDate]);

  // Handle single item count update
  const handleItemCountUpdate = async (
    ingredientId: string,
    physicalQty: number | null,
    isCounted: boolean
  ) => {
    if (!day) return;
    setSavingItem(ingredientId);

    try {
      const res = await fetch("/api/admin/inventory/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayId: day.id,
          ingredientId,
          physicalQty,
          isCounted,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update count");

      // Update local state without full reload
      setGrouped((prev) =>
        prev.map((g) => {
          const itemIdx = g.items.findIndex((i) => i.ingredient_id === ingredientId);
          if (itemIdx === -1) return g;
          const updatedItems = [...g.items];
          updatedItems[itemIdx] = {
            ...updatedItems[itemIdx],
            closing_actual_qty: physicalQty,
            is_counted: isCounted,
          };
          const countedCount = updatedItems.filter((i) => i.is_counted).length;
          return {
            ...g,
            items: updatedItems,
            counted: countedCount,
            isDone: countedCount === updatedItems.length,
          };
        })
      );

      // Re-sum stats
      setStats((prev) => {
        const newCounted = isCounted ? prev.totalCounted + 1 : Math.max(0, prev.totalCounted - 1);
        const pct = prev.totalItems > 0 ? Math.round((newCounted / prev.totalItems) * 100) : 0;
        return {
          ...prev,
          totalCounted: newCounted,
          progressPercent: pct,
          isComplete: newCounted === prev.totalItems,
        };
      });

      setSuccessToast("Count saved");
      setTimeout(() => setSuccessToast(null), 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save count");
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setSavingItem(null);
    }
  };

  // Toggle counted status
  const handleToggleCounted = (item: InventoryDayItem) => {
    const rawVal = inputValues[item.ingredient_id];
    let qty: number | null = null;
    if (rawVal !== undefined && rawVal !== "") {
      const parsed = parseFloat(rawVal);
      qty = isNaN(parsed) ? 0 : Math.max(0, parsed);
    } else if (item.closing_actual_qty !== null && item.closing_actual_qty !== undefined) {
      qty = item.closing_actual_qty;
    } else {
      qty = 0; // default counted to 0 if empty
      setInputValues((prev) => ({ ...prev, [item.ingredient_id]: "0" }));
    }

    const nextCounted = !item.is_counted;
    handleItemCountUpdate(item.ingredient_id, nextCounted ? qty : null, nextCounted);
  };

  // On blur of Qty input, save count
  const handleQtyBlur = (item: InventoryDayItem) => {
    const rawVal = inputValues[item.ingredient_id];
    if (rawVal === undefined || rawVal === "") {
      // If user clears the input
      if (item.is_counted) {
        handleItemCountUpdate(item.ingredient_id, null, false);
      }
      return;
    }

    const parsed = parseFloat(rawVal);
    const qty = isNaN(parsed) ? 0 : Math.max(0, parsed);
    handleItemCountUpdate(item.ingredient_id, qty, true);
  };

  // Filter groups
  const filteredGroups = useMemo(() => {
    return grouped
      .filter((g) => selectedCategory === "ALL" || g.category.id === selectedCategory)
      .map((g) => {
        if (!searchQuery) return g;
        const matchingItems = g.items.filter(
          (i) =>
            i.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.ingredient_number.toString().includes(searchQuery)
        );
        return {
          ...g,
          items: matchingItems,
        };
      })
      .filter((g) => g.items.length > 0);
  }, [grouped, selectedCategory, searchQuery]);

  return (
    <AdminLayout>
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* TOP BAR / NAVIGATION */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/inventory"
            className="flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-[#CA340A] transition"
          >
            <ArrowLeft size={16} />
            <span>Back to Inventory Register</span>
          </Link>

          {successToast && (
            <div className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-md animate-fade-in flex items-center gap-1.5">
              <Check size={14} />
              <span>{successToast}</span>
            </div>
          )}
        </div>

        {/* HERO CARD: DAILY STOCK CHECKLIST (Matches Mockup 3) */}
        <div className="bg-[#2C1710] text-[#FFF9F5] rounded-3xl p-6 shadow-xl border border-[#CA340A]/20 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#E2C7BA]">
                <ClipboardCheck size={16} className="text-amber-400" />
                <span>Physical Stock Count</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight mt-1">Daily Stock Checklist</h1>
              <p className="text-xs text-[#E2C7BA]/80 mt-0.5">
                Fast handheld stock taking for kitchen and cold storage staff
              </p>
            </div>

            {/* Total Counted Pill (Mockup 3 top right) */}
            <div className="self-start sm:self-center bg-white/10 px-4 py-2 rounded-2xl border border-white/15 text-center">
              <div className="text-sm sm:text-base font-black text-amber-300">
                {stats.totalCounted}/{stats.totalItems} counted
              </div>
              <div className="text-[10px] text-zinc-300 uppercase tracking-wider font-semibold">
                {stats.progressPercent}% Completed
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-black/30 rounded-full h-2.5 mt-5 overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
        </div>

        {/* LOCKED FINALIZED BANNER WITH REOPEN ACTION */}
        {day?.status === "FINALIZED" && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <div className="text-xs font-black tracking-wide uppercase text-amber-800">
                  REGISTER FINALIZED &amp; LOCKED
                </div>
                <p className="text-xs text-amber-900/80 mt-0.5">
                  Today&apos;s counts are locked by {day.finalized_by || "Manager"}. Need to change or correct counts?
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={reopenDay}
              disabled={reopening}
              className="px-4 py-2 bg-[#2C1710] hover:bg-black text-[#FFF9F5] text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RotateCcw size={14} className={reopening ? "animate-spin" : ""} />
              <span>{reopening ? "Reopening..." : "Reopen for Corrections"}</span>
            </button>
          </div>
        )}

        {/* ERROR MESSAGE BANNER */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center justify-between text-xs font-bold shadow-xs">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* CONTROLS: CATEGORY PILLS & SEARCH */}
        <div className="space-y-3">
          {/* Category Filter Horizontal Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === "ALL"
                  ? "bg-[#2C1710] text-[#FFF9F5] shadow-sm"
                  : "bg-white text-zinc-700 hover:bg-neutral-100 border border-zinc-200"
              }`}
            >
              All Sections
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? "bg-[#2C1710] text-[#FFF9F5] shadow-sm"
                    : "bg-white text-zinc-700 hover:bg-neutral-100 border border-zinc-200"
                }`}
              >
                {cat.code}. {cat.name}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search ingredient (e.g. Mozzarella, Bun, Milk)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-zinc-200 text-xs font-medium text-zinc-900 focus:outline-hidden focus:border-[#CA340A] shadow-xs"
            />
          </div>
        </div>

        {/* CHECKLIST ITEMS BY CATEGORY (Matches Mockup 3) */}
        {loading ? (
          <div className="py-20 text-center text-zinc-400 font-medium">
            Loading stock checklist...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-zinc-300 text-zinc-500 text-xs">
            No ingredients found.
          </div>
        ) : (
          filteredGroups.map((g) => {
            const cat = g.category;
            const pct = g.total > 0 ? Math.round((g.counted / g.total) * 100) : 0;

            return (
              <div
                key={cat.id}
                className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden"
              >
                {/* Category Header (Mockup 3: C. Bread & Bakery 0%) */}
                <div className="bg-[#FAF9F5] px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-[#2C1710] text-white flex items-center justify-center font-black text-xs">
                      {cat.code}
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-zinc-900">
                      {cat.name}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-500">
                      {g.counted}/{g.total}
                    </span>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                        g.isDone
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Ingredients List */}
                <div className="divide-y divide-zinc-100">
                  {g.items.map((item) => {
                    const isCounted = item.is_counted;
                    const isSaving = savingItem === item.ingredient_id;
                    const val =
                      inputValues[item.ingredient_id] !== undefined
                        ? inputValues[item.ingredient_id]
                        : item.closing_actual_qty !== null && item.closing_actual_qty !== undefined
                        ? item.closing_actual_qty.toString()
                        : "";

                    return (
                      <div
                        key={item.id}
                        className={`px-6 py-3.5 flex items-center justify-between gap-4 transition ${
                          isCounted ? "bg-emerald-50/20" : "hover:bg-zinc-50"
                        }`}
                      >
                        {/* Left: Item Name and Unit (Mockup 3: Burger Bun / pcs) */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-zinc-950 truncate">
                            {item.ingredient_name}
                          </div>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {item.unit}
                          </span>
                        </div>

                        {/* Right: Qty Input and Counted Toggle (Mockup 3) */}
                        <div className="flex items-center gap-3">
                          {/* Qty Input Box */}
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="Qty"
                              value={val}
                              onChange={(e) =>
                                setInputValues({
                                  ...inputValues,
                                  [item.ingredient_id]: e.target.value,
                                })
                              }
                              onBlur={() => handleQtyBlur(item)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className={`w-20 sm:w-24 px-3 py-2 text-center rounded-xl border text-xs font-bold transition focus:outline-hidden ${
                                isCounted
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-900 focus:border-emerald-500"
                                  : "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-[#CA340A]"
                              }`}
                            />
                          </div>

                          {/* Counted Button / Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleCounted(item)}
                            disabled={isSaving}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                              isCounted
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200"
                            }`}
                          >
                            {isCounted ? (
                              <>
                                <CheckCircle2 size={15} />
                                <span>Counted</span>
                              </>
                            ) : (
                              <>
                                <Circle size={15} className="text-zinc-400" />
                                <span>Count</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}

