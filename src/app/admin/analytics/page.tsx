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
} from "lucide-react";
import SalesAreaChart from "@/components/Admin/Analytics/SalesAreaChart";
import EarningsDonutChart from "@/components/Admin/Analytics/EarningsDonutChart";
import PaymentBarChart from "@/components/Admin/Analytics/PaymentBarChart";

type PeriodFilter = "today" | "yesterday" | "week" | "30days" | "year" | "custom";
type ViewMode = "sales" | "payments";
type ChartType = "spline" | "bar";
type TrendingMetric = "quantity" | "revenue";

interface TimelinePoint {
  label: string;
  fullLabel: string;
  sales: number;
  orders: number;
  cash: number;
  online: number;
  credit: number;
}

interface ProductItem {
  id: string;
  name: string;
  category: string;
  image: string;
  quantity: number;
  revenue: number;
  unitPrice: number;
}

interface AnalyticsApiResponse {
  success: boolean;
  storeName: string;
  range: string;
  periodLabel: string;
  selectedDateLabel: string;
  metrics: {
    totalSales: number;
    grossSales: number;
    totalOrders: number;
    paidOrders: number;
    cashSales: number;
    onlineSales: number;
    creditSales: number;
    expenses: number;
    averageOrderValue: number;
  };
  donut: {
    fullPayment: number;
    credit: number;
    fullPaymentPct: number;
    creditPct: number;
  };
  timeline: TimelinePoint[];
  trendingItems: ProductItem[];
  productSoldHistory: ProductItem[];
  notSoldItems: Array<{ id: string; name: string; category: string; price: number; quantity: number }>;
  insights: {
    aov: number;
    aovText: string;
    customerInfoText: string;
    peakHourText: string;
  };
}

