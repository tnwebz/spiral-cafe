"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import CollectCashModal from "@/components/Admin/CollectCashModal";
import ThermalReceiptModal from "@/components/Admin/ThermalReceipt";
import { Order, Invoice } from "@/lib/db";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  ChefHat,
  CheckCircle2,
  Banknote,
  CreditCard,
  AlertCircle,
  Receipt,
  Printer,
  Search,
  Eye,
  RefreshCw,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [data, setData] = useState<{
    kpis: {
      todaySales: number;
      ordersToday: number;
      paidOrders: number;
      unpaidOrders: number;
      pendingPaymentsAmount: number;
      pendingPayments?: number;
      pendingOrders?: number;
      preparingOrders?: number;
      readyOrders?: number;
      avgOrderValue: number;
      onlinePayments: number;
      cashPayments: number;
      activeTables: number;
      taxCollected: number;
    };
    recentOrders: Order[];
    currentOrders?: Order[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [selectedOrderForCash, setSelectedOrderForCash] = useState<Order | null>(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);

  // Tabs & pagination for Dashboard Orders (15-20 consecutive orders max)
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dashboardTab, setDashboardTab] = useState<"CURRENT" | "RECENT">("CURRENT");
  const pageSize = 15;

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const realtimeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchOverview();

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("admin_dashboard_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchOverview();
          }, 200);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invoices",
        },
        () => {
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchOverview();
          }, 200);
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn("Supabase Realtime admin dashboard error:", err);
      });

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchOverview]);

  const handleGenerateInvoice = async (orderId: string) => {
    setGeneratingInvoiceId(orderId);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, adminUser: "Admin" }),
      });
      const resData = await res.json();
      if (resData.success && resData.invoice && resData.invoice.id) {
        setSelectedInvoiceForPrint(resData.invoice);
        fetchOverview();
      } else {
        alert(resData.error || "Failed to generate invoice.");
      }
    } catch {
      alert("Network error generating invoice.");
    } finally {
      setGeneratingInvoiceId(null);
    }
  };

  const handleViewInvoice = async (invoiceIdOrOrderId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceIdOrOrderId}`);
      const resData = await res.json();
      if (resData.success && resData.invoice && resData.invoice.id) {
        setSelectedInvoiceForPrint(resData.invoice);
      } else {
        alert(resData.error || "Invoice not found.");
      }
    } catch {
      alert("Failed to connect to invoice service.");
    }
  };

  if (loading || !data) {
    return (
      <AdminLayout>
        <div className="py-24 flex flex-col items-center justify-center text-[#52525b]">
          <RefreshCw size={32} className="animate-spin text-[#CA340A] mb-3" />
          <p className="text-sm font-semibold">Loading live dashboard...</p>
        </div>
      </AdminLayout>
    );
  }

  const { kpis, recentOrders = [] } = data;

  // Active status counts: fallback to counting recentOrders if not in kpis
  const pendingCount =
    kpis?.pendingOrders ??
    recentOrders.filter((o) => o.status === "PENDING").length;

  const preparingCount =
    kpis?.preparingOrders ??
    recentOrders.filter((o) => o.status === "PREPARING").length;

  const readyCount =
    kpis?.readyOrders ??
    recentOrders.filter((o) => o.status === "READY").length;

  // Revenue totals
  const cashTotal = kpis?.cashPayments ?? 0;
  const onlineTotal = kpis?.onlinePayments ?? 0;
  const pendingTotal = kpis?.pendingPaymentsAmount ?? kpis?.pendingPayments ?? 0;
  const taxTotal = kpis?.taxCollected ?? 0;
  const totalVolume = cashTotal + onlineTotal + pendingTotal;

  const cashPercent = totalVolume > 0 ? Math.round((cashTotal / totalVolume) * 100) : 0;
  const onlinePercent = totalVolume > 0 ? Math.round((onlineTotal / totalVolume) * 100) : 0;
  const pendingPercent = totalVolume > 0 ? Math.max(0, 100 - cashPercent - onlinePercent) : 0;

  // Current active/unsettled orders (cooking or awaiting cash collection)
  const currentOrdersList =
    data?.currentOrders ||
    recentOrders.filter(
      (o) => !(o.status === "COMPLETED" && o.paymentStatus === "PAID") && o.status !== "CANCELLED"
    );

  const displayedOrdersSource = dashboardTab === "CURRENT" ? currentOrdersList : recentOrders;

  // Filter orders
  const filteredOrders = displayedOrdersSource.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.tableNumber.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      (o.items || []).some((it) => it.name.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <AdminLayout>
      <div className="space-y-6 w-full">
        {/* TOP BAR / DASHBOARD HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CA340A]/10 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
                Dashboard
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#52525b] mt-0.5">
              Today's sales, kitchen pipeline, revenue summary, and recent orders
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="hidden md:inline text-xs font-medium text-[#52525b] bg-white px-3 py-1.5 rounded-xl border border-zinc-200/80 shadow-2xs">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <button
              onClick={fetchOverview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#CA340A]/20 hover:bg-[#FFF9F5] text-xs font-bold text-[#2C1710] shadow-2xs transition-all cursor-pointer"
              title="Refresh Dashboard"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* TOP METRIC CARDS: TODAY'S SALES | TODAY'S ORDERS | PENDING / PREPARING / READY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. TODAY'S SALES */}
          <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-[#CA340A]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                Today’s Sales
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#CA340A]/10 text-[#CA340A] flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>

            <div className="my-2">
              <div className="font-heading font-black text-3xl sm:text-4xl text-[#2C1710] tracking-tight">
                ₹{(kpis?.todaySales ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100">
              <span className="text-[#15803D] font-bold flex items-center gap-1">
                <CheckCircle2 size={13} />
                {kpis?.paidOrders ?? 0} orders settled
              </span>
              <span className="text-[#52525b] text-[11px]">
                Avg: <strong className="text-[#2C1710]">₹{kpis?.avgOrderValue ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* 2. TODAY'S ORDERS */}
          <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-[#CA340A]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                Today’s Orders
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingBag size={16} />
              </div>
            </div>

            <div className="my-2">
              <div className="font-heading font-black text-3xl sm:text-4xl text-[#2C1710] tracking-tight">
                {kpis?.ordersToday ?? 0}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100">
              <span className="text-[#52525b]">
                Active Tables: <strong className="text-[#2C1710]">{kpis?.activeTables ?? 0}</strong>
              </span>
              <span className="text-amber-700 font-bold text-[11px]">
                {kpis?.unpaidOrders ?? 0} unpaid
              </span>
            </div>
          </div>

          {/* 3. PENDING / PREPARING / READY */}
          <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-[#CA340A]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                Pending / Preparing / Ready
              </span>
              <Link
                href="/kitchen"
                target="_blank"
                className="w-8 h-8 rounded-xl bg-orange-50 text-[#CA340A] hover:bg-[#CA340A] hover:text-white flex items-center justify-center transition-colors"
                title="Launch Kitchen KDS"
              >
                <ChefHat size={16} />
              </Link>
            </div>

            {/* 3 Status Counters */}
            <div className="grid grid-cols-3 gap-2 my-2">
              {/* Pending */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-center">
                <span className="block text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">
                  Pending
                </span>
                <span className="font-heading font-black text-2xl text-amber-700 leading-tight">
                  {pendingCount}
                </span>
              </div>

              {/* Preparing */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5 text-center">
                <span className="block text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">
                  Preparing
                </span>
                <span className="font-heading font-black text-2xl text-blue-700 leading-tight">
                  {preparingCount}
                </span>
              </div>

              {/* Ready */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 text-center">
                <span className="block text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                  Ready
                </span>
                <span className="font-heading font-black text-2xl text-emerald-700 leading-tight">
                  {readyCount}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100">
              <span className="text-[#52525b] text-[11px]">
                Total Active: <strong className="text-[#2C1710]">{pendingCount + preparingCount + readyCount}</strong>
              </span>
              <Link
                href="/kitchen"
                target="_blank"
                className="text-[11px] font-bold text-[#CA340A] hover:underline flex items-center gap-0.5"
              >
                <span>Kitchen Screen</span>
                <ExternalLink size={10} />
              </Link>
            </div>
          </div>
        </div>

        {/* 4. QUICK REVENUE SUMMARY */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#CA340A]/15 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Banknote size={16} />
              </div>
              <div>
                <h2 className="font-heading font-extrabold text-base text-[#2C1710] tracking-tight">
                  Quick Revenue Summary
                </h2>
                <p className="text-xs text-[#52525b]">
                  Payment methods breakdown, cash in hand, and unsettled collections for today
                </p>
              </div>
            </div>

            <div className="text-xs text-[#52525b] font-medium self-start sm:self-auto">
              Total Recorded: <strong className="text-[#2C1710] font-heading font-extrabold text-sm">₹{totalVolume.toLocaleString()}</strong>
            </div>
          </div>

          {/* Proportional Distribution Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden flex shadow-inner">
              {cashPercent > 0 && (
                <div
                  style={{ width: `${cashPercent}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Cash: ₹${cashTotal.toLocaleString()} (${cashPercent}%)`}
                />
              )}
              {onlinePercent > 0 && (
                <div
                  style={{ width: `${onlinePercent}%` }}
                  className="bg-indigo-600 h-full transition-all"
                  title={`Online / UPI: ₹${onlineTotal.toLocaleString()} (${onlinePercent}%)`}
                />
              )}
              {pendingPercent > 0 && (
                <div
                  style={{ width: `${pendingPercent}%` }}
                  className="bg-amber-400 h-full transition-all"
                  title={`Pending: ₹${pendingTotal.toLocaleString()} (${pendingPercent}%)`}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-[#52525b] pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Cash ({cashPercent}%)
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                Online / UPI ({onlinePercent}%)
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Unpaid / Due ({pendingPercent}%)
              </span>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Cash */}
            <div className="p-3.5 rounded-xl bg-[#FFF9F5] border border-[#CA340A]/10">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block">
                Cash Collection
              </span>
              <div className="font-heading font-black text-xl sm:text-2xl text-emerald-700 mt-1">
                ₹{cashTotal.toLocaleString()}
              </div>
              <span className="text-[10px] text-[#52525b] block mt-0.5">
                Physical drawer cash
              </span>
            </div>

            {/* Online */}
            <div className="p-3.5 rounded-xl bg-[#FFF9F5] border border-[#CA340A]/10">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block">
                Online / UPI
              </span>
              <div className="font-heading font-black text-xl sm:text-2xl text-indigo-700 mt-1">
                ₹{onlineTotal.toLocaleString()}
              </div>
              <span className="text-[10px] text-[#52525b] block mt-0.5">
                Razorpay &amp; QR payments
              </span>
            </div>

            {/* Pending / Unpaid */}
            <div className="p-3.5 rounded-xl bg-[#FFF9F5] border border-[#CA340A]/10">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block">
                Pending / Unpaid
              </span>
              <div className="font-heading font-black text-xl sm:text-2xl text-amber-700 mt-1">
                ₹{pendingTotal.toLocaleString()}
              </div>
              <span className="text-[10px] text-[#52525b] block mt-0.5">
                {kpis?.unpaidOrders ?? 0} active tickets
              </span>
            </div>

            {/* Tax Collected */}
            <div className="p-3.5 rounded-xl bg-[#FFF9F5] border border-[#CA340A]/10">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block">
                GST (5%) Tax
              </span>
              <div className="font-heading font-black text-xl sm:text-2xl text-[#CA340A] mt-1">
                ₹{taxTotal.toLocaleString()}
              </div>
              <span className="text-[10px] text-[#52525b] block mt-0.5">
                Total statutory tax
              </span>
            </div>
          </div>
        </div>

        {/* 5. CURRENT ORDERS & DASHBOARD TICKETS */}
        <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs overflow-hidden">
          {/* Header, Tabs & Search */}
          <div className="p-5 border-b border-zinc-100 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-extrabold text-base text-[#2C1710] tracking-tight">
                    {dashboardTab === "CURRENT" ? "Current Orders" : "Recent 20 Orders"}
                  </h2>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-[#52525b]">
                    {filteredOrders.length}
                  </span>
                </div>
                <p className="text-xs text-[#52525b]">
                  {dashboardTab === "CURRENT"
                    ? "Active dine-in tickets & orders awaiting payment settlement (max 20)"
                    : "Latest consecutive orders placed in the café (max 20)"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-2.5 text-[#52525b]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search order #, table, item..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
                  />
                </div>

                <Link
                  href="/admin/orders"
                  className="px-3.5 py-1.5 rounded-xl bg-[#2C1710] text-white hover:bg-[#432319] text-xs font-bold whitespace-nowrap shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <span>Order History</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* Sub-Tabs: Current Orders vs Recent 20 Orders */}
            <div className="flex items-center gap-2 pt-1 border-t border-zinc-100">
              <button
                onClick={() => {
                  setDashboardTab("CURRENT");
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  dashboardTab === "CURRENT"
                    ? "bg-[#2C1710] text-[#FFF9F5] border-[#2C1710] shadow-xs"
                    : "bg-[#FFF9F5] text-[#52525b] border-zinc-200 hover:bg-white"
                }`}
              >
                <Clock size={13} className={dashboardTab === "CURRENT" ? "text-amber-400" : "text-amber-600"} />
                <span>Current Orders ({currentOrdersList.length})</span>
                {currentOrdersList.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => {
                  setDashboardTab("RECENT");
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  dashboardTab === "RECENT"
                    ? "bg-[#2C1710] text-[#FFF9F5] border-[#2C1710] shadow-xs"
                    : "bg-[#FFF9F5] text-[#52525b] border-zinc-200 hover:bg-white"
                }`}
              >
                <span>Recent 20 Orders</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/20 text-white">
                  {recentOrders.length}
                </span>
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#2C1710]">
              <thead className="bg-[#FFF9F5] text-zinc-500 font-bold uppercase tracking-wider text-xs border-b border-zinc-100">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Order / Table</th>
                  <th className="py-3.5 px-4 font-bold">Items Snapshot</th>
                  <th className="py-3.5 px-4 text-right font-bold">Amount</th>
                  <th className="py-3.5 px-4 text-center font-bold">Kitchen Status</th>
                  <th className="py-3.5 px-4 text-center font-bold">Payment</th>
                  <th className="py-3.5 px-4 font-bold">Time</th>
                  <th className="py-3.5 px-4 text-right font-bold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-sm font-medium text-[#52525b]">
                      <div className="flex flex-col items-center justify-center text-center">
                        <CheckCircle2 size={32} className="text-emerald-600 mb-2 opacity-70" />
                        <h3 className="font-heading font-black text-sm text-[#2C1710]">
                          {dashboardTab === "CURRENT"
                            ? "All Active Orders Settled & Completed"
                            : "No orders matching your criteria."}
                        </h3>
                        <p className="text-xs text-[#52525b] mt-1 max-w-sm">
                          {dashboardTab === "CURRENT"
                            ? "There are no in-progress orders or pending cash collections right now. Fully settled orders have moved to Order History."
                            : "Try searching for a different order #, table, or item name."}
                        </p>
                        {dashboardTab === "CURRENT" && (
                          <div className="flex items-center gap-2 mt-4">
                            <button
                              onClick={() => setDashboardTab("RECENT")}
                              className="px-3.5 py-1.5 bg-[#FFF9F5] hover:bg-zinc-100 border border-zinc-200 text-[#2C1710] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              View Recent 20 Orders
                            </button>
                            <Link
                              href="/admin/orders"
                              className="px-3.5 py-1.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                            >
                              Open Order History →
                            </Link>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const isPaid = order.paymentStatus === "PAID";
                    const isCashUnpaid = order.paymentMethod === "CASH" && !isPaid;

                    // Items snippet
                    const itemsSummary = (order.items || [])
                      .map((it) => `${it.quantity}x ${it.name}`)
                      .join(", ");

                    // Kitchen status badge
                    let statusBadge = "bg-zinc-100 text-zinc-700 border border-zinc-200";
                    if (order.status === "PENDING") statusBadge = "bg-amber-50 text-amber-800 border border-amber-300";
                    else if (order.status === "PREPARING") statusBadge = "bg-blue-50 text-blue-800 border border-blue-300";
                    else if (order.status === "READY") statusBadge = "bg-emerald-50 text-emerald-800 border border-emerald-300";
                    else if (order.status === "CANCELLED") statusBadge = "bg-red-50 text-red-800 border border-red-300";

                    return (
                      <tr key={order.id} className="hover:bg-[#FFF9F5]/70 transition-colors">
                        {/* Order & Table */}
                        <td className="py-4 px-4 font-mono">
                          <div className="font-bold text-sm text-[#2C1710] flex items-center gap-1.5">
                            <span>{order.orderNumber}</span>
                          </div>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-bold bg-[#CA340A]/10 text-[#CA340A]">
                            {order.tableNumber}
                          </span>
                        </td>

                        {/* Items Snapshot */}
                        <td className="py-4 px-4 max-w-sm lg:max-w-md">
                          <p className="font-semibold text-sm text-[#2C1710] truncate" title={itemsSummary}>
                            {itemsSummary || "No items listed"}
                          </p>
                          <span className="text-xs text-zinc-500 font-medium">
                            {(order.items || []).length} {(order.items || []).length === 1 ? "item" : "items"}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-4 px-4 text-right font-heading font-black text-base text-[#2C1710]">
                          ₹{(order.grandTotal || 0).toLocaleString()}
                        </td>

                        {/* Kitchen Status */}
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusBadge}`}>
                            {order.status}
                          </span>
                        </td>

                        {/* Payment */}
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                                isPaid
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {order.paymentStatus}
                            </span>
                            <span className="text-xs text-zinc-500 font-medium mt-0.5">
                              {order.paymentMethod}
                            </span>
                          </div>
                        </td>

                        {/* Time */}
                        <td className="py-4 px-4 text-xs font-medium text-zinc-600 whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Collect Cash shortcut */}
                            {isCashUnpaid && (
                              <button
                                onClick={() => setSelectedOrderForCash(order)}
                                className="px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                                title="Collect cash & settle"
                              >
                                Settle
                              </button>
                            )}

                            {/* View Bill / Receipt */}
                            {order.invoiceNumber ? (
                              <button
                                onClick={() => handleViewInvoice(order.invoiceId || order.id)}
                                className="px-3 py-1.5 bg-[#FFF9F5] border border-[#CA340A]/30 text-[#CA340A] hover:bg-[#CA340A] hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                                title="View 58mm Thermal Bill & SMS"
                              >
                                <Printer size={13} />
                                <span>Bill</span>
                              </button>
                            ) : isPaid ? (
                              <button
                                disabled={generatingInvoiceId === order.id}
                                onClick={() => handleGenerateInvoice(order.id)}
                                className="px-3 py-1.5 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                                title="Generate tax invoice"
                              >
                                <Receipt size={13} />
                                <span>Invoice</span>
                              </button>
                            ) : null}

                            {/* View Detail Page */}
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-[#CA340A] hover:border-[#CA340A]/40 hover:bg-[#FFF9F5] transition-colors"
                              title="View Order Details"
                            >
                              <Eye size={15} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs text-[#52525b]">
              <span>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredOrders.length} orders)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-[#FFF9F5] cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-[#FFF9F5] cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collect Cash Modal */}
      <CollectCashModal
        order={selectedOrderForCash}
        onClose={() => setSelectedOrderForCash(null)}
        onSuccess={() => {
          setSelectedOrderForCash(null);
          fetchOverview();
        }}
      />

      {/* Thermal Receipt & SMS Modal */}
      <ThermalReceiptModal
        invoice={selectedInvoiceForPrint}
        onClose={() => setSelectedInvoiceForPrint(null)}
        onSmsSent={fetchOverview}
      />
    </AdminLayout>
  );
}
