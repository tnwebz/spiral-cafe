"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/Admin/AdminLayout";
import { Settlement } from "@/lib/db";
import {
  FileSpreadsheet,
  Banknote,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  RefreshCw,
  Save,
  DollarSign,
} from "lucide-react";

export default function AdminSettlementsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [summary, setSummary] = useState<any>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  // Settlement Form
  const [cashCounted, setCashCounted] = useState<string>("");
  const [cashSettled, setCashSettled] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchSettlementData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/settlements?date=${selectedDate}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setSettlements(data.settlements || []);
      }
    } catch (e) {
      console.error("Settlement fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchSettlementData();
  }, [fetchSettlementData]);

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    const counted = parseFloat(cashCounted);
    const settled = parseFloat(cashSettled);

    if (isNaN(counted) || isNaN(settled)) {
      setFormMsg({ text: "Please enter valid numeric amounts.", error: true });
      return;
    }

    setSubmitting(true);
    setFormMsg(null);

    try {
      const res = await fetch("/api/admin/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          cashCounted: counted,
          cashSettled: settled,
          notes: notes.trim(),
          settledBy: "Admin Manager",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFormMsg({ text: "Daily settlement recorded successfully and locked into audit log." });
        setCashCounted("");
        setCashSettled("");
        setNotes("");
        fetchSettlementData();
      } else {
        setFormMsg({ text: data.error || "Failed to record settlement.", error: true });
      }
    } catch {
      setFormMsg({ text: "Network error submitting settlement.", error: true });
    } finally {
      setSubmitting(false);
    }
  };

  const expectedCash = summary?.cashSales || 0;
  const countedNum = parseFloat(cashCounted) || 0;
  const cashDifference = countedNum - expectedCash;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CA340A]/10 pb-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2C1710] tracking-tight">
              Revenue &amp; Cash Settlement
            </h1>
            <p className="text-xs sm:text-sm text-[#52525b]">
              Daily register reconciliation, cash drawer balancing, and gateway settlement records
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-zinc-200 font-semibold text-[#2C1710]"
            />
            <button
              onClick={fetchSettlementData}
              className="p-2.5 rounded-xl bg-white border border-zinc-200 text-[#2C1710] hover:bg-[#FFF9F5]"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* 4 Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Collected */}
          <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider block">
              TOTAL COLLECTED ({selectedDate})
            </span>
            <div className="font-heading font-black text-2xl sm:text-3xl text-[#2C1710] mt-1.5">
              ₹{(summary?.totalSales || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-emerald-700 font-bold mt-1">
              {summary?.paidOrdersCount || 0} paid orders
            </p>
          </div>

          {/* Cash Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                CASH REVENUE
              </span>
              <Banknote size={16} className="text-emerald-600" />
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-emerald-800 mt-1.5">
              ₹{(summary?.cashSales || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-[#52525b] mt-1">Physical counter collections</p>
          </div>

          {/* Online Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                ONLINE REVENUE
              </span>
              <CreditCard size={16} className="text-indigo-600" />
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-indigo-800 mt-1.5">
              ₹{(summary?.onlineSales || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-indigo-700 font-semibold mt-1">Razorpay gateway</p>
          </div>

          {/* Pending Collection */}
          <div className="bg-white p-5 rounded-2xl border border-[#CA340A]/15 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#52525b] uppercase tracking-wider">
                PENDING COLLECTION
              </span>
              <Clock size={16} className="text-amber-600" />
            </div>
            <div className="font-heading font-black text-2xl sm:text-3xl text-amber-800 mt-1.5">
              ₹{(summary?.unpaidTotal || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-amber-700 font-semibold mt-1">
              {summary?.unpaidOrdersCount || 0} active dining bills
            </p>
          </div>
        </div>

        {/* Cash Drawer Balancing Form & Historical Settlements */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Cash Reconciliation Form */}
          <div className="bg-white p-6 rounded-3xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Banknote size={18} className="text-[#CA340A]" />
                <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                  Cash Drawer Balancing
                </h3>
              </div>
              <p className="text-xs text-[#52525b] mb-4">
                Verify cash in the physical register against system sales for {selectedDate}.
              </p>

              {formMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold mb-4 flex items-center gap-2 ${
                    formMsg.error
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {formMsg.error ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                  <span>{formMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleRecordSettlement} className="space-y-4">
                {/* Expected Cash Readonly */}
                <div className="p-3 bg-[#FFF9F5] border border-[#CA340A]/15 rounded-xl">
                  <span className="text-[11px] font-bold text-[#52525b] uppercase tracking-wider block">
                    Expected System Cash
                  </span>
                  <div className="font-heading font-black text-xl text-[#2C1710]">
                    ₹{expectedCash.toLocaleString()}
                  </div>
                </div>

                {/* Cash Counted Input */}
                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                    Actual Cash Counted (₹) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={cashCounted}
                    onChange={(e) => setCashCounted(e.target.value)}
                    placeholder="Enter physical cash in drawer"
                    className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] rounded-xl text-sm font-bold text-[#2C1710] focus:outline-none"
                  />
                </div>

                {/* Difference Badge */}
                {cashCounted && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-bold flex justify-between items-center ${
                      cashDifference === 0
                        ? "bg-emerald-100 text-emerald-800"
                        : cashDifference > 0
                        ? "bg-blue-100 text-blue-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    <span>Reconciliation Difference:</span>
                    <span>
                      {cashDifference > 0 ? `+₹${cashDifference}` : `₹${cashDifference}`}
                    </span>
                  </div>
                )}

                {/* Cash Settled / Deposited */}
                <div>
                  <label className="block text-xs font-bold text-[#2C1710] mb-1 uppercase tracking-wider">
                    Cash Settled / Deposited (₹) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={cashSettled}
                    onChange={(e) => setCashSettled(e.target.value)}
                    placeholder="Amount deposited to bank/safe"
                    className="w-full px-3.5 py-2.5 bg-[#FFF9F5] border border-[#CA340A]/20 focus:border-[#CA340A] rounded-xl text-sm font-bold text-[#2C1710] focus:outline-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-[#52525b] mb-1 uppercase tracking-wider">
                    Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. End of shift register audit"
                    className="w-full px-3.5 py-2 bg-[#FFF9F5] border border-zinc-200 rounded-xl text-xs text-[#2C1710] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#CA340A] hover:bg-[#A82806] text-white rounded-xl text-xs font-heading font-extrabold shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save size={15} />
                  <span>{submitting ? "Recording Audit..." : "RECORD & LOCK SETTLEMENT"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Historical Settlements Table */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-[#CA340A]/15 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-extrabold text-base text-[#2C1710] mb-1">
                Settlement History Archive
              </h3>
              <p className="text-xs text-[#52525b] mb-4">
                Audited register reconciliations and drawer closing balances
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FFF9F5] text-[#52525b] font-extrabold uppercase text-[10px] border-b border-zinc-100">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">System Sales</th>
                      <th className="py-2.5 px-3 text-right">Cash Counted</th>
                      <th className="py-2.5 px-3 text-right">Settled</th>
                      <th className="py-2.5 px-3 text-right">Diff</th>
                      <th className="py-2.5 px-3">Auditor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {settlements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#52525b]">
                          No historical settlements recorded yet.
                        </td>
                      </tr>
                    ) : (
                      settlements.map((s) => (
                        <tr key={s.id} className="hover:bg-amber-50/20">
                          <td className="py-3 px-3 font-semibold text-[#2C1710]">{s.date}</td>
                          <td className="py-3 px-3 text-right font-bold">₹{s.totalSales}</td>
                          <td className="py-3 px-3 text-right font-medium">₹{s.cashCounted}</td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-800">
                            ₹{s.cashSettled}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-bold ${
                              s.difference === 0
                                ? "text-emerald-700"
                                : s.difference > 0
                                ? "text-blue-700"
                                : "text-red-700"
                            }`}
                          >
                            {s.difference > 0 ? `+₹${s.difference}` : `₹${s.difference}`}
                          </td>
                          <td className="py-3 px-3 text-zinc-500 font-medium text-[11px]">
                            {s.settledBy}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
