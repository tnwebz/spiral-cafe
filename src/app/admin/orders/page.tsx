"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import CollectCashModal from "@/components/Admin/CollectCashModal";
import ThermalReceiptModal from "@/components/Admin/ThermalReceipt";
import { Order, Invoice } from "@/lib/db";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Banknote,
  Receipt,
  Printer,
  Calendar,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab: COMPLETED (history of paid & completed orders) vs UNSETTLED (active / unpaid tickets)
  const [orderTab, setOrderTab] = useState<"COMPLETED" | "UNSETTLED">("COMPLETED");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  // Modals
  const [selectedOrderForCash, setSelectedOrderForCash] = useState<Order | null>(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error("Fetch orders error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const realtimeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchOrders();

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("admin_orders_list_realtime")
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
            fetchOrders();
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
            fetchOrders();
          }, 200);
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn("Supabase Realtime admin orders error:", err);
      });

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const handleGenerateInvoice = async (orderId: string) => {
    setGeneratingId(orderId);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedInvoiceForPrint(data.invoice);
        fetchOrders();
      } else {
        alert(data.error || "Failed to generate invoice.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleViewInvoice = async (invoiceIdOrOrderId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceIdOrOrderId}`);
      const data = await res.json();
      if (data.success && data.invoice && data.invoice.id) {
        setSelectedInvoiceForPrint(data.invoice);
      } else {
        alert(data.error || "Invoice not found.");
      }
    } catch {
      alert("Failed to connect to invoice server.");
    }
  };

  // Split into Completed Order History vs Unsettled / Active
  const completedOrdersList = orders.filter(
    (o) => (o.status === "COMPLETED" && o.paymentStatus === "PAID") || o.status === "CANCELLED"
  );
  const unsettledOrdersList = orders.filter(
    (o) => !(o.status === "COMPLETED" && o.paymentStatus === "PAID") && o.status !== "CANCELLED"
  );

  const baseOrders = orderTab === "COMPLETED" ? completedOrdersList : unsettledOrdersList;

  const filteredOrders = baseOrders.filter((o) => {
    const matchesSearch =
      searchQuery === "" ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerPhone && o.customerPhone.includes(searchQuery)) ||
      o.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.items || []).some((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" || o.status === statusFilter;

    const matchesMethod =
      methodFilter === "ALL" || o.paymentMethod === methodFilter;

    const matchesDate = !dateFilter || o.createdAt.startsWith(dateFilter);

    return matchesSearch && matchesStatus && matchesMethod && matchesDate;
  });

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CA340A]/10 pb-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
              Order History &amp; Records
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b]">
              Complete archive of dine-in tickets, receipts, and customer orders
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#CA340A]/20 hover:bg-[#FFF9F5] text-xs font-bold text-[#2C1710] shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* TABS: COMPLETED ORDER HISTORY vs UNSETTLED / ACTIVE */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setOrderTab("COMPLETED");
              setStatusFilter("ALL");
              setMethodFilter("ALL");
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
              orderTab === "COMPLETED"
                ? "bg-[#2C1710] text-[#FFF9F5] border-[#2C1710] shadow-sm"
                : "bg-white text-[#52525b] border-zinc-200 hover:bg-[#FFF9F5]"
            }`}
          >
            <CheckCircle2 size={15} className={orderTab === "COMPLETED" ? "text-emerald-400" : "text-emerald-600"} />
            <span>Completed Order History</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/20 text-white">
              {completedOrdersList.length}
            </span>
          </button>

          <button
            onClick={() => {
              setOrderTab("UNSETTLED");
              setStatusFilter("ALL");
              setMethodFilter("ALL");
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
              orderTab === "UNSETTLED"
                ? "bg-[#CA340A] text-white border-[#CA340A] shadow-sm"
                : "bg-white text-[#52525b] border-zinc-200 hover:bg-[#FFF9F5]"
            }`}
          >
            <Clock size={15} />
            <span>Unsettled / Active Orders</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/20 text-white">
              {unsettledOrdersList.length}
            </span>
            {unsettledOrdersList.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Info banner for Unsettled tab */}
        {orderTab === "UNSETTLED" && (
          <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900">
            <AlertCircle size={16} className="text-amber-700 shrink-0" />
            <span>
              These orders are active on the Main Dashboard and awaiting completion or payment. Once collected &amp; completed, they automatically move to <strong>Completed Order History</strong>.
            </span>
          </div>
        )}

        {/* Filters Card */}
        <div className="bg-white p-4 rounded-2xl border border-[#CA340A]/15 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search size={16} className="absolute left-3 top-2.5 text-[#52525b]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search order #, phone, table..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] focus:outline-none"
              />
            </div>

            {/* Date Picker */}
            <div>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              />
            </div>

            {/* Order Status */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              >
                {orderTab === "COMPLETED" ? (
                  <>
                    <option value="ALL">All Completed States</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </>
                ) : (
                  <>
                    <option value="ALL">All Active States</option>
                    <option value="PENDING">PENDING</option>
                    <option value="PREPARING">PREPARING</option>
                    <option value="READY">READY</option>
                    <option value="COMPLETED">COMPLETED (Unpaid)</option>
                  </>
                )}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <select
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              >
                <option value="ALL">All Payment Methods</option>
                <option value="CASH">CASH</option>
                <option value="ONLINE">ONLINE / UPI</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#2C1710]">
              <thead className="bg-[#FFF9F5] text-zinc-500 font-bold uppercase tracking-wider text-xs border-b border-zinc-100">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Order No</th>
                  <th className="py-3.5 px-4 font-bold">Date &amp; Time</th>
                  <th className="py-3.5 px-4 font-bold">Table</th>
                  <th className="py-3.5 px-4 font-bold">Customer</th>
                  <th className="py-3.5 px-4 font-bold">Items</th>
                  <th className="py-3.5 px-4 text-right font-bold">Total</th>
                  <th className="py-3.5 px-4 text-center font-bold">Status</th>
                  <th className="py-3.5 px-4 text-center font-bold">Payment</th>
                  <th className="py-3.5 px-4 text-center font-bold">Invoice</th>
                  <th className="py-3.5 px-4 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-14 text-center text-sm font-medium text-[#52525b]">
                      <div className="flex flex-col items-center justify-center">
                        <CheckCircle2 size={32} className="text-emerald-600 mb-2 opacity-60" />
                        <p className="font-bold text-sm text-[#2C1710]">
                          {orderTab === "COMPLETED"
                            ? "No completed orders found matching your search."
                            : "No unsettled orders. All active orders are paid and completed!"}
                        </p>
                        <p className="text-xs text-[#52525b] mt-1">
                          {orderTab === "COMPLETED"
                            ? "Orders automatically appear here once cooked/served and paid."
                            : "Unpaid or in-progress orders from the dashboard will show here."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const isPaid = order.paymentStatus === "PAID";
                    const isCashUnpaid = order.paymentMethod === "CASH" && !isPaid;

                    return (
                      <tr key={order.id} className="hover:bg-[#FFF9F5]/70 transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-sm text-[#2C1710]">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="hover:text-[#CA340A] hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>

                        <td className="py-4 px-4 text-[#52525b]">
                          <div className="font-semibold text-xs sm:text-sm text-[#2C1710]">{new Date(order.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-zinc-500 font-medium">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>

                        <td className="py-4 px-4 font-bold text-xs sm:text-sm text-[#CA340A]">
                          <span className="px-2 py-0.5 rounded-md bg-[#CA340A]/10 inline-block">
                            {order.tableNumber}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-[#52525b]">
                          {order.customerPhone ? (
                            <span className="font-mono text-xs sm:text-sm flex items-center gap-1.5 font-medium text-[#2C1710]">
                              <Phone size={12} className="text-[#CA340A]" />
                              {order.customerPhone}
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-xs sm:text-sm">Walk-in</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <div className="truncate max-w-[200px] text-xs sm:text-sm font-medium text-[#2C1710]" title={order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}>
                            {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right font-heading font-black text-sm sm:text-base text-[#2C1710]">
                          ₹{(order.grandTotal || 0).toLocaleString()}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              order.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : order.status === "READY"
                                ? "bg-green-50 text-green-800 border border-green-200"
                                : order.status === "PREPARING"
                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                : order.status === "CANCELLED"
                                ? "bg-red-50 text-red-800 border border-red-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              isPaid
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {order.paymentStatus}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-center">
                          {order.invoiceNumber ? (
                            <button
                              onClick={() => handleViewInvoice(order.invoiceId || order.id)}
                              className="text-xs font-mono font-bold text-[#CA340A] hover:underline cursor-pointer"
                              title="View Invoice Receipt"
                            >
                              {order.invoiceNumber}
                            </button>
                          ) : (
                            <span className="text-zinc-400 text-xs">None</span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isCashUnpaid && (
                              <button
                                onClick={() => setSelectedOrderForCash(order)}
                                className="px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                              >
                                Collect
                              </button>
                            )}

                            {!order.invoiceNumber ? (
                              <button
                                disabled={!isPaid || generatingId === order.id}
                                onClick={() => handleGenerateInvoice(order.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all ${
                                  isPaid
                                    ? "bg-[#CA340A] text-white hover:bg-[#A82806] cursor-pointer"
                                    : "bg-zinc-100 text-zinc-400 opacity-60 cursor-not-allowed"
                                }`}
                              >
                                Invoice
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleViewInvoice(order.invoiceId || order.id)}
                                  className="px-3 py-1.5 bg-[#FFF9F5] border border-[#CA340A]/30 text-[#CA340A] hover:bg-[#CA340A] hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                                  title="View 58mm Thermal Bill"
                                >
                                  <Printer size={13} />
                                  <span>View Bill</span>
                                </button>
                                <button
                                  onClick={() => handleViewInvoice(order.invoiceId || order.id)}
                                  className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                  title="Send Bill via SMS to Customer"
                                >
                                  <MessageSquare size={12} />
                                  <span>SMS</span>
                                </button>
                              </>
                            )}

                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-[#CA340A] hover:border-[#CA340A]/40 hover:bg-[#FFF9F5] transition-colors"
                              title="View Details"
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
          <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs text-[#52525b]">
            <span>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredOrders.length} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <CollectCashModal
        order={selectedOrderForCash}
        onClose={() => setSelectedOrderForCash(null)}
        onSuccess={() => {
          setSelectedOrderForCash(null);
          fetchOrders();
        }}
      />

      <ThermalReceiptModal
        invoice={selectedInvoiceForPrint}
        onClose={() => setSelectedInvoiceForPrint(null)}
        onSmsSent={fetchOrders}
      />
    </AdminLayout>
  );
}
