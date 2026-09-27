"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import CollectCashModal from "@/components/Admin/CollectCashModal";
import ThermalReceiptModal from "@/components/Admin/ThermalReceipt";
import { Order, Invoice } from "@/lib/db";
import {
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  Clock,
  Banknote,
  CreditCard,
  Layers,
  ArrowUpRight,
  Receipt,
  Printer,
  Search,
  Filter,
  Eye,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Phone,
} from "lucide-react";

export default function AdminOverviewPage() {
  const [data, setData] = useState<{
    kpis: {
      todaySales: number;
      ordersToday: number;
      paidOrders: number;
      unpaidOrders: number;
      pendingPaymentsAmount: number;
      pendingPayments?: number;
      avgOrderValue: number;
      onlinePayments: number;
      cashPayments: number;
      activeTables: number;
      taxCollected: number;
      totalCustomers?: number;
      totalInvoices?: number;
    };
    hourlySales: Array<{ hour: string; count: number; sales: number }>;
    paymentSplit: { cash: number; online: number; unpaid: number };
    topSellingItems: Array<{ name: string; quantity: number; total: number }>;
    recentOrders: Order[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [selectedOrderForCash, setSelectedOrderForCash] = useState<Order | null>(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);

  // Filters for today's table
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [tableFilter, setTableFilter] = useState("ALL");

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error("Overview fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();

    // Listen to real-time events
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/admin/stream");
      eventSource.addEventListener("order", () => fetchOverview());
      eventSource.addEventListener("payment", () => fetchOverview());
      eventSource.addEventListener("invoice", () => fetchOverview());
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
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
      if (resData.success) {
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
      if (resData.success) {
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
        <div className="py-20 flex flex-col items-center justify-center text-[#52525b]">
          <RefreshCw size={32} className="animate-spin text-[#CA340A] mb-3" />
          <p className="text-sm font-semibold">Loading live restaurant analytics...</p>
        </div>
      </AdminLayout>
    );
  }

  const { kpis, hourlySales, paymentSplit, topSellingItems, recentOrders } = data;

  // Filter today's sales table
  const filteredOrders = recentOrders.filter((o) => {
    const matchesSearch =
      searchQuery === "" ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerPhone && o.customerPhone.includes(searchQuery)) ||
      o.items.some((it) => it.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    const matchesPayment = paymentFilter === "ALL" || o.paymentStatus === paymentFilter;
    const matchesTable = tableFilter === "ALL" || o.tableNumber === tableFilter;

    return matchesSearch && matchesStatus && matchesPayment && matchesTable;
  });

  // Extract unique tables for filter
  const tableOptions = Array.from(new Set(recentOrders.map((o) => o.tableNumber))).sort();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* TOP BAR / TITLE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CA340A]/10 pb-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
              Today's Operations
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b]">
              Live sales performance, active kitchen tickets, and payment settlements
            </p>
          </div>

          <button
            onClick={fetchOverview}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#CA340A]/20 hover:bg-[#FFF9F5] text-xs font-bold text-[#2C1710] shadow-2xs transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Live Data</span>
          </button>
        </div>

        {/* 8 TOP OPERATIONAL KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: TODAY'S SALES */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                TODAY'S SALES
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#CA340A]/10 text-[#CA340A] flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] mt-2">
              ₹{(kpis?.todaySales ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-[#15803D] font-bold mt-1 flex items-center gap-1">
              <span>{kpis?.paidOrders ?? 0} orders paid</span>
            </p>
          </div>

          {/* Card 2: ORDERS TODAY */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                ORDERS TODAY
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingBag size={16} />
              </div>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] mt-2">
              {kpis?.ordersToday ?? 0}
            </div>
            <p className="text-[11px] text-[#52525b] font-medium mt-1">
              Active Tables: <strong className="text-[#2C1710]">{kpis?.activeTables ?? 0}</strong>
            </p>
          </div>

          {/* Card 3: PAID ORDERS */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                PAID ORDERS
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-emerald-700 mt-2">
              {kpis?.paidOrders ?? 0}
            </div>
            <p className="text-[11px] text-[#52525b] font-medium mt-1">
              Settled: {Math.round(((kpis?.paidOrders ?? 0) / (kpis?.ordersToday || 1)) * 100)}%
            </p>
          </div>

          {/* Card 4: PENDING PAYMENTS */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                PENDING PAYMENTS
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock size={16} />
              </div>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-amber-700 mt-2">
              ₹{(kpis?.pendingPaymentsAmount ?? kpis?.pendingPayments ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              {kpis?.unpaidOrders ?? 0} unpaid {(kpis?.unpaidOrders ?? 0) === 1 ? "order" : "orders"}
            </p>
          </div>

          {/* Card 5: AVERAGE ORDER VALUE */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                AVG ORDER VALUE
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] mt-2">
              ₹{kpis?.avgOrderValue ?? 0}
            </div>
            <p className="text-[11px] text-[#52525b] font-medium mt-1">Per dining check</p>
          </div>

          {/* Card 6: ONLINE PAYMENTS */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                ONLINE PAYMENTS
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CreditCard size={16} />
              </div>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] mt-2">
              ₹{(kpis?.onlinePayments ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-indigo-700 font-semibold mt-1">Razorpay Verified</p>
          </div>

          {/* Card 7: CASH PAYMENTS */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                CASH PAYMENTS
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Banknote size={16} />
              </div>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] mt-2">
              ₹{(kpis?.cashPayments ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">Cash Register</p>
          </div>

          {/* Card 8: ACTIVE TABLES */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                ACTIVE TABLES
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <Layers size={16} />
              </div>
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-[#CA340A] mt-2">
              {kpis?.activeTables ?? 0}
            </div>
            <p className="text-[11px] text-[#52525b] font-medium mt-1">Dining Floor In-Session</p>
          </div>
        </div>

        {/* MIDDLE SECTION: HOURLY SALES TREND & PAYMENT DISTRIBUTION & TOP ITEMS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Orders by Hour / Revenue Chart */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                  Orders &amp; Sales by Hour
                </h3>
                <p className="text-xs text-[#52525b]">Peak customer traffic today</p>
              </div>
            </div>

            {/* Simple Bar Chart */}
            <div className="h-44 flex items-end gap-2 pt-6 pb-2 border-b border-zinc-100 overflow-x-auto">
              {hourlySales.map((h, idx) => {
                const maxSales = Math.max(...hourlySales.map((item) => item.sales), 100);
                const heightPct = Math.max(8, (h.sales / maxSales) * 100);

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center min-w-[32px] group">
                    <div className="text-[10px] font-bold text-[#52525b] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                      ₹{h.sales}
                    </div>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-lg transition-all ${
                        h.count > 0 ? "bg-[#CA340A] group-hover:bg-[#A82806]" : "bg-zinc-100"
                      }`}
                    />
                    <span className="text-[10px] font-semibold text-[#52525b] mt-2 truncate w-full text-center">
                      {h.hour}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer Summary */}
            <div className="flex items-center justify-between pt-3 text-xs text-[#52525b]">
              <span>Tax Collected: <strong className="text-[#2C1710]">₹{kpis.taxCollected}</strong></span>
              <span>Total Volume: <strong className="text-[#2C1710]">{kpis.ordersToday} Orders</strong></span>
            </div>
          </div>

          {/* Payment Split & Top Items */}
          <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-extrabold text-base text-[#2C1710] mb-1">
                Payment Distribution
              </h3>
              <p className="text-xs text-[#52525b] mb-4">Cash vs Online breakdown</p>

              {/* Progress bars */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-emerald-700 flex items-center gap-1.5">
                      <Banknote size={14} /> Cash Collection
                    </span>
                    <span>₹{(paymentSplit?.cash ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      style={{
                        width: `${
                          (kpis?.todaySales ?? 0) > 0
                            ? ((paymentSplit?.cash ?? 0) / (kpis?.todaySales || 1)) * 100
                            : 0
                        }%`,
                      }}
                      className="h-full bg-emerald-600 rounded-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-indigo-700 flex items-center gap-1.5">
                      <CreditCard size={14} /> Online (Razorpay)
                    </span>
                    <span>₹{(paymentSplit?.online ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      style={{
                        width: `${
                          (kpis?.todaySales ?? 0) > 0
                            ? ((paymentSplit?.online ?? 0) / (kpis?.todaySales || 1)) * 100
                            : 0
                        }%`,
                      }}
                      className="h-full bg-indigo-600 rounded-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-amber-700 flex items-center gap-1.5">
                      <Clock size={14} /> Uncollected / Pending
                    </span>
                    <span>₹{(paymentSplit?.unpaid ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      style={{
                        width: `${
                          ((kpis?.todaySales ?? 0) + (paymentSplit?.unpaid ?? 0)) > 0
                            ? ((paymentSplit?.unpaid ?? 0) /
                                ((kpis?.todaySales ?? 0) + (paymentSplit?.unpaid ?? 0))) *
                              100
                            : 0
                        }%`,
                      }}
                      className="h-full bg-amber-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Seller Quick List */}
            <div className="mt-5 pt-4 border-t border-zinc-100">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block mb-2">
                Top Selling Today
              </span>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {topSellingItems.length === 0 ? (
                  <p className="text-xs text-[#52525b]">No item sales recorded today yet.</p>
                ) : (
                  topSellingItems.slice(0, 3).map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#2C1710] truncate max-w-[150px]">
                        {it.name}
                      </span>
                      <span className="text-[#CA340A] font-bold">
                        {it.quantity} sold (₹{it.total})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TODAY'S SALES & ORDERS TABLE */}
        <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs overflow-hidden">
          {/* Table Header & Filters */}
          <div className="p-5 border-b border-zinc-100 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-extrabold text-lg text-[#2C1710]">
                  Today's Live Sales &amp; Order Register
                </h3>
                <p className="text-xs text-[#52525b]">
                  Showing {filteredOrders.length} of {recentOrders.length} orders
                </p>
              </div>

              {/* Quick Search */}
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-2.5 text-[#52525b]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search order #, phone, item..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] focus:outline-none"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
              <span className="text-[11px] font-bold text-[#52525b] flex items-center gap-1 mr-1">
                <Filter size={12} /> Filters:
              </span>

              {/* Order Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              >
                <option value="ALL">All Order Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PREPARING">Preparing</option>
                <option value="READY">Ready</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              {/* Payment Status Filter */}
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              >
                <option value="ALL">All Payments</option>
                <option value="PAID">Paid Only</option>
                <option value="UNPAID">Unpaid Only</option>
                <option value="PENDING_CASH">Pending Cash Confirmation</option>
              </select>

              {/* Table Filter */}
              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              >
                <option value="ALL">All Tables</option>
                {tableOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#2C1710]">
              <thead className="bg-[#FFF9F5] text-[#52525b] font-extrabold uppercase tracking-wider text-[10px] border-b border-zinc-100">
                <tr>
                  <th className="py-3 px-4">Order No</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Kitchen</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Invoice</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-[#52525b]">
                      No orders found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isPaid = order.paymentStatus === "PAID";
                    const isCashUnpaid = order.paymentMethod === "CASH" && !isPaid;

                    return (
                      <tr key={order.id} className="hover:bg-amber-50/30 transition-colors">
                        {/* Order No */}
                        <td className="py-3.5 px-4 font-mono font-bold text-[#2C1710]">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="hover:text-[#CA340A] hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>

                        {/* Time */}
                        <td className="py-3.5 px-4 text-[#52525b]">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        {/* Table */}
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 bg-[#FFF9F5] border border-[#CA340A]/20 text-[#CA340A] font-bold rounded-md">
                            {order.tableNumber}
                          </span>
                        </td>

                        {/* Customer Phone */}
                        <td className="py-3.5 px-4 text-[#52525b]">
                          {order.customerPhone ? (
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <Phone size={11} className="text-[#CA340A]" />
                              +91 {order.customerPhone.slice(-10)}
                            </span>
                          ) : (
                            <span className="text-zinc-400">Walk-in</span>
                          )}
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-4">
                          <div className="truncate max-w-[180px]" title={order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}>
                            <span className="font-semibold text-[#2C1710]">
                              {order.items[0]?.name}
                            </span>
                            {order.items.length > 1 && (
                              <span className="text-zinc-500 text-[11px] ml-1">
                                +{order.items.length - 1} more
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-heading font-extrabold text-sm text-[#2C1710]">
                            ₹{order.grandTotal}
                          </span>
                        </td>

                        {/* Kitchen Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              order.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : order.status === "READY"
                                ? "bg-green-100 text-green-800 animate-pulse"
                                : order.status === "PREPARING"
                                ? "bg-blue-100 text-blue-800"
                                : order.status === "CANCELLED"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>

                        {/* Payment Status & Method */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isPaid
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {order.paymentStatus}
                            </span>
                            <span className="text-[10px] font-semibold text-[#52525b] mt-0.5 uppercase">
                              {order.paymentMethod}
                            </span>
                          </div>
                        </td>

                        {/* Invoice Status */}
                        <td className="py-3.5 px-4 text-center">
                          {order.invoiceNumber ? (
                            <button
                              onClick={() => handleViewInvoice(order.invoiceId || order.id)}
                              className="text-[11px] font-mono font-bold text-[#CA340A] hover:underline cursor-pointer"
                              title="View Invoice Receipt"
                            >
                              {order.invoiceNumber}
                            </button>
                          ) : (
                            <span className="text-[10px] text-zinc-400 font-medium">
                              Not Issued
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Collect Cash Action if Cash & Unpaid */}
                            {isCashUnpaid && (
                              <button
                                onClick={() => setSelectedOrderForCash(order)}
                                className="px-2.5 py-1 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Banknote size={12} />
                                <span>Collect Cash</span>
                              </button>
                            )}

                            {/* Generate Invoice Action (Enabled only after PAID) */}
                            {!order.invoiceNumber ? (
                              <button
                                disabled={!isPaid || generatingInvoiceId === order.id}
                                onClick={() => handleGenerateInvoice(order.id)}
                                title={
                                  isPaid
                                    ? "Generate official tax invoice"
                                    : "Invoice can be generated after payment is confirmed."
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                                  isPaid
                                    ? "bg-[#CA340A] hover:bg-[#A82806] text-white shadow-2xs cursor-pointer"
                                    : "bg-zinc-100 text-zinc-400 cursor-not-allowed opacity-60"
                                }`}
                              >
                                <Receipt size={12} />
                                <span>
                                  {generatingInvoiceId === order.id ? "..." : "Invoice"}
                                </span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleViewInvoice(order.invoiceId || order.id)}
                                className="px-2.5 py-1 rounded-lg bg-[#FFF9F5] border border-[#CA340A]/30 text-[#CA340A] hover:bg-[#CA340A] hover:text-white transition-colors text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="View / Print 58mm Thermal Receipt"
                              >
                                <Printer size={12} />
                                <span>View Bill</span>
                              </button>
                            )}

                            {/* View Order Detail */}
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="p-1 rounded-lg border border-zinc-200 text-[#52525b] hover:bg-[#FFF9F5] hover:text-[#2C1710] transition-colors"
                              title="View Order Details"
                            >
                              <Eye size={14} />
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
        </div>
      </div>

      {/* CASH PAYMENT CONFIRMATION MODAL */}
      <CollectCashModal
        order={selectedOrderForCash}
        onClose={() => setSelectedOrderForCash(null)}
        onSuccess={() => {
          setSelectedOrderForCash(null);
          fetchOverview();
        }}
      />

      {/* 58MM THERMAL RECEIPT PRINT MODAL */}
      <ThermalReceiptModal
        invoice={selectedInvoiceForPrint}
        onClose={() => setSelectedInvoiceForPrint(null)}
      />
    </AdminLayout>
  );
}
