"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import { Calendar, RefreshCw } from "lucide-react";

type TimeRange = "today" | "week" | "month" | "year" | "date" | "custom";
type ProductTab = "top" | "low" | "not_sold";

interface ProductItem {
  name: string;
  quantity: number;
  revenue?: number;
  category?: string;
}

interface AnalyticsData {
  success: boolean;
  range: string;
  periodLabel: string;
  selectedDateLabel: string;
  metrics: {
    grossSales: number;
    totalOrders: number;
    cashSales: number;
    onlineSales: number;
  };
  topSelling: ProductItem[];
  lowSelling: ProductItem[];
  notSold: ProductItem[];
}

export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ProductTab>("top");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  const datePickerRef = useRef<HTMLInputElement>(null);

  // Initialize dates
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    setSelectedDate(todayStr);

    // Default custom range: 7 days ago to today
    const past = new Date(today);
    past.setDate(today.getDate() - 7);
    const py = past.getFullYear();
    const pm = String(past.getMonth() + 1).padStart(2, "0");
    const pd = String(past.getDate()).padStart(2, "0");
    setCustomStart(`${py}-${pm}-${pd}`);
    setCustomEnd(todayStr);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/analytics?range=${timeRange}`;

      if (timeRange === "date" && selectedDate) {
        url += `&date=${selectedDate}`;
      } else if (timeRange === "custom") {
        if (customStart && customEnd) {
          url += `&startDate=${customStart}&endDate=${customEnd}`;
        }
      }

      const res = await fetch(url);
      const json = await res.json();
      if (json && json.success) {
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load analytics data:", e);
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedDate, customStart, customEnd]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleCalendarClick = () => {
    if (datePickerRef.current) {
      if (typeof datePickerRef.current.showPicker === "function") {
        datePickerRef.current.showPicker();
      } else {
        datePickerRef.current.focus();
      }
    }
  };

  // Determine active product list based on selected tab
  const getActiveProducts = (): ProductItem[] => {
    if (!data) return [];
    if (activeTab === "top") return data.topSelling || [];
    if (activeTab === "low") return data.lowSelling || [];
    if (activeTab === "not_sold") return data.notSold || [];
    return [];
  };

  const activeProducts = getActiveProducts();

  // Tab heading label: e.g. "Top Selling — This Week" or "Top Selling — Oct 2, 2026"
  const getTabHeading = () => {
    const period = data?.periodLabel || "Selected Period";
    if (activeTab === "top") return `Top Selling — ${period}`;
    if (activeTab === "low") return `Low Selling — ${period}`;
    return `Not Sold — ${period}`;
  };

  return (
    <AdminLayout>
      <div className="w-full space-y-7 pb-12">
        {/* Page Title & Main Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#CA340A]/10 pb-4">
          <div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] tracking-tight uppercase">
              Sales &amp; Analytics
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b] mt-0.5">
              Performance metrics and product sales overview
            </p>
          </div>

          <button
            onClick={fetchAnalytics}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-[#2C1710] hover:bg-[#FFF9F5] hover:border-[#CA340A]/40 transition-colors shadow-2xs cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#CA340A]" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 1. Date Filter Section */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {[
              { id: "today", label: "Today" },
              { id: "week", label: "This Week" },
              { id: "month", label: "This Month" },
              { id: "year", label: "This Year" },
              { id: "custom", label: "Custom" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setTimeRange(btn.id as TimeRange)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  timeRange === btn.id
                    ? "bg-[#CA340A] text-white shadow-xs"
                    : "bg-white border border-zinc-200 text-[#52525b] hover:bg-[#FFF9F5] hover:border-[#CA340A]/30"
                }`}
              >
                {btn.label}
              </button>
            ))}

            {/* Calendar button for specific single date */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                onClick={handleCalendarClick}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  timeRange === "date"
                    ? "bg-[#CA340A] text-white shadow-xs"
                    : "bg-white border border-zinc-200 text-[#52525b] hover:bg-[#FFF9F5] hover:border-[#CA340A]/30"
                }`}
                title="Pick exact date from calendar"
              >
                <Calendar size={16} className={timeRange === "date" ? "text-white" : "text-[#CA340A]"} />
                <span>
                  {timeRange === "date" && selectedDate ? selectedDate : "📅"}
                </span>
              </button>
              <input
                ref={datePickerRef}
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                    setTimeRange("date");
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Select exact date"
              />
            </div>
          </div>

          {/* Custom Date Range Picker Inputs */}
          {timeRange === "custom" && (
            <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-2xl border border-[#CA340A]/20 shadow-2xs text-sm mt-2 w-fit">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#52525b]">From:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710] text-sm focus:outline-[#CA340A]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#52525b]">To:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710] text-sm focus:outline-[#CA340A]"
                />
              </div>
            </div>
          )}

          {/* Selected Date Context Label */}
          <div className="text-sm font-semibold text-[#52525b] pt-1">
            Selected:{" "}
            <span className="font-bold text-[#2C1710]">
              {data?.selectedDateLabel || "Loading..."}
            </span>
          </div>
        </div>

        {/* 2. KPI Summary: Strictly 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Gross Sales */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
              Gross Sales
            </span>
            <div className="font-heading font-black text-3xl sm:text-4xl text-[#2C1710] mt-3">
              ₹{(data?.metrics?.grossSales ?? 0).toLocaleString()}
            </div>
          </div>

          {/* Card 2: Total Orders */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
              Total Orders
            </span>
            <div className="font-heading font-black text-3xl sm:text-4xl text-[#2C1710] mt-3">
              {(data?.metrics?.totalOrders ?? 0).toLocaleString()}
            </div>
          </div>

          {/* Card 3: Payment Split */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
              Payment Split
            </span>
            <div className="mt-3 space-y-2 text-base">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-800">Cash</span>
                <span className="font-heading font-black text-lg text-[#2C1710]">
                  ₹{(data?.metrics?.cashSales ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-800">Online</span>
                <span className="font-heading font-black text-lg text-[#2C1710]">
                  ₹{(data?.metrics?.onlineSales ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Product Analytics Section */}
        <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading font-black text-xl sm:text-2xl text-[#2C1710] tracking-tight">
                Product Analytics
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#CA340A] mt-0.5">
                {getTabHeading()}
              </p>
            </div>

            {/* Product Tabs: [ Top Selling ] [ Low Selling ] [ Not Sold ] */}
            <div className="flex items-center gap-1.5 p-1 bg-[#FFF9F5] border border-[#CA340A]/15 rounded-xl w-fit">
              {[
                { id: "top", label: "Top Selling" },
                { id: "low", label: "Low Selling" },
                { id: "not_sold", label: "Not Sold" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ProductTab)}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-[#CA340A] text-white shadow-2xs"
                      : "text-[#52525b] hover:text-[#2C1710] hover:bg-white/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items List */}
          {loading ? (
            <div className="py-16 text-center text-[#52525b]">
              <RefreshCw size={24} className="animate-spin text-[#CA340A] mx-auto mb-2" />
              <p className="font-semibold text-sm">Loading product sales...</p>
            </div>
          ) : activeProducts.length === 0 ? (
            <div className="py-12 text-center text-[#52525b] bg-[#FFF9F5]/40 rounded-xl border border-dashed border-zinc-200">
              <p className="text-sm font-semibold text-[#2C1710]">
                {activeTab === "not_sold"
                  ? "All menu products recorded sales during this period!"
                  : "No product sales recorded for this period."}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Try selecting a different date or date range above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-[580px] overflow-y-auto pr-1">
              {activeProducts.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  className="flex items-center justify-between py-3.5 px-3 sm:px-4 hover:bg-[#FFF9F5]/70 transition-colors rounded-xl"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="font-heading font-black text-sm sm:text-base text-[#CA340A] w-6 shrink-0">
                      {idx + 1}.
                    </span>
                    <div>
                      <span className="font-bold text-sm sm:text-base text-[#2C1710] block sm:inline">
                        {item.name}
                      </span>
                      {item.category && (
                        <span className="text-xs text-zinc-500 font-medium sm:ml-2">
                          ({item.category})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span
                      className={`text-xs sm:text-sm font-bold px-3.5 py-1 rounded-full ${
                        item.quantity > 0
                          ? "bg-[#CA340A]/10 text-[#CA340A]"
                          : "bg-zinc-100 text-zinc-500 font-medium"
                      }`}
                    >
                      {item.quantity} sold
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
