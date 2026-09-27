"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import {
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  Clock,
  Banknote,
  CreditCard,
  Layers,
  Calendar,
  RefreshCw,
  Award,
  ArrowDownRight,
  PieChart,
  BarChart3,
  Percent,
} from "lucide-react";

export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/analytics?range=${timeRange}`;
      if (timeRange === "custom" && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (json && json.success) {
        setData(json);
      }
    } catch (e) {
      console.error("Analytics fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [timeRange, customStart, customEnd]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const topItems = data?.topItems || data?.topSellingItems || [];
  const leastItems = data?.leastItems || data?.leastSellingItems || [];
  const tablePerformance = data?.tablePerformance || [];
  const dailyTrends = data?.dailyTrend || data?.dailyTrends || [];
  const categoryBreakdown = data?.categoryBreakdown || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header & Date Range Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#CA340A]/10 pb-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
              Sales &amp; Revenue Analytics
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b]">
              Aggregated business metrics, table turnover rates, and category performance
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "7days", label: "Last 7 Days" },
              { id: "30days", label: "Last 30 Days" },
              { id: "custom", label: "Custom Range" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setTimeRange(btn.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeRange === btn.id
                    ? "bg-[#CA340A] text-white shadow-xs"
                    : "bg-white border border-zinc-200 text-[#52525b] hover:bg-[#FFF9F5]"
                }`}
              >
                {btn.label}
              </button>
            ))}

            {timeRange === "custom" && (
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-zinc-200 text-xs">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1 rounded bg-[#FFF9F5] text-xs font-semibold"
                />
                <span className="text-zinc-400 font-bold">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1 rounded bg-[#FFF9F5] text-xs font-semibold"
                />
              </div>
            )}

            <button
              onClick={fetchAnalytics}
              className="p-2 rounded-xl bg-white border border-zinc-200 text-[#2C1710] hover:bg-[#FFF9F5]"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {loading || !data ? (
          <div className="py-20 text-center text-[#52525b]">
            <RefreshCw size={28} className="animate-spin text-[#CA340A] mx-auto mb-2" />
            <p className="font-semibold text-xs">Computing aggregated sales data...</p>
          </div>
        ) : (
          <>
            {/* Top Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
                <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block">
                  Gross Sales
                </span>
                <div className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] mt-1.5">
                  ₹{(data?.metrics?.grossSales ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-[#52525b] mt-1">
                  Tax Collected: ₹{(data?.metrics?.taxCollected ?? data?.metrics?.totalTax ?? 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
                <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block">
                  Total Orders
                </span>
                <div className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] mt-1.5">
                  {data?.metrics?.orderCount ?? 0}
                </div>
                <p className="text-[11px] text-emerald-700 font-bold mt-1">
                  {data?.metrics?.paidOrders ?? 0} Paid • {data?.metrics?.unpaidOrders ?? 0} Unpaid
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
                <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block">
                  Avg Order Value
                </span>
                <div className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] mt-1.5">
                  ₹{(data?.metrics?.avgOrderValue ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-[#52525b] mt-1">Net sales / order volume</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
                <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block">
                  Payment Channels
                </span>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-emerald-700 font-bold">Cash:</span>
                    <span className="font-extrabold">₹{(data?.metrics?.cashSales ?? data?.metrics?.cashCollection ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-700 font-bold">Online:</span>
                    <span className="font-extrabold">₹{(data?.metrics?.onlineSales ?? data?.metrics?.onlineCollection ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Trend & Category Revenue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Sales Bar Chart */}
              <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-heading font-extrabold text-base text-[#2C1710] mb-1">
                    Revenue by Date
                  </h3>
                  <p className="text-xs text-[#52525b] mb-4">Daily sales volume trend</p>
                </div>

                <div className="h-48 flex items-end gap-2 pt-6 pb-2 border-b border-zinc-100 overflow-x-auto">
                  {dailyTrends.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                      No daily records in this range.
                    </div>
                  ) : (
                    dailyTrends.map((d: any, idx: number) => {
                      const maxVal = Math.max(...dailyTrends.map((item: any) => item.sales || 0), 100);
                      const heightPct = Math.max(10, ((d.sales || 0) / maxVal) * 100);

                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center min-w-[40px] group">
                          <div className="text-[10px] font-bold text-[#52525b] opacity-0 group-hover:opacity-100 transition-opacity mb-1 whitespace-nowrap">
                            ₹{(d.sales || 0).toLocaleString()}
                          </div>
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-[#CA340A] rounded-t-lg group-hover:bg-[#A82806] transition-all"
                          />
                          <span className="text-[10px] font-semibold text-[#52525b] mt-2 truncate w-full text-center">
                            {d.date ? d.date.slice(5) : "—"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-3 flex justify-between text-xs text-[#52525b]">
                  <span>Total Days In Range: <strong>{dailyTrends.length}</strong></span>
                  <span>Range Sales: <strong className="text-[#2C1710]">₹{(data?.metrics?.grossSales ?? 0).toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
                <h3 className="font-heading font-extrabold text-base text-[#2C1710] mb-1">
                  Sales by Category
                </h3>
                <p className="text-xs text-[#52525b] mb-4">Revenue distribution</p>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {categoryBreakdown.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-8 text-center">No items sold in this period.</p>
                  ) : (
                    categoryBreakdown.map((cat: any, idx: number) => {
                      const gross = data?.metrics?.grossSales || 1;
                      const pct = Math.min(100, Math.round(((cat.revenue || 0) / gross) * 100));
                      return (
                        <div key={idx} className="text-xs space-y-1">
                          <div className="flex justify-between font-bold">
                            <span className="text-[#2C1710]">{cat.name}</span>
                            <span>₹{(cat.revenue || 0).toLocaleString()} ({pct}%)</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full bg-[#CA340A] rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Top vs Least Selling Items & Table Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Top Selling Items */}
              <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <Award size={16} className="text-amber-500" />
                  <h3 className="font-heading font-extrabold text-sm text-[#2C1710]">
                    Top Selling Products
                  </h3>
                </div>

                <div className="divide-y divide-zinc-100 text-xs">
                  {topItems.length === 0 ? (
                    <p className="py-4 text-zinc-400 text-center">No items recorded.</p>
                  ) : (
                    topItems.map((it: any, idx: number) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-[#2C1710]">
                            {idx + 1}. {it.name}
                          </span>
                          <span className="block text-[11px] text-[#52525b]">
                            {it.quantity || 0} orders
                          </span>
                        </div>
                        <span className="font-heading font-extrabold text-[#CA340A]">
                          ₹{(it.total ?? it.revenue ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Least Selling Items */}
              <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowDownRight size={16} className="text-zinc-500" />
                  <h3 className="font-heading font-extrabold text-sm text-[#2C1710]">
                    Low Volume Products
                  </h3>
                </div>

                <div className="divide-y divide-zinc-100 text-xs">
                  {leastItems.length === 0 ? (
                    <p className="py-4 text-zinc-400 text-center">No items recorded.</p>
                  ) : (
                    leastItems.map((it: any, idx: number) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-[#2C1710]">
                            {idx + 1}. {it.name}
                          </span>
                          <span className="block text-[11px] text-[#52525b]">
                            {it.quantity || 0} orders
                          </span>
                        </div>
                        <span className="font-heading font-bold text-[#52525b]">
                          ₹{(it.total ?? it.revenue ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Table Performance */}
              <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={16} className="text-blue-600" />
                  <h3 className="font-heading font-extrabold text-sm text-[#2C1710]">
                    Table Turnover &amp; Sales
                  </h3>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
                  {tablePerformance.length === 0 ? (
                    <p className="text-zinc-400 py-8 text-center">No table records in this range.</p>
                  ) : (
                    tablePerformance.map((t: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-2 rounded-xl bg-[#FFF9F5] border border-[#CA340A]/10"
                      >
                        <div>
                          <span className="font-bold text-[#2C1710]">Table {t.table}</span>
                          <span className="block text-[10px] text-[#52525b]">
                            {t.orders || 0} dining visits
                          </span>
                        </div>
                        <span className="font-heading font-extrabold text-[#2C1710]">
                          ₹{(t.sales ?? t.revenue ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