export default function SalesAndAnalyticsPage() {
  const [period, setPeriod] = useState<PeriodFilter>("today");
  const [viewMode, setViewMode] = useState<ViewMode>("sales");
  const [chartType, setChartType] = useState<ChartType>("spline");
  const [trendingMetric, setTrendingMetric] = useState<TrendingMetric>("quantity");
  const [showValues, setShowValues] = useState<boolean>(true);
  const [centerMetric, setCenterMetric] = useState<"currency" | "count">("currency");
  const [selectedDayTab, setSelectedDayTab] = useState<string>("");
  const [customDate, setCustomDate] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AnalyticsApiResponse | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<TimelinePoint | null>(null);
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [productSortBy, setProductSortBy] = useState<"revenue" | "quantity">("revenue");

  // Dynamic time greeting: Good morning / Good afternoon / Good evening
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning, Spiral Cafe";
    if (hour < 17) return "Good afternoon, Spiral Cafe";
    return "Good evening, Spiral Cafe";
  }, []);

  // Fetch Analytics from API
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/analytics?range=${period}`;
      if (period === "custom" && customDate) {
        url = `/api/admin/analytics?range=date&date=${customDate}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [period, customDate]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Authentic live timeline from database (real-time orders)
  const activeTimeline: TimelinePoint[] = useMemo(() => {
    if (data?.timeline && data.timeline.length > 0) {
      return data.timeline;
    }

    // Clean neutral timeline with real 0 values when no orders are recorded yet
    if (period === "yesterday" || period === "today") {
      return [
        { label: "12am", fullLabel: "12am – 2am", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "2am", fullLabel: "2am – 4am", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "4am", fullLabel: "4am – 6am", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "6am", fullLabel: "6am – 8am", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "8am", fullLabel: "8am – 10am", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "10am", fullLabel: "10am – 12pm", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "12pm", fullLabel: "12pm – 2pm", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "2pm", fullLabel: "2pm – 4pm", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "4pm", fullLabel: "4pm – 6pm", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "6pm", fullLabel: "6pm – 8pm", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "8pm", fullLabel: "8pm – 10pm", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
        { label: "10pm", fullLabel: "10pm – 12am", sales: 0, orders: 0, cash: 0, online: 0, credit: 0 },
      ];
    } else if (period === "week") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return days.map((d) => ({
        label: d,
        fullLabel: d,
        sales: 0,
        orders: 0,
        cash: 0,
        online: 0,
        credit: 0,
      }));
    } else if (period === "year") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return months.map((m) => ({
        label: m,
        fullLabel: m,
        sales: 0,
        orders: 0,
        cash: 0,
        online: 0,
        credit: 0,
      }));
    }

    return [];
  }, [data?.timeline, period]);

  // Key metrics calculation — Authentic values directly from database
  const totalSalesVal = data?.metrics?.totalSales ?? 0;
  const creditSalesVal = data?.metrics?.creditSales ?? 0;
  const totalOrdersVal = data?.metrics?.totalOrders ?? 0;
  const expensesVal = data?.metrics?.expenses ?? 0;
  const aovVal = data?.metrics?.averageOrderValue ?? (totalOrdersVal > 0 ? totalSalesVal / totalOrdersVal : 0);

  // Format currency
  const formatRupee = (num: number) => {
    if (!showValues) return "••••••";
    return `₹${Math.round(num).toLocaleString("en-IN")}`;
  };

  // Trending items list (Dynamically sorted by Quantity or Total Revenue)
  const trendingList: ProductItem[] = useMemo(() => {
    const raw: ProductItem[] = [...(data?.trendingItems || [])];
    if (trendingMetric === "revenue") {
      return raw.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    }
    return raw.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
  }, [data?.trendingItems, trendingMetric]);

  // Comprehensive Product Sold Analytics stats and category breakdown
  const categoryStats = useMemo(() => {
    const list = data?.productSoldHistory && data.productSoldHistory.length > 0
      ? data.productSoldHistory
      : (data?.trendingItems || []);

    const map: Record<string, { category: string; quantity: number; revenue: number; itemsCount: number }> = {};
    let totalQty = 0;
    let totalRev = 0;

    list.forEach((item) => {
      const cat = (item.category || "SPECIALS").toUpperCase();
      if (!map[cat]) {
        map[cat] = { category: cat, quantity: 0, revenue: 0, itemsCount: 0 };
      }
      map[cat].quantity += Number(item.quantity) || 0;
      map[cat].revenue += Number(item.revenue) || 0;
      map[cat].itemsCount += 1;

      totalQty += Number(item.quantity) || 0;
      totalRev += Number(item.revenue) || 0;
    });

    const categoriesList = Object.values(map).sort((a, b) => b.revenue - a.revenue);
    const topCategory = categoriesList.length > 0 ? categoriesList[0] : null;

    return {
      map,
      categoriesList,
      totalQty,
      totalRev,
      topCategory,
    };
  }, [data?.productSoldHistory, data?.trendingItems]);

  const displayedProducts = useMemo(() => {
    const list = data?.productSoldHistory && data.productSoldHistory.length > 0
      ? [...data.productSoldHistory]
      : [...(data?.trendingItems || [])];

    let filtered = list.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (item.category || "").toLowerCase().includes(productSearch.toLowerCase());
      const matchCategory =
        selectedCategory === "ALL" ||
        (item.category || "SPECIALS").toUpperCase() === selectedCategory.toUpperCase();
      return matchSearch && matchCategory;
    });

    if (productSortBy === "revenue") {
      filtered.sort((a, b) => (b.revenue || 0) - (a.revenue || 0) || (b.quantity || 0) - (a.quantity || 0));
    } else {
      filtered.sort((a, b) => (b.quantity || 0) - (a.quantity || 0) || (b.revenue || 0) - (a.revenue || 0));
    }

    return filtered;
  }, [data?.productSoldHistory, data?.trendingItems, productSearch, selectedCategory, productSortBy]);

  return (
    <AdminLayout>
      <div className="text-[#2C1710] space-y-4">
        {/* ========================================================= */}
        {/* TOP COMMAND HEADER (100% Matching Image 3 Reference) */}
        {/* ========================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 pb-4">
          {/* Back link & Store Dashboard Title */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="p-1.5 rounded-xl hover:bg-black/5 text-[#4a1525] transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft size={18} className="text-[#4a1525]" />
            </Link>
            <h1 className="font-heading font-black text-sm tracking-wider uppercase text-[#4a1525]">
              STORE DASHBOARD
            </h1>
          </div>

          {/* Right Header Controls (Store Pill, All Filter, Bell, Avatar, Refresh) */}
          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            {/* Store Selector Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-black/10 shadow-2xs text-xs font-semibold text-zinc-800">
              <span>Spiral Cafe</span>
              <ChevronDown size={14} className="text-zinc-500" />
            </div>

            {/* Filter Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-black/10 shadow-2xs text-xs font-semibold text-zinc-700">
              <span>All</span>
              <ChevronDown size={14} className="text-zinc-500" />
            </div>

            {/* Notification Bell */}
            <button
              className="p-2 rounded-full bg-white border border-black/10 text-zinc-600 hover:text-zinc-900 transition-colors shadow-2xs"
              title="Notifications"
            >
              <Bell size={15} />
            </button>

            {/* User Profile Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#3B1220] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              M
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchAnalyticsData}
              className="p-2 rounded-full bg-white border border-black/10 text-zinc-700 hover:bg-zinc-100 transition-colors shadow-2xs cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-[#CA340A]" : ""} />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TIME GREETING & TABS ROW (Sales/Payments & Periods) */}
        {/* ========================================================= */}
        <div className="space-y-4">
          <h2 className="font-heading font-bold text-lg sm:text-xl text-[#1a120c]">
            {greeting}
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-2">
            {/* Mode Tabs: Sales vs Payments */}
            <div className="flex items-center gap-8 text-sm font-semibold">
              <button
                onClick={() => setViewMode("sales")}
                className={`relative pb-2 transition-colors cursor-pointer ${
                  viewMode === "sales" ? "text-[#3B1220] font-extrabold" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <span>Sales</span>
                {viewMode === "sales" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#3B1220] rounded-full" />
                )}
              </button>

              <button
                onClick={() => setViewMode("payments")}
                className={`relative pb-2 transition-colors cursor-pointer ${
                  viewMode === "payments" ? "text-[#3B1220] font-extrabold" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <span>Payments</span>
                {viewMode === "payments" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#3B1220] rounded-full" />
                )}
              </button>

              <Link
                href="/admin/analytics/private"
                className="relative pb-2 transition-colors cursor-pointer flex items-center gap-1.5 text-zinc-500 hover:text-[#CA340A]"
                title="View separated internal & staff consumption analytics"
              >
                <Lock size={13} className="text-zinc-400" />
                <span>Private Sales</span>
              </Link>
            </div>

            {/* Period Filters: Today | Yesterday | Week | 30 Days | Year | Custom */}
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
                onClick={fetchAnalyticsData}
                className="px-3 py-1 rounded-lg bg-[#3B1220] text-white text-xs font-bold hover:bg-[#521c2f] transition-all"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* TOP METRICS & MAIN CHARTS (Spline Sales Curve + Donut Breakdown + Payment Bars) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* ------------------------------------------------------- */}
          {/* CARD 1: MAIN AREA / BAR CHART (8 Cols) */}
          {/* ------------------------------------------------------- */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            {/* Toggle Spline Curve vs Bar Chart */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                  {chartType === "spline" ? "Sales Spline Curve" : "Payment Comparison"}
                </span>
                <span className="text-[11px] font-bold text-zinc-400 bg-zinc-100 px-2.5 py-0.5 rounded-full">
                  {period === "today"
                    ? "1 Day"
                    : period === "yesterday"
                    ? "Yesterday"
                    : period === "week"
                    ? "7 Days"
                    : period === "30days"
                    ? "30 Days"
                    : period === "year"
                    ? "1 Year"
                    : "Custom"}
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
                  title="Spline Area View"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17c3-7 6-10 9-3s6 4 9-4" />
                  </svg>
                  <span>Spline Curve</span>
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    chartType === "bar"
                      ? "bg-[#3B1220] text-white shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                  title="Bar Comparison View"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="4" height="11" rx="1" />
                    <rect x="10" y="4" width="4" height="17" rx="1" />
                    <rect x="16" y="13" width="4" height="8" rx="1" />
                  </svg>
                  <span>Payment Bars</span>
                </button>
              </div>
            </div>

            {chartType === "spline" ? (
              <SalesAreaChart
                data={activeTimeline}
                periodLabel={
                  period === "today"
                    ? "Today's Sales"
                    : period === "yesterday"
                    ? "Yesterday's Sales"
                    : period === "week"
                    ? "Weekly Sales"
                    : period === "30days"
                    ? "Monthly Sales"
                    : period === "year"
                    ? "Yearly Sales"
                    : "Period Sales"
                }
                currencySymbol="₹"
              />
            ) : (
              <PaymentBarChart
                data={activeTimeline.map((t) => ({
                  label: t.label,
                  cash: t.cash,
                  online: t.online,
                }))}
                currencySymbol="₹"
              />
            )}
          </div>

          {/* ------------------------------------------------------- */}
          {/* CARD 2: DONUT CHART ("EARNINGS REPORT") (4 Cols) */}
          {/* ------------------------------------------------------- */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <EarningsDonutChart
              cash={data?.metrics?.cashSales ?? 0}
              online={data?.metrics?.onlineSales ?? 0}
              credit={data?.metrics?.creditSales ?? 0}
              currencySymbol="₹"
              totalOrders={totalOrdersVal}
            />
          </div>
        </div>

        {/* ========================================================= */}
        {/* KEY HIGHLIGHT METRICS STRIP (Total Orders, AOV, Cash in Drawer, Online) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                <ShoppingBag size={16} />
              </div>
              <span className="text-xs font-semibold text-zinc-500">Total Orders</span>
            </div>
            <div className="mt-3">
              <p className="font-heading font-extrabold text-2xl text-zinc-950">
                {totalOrdersVal}
              </p>
              <span className="text-[11px] font-bold text-zinc-400">
                {data?.metrics?.paidOrders ?? totalOrdersVal} settled
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
                <TrendingUp size={16} />
              </div>
              <span className="text-xs font-semibold text-zinc-500">Average Order Value</span>
            </div>
            <div className="mt-3">
              <p className="font-heading font-extrabold text-2xl text-zinc-950">
                {formatRupee(aovVal)}
              </p>
              <span className="text-[11px] font-bold text-emerald-600">
                Per dining table visit
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                <Wallet size={16} />
              </div>
              <span className="text-xs font-semibold text-zinc-500">Physical Cash</span>
            </div>
            <div className="mt-3">
              <p className="font-heading font-extrabold text-2xl text-emerald-700">
                {formatRupee(data?.metrics?.cashSales ?? 0)}
              </p>
              <span className="text-[11px] font-bold text-zinc-400">
                Drawer collection
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                <Sparkles size={16} />
              </div>
              <span className="text-xs font-semibold text-zinc-500">Online / Razorpay</span>
            </div>
            <div className="mt-3">
              <p className="font-heading font-extrabold text-2xl text-blue-700">
                {formatRupee(data?.metrics?.onlineSales ?? 0)}
              </p>
              <span className="text-[11px] font-bold text-zinc-400">
                Instant UPI &amp; Cards
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* FULL-WIDTH PRODUCT SOLD & CATEGORY ANALYTICS */}
        {/* ========================================================= */}
        <div className="w-full bg-white rounded-3xl p-5 sm:p-6 border border-black/5 shadow-[0_12px_35px_rgba(0,0,0,0.02)] space-y-5">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-[#CA340A] flex items-center justify-center">
                <ShoppingBag size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-heading font-black text-base sm:text-lg text-zinc-950">
                    Product Sold Analytics
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#3B1220]/10 text-[#3B1220]">
                    {data?.periodLabel || "Selected Period"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-medium">
                  Complete breakdown of dishes sold, total units, and sales revenue grouped by category
                </p>
              </div>
            </div>

            {/* Controls: Search + Sort Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search Box */}
              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search sold dishes..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-[#3B1220]"
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 hover:text-zinc-700"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort Mode Toggle */}
              <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs font-bold text-zinc-600 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setProductSortBy("revenue")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    productSortBy === "revenue"
                      ? "bg-[#CA340A] text-white shadow-xs font-extrabold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                  title="Sort by Highest Revenue"
                >
                  <span>₹ Revenue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductSortBy("quantity")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    productSortBy === "quantity"
                      ? "bg-[#3B1220] text-white shadow-xs font-extrabold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                  title="Sort by Most Units Sold"
                >
                  <ShoppingBag size={12} />
                  <span>Units</span>
                </button>
              </div>
            </div>
          </div>

          {/* Category Filter Chips Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Filter size={13} className="text-[#CA340A]" />
                Filter by Category:
              </span>
              <span className="text-[11px] text-zinc-400">
                {displayedProducts.length} items shown
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
              {/* "ALL" Chip */}
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === "ALL"
                    ? "bg-[#3B1220] text-white border-[#3B1220] shadow-2xs"
                    : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                <span>ALL CATEGORIES</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  selectedCategory === "ALL" ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
                }`}>
                  {formatRupee(categoryStats.totalRev)}
                </span>
                <span className="text-[10px] opacity-80">
                  ({categoryStats.totalQty})
                </span>
              </button>

              {/* Individual Category Chips with Total Revenue and Units */}
              {categoryStats.categoriesList.map((cat) => {
                const isSelected = selectedCategory.toUpperCase() === cat.category.toUpperCase();
                return (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setSelectedCategory(cat.category)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-[#CA340A] text-white border-[#CA340A] shadow-2xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <span>{cat.category}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      isSelected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-700"
                    }`}>
                      {formatRupee(cat.revenue)}
                    </span>
                    <span className="text-[10px] opacity-75">
                      ({cat.quantity})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Metrics Strip for Category / Product Sales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50/70 p-3.5 rounded-2xl border border-zinc-100">
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total Units Sold</span>
              <span className="font-heading font-extrabold text-xl text-zinc-950 mt-0.5 block">
                {categoryStats.totalQty} <span className="text-xs font-normal text-zinc-500">items</span>
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total Product Sales</span>
              <span className="font-heading font-extrabold text-xl text-[#CA340A] mt-0.5 block">
                {formatRupee(categoryStats.totalRev)}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Top Category</span>
              <span className="font-heading font-extrabold text-sm sm:text-base text-zinc-950 mt-0.5 truncate block">
                {categoryStats.topCategory ? categoryStats.topCategory.category : "—"}
                {categoryStats.topCategory && (
                  <span className="text-xs font-semibold text-emerald-600 ml-1">
                    ({formatRupee(categoryStats.topCategory.revenue)})
                  </span>
                )}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Active Categories</span>
              <span className="font-heading font-extrabold text-xl text-zinc-950 mt-0.5 block">
                {categoryStats.categoriesList.length} <span className="text-xs font-normal text-zinc-500">active</span>
              </span>
            </div>
          </div>

          {/* Products List Table */}
          <div className="border border-zinc-200/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200/80 text-[11px] uppercase font-bold text-zinc-500 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Item &amp; Category</th>
                    <th className="py-3 px-4 text-center">Unit Price</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                    <th className="py-3 px-4 text-right min-w-[120px]">Sales Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {displayedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-400">
                        <ShoppingBag size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-sm text-zinc-500">No dishes sold in this period</p>
                        <p className="text-xs text-zinc-400 mt-1">Try selecting a different date range or category filter.</p>
                      </td>
                    </tr>
                  ) : (
                    displayedProducts.map((item, idx) => {
                      const sharePct = categoryStats.totalRev > 0
                        ? Math.round(((item.revenue || 0) / categoryStats.totalRev) * 100)
                        : 0;

                      return (
                        <tr key={item.id || idx} className="hover:bg-zinc-50/80 transition-colors">
                          {/* Item Details */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0 flex items-center justify-center">
                                {item.image ? (
                                  <Image
                                    src={item.image}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold text-xs text-amber-800 bg-amber-50">
                                    {item.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <p className="font-bold text-zinc-900 text-xs sm:text-sm truncate">
                                  {item.name}
                                </p>
                                <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#3B1220]/10 text-[#3B1220] text-[9px] font-extrabold uppercase tracking-wide">
                                  {item.category || "SPECIALS"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Unit Price */}
                          <td className="py-3 px-4 text-center font-semibold text-zinc-600">
                            ₹{item.unitPrice || "—"}
                          </td>

                          {/* Units Sold */}
                          <td className="py-3 px-4 text-center">
                            <span className="font-heading font-extrabold text-sm text-zinc-950 px-2.5 py-1 rounded-xl bg-zinc-100">
                              {item.quantity}
                            </span>
                          </td>

                          {/* Total Revenue */}
                          <td className="py-3 px-4 text-right font-heading font-extrabold text-sm sm:text-base text-zinc-950">
                            {formatRupee(item.revenue)}
                          </td>

                          {/* Sales Share with Progress Bar */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 sm:w-24 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-[#CA340A] rounded-full transition-all"
                                  style={{ width: `${Math.min(100, Math.max(4, sharePct))}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-zinc-500 w-8 text-right">
                                {sharePct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
