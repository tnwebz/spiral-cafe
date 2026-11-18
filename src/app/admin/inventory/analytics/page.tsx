"use client";

import React, { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Printer,
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  Package,
  Layers,
  Truck,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  CheckCircle2,
  PieChart as PieChartIcon,
  HelpCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { getKolkataDateString } from "@/types/inventory";

interface AnalyticsData {
  startDate: string;
  endDate: string;
  totalFinalizedDays: number;
  totalConsumptionCost: number;
  totalPurchasedCost: number;
  totalWastageCost: number;
  latestClosingStockValue: number;
  latestFinalizedDate: string | null;
  missingCostItemsCount: number;
  dailyConsumptionTrend: Array<{
    date: string;
    consumptionCost: number;
    purchasedCost: number;
    wastageCost: number;
  }>;
  categoryConsumption: Array<{
    categoryId: string;
    categoryCode: string;
    categoryName: string;
    consumptionCost: number;
    purchasedCost: number;
    closingStockValue: number;
  }>;
  highestConsumptionIngredients: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    usedQty: number;
    consumptionCost: number;
    avgUnitCost: number;
  }>;
  mostUsedIngredients: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    usedQty: number;
  }>;
  mostWastedIngredients: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    wastageQty: number;
    wastageCost: number;
  }>;
  purchasesHistory: Array<{
    id: string;
    date: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalCost: number;
    supplier: string | null;
  }>;
}

