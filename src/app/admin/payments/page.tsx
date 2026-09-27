"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import CollectCashModal from "@/components/Admin/CollectCashModal";
import { Order } from "@/lib/db";
import {
  CreditCard,
  Banknote,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  RefreshCw,
  Phone,
  Eye,
} from "lucide-react";

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOrderForCash, setSelectedOrderForCash] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error("Fetch payments error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filtered = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === "" ||
      o.orderNumber.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      (o.paymentTxnId && o.paymentTxnId.toLowerCase().includes(q));

    const matchesMethod = methodFilter === "ALL" || o.paymentMethod === methodFilter;
    const matchesStatus = statusFilter === "ALL" || o.paymentStatus === statusFilter;

    return matchesSearch && matchesMethod && matchesStatus;
  });

  const totalPaid = orders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const totalPending = orders
    .filter((o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CA340A]/10 pb-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
              Payment Transactions
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b]">
              Monitor counter cash settlements and Razorpay digital gateway transactions
            </p>
          </div>

          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-[#FFF9F5] text-xs font-bold text-[#2C1710]"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Top Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Total Realized Payments
              </span>
              <div className="font-heading font-black text-2xl text-emerald-900 mt-1">
                ₹{totalPaid.toLocaleString()}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Pending Uncollected
              </span>
              <div className="font-heading font-black text-2xl text-amber-900 mt-1">
                ₹{totalPending.toLocaleString()}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock size={20} />
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-2xl border border-[#CA340A]/15 shadow-xs flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-2.5 text-[#52525b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, phone, transaction ref..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 focus:outline-none"
            />
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
          >
            <option value="ALL">All Methods</option>
            <option value="CASH">CASH</option>
            <option value="ONLINE">ONLINE (Razorpay)</option>
            <option value="UNSELECTED">UNSELECTED</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-zinc-200 font-semibold text-[#2C1710]"
          >
            <option value="ALL">All Payment States</option>
            <option value="PAID">PAID</option>
            <option value="UNPAID">UNPAID</option>
            <option value="PENDING_CASH">PENDING_CASH</option>
          </select>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#2C1710]">
              <thead className="bg-[#FFF9F5] text-[#52525b] font-extrabold uppercase tracking-wider text-[10px] border-b border-zinc-100">
                <tr>
                  <th className="py-3 px-4">Order No</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Customer Phone</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Method</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Transaction / Provider Ref</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#52525b]">
                      No payment transactions found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => {
                    const isPaid = o.paymentStatus === "PAID";
                    const isCashUnpaid = o.paymentMethod === "CASH" && !isPaid;

                    return (
                      <tr key={o.id} className="hover:bg-amber-50/20">
                        <td className="py-3 px-4 font-mono font-bold text-[#2C1710]">
                          <Link href={`/admin/orders/${o.id}`} className="hover:text-[#CA340A] hover:underline">
                            {o.orderNumber}
                          </Link>
                        </td>

                        <td className="py-3 px-4 font-bold text-[#CA340A]">{o.tableNumber}</td>

                        <td className="py-3 px-4 font-mono text-[#52525b]">
                          {o.customerPhone || "Walk-in"}
                        </td>

                        <td className="py-3 px-4 text-[#52525b]">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4 text-right font-heading font-extrabold text-sm text-[#2C1710]">
                          ₹{o.grandTotal}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="font-bold uppercase text-[11px] text-[#2C1710]">
                            {o.paymentMethod}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {o.paymentStatus}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-500">
                          {o.paymentTxnId || "—"}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isCashUnpaid ? (
                            <button
                              onClick={() => setSelectedOrderForCash(o)}
                              className="px-2.5 py-1 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg text-[11px] font-bold"
                            >
                              Collect Cash
                            </button>
                          ) : (
                            <Link
                              href={`/admin/orders/${o.id}`}
                              className="p-1 text-zinc-500 hover:text-[#2C1710] inline-block"
                            >
                              <Eye size={14} />
                            </Link>
                          )}
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

      <CollectCashModal
        order={selectedOrderForCash}
        onClose={() => setSelectedOrderForCash(null)}
        onSuccess={() => {
          setSelectedOrderForCash(null);
          fetchOrders();
        }}
      />
    </AdminLayout>
  );
}
