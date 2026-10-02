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
} from "lucide-react";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
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

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      searchQuery === "" ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerPhone && o.customerPhone.includes(searchQuery)) ||
      o.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.items || []).some((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    const matchesPayment = paymentFilter === "ALL" || o.paymentStatus === paymentFilter;
    const matchesMethod = methodFilter === "ALL" || o.paymentMethod === methodFilter;
    const matchesDate = !dateFilter || o.createdAt.startsWith(dateFilter);

    return matchesSearch && matchesStatus && matchesPayment && matchesMethod && matchesDate;
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
              Complete archive of dine-in tickets, payment statuses, and customer orders
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
                <option value="ALL">All Order States</option>
                <option value="PENDING">PENDING</option>
                <option value="PREPARING">PREPARING</option>
                <option value="READY">READY</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            {/* Payment Status */}
            <div>
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
              >
                <option value="ALL">All Payments</option>
                <option value="PAID">PAID</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PENDING_CASH">PENDING_CASH</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#2C1710]">
              <thead className="bg-[#FFF9F5] text-[#52525b] font-extrabold uppercase tracking-wider text-[10px] border-b border-zinc-100">
                <tr>
                  <th className="py-3 px-4">Order No</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Invoice</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-[#52525b]">
                      No orders found matching your search.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const isPaid = order.paymentStatus === "PAID";
                    const isCashUnpaid = order.paymentMethod === "CASH" && !isPaid;

                    return (
                      <tr key={order.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#2C1710]">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="hover:text-[#CA340A] hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>

                        <td className="py-3 px-4 text-[#52525b]">
                          <div>{new Date(order.createdAt).toLocaleDateString()}</div>
                          <div className="text-[10px] text-zinc-400">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-bold text-[#CA340A]">
                          {order.tableNumber}
                        </td>

                        <td className="py-3 px-4 text-[#52525b]">
                          {order.customerPhone ? (
                            <span className="font-mono text-[11px] flex items-center gap-1">
                              <Phone size={10} className="text-[#CA340A]" />
                              {order.customerPhone}
                            </span>
                          ) : (
                            <span className="text-zinc-400">Walk-in</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="truncate max-w-[160px]">
                            {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-heading font-extrabold text-[#2C1710]">
                          ₹{order.grandTotal}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              order.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : order.status === "READY"
                                ? "bg-green-100 text-green-800"
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

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              isPaid
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {order.paymentStatus}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {order.invoiceNumber ? (
                            <button
                              onClick={() => handleViewInvoice(order.invoiceId || order.id)}
                              className="text-[11px] font-mono font-bold text-[#CA340A] hover:underline cursor-pointer"
                              title="View Invoice Receipt"
                            >
                              {order.invoiceNumber}
                            </button>
                          ) : (
                            <span className="text-zinc-400 text-[10px]">None</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isCashUnpaid && (
                              <button
                                onClick={() => setSelectedOrderForCash(order)}
                                className="px-2 py-1 bg-[#15803D] hover:bg-[#166534] text-white rounded-md text-[10px] font-bold"
                              >
                                Collect
                              </button>
                            )}

                            {!order.invoiceNumber ? (
                              <button
                                disabled={!isPaid || generatingId === order.id}
                                onClick={() => handleGenerateInvoice(order.id)}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold ${
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
                                  className="px-2 py-1 bg-[#FFF9F5] border border-[#CA340A]/30 text-[#CA340A] hover:bg-[#CA340A] hover:text-white rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                  title="View 58mm Thermal Bill"
                                >
                                  <Printer size={11} />
                                  <span>View Bill</span>
                                </button>
                                <button
                                  onClick={() => handleViewInvoice(order.invoiceId || order.id)}
                                  className="px-1.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-md text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                                  title="Send Bill via SMS to Customer"
                                >
                                  <MessageSquare size={10} />
                                  <span>SMS</span>
                                </button>
                              </>
                            )}

                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="p-1 text-zinc-600 hover:text-[#2C1710]"
                              title="View Details"
                            >
                              <Eye size={13} />
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