export default function InventoryAnalyticsPage() {
  const today = useMemo(() => getKolkataDateString(), []);

  // Quick preset ranges
  const [filterPreset, setFilterPreset] = useState<"today" | "yesterday" | "week" | "month" | "custom">("month");
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to first day of current month
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState<string>(today);

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"consumption" | "categories" | "usage" | "wastage" | "purchases">("consumption");

  // Handle Preset changes
  const applyPreset = (preset: "today" | "yesterday" | "week" | "month" | "custom") => {
    setFilterPreset(preset);
    const now = new Date();

    if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = getKolkataDateString(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "week") {
      // Last 7 days
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      setStartDate(getKolkataDateString(w));
      setEndDate(today);
    } else if (preset === "month") {
      // Month to date
      const mStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      setStartDate(mStart);
      setEndDate(today);
    }
  };

  // Fetch Analytics
  const fetchAnalytics = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/inventory/analytics?startDate=${startDate}&endDate=${endDate}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load analytics data");
      }
      setData(json);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  // Export CSV
  const handleExportCSV = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push(`SPIRAL CAFE — INVENTORY ANALYTICS REPORT`);
    lines.push(`Period: ${data.startDate} to ${data.endDate}`);
    lines.push(`Finalized Days Analyzed: ${data.totalFinalizedDays}`);
    lines.push("");
    lines.push("SUMMARY METRICS (₹)");
    lines.push(`Total Consumption Cost: Rs. ${data.totalConsumptionCost.toFixed(2)}`);
    lines.push(`Total Purchased Cost: Rs. ${data.totalPurchasedCost.toFixed(2)}`);
    lines.push(`Total Wastage Cost: Rs. ${data.totalWastageCost.toFixed(2)}`);
    lines.push(`Latest Closing Stock Value: Rs. ${data.latestClosingStockValue.toFixed(2)}`);
    lines.push("");

    lines.push("CATEGORY BREAKDOWN");
    lines.push("Code,Category,Consumption Cost (Rs),Purchased Cost (Rs),Closing Stock Value (Rs)");
    for (const c of data.categoryConsumption) {
      lines.push(
        `"${c.categoryCode}","${c.categoryName}",${c.consumptionCost.toFixed(2)},${c.purchasedCost.toFixed(2)},${c.closingStockValue.toFixed(2)}`
      );
    }
    lines.push("");

    lines.push("TOP CONSUMPTION INGREDIENTS (₹)");
    lines.push("Ingredient,Unit,Used Qty,Avg Unit Cost (Rs),Total Consumption Cost (Rs)");
    for (const ing of data.highestConsumptionIngredients) {
      lines.push(
        `"${ing.ingredientName}","${ing.unit}",${ing.usedQty},${ing.avgUnitCost.toFixed(2)},${ing.consumptionCost.toFixed(2)}`
      );
    }
    lines.push("");

    lines.push("PURCHASES LOG");
    lines.push("Date,Ingredient,Quantity,Unit,Price Per Unit (Rs),Total Cost (Rs),Supplier");
    for (const p of data.purchasesHistory) {
      lines.push(
        `"${p.date}","${p.ingredientName}",${p.quantity},"${p.unit}",${p.pricePerUnit.toFixed(2)},${p.totalCost.toFixed(2)},"${p.supplier || ""}"`
      );
    }

    const csvContent = lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `spiral_cafe_inventory_analytics_${data.startDate}_to_${data.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 print:p-0 print:space-y-4">
        {/* TOP HEADER */}
        <div className="bg-[#2C1710] text-[#FFF9F5] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-[#CA340A]/20">
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#CA340A]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-[#CA340A]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/admin/inventory"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[#FFF9F5] text-xs font-semibold transition"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Inventory Register</span>
                </Link>
                <span className="px-2.5 py-0.5 rounded-full bg-[#CA340A]/30 text-[#FFF9F5] text-[10px] font-bold tracking-widest uppercase border border-[#CA340A]/40">
                  Financial Analytics
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#FFF9F5]">
                Inventory Financials & Usage
              </h1>
              <p className="text-xs sm:text-sm text-[#E2C7BA] mt-1 max-w-xl">
                Manual stock movement analytics, cost of ingredients consumed, purchases log, and moving weighted-average valuations.
              </p>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center gap-3 print:hidden">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFF9F5] border border-white/15 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Printer size={15} />
                <span>Print Report</span>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={!data}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#CA340A] hover:bg-[#b02d08] text-white text-xs font-bold transition shadow-md disabled:opacity-50 cursor-pointer"
              >
                <Download size={15} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* DATE RANGE CONTROLS */}
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 print:hidden">
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-2xl border border-white/10">
              {(
                [
                  { id: "today", label: "Today" },
                  { id: "yesterday", label: "Yesterday" },
                  { id: "week", label: "This Week (7d)" },
                  { id: "month", label: "This Month" },
                  { id: "custom", label: "Custom Range" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    filterPreset === p.id
                      ? "bg-[#CA340A] text-white shadow-xs"
                      : "text-[#E2C7BA] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-[#FFF9F5] px-3 py-1.5 rounded-xl text-[#2C1710] font-semibold border border-white/20">
                <Calendar size={13} className="text-[#CA340A]" />
                <span className="text-zinc-500 text-[11px]">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setFilterPreset("custom");
                    setStartDate(e.target.value);
                  }}
                  className="bg-transparent border-none text-xs font-bold text-[#2C1710] focus:outline-hidden"
                />
              </div>

              <span className="text-[#E2C7BA] font-bold">—</span>

              <div className="flex items-center gap-1.5 bg-[#FFF9F5] px-3 py-1.5 rounded-xl text-[#2C1710] font-semibold border border-white/20">
                <Calendar size={13} className="text-[#CA340A]" />
                <span className="text-zinc-500 text-[11px]">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setFilterPreset("custom");
                    setEndDate(e.target.value);
                  }}
                  className="bg-transparent border-none text-xs font-bold text-[#2C1710] focus:outline-hidden"
                />
              </div>

              <button
                onClick={fetchAnalytics}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFF9F5] transition cursor-pointer"
                title="Refresh Analytics"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* INCOMPLETE VALUATION WARNING BANNER */}
        {data && data.missingCostItemsCount > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold">Incomplete Stock Valuation: </span>
              {data.missingCostItemsCount} ingredient(s) do not have purchase costs set.
              Their usage and closing stock values cannot be calculated and are excluded from the totals until purchase prices are entered.
            </div>
          </div>
        )}

        {/* 4 BENTO SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Consumption Cost */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-xs relative overflow-hidden group hover:border-[#CA340A]/40 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Total Consumption Cost
              </span>
              <span className="p-2 rounded-xl bg-orange-50 text-[#CA340A]">
                <TrendingUp size={16} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight">
              ₹{data ? data.totalConsumptionCost.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
            </div>
            <div className="text-[11px] text-zinc-500 mt-2">
              Cost of ingredients consumed in kitchen based on manual counts.
            </div>
          </div>

          {/* 2. Total Purchased Cost */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-xs relative overflow-hidden group hover:border-emerald-500/40 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Purchases Recorded
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Truck size={16} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono tracking-tight">
              ₹{data ? data.totalPurchasedCost.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
            </div>
            <div className="text-[11px] text-zinc-500 mt-2">
              Total stock purchased from suppliers during this period.
            </div>
          </div>

          {/* 3. Total Wastage Cost */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-xs relative overflow-hidden group hover:border-red-500/40 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Wastage / Scrap Cost
              </span>
              <span className="p-2 rounded-xl bg-red-50 text-red-600">
                <Trash2 size={16} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-600 font-mono tracking-tight">
              ₹{data ? data.totalWastageCost.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
            </div>
            <div className="text-[11px] text-zinc-500 mt-2">
              Estimated financial loss due to kitchen scrap and spoilage.
            </div>
          </div>

          {/* 4. Latest Closing Stock Value */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-xs relative overflow-hidden group hover:border-[#2C1710]/40 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Closing Stock Value
              </span>
              <span className="p-2 rounded-xl bg-[#FAF9F5] text-[#2C1710] border border-zinc-200">
                <Package size={16} />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight">
              ₹{data ? data.latestClosingStockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
            </div>
            <div className="text-[11px] text-zinc-500 mt-2">
              Current floor inventory valuation on {data?.latestFinalizedDate || "latest count"}.
            </div>
          </div>
        </div>

        {/* SECTION TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-white/70 p-2 rounded-2xl border border-zinc-200/80 shadow-xs print:hidden">
          {[
            { id: "consumption", label: "Top Consumed (₹)", icon: TrendingUp },
            { id: "categories", label: "Category Breakdown", icon: Layers },
            { id: "usage", label: "Most Used (Qty)", icon: Package },
            { id: "wastage", label: "Wastage Analysis", icon: Trash2 },
            { id: "purchases", label: "Purchases Log", icon: Truck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#2C1710] text-[#FFF9F5] shadow-xs"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="py-20 text-center text-zinc-400 font-medium">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#CA340A]" />
            Loading financial analytics...
          </div>
        )}

        {/* ERROR STATE */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 text-red-900 border border-red-200 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {!loading && data && (
          <>
            {/* TAB 1: HIGHEST CONSUMPTION INGREDIENTS (₹) */}
            {activeTab === "consumption" && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-zinc-950">
                        Top Consumed Ingredients by Cost (₹)
                      </h2>
                      <p className="text-xs text-zinc-500">
                        Ingredients generating the largest cost of goods used during {data.startDate} to {data.endDate}.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      {data.highestConsumptionIngredients.length} items ranked
                    </span>
                  </div>

                  {data.highestConsumptionIngredients.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 text-xs">
                      No consumption recorded for this period yet. Finalize daily registers with counts to populate.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                            <th className="py-3 px-4 w-12 text-center">Rank</th>
                            <th className="py-3 px-4">Ingredient</th>
                            <th className="py-3 px-4 text-center">Total Used Qty</th>
                            <th className="py-3 px-4 text-center">Avg Unit Cost</th>
                            <th className="py-3 px-4 text-right">Total Consumption Cost (₹)</th>
                            <th className="py-3 px-4 text-right">% of Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {data.highestConsumptionIngredients.map((item, idx) => {
                            const pct =
                              data.totalConsumptionCost > 0
                                ? ((item.consumptionCost / data.totalConsumptionCost) * 100).toFixed(1)
                                : "0.0";

                            return (
                              <tr key={item.ingredientId} className="hover:bg-zinc-50 transition">
                                <td className="py-3 px-4 text-center font-mono font-bold text-zinc-400">
                                  #{idx + 1}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-zinc-950 text-sm">
                                    {item.ingredientName}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-zinc-700">
                                  {item.usedQty} {item.unit}
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-zinc-500">
                                  ₹{item.avgUnitCost.toFixed(2)}/{item.unit}
                                </td>
                                <td className="py-3 px-4 text-right font-black font-mono text-[#CA340A] text-sm">
                                  ₹{item.consumptionCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-zinc-500">
                                  <span className="px-2 py-0.5 rounded-full bg-orange-50 text-[#CA340A] text-[11px] font-bold">
                                    {pct}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CATEGORY BREAKDOWN */}
            {activeTab === "categories" && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-zinc-950">
                      Category Financial Breakdown
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Financial consumption cost, purchases, and closing stock valuation organized across categories.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                          <th className="py-3 px-4 w-14 text-center">Code</th>
                          <th className="py-3 px-4">Category Name</th>
                          <th className="py-3 px-4 text-right">Consumption Cost (₹)</th>
                          <th className="py-3 px-4 text-right">Purchases (₹)</th>
                          <th className="py-3 px-4 text-right">Closing Valuation (₹)</th>
                          <th className="py-3 px-4 text-right">Share of Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {data.categoryConsumption.map((cat) => {
                          const pct =
                            data.totalConsumptionCost > 0
                              ? ((cat.consumptionCost / data.totalConsumptionCost) * 100).toFixed(1)
                              : "0.0";

                          return (
                            <tr key={cat.categoryId} className="hover:bg-zinc-50 transition">
                              <td className="py-3 px-4 text-center">
                                <span className="w-7 h-7 rounded-lg bg-[#FAF9F5] border border-zinc-200 text-[#2C1710] inline-flex items-center justify-center font-black text-xs">
                                  {cat.categoryCode}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-zinc-950 text-sm">
                                {cat.categoryName}
                              </td>
                              <td className="py-3 px-4 text-right font-black font-mono text-[#CA340A] text-sm">
                                ₹{cat.consumptionCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                                ₹{cat.purchasedCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900">
                                ₹{cat.closingStockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-zinc-100 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="bg-[#CA340A] h-full"
                                      style={{ width: `${Math.min(100, Number(pct))}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-zinc-600 text-[11px] font-bold w-10 text-right">
                                    {pct}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MOST USED (BY QUANTITY) */}
            {activeTab === "usage" && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-zinc-950">
                      Most Used Ingredients by Physical Quantity
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Physical inventory movement quantities consumed. Each item strictly preserves its respective counting unit (kg, L, pcs) without summing unlike units.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.mostUsedIngredients.map((item, idx) => (
                      <div
                        key={item.ingredientId}
                        className="p-4 rounded-2xl bg-zinc-50/70 border border-zinc-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-white border border-zinc-200 text-zinc-500 font-mono font-black text-xs flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-zinc-950 text-sm">{item.ingredientName}</div>
                            <span className="text-[11px] text-zinc-400 font-mono">Unit: {item.unit}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black font-mono text-[#2C1710]">
                            {item.usedQty}
                          </span>
                          <span className="text-xs font-bold text-zinc-500 ml-1">{item.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: WASTAGE ANALYSIS */}
            {activeTab === "wastage" && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-zinc-950">
                      Kitchen Wastage & Loss Analysis
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Ingredients recorded in the daily register wastage column or audited scrap log.
                    </p>
                  </div>

                  {data.mostWastedIngredients.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 text-xs">
                      Zero wastage recorded during this period! Clean kitchen operations.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                            <th className="py-3 px-4 w-12 text-center">#</th>
                            <th className="py-3 px-4">Ingredient</th>
                            <th className="py-3 px-4 text-center">Wasted Quantity</th>
                            <th className="py-3 px-4 text-right">Wastage Cost (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {data.mostWastedIngredients.map((item, idx) => (
                            <tr key={item.ingredientId} className="hover:bg-zinc-50 transition">
                              <td className="py-3 px-4 text-center font-mono text-zinc-400">
                                #{idx + 1}
                              </td>
                              <td className="py-3 px-4 font-bold text-zinc-950 text-sm">
                                {item.ingredientName}
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-red-600">
                                {item.wastageQty} {item.unit}
                              </td>
                              <td className="py-3 px-4 text-right font-black font-mono text-red-600 text-sm">
                                ₹{item.wastageCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: PURCHASES LOG */}
            {activeTab === "purchases" && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-zinc-950">
                        Purchases & Deliveries History
                      </h2>
                      <p className="text-xs text-zinc-500">
                        Date-wise purchases recorded with unit costs contributing to the weighted average valuation.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      {data.purchasesHistory.length} purchase(s) recorded
                    </span>
                  </div>

                  {data.purchasesHistory.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 text-xs">
                      No purchases recorded for this date range. Click &quot;+ Add Purchase&quot; on the daily register to log deliveries.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Ingredient</th>
                            <th className="py-3 px-4 text-center">Quantity</th>
                            <th className="py-3 px-4 text-center">Price / Unit</th>
                            <th className="py-3 px-4 text-right">Total Cost (₹)</th>
                            <th className="py-3 px-4">Supplier</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {data.purchasesHistory.map((p) => (
                            <tr key={p.id} className="hover:bg-zinc-50 transition">
                              <td className="py-3 px-4 font-mono text-zinc-500 text-[11px]">{p.date}</td>
                              <td className="py-3 px-4 font-bold text-zinc-950 text-sm">
                                {p.ingredientName}
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-zinc-800">
                                {p.quantity} {p.unit}
                              </td>
                              <td className="py-3 px-4 text-center font-mono text-zinc-600">
                                ₹{p.pricePerUnit.toFixed(2)}/{p.unit}
                              </td>
                              <td className="py-3 px-4 text-right font-black font-mono text-emerald-700 text-sm">
                                ₹{p.totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-zinc-600 text-xs">{p.supplier || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
