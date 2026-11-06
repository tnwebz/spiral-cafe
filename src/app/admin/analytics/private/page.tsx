"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import AdminLayout from "@/components/Admin/AdminLayout";
import {
  ArrowLeft,
  ChevronDown,
  Bell,
  RefreshCw,
  Eye,
  EyeOff,
  TrendingUp,
  ShoppingBag,
  Wallet,
  Sparkles,
  Calendar,
  Layers,
  Flame,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  FileSpreadsheet,
  Lock,
  UserCheck,
  ShieldCheck,
  ChefHat,
  ArrowUpRight,
} from "lucide-react";
import SalesAreaChart from "@/components/Admin/Analytics/SalesAreaChart";
import EarningsDonutChart from "@/components/Admin/Analytics/EarningsDonutChart";
import PaymentBarChart from "@/components/Admin/Analytics/PaymentBarChart";

type PeriodFilter = "today" | "yesterday" | "week" | "30days" | "year" | "custom";
type ChartType = "spline" | "bar";
type PrivatePurposeFilter = "ALL" | "STAFF" | "OWNER" | "OTHER_INTERNAL";

interface TimelinePoint {
  label: string;
  fullLabel: string;
  sales: number;
  orders: number;
  fullPayment: number;
  credit: number;
}

interface ProductItem {
  id: string;
  name: string;
  category?: string;
  image?: string;
  quantity: number;
  revenue?: number;
  amount?: number;
  unitPrice?: number;
}

interface PrivateOrderRecord {
  id: string;
  orderNumber: string;
  purpose: string;
  note: string;
  grandTotal: number;
  itemsCount: number;
  items: Array<{ name: string; quantity: number; lineTotal: number }>;
  createdAt: string;
}

