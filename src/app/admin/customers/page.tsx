"use client";

import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import { Customer } from "@/lib/db";
import {
  Users,
  Search,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShoppingBag,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers || []);
      }
    } catch (e) {
      console.error("Fetch customers error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filtered = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      q === "" ||
      c.phoneNumber.includes(q) ||
      (c.name && c.name.toLowerCase().includes(q))
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CA340A]/10 pb-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
              Customer Directory
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b]">
              Captured guest phone numbers, dine-in visit frequency, and SMS consent records
            </p>
          </div>

          <button
            onClick={fetchCustomers}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-[#FFF9F5] text-xs font-bold text-[#2C1710]"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl border border-[#CA340A]/15 shadow-xs flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3 top-2.5 text-[#52525b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by phone number or name..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#FFF9F5] border border-[#CA340A]/20 focus:outline-none"
            />
          </div>

          <div className="text-xs text-[#52525b] font-semibold">
            Registered Guests: <strong className="text-[#2C1710]">{customers.length}</strong>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-2xl border border-[#CA340A]/15 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#2C1710]">
              <thead className="bg-[#FFF9F5] text-[#52525b] font-extrabold uppercase tracking-wider text-[10px] border-b border-zinc-100">
                <tr>
                  <th className="py-3 px-4">Customer Mobile</th>
                  <th className="py-3 px-4">Name / Alias</th>
                  <th className="py-3 px-4 text-center">Total Orders</th>
                  <th className="py-3 px-4 text-right">Lifetime Spend</th>
                  <th className="py-3 px-4 text-center">Transactional SMS</th>
                  <th className="py-3 px-4 text-center">Marketing SMS</th>
                  <th className="py-3 px-4">First Visit</th>
                  <th className="py-3 px-4">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#52525b]">
                      No customer records found. Guests are registered on menu check-in.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-amber-50/20">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#2C1710]">
                        <span className="flex items-center gap-1.5">
                          <Phone size={12} className="text-[#CA340A]" />
                          +91 {c.phoneNumber.slice(-10)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-[#52525b]">
                        {c.name || "Guest Diner"}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-[#2C1710]">
                        {c.totalOrders}
                      </td>

                      <td className="py-3.5 px-4 text-right font-heading font-extrabold text-sm text-[#CA340A]">
                        ₹{c.totalSpent}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={11} /> Granted
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {c.marketingConsent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 size={11} /> Opted-in
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">Opt-out</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#52525b] text-[11px]">
                        {new Date(c.firstSeenAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-[#52525b] text-[11px]">
                        {new Date(c.lastSeenAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