export default function PrivateSalesAnalyticsPage() {
  const [period, setPeriod] = useState<PeriodFilter>("today");
  const [purposeFilter, setPurposeFilter] = useState<PrivatePurposeFilter>("ALL");
  const [chartType, setChartType] = useState<ChartType>("spline");
  const [showValues, setShowValues] = useState<boolean>(true);
  const [customDate, setCustomDate] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any | null>(null);
  const [tableSearch, setTableSearch] = useState<string>("");
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  const [reprintFeedback, setReprintFeedback] = useState<string | null>(null);

  // Inventory Table & Trending Metric state
  const [showInventoryTable, setShowInventoryTable] = useState<boolean>(false);
  const [trendingMetric, setTrendingMetric] = useState<"quantity" | "revenue">("quantity");
  const [inventorySearch, setInventorySearch] = useState<string>("");
  const [inventoryCategory, setInventoryCategory] = useState<string>("ALL");

  // Dynamic greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning, Spiral Cafe";
    if (hour < 17) return "Good afternoon, Spiral Cafe";
    return "Good evening, Spiral Cafe";
  }, []);

  // Fetch Private Analytics
  const fetchPrivateAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/analytics/private?range=${period}`;
      if (period === "custom" && customDate) {
        url = `/api/admin/analytics/private?range=date&date=${customDate}`;
      }
      if (purposeFilter !== "ALL") {
        url += `&purpose=${purposeFilter}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load private analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [period, customDate, purposeFilter]);

  useEffect(() => {
    fetchPrivateAnalytics();
  }, [fetchPrivateAnalytics]);

  // Currency Formatter
  const formatRupee = (num: number) => {
    if (!showValues) return "••••••";
    return `₹${Math.round(num).toLocaleString("en-IN")}`;
  };

  // Metrics extraction
  const totalSalesVal = data?.metrics?.totalSales ?? 0;
  const staffVal = data?.metrics?.staffConsumption ?? 0;
  const ownerVal = data?.metrics?.ownerConsumption ?? 0;
  const otherVal = data?.metrics?.otherConsumption ?? 0;
  const totalOrdersVal = data?.metrics?.totalOrders ?? 0;
  const totalItemsVal = data?.metrics?.totalItems ?? 0;
  const aovVal = data?.metrics?.averageOrderValue ?? 0;

  // Timeline points formatted for existing chart components
  const timelinePoints: TimelinePoint[] = useMemo(() => {
    if (data?.timeline && data.timeline.length > 0) {
      return data.timeline.map((tp: any) => ({
        label: tp.label,
        fullLabel: tp.date || tp.label,
        sales: tp.amount || 0,
        orders: tp.orders || 0,
        fullPayment: tp.amount || 0,
        credit: 0,
      }));
    }
    return [
      { label: "10 AM", fullLabel: "10:00 AM", sales: 0, orders: 0, fullPayment: 0, credit: 0 },
      { label: "12 PM", fullLabel: "12:00 PM", sales: 0, orders: 0, fullPayment: 0, credit: 0 },
      { label: "2 PM", fullLabel: "2:00 PM", sales: 0, orders: 0, fullPayment: 0, credit: 0 },
      { label: "4 PM", fullLabel: "4:00 PM", sales: 0, orders: 0, fullPayment: 0, credit: 0 },
      { label: "6 PM", fullLabel: "6:00 PM", sales: 0, orders: 0, fullPayment: 0, credit: 0 },
      { label: "8 PM", fullLabel: "8:00 PM", sales: 0, orders: 0, fullPayment: 0, credit: 0 },
      { label: "10 PM", fullLabel: "10:00 PM", sales: 0, orders: 0, fullPayment: 0, credit: 0 },
    ];
  }, [data?.timeline]);

  // Trending items (exact count from API)
  const trendingList: ProductItem[] = useMemo(() => {
    return data?.trendingItems || [];
  }, [data?.trendingItems]);

  // Inventory filtered items for inventory buying management in private orders
  const inventoryItems = useMemo(() => {
    const list: any[] = data?.productSoldHistory && data.productSoldHistory.length > 0
      ? data.productSoldHistory
      : trendingList;

    return list.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchCategory = inventoryCategory === "ALL" || (item.category || "SPECIALS") === inventoryCategory;
      return matchSearch && matchCategory;
    });
  }, [data?.productSoldHistory, trendingList, inventorySearch, inventoryCategory]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    cats.add("ALL");
    (data?.productSoldHistory || trendingList).forEach((it: any) => {
      if (it.category) cats.add(it.category);
    });
    return Array.from(cats);
  }, [data?.productSoldHistory, trendingList]);

  // Orders list filtered by table search
  const ordersList: PrivateOrderRecord[] = useMemo(() => {
    const list: PrivateOrderRecord[] = data?.ordersList || [];
    if (!tableSearch.trim()) return list;
    const q = tableSearch.toLowerCase();
    return list.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.purpose.toLowerCase().includes(q) ||
        o.note.toLowerCase().includes(q) ||
        o.items.some((it) => it.name.toLowerCase().includes(q))
    );
  }, [data?.ordersList, tableSearch]);

  // Kitchen KOT Reprint Handler
  const handleReprintKot = async (orderId: string, orderNumber: string) => {
    setReprintingId(orderId);
    setReprintFeedback(null);
    try {
      const res = await fetch("/api/admin/private-orders/kot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (json.success && json.printed) {
        setReprintFeedback(`KOT for #${orderNumber} sent to Kitchen printer.`);
      } else {
        setReprintFeedback(json.warning || `KOT triggered for #${orderNumber}.`);
      }
    } catch (e: any) {
      setReprintFeedback("Local connector unreachable on port 4318.");
    } finally {
      setReprintingId(null);
      setTimeout(() => setReprintFeedback(null), 5000);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-24">
        {/* ========================================================= */}
        {/* TOP COMMAND BAR (Exact Replica of Analytics Header) */}
        {/* ========================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/analytics"
              className="p-2 rounded-2xl bg-white border border-black/10 text-zinc-700 hover:bg-zinc-100 transition-colors shadow-2xs cursor-pointer"
              title="Back to Customer Analytics"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider text-zinc-400 uppercase">
                  STORE DASHBOARD
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#3A1710] text-[#FFF9F5] text-[10px] font-bold flex items-center gap-1 shadow-xs">
                  <Lock size={10} className="text-[#E2C7BA]" />
                  <span>Private Isolated</span>
                </span>
              </div>
              <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#1a120c]">
                Private & Staff Sales Analytics
              </h1>
            </div>
          </div>

          {/* Right Action Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/private-order"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#CA340A] text-white font-bold text-xs hover:bg-[#B73F1D] shadow-md shadow-[#CA340A]/20 transition-all cursor-pointer"
            >
              <ChefHat size={14} />
              <span>+ Place Private Order</span>
            </Link>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-black/10 shadow-2xs text-xs font-semibold text-zinc-700">
              <span>Spiral Cafe</span>
              <ChevronDown size={14} className="text-zinc-500" />
            </div>

            <div className="w-8 h-8 rounded-full bg-[#3B1220] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              M
            </div>

            <button
              onClick={fetchPrivateAnalytics}
              className="p-2 rounded-full bg-white border border-black/10 text-zinc-700 hover:bg-zinc-100 transition-colors shadow-2xs cursor-pointer"
              title="Refresh Private Analytics"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-[#CA340A]" : ""} />
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {reprintFeedback && (
          <div className="p-3 bg-zinc-900 text-white rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Printer size={15} className="text-[#E2C7BA]" />
              <span>{reprintFeedback}</span>
            </div>
            <button
              onClick={() => setReprintFeedback(null)}
              className="text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* TIME GREETING & TABS ROW (Sales | Payments | Private Sales) */}
        {/* ========================================================= */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg sm:text-xl text-[#1a120c]">
              {greeting}
            </h2>
            <button
              onClick={() => setShowValues(!showValues)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              {showValues ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>{showValues ? "Hide Values" : "Show Values"}</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-2">
            {/* Mode Tabs */}
            <div className="flex items-center gap-8 text-sm font-semibold">
              <Link
                href="/admin/analytics"
                className="relative pb-2 transition-colors cursor-pointer text-zinc-500 hover:text-zinc-800"
              >
                <span>Sales</span>
              </Link>

              <Link
                href="/admin/analytics"
                className="relative pb-2 transition-colors cursor-pointer text-zinc-500 hover:text-zinc-800"
              >
                <span>Payments</span>
              </Link>

              <div className="relative pb-2 text-[#3B1220] font-extrabold flex items-center gap-1.5">
                <Lock size={13} className="text-[#CA340A]" />
                <span>Private Sales</span>
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#3B1220] rounded-full" />
              </div>
            </div>

            {/* Period Filters */}
            <div className="flex items-center gap-4 sm:gap-6 text-xs font-semibold overflow-x-auto">
              {(
                [
                  { id: "today", label: "Today (1D)" },
                  { id: "yesterday", label: "Yesterday" },
                  { id: "week", label: "Week (7D)" },
                  { id: "30days", label: "30 Days (1M)" },
                  { id: "year", label: "Year (1Y)" },
                  { id: "custom", label: "Custom" },
                ] as const
              ).map((p) => {
                const isActive = period === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`relative pb-2 whitespace-nowrap transition-colors cursor-pointer ${
                      isActive ? "text-[#3B1220] font-bold" : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    <span>{p.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#3B1220] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Picker Drawer if Custom is chosen */}
          {period === "custom" && (
            <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-black/5 shadow-2xs max-w-md">
              <Calendar size={16} className="text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-600">Select Date:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="text-xs font-medium border border-zinc-200 rounded-lg px-2.5 py-1 text-zinc-800 bg-zinc-50 outline-none focus:ring-1 focus:ring-[#3B1220]"
              />
              <button
                onClick={fetchPrivateAnalytics}
                className="px-3 py-1 rounded-lg bg-[#3B1220] text-white text-xs font-bold hover:bg-[#521c2f] transition-all cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Purpose Filter Pills Sub-Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mr-1">
            Filter Purpose:
          </span>
          {(
            [
              { id: "ALL", label: "All Internal" },
              { id: "STAFF", label: "Staff Only" },
              { id: "OWNER", label: "Owner Only" },
              { id: "OTHER_INTERNAL", label: "Other Internal" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPurposeFilter(p.id)}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                purposeFilter === p.id
                  ? "bg-[#3A1710] text-white shadow-xs"
                  : "bg-white border border-black/10 text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ========================================================= */}
        {/* 4 HIGH-LEVEL METRIC CARDS */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Private Consumption */}
          <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Total Private Consumption
              </span>
              <div className="w-8 h-8 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Lock size={16} />
              </div>
            </div>
            <p className="font-heading font-black text-2xl text-[#1a120c]">
              {formatRupee(totalSalesVal)}
            </p>
            <p className="text-[11px] text-zinc-500 font-medium">
              Internal value • Never added to customer tax sales
            </p>
          </div>

          {/* Card 2: Staff Food Consumption */}
          <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Staff Food Consumption
              </span>
              <div className="w-8 h-8 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center">
                <ChefHat size={16} />
              </div>
            </div>
            <p className="font-heading font-black text-2xl text-blue-900">
              {formatRupee(staffVal)}
            </p>
            <p className="text-[11px] text-zinc-500 font-medium">
              {totalSalesVal > 0 ? Math.round((staffVal / totalSalesVal) * 100) : 0}% of internal total
            </p>
          </div>

          {/* Card 3: Owner & Personal */}
          <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Owner & Personal
              </span>
              <div className="w-8 h-8 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center">
                <ShieldCheck size={16} />
              </div>
            </div>
            <p className="font-heading font-black text-2xl text-purple-900">
              {formatRupee(ownerVal)}
            </p>
            <p className="text-[11px] text-zinc-500 font-medium">
              {totalSalesVal > 0 ? Math.round((ownerVal / totalSalesVal) * 100) : 0}% of internal total
            </p>
          </div>

          {/* Card 4: Total Private Orders */}
          <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Orders & Items
              </span>
              <div className="w-8 h-8 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <ShoppingBag size={16} />
              </div>
            </div>
            <p className="font-heading font-black text-2xl text-[#1a120c]">
              {totalOrdersVal} <span className="text-sm font-bold text-zinc-500">tickets</span>
            </p>
            <p className="text-[11px] text-zinc-500 font-medium">
              {totalItemsVal} items consumed • Avg {formatRupee(aovVal)}
            </p>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CHARTS ROW (Area Spline Curve + Purpose Donut) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Main Chart (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                  {chartType === "spline" ? "Private Consumption Trend" : "Hourly Comparison"}
                </span>
                <span className="text-[11px] font-bold text-zinc-400 bg-zinc-100 px-2.5 py-0.5 rounded-full">
                  {data?.periodLabel || "Selected Period"}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-white border border-zinc-200 p-1 rounded-2xl shadow-2xs">
                <button
                  onClick={() => setChartType("spline")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    chartType === "spline"
                      ? "bg-[#3B1220] text-white shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <span>Spline Curve</span>
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    chartType === "bar"
                      ? "bg-[#3B1220] text-white shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <span>Payment Bars</span>
                </button>
              </div>
            </div>

            {chartType === "spline" ? (
              <SalesAreaChart
                data={timelinePoints.map((tp) => ({
                  label: tp.label,
                  fullLabel: tp.fullLabel,
                  sales: tp.sales,
                  orders: tp.orders,
                }))}
                periodLabel={data?.selectedDateLabel || "Selected Period"}
                currencySymbol="₹"
              />
            ) : (
              <PaymentBarChart
                data={timelinePoints.map((tp) => ({
                  label: tp.label,
                  cash: tp.sales,
                  online: 0,
                }))}
                currencySymbol="₹"
              />
            )}
          </div>

          {/* Donut Chart (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                Consumption Breakdown
              </span>
            </div>

            <EarningsDonutChart
              cash={ownerVal}
              online={staffVal}
              credit={otherVal}
              totalOrders={totalOrdersVal}
              currencySymbol="₹"
            />
          </div>
        </div>

        {/* ========================================================= */}
        {/* TRENDING ITEMS & INVENTORY BUYING TABLE (Exact replica of User Screenshot) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Main Trending Items Card (8 Cols) */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-5 border border-black/5 shadow-[0_12px_35px_rgba(0,0,0,0.02)] space-y-4">
            {/* Header with Title and Metric Toggle (Cart / Currency) */}
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center">
                  <TrendingUp size={15} />
                </div>
                <h3 className="font-heading font-extrabold text-sm text-zinc-900">
                  Trending Items
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Switch between compact trending and full inventory buying table */}
                <button
                  onClick={() => setShowInventoryTable(!showInventoryTable)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                    showInventoryTable
                      ? "bg-[#3B1220] text-white border-[#3B1220]"
                      : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  }`}
                  title="Inventory Buying Management"
                >
                  {showInventoryTable ? "Show Quick Cards" : "Inventory Buying Table"}
                </button>

                {/* Quantity vs Revenue Toggle */}
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs font-bold text-zinc-500">
                  <button
                    onClick={() => setTrendingMetric("quantity")}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                      trendingMetric === "quantity"
                        ? "bg-white text-zinc-900 shadow-2xs font-extrabold"
                        : "hover:text-zinc-800"
                    }`}
                    title="Sold Quantity"
                  >
                    <ShoppingBag size={13} />
                  </button>
                  <button
                    onClick={() => setTrendingMetric("revenue")}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                      trendingMetric === "revenue"
                        ? "bg-white text-zinc-900 shadow-2xs font-extrabold"
                        : "hover:text-zinc-800"
                    }`}
                    title="Total Value in ₹"
                  >
                    ₹
                  </button>
                </div>
              </div>
            </div>

            {/* Content: Either Quick Cards (Image Reference) OR Inventory Table */}
            {!showInventoryTable ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                  <span>Items</span>
                  <span>{trendingMetric === "quantity" ? "Sold Quantity" : "Total Revenue"}</span>
                </div>

                <div className="divide-y divide-zinc-100">
                  {trendingList.length === 0 ? (
                    <div className="py-10 text-center text-zinc-400 font-semibold text-xs">
                      No private orders recorded in this period.
                    </div>
                  ) : (
                    trendingList.map((item) => (
                      <div
                        key={item.id}
                        className="py-3 flex items-center justify-between gap-3 hover:bg-zinc-50/70 px-1 rounded-2xl transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Circular Image matching screenshot */}
                          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-zinc-500 bg-amber-50">
                                {item.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Category Badge & Product Name */}
                          <div className="min-w-0 space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#3B1220] text-white text-[9px] font-extrabold uppercase tracking-wide">
                              {item.category || "SPECIALS"}
                            </span>
                            <p className="text-xs font-bold text-zinc-900 truncate">
                              {item.name}
                            </p>
                          </div>
                        </div>

                        {/* Sold Quantity / Revenue Value (e.g. 21, 10, 9, 8, 1) */}
                        <span className="font-heading font-extrabold text-base text-zinc-900 shrink-0">
                          {trendingMetric === "quantity"
                            ? item.quantity
                            : formatRupee(item.revenue || item.amount || 0)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* INVENTORY BUYING MANAGEMENT VIEW FOR PRIVATE SALES */
              <div className="space-y-3 pt-1">
                {/* Search & Category Filter Pills */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search inventory items..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-[#3B1220]"
                    />
                  </div>

                  {/* Category Pill Scroller */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                    {categories.slice(0, 5).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setInventoryCategory(cat)}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                          inventoryCategory === cat
                            ? "bg-[#3B1220] text-white shadow-2xs"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inventory Table */}
                <div className="border border-zinc-100 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-100 text-[10px] uppercase font-bold text-zinc-400 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Sold Count</th>
                        <th className="py-2.5 px-3 text-right">Inventory Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {inventoryItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-zinc-400 font-semibold">
                            No matching items in inventory.
                          </td>
                        </tr>
                      ) : (
                        inventoryItems.map((item: any) => (
                          <tr key={item.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-zinc-800">
                              {item.name}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 text-[9px] font-bold uppercase">
                                {item.category || "SPECIALS"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-zinc-900">
                              {item.quantity} units
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  item.quantity >= 10
                                    ? "bg-red-100 text-red-700"
                                    : item.quantity >= 3
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {item.quantity >= 10
                                  ? "High Restock"
                                  : item.quantity >= 3
                                  ? "Moderate Restock"
                                  : "Low Usage"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Internal Inventory Insights (4 Cols) */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-black/5 shadow-[0_12px_35px_rgba(0,0,0,0.02)] space-y-3.5 flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-extrabold text-sm text-zinc-900 mb-3">
                Internal Inventory Insights
              </h3>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#FFF1F2] border border-[#FFE4E6] flex items-center gap-3">
                  <span className="text-base shrink-0">📦</span>
                  <p className="text-xs font-semibold text-[#9F1239] leading-relaxed">
                    <span className="font-black">{totalItemsVal} total items</span> consumed internally this period.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#DCFCE7] flex items-center gap-3">
                  <span className="text-base shrink-0">🍳</span>
                  <p className="text-xs font-semibold text-[#166534] leading-relaxed">
                    <span className="font-bold">Staff Food:</span> <span className="font-black">{formatRupee(staffVal)}</span> • <span className="font-bold">Owner:</span> <span className="font-black">{formatRupee(ownerVal)}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F5F3FF] border border-[#EDE9FE] flex items-center gap-3">
                  <span className="text-base shrink-0">💡</span>
                  <p className="text-xs font-semibold text-[#5B21B6] leading-relaxed">
                    {data?.insights?.topPurposeText || "Monitor staff meal consumption against kitchen raw materials."}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60 text-[11px] text-zinc-600">
              💡 <strong>Inventory Note:</strong> Raw materials used in private orders are tracked here separately so you know the exact kitchen stock usage without distorting customer tax revenue.
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RECENT PRIVATE ORDERS HISTORY TABLE */}
        {/* ========================================================= */}
        <section className="bg-white rounded-3xl p-5 border border-black/5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-heading font-extrabold text-base text-[#1a120c]">
                Private Order Tickets History
              </h3>
              <p className="text-xs text-zinc-500">
                Complete record of internal tickets, purpose tags, and kitchen print receipts.
              </p>
            </div>

            {/* Search filter */}
            <div className="relative sm:w-64">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search ticket #, purpose, note..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#FAF7F2] border border-black/10 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#3A1710]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/10 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th className="pb-3 font-bold">Ticket #</th>
                  <th className="pb-3 font-bold">Time</th>
                  <th className="pb-3 font-bold">Purpose</th>
                  <th className="pb-3 font-bold">Destination</th>
                  <th className="pb-3 font-bold">Items Summary</th>
                  <th className="pb-3 font-bold">Note</th>
                  <th className="pb-3 font-bold text-right">Amount</th>
                  <th className="pb-3 font-bold text-right">Kitchen KOT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {ordersList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400 font-semibold">
                      No private orders match your filters.
                    </td>
                  </tr>
                ) : (
                  ordersList.map((order) => (
                    <tr key={order.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3 font-extrabold text-[#1a120c]">
                        #{order.orderNumber}
                      </td>
                      <td className="py-3 text-zinc-500 whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            order.purpose === "STAFF"
                              ? "bg-blue-100 text-blue-800"
                              : order.purpose === "OWNER"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-zinc-100 text-zinc-800"
                          }`}
                        >
                          {order.purpose}
                        </span>
                      </td>
                      <td className="py-3 font-bold text-emerald-700">
                        GIVE ON COUNTER
                      </td>
                      <td className="py-3 text-zinc-700 max-w-xs truncate">
                        {order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                      </td>
                      <td className="py-3 text-zinc-500 italic max-w-xs truncate">
                        {order.note || "—"}
                      </td>
                      <td className="py-3 text-right font-extrabold text-[#CA340A]">
                        {formatRupee(order.grandTotal)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleReprintKot(order.id, order.orderNumber)}
                          disabled={reprintingId === order.id}
                          className="px-2.5 py-1 rounded-lg bg-white border border-black/10 text-zinc-800 font-bold text-[11px] hover:bg-zinc-100 transition-colors shadow-2xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Print / Reprint Kitchen KOT to CN811-UEWB"
                        >
                          <Printer size={12} />
                          <span>{reprintingId === order.id ? "Sending..." : "Reprint KOT"}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

