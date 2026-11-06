"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/Admin/AdminLayout";
import CreateTableModal from "@/components/Admin/CreateTableModal";
import PrinterStatusModal from "@/components/Admin/PrinterStatusModal";
import { TableCardStatus } from "@/lib/tables";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";
import { PrinterClient } from "@/services/printerClient";
import {
  Plus,
  RefreshCw,
  Search,
  ArrowUpDown,
  Filter,
  Users,
  Clock,
  Printer,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Utensils,
  Layers,
  ArrowLeftRight,
  ArrowRight,
  Check,
  X,
  Lock,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AdminTablesPage() {
  const router = useRouter();

  const [tables, setTables] = useState<TableCardStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Sorting
  const [activeTab, setActiveTab] = useState<"ALL" | "DINE-IN" | "ROOFTOP">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "RESERVED" | "NEW" | "YELLOW" | "GREEN">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("ASC");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);

  // Table Transfers State
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferAlertMsg, setTransferAlertMsg] = useState<string | null>(null);

  // Printer real-time status hook (raw TCP to CN811-UEWB port 9100)
  const printer = usePrinterStatus(8000);

  // Fetch pending transfers
  const fetchTransfers = useCallback(async () => {
    try {
      const res = await fetch("/api/tables/transfer");
      const data = await res.json();
      if (data.success && Array.isArray(data.pendingRequests)) {
        setPendingTransfers(data.pendingRequests);
      }
    } catch {}
  }, []);

  // Fetch tables overview
  const fetchTables = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch("/api/tables");
      const data = await res.json();
      if (data.success && Array.isArray(data.tables)) {
        setTables(data.tables);
      }
    } catch (err) {
      console.error("Error fetching tables:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleApproveTransfer = async (req: any) => {
    setTransferLoading(true);
    setTransferAlertMsg(null);
    try {
      const res = await fetch("/api/tables/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE",
          requestId: req.id,
          adminUser: "Cashier Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransferAlertMsg(
          `✅ Table transfer approved! Table ${req.fromTable} successfully moved to Table ${req.toTable}.`
        );
        fetchTables(true);
        fetchTransfers();

        // Optional physical table transfer slip print to kitchen
        PrinterClient.printTableTransferNotice({
          visitId: req.visitId,
          fromTable: req.fromTable,
          toTable: req.toTable,
          orderCount: req.ordersCount,
          totalBill: req.currentBill,
          adminUser: "Cashier Staff",
        }).catch(() => {});
      } else {
        alert(data.error || "Failed to approve transfer.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to approve transfer.");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleRejectTransfer = async (requestId: string) => {
    const reason = prompt("Enter reason for rejection (optional):", "Declined by counter staff");
    if (reason === null) return;

    setTransferLoading(true);
    try {
      const res = await fetch("/api/tables/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          requestId,
          reason,
          adminUser: "Cashier Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchTransfers();
      }
    } catch {} finally {
      setTransferLoading(false);
    }
  };

  // Periodic polling & Supabase realtime
  useEffect(() => {
    fetchTables();
    fetchTransfers();

    // Fast polling every 5s for live table & transfer updates
    const pollTimer = setInterval(() => {
      fetchTables(true);
      fetchTransfers();
    }, 5000);

    // Listen to Supabase Realtime for instant order changes
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("admin_tables_live_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchTables(true);
          fetchTransfers();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchTables, fetchTransfers]);

  // Next suggested table number for Create Table dialog
  const suggestedNextTable = useMemo(() => {
    const aNums = tables
      .map((t) => t.tableNumber)
      .filter((n) => n.startsWith("A"))
      .map((n) => parseInt(n.replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n));
    const maxA = aNums.length > 0 ? Math.max(...aNums) : 15;
    return `A${maxA + 1}`;
  }, [tables]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: tables.length,
      available: tables.filter((t) => t.color === "WHITE").length,
      reserved: tables.filter((t) => t.color === "BLUE").length,
      newOrders: tables.filter((t) => t.color === "RED").length,
      actionNeeded: tables.filter((t) => t.color === "YELLOW").length,
      kotSent: tables.filter((t) => t.color === "GREEN").length,
    };
  }, [tables]);

  // Filter & Sort logic
  const filteredTables = useMemo(() => {
    return tables
      .filter((t) => {
        // Section tab
        if (activeTab === "DINE-IN" && t.section !== "Dine-In") return false;
        if (activeTab === "ROOFTOP" && t.section !== "Rooftop") return false;

        // Status filter
        if (statusFilter === "AVAILABLE" && t.color !== "WHITE") return false;
        if (statusFilter === "RESERVED" && t.color !== "BLUE") return false;
        if (statusFilter === "NEW" && t.color !== "RED") return false;
        if (statusFilter === "YELLOW" && t.color !== "YELLOW") return false;
        if (statusFilter === "GREEN" && t.color !== "GREEN") return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            t.tableNumber.toLowerCase().includes(q) ||
            (t.orderNumber && t.orderNumber.toLowerCase().includes(q))
          );
        }

        return true;
      })
      .sort((a, b) => {
        // Custom alphanumeric sorting for A1, A2, B1, B2...
        const cmp = a.tableNumber.localeCompare(b.tableNumber, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortOrder === "ASC" ? cmp : -cmp;
      });
  }, [tables, activeTab, statusFilter, searchQuery, sortOrder]);

  return (
    <AdminLayout>
      {/* Warm Beige Editorial Background (#F5F0E8) */}
      <div className="min-h-screen bg-[#F5F0E8] text-[#2C1710] p-4 sm:p-6 lg:p-8 space-y-6">
        {/* TOP COMMAND BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#2C1710] tracking-tight">
                Table Management
              </h1>
              {stats.newOrders > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {stats.newOrders} New Order{stats.newOrders > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-[#52525b] mt-0.5">
              Live floor overview, KOT dispatch, and instant payment settlement
            </p>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Kitchen Printer Connectivity Pill */}
            <button
              onClick={() => setPrinterModalOpen(true)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                printer.status === "CONNECTED"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  : printer.status === "WARNING"
                  ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
              }`}
              title="Click to check or configure kitchen printer"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  printer.status === "CONNECTED"
                    ? "bg-emerald-500 animate-pulse"
                    : printer.status === "WARNING"
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
              />
              <Printer size={15} />
              <span>
                {printer.status === "CONNECTED"
                  ? "Kitchen Printer Ready"
                  : printer.status === "WARNING"
                  ? "Printer Warning"
                  : "Printer Disconnected"}
              </span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchTables()}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-white border border-black/10 text-[#2C1710] hover:bg-zinc-50 transition-colors shadow-xs"
              title="Refresh Floor Tables"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin text-[#CA340A]" : ""} />
            </button>

            {/* Private Order Button */}
            <Link
              href="/admin/private-order"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#3A1710] text-[#FFF9F5] text-xs font-bold hover:bg-[#2A100A] shadow-md shadow-[#3A1710]/20 transition-all cursor-pointer"
              title="Place internal or staff order (GIVE ON COUNTER)"
            >
              <Lock size={15} className="text-[#E2C7BA]" />
              <span>Private Order</span>
            </Link>

            {/* + Create Table Button */}
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#B73F1D] shadow-md shadow-[#CA340A]/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Create Table</span>
            </button>
          </div>
        </div>

        {/* Transfer Alert Toast / Notice */}
        {transferAlertMsg && (
          <div className="p-3.5 bg-emerald-100/90 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
              <span>{transferAlertMsg}</span>
            </div>
            <button
              onClick={() => setTransferAlertMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* PENDING TABLE TRANSFER REQUESTS BANNER */}
        {pendingTransfers.length > 0 && (
          <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                  <ArrowLeftRight size={18} />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm sm:text-base text-amber-950">
                    Table Transfer Requests ({pendingTransfers.length})
                  </h3>
                  <p className="text-xs text-amber-800">
                    Customer requested to transfer their dining session to an available table.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingTransfers.map((req) => (
                <div
                  key={req.id}
                  className="bg-white p-4 rounded-2xl border border-amber-200/90 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-red-100 text-red-800 font-heading font-extrabold text-sm border border-red-200">
                        Table {req.fromTable}
                      </span>
                      <ArrowRight size={16} className="text-amber-600" />
                      <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-heading font-extrabold text-sm border border-emerald-200">
                        Table {req.toTable}
                      </span>
                    </div>

                    <span className="text-xs font-heading font-extrabold text-[#B73F1D]">
                      ₹{req.currentBill} ({req.ordersCount} orders)
                    </span>
                  </div>

                  <div className="text-[11px] text-[#52525b] flex items-center justify-between">
                    <span>
                      Customer: <strong>{req.customerPhone || "Mobile Guest"}</strong>
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Requested {new Date(req.requestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-100">
                    <button
                      disabled={transferLoading}
                      onClick={() => handleApproveTransfer(req)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-heading font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Check size={14} />
                      <span>Approve Move</span>
                    </button>
                    <button
                      disabled={transferLoading}
                      onClick={() => handleRejectTransfer(req.id)}
                      className="px-3 py-2 bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-700 text-xs font-heading font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* METRICS SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <button
            onClick={() => setStatusFilter(statusFilter === "AVAILABLE" ? "ALL" : "AVAILABLE")}
            className={`p-4 rounded-3xl bg-white border text-left transition-all shadow-[0_8px_25px_rgba(0,0,0,0.02)] ${
              statusFilter === "AVAILABLE" ? "border-zinc-800 ring-2 ring-zinc-400" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#52525b] uppercase tracking-wider">
                Available
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
            </div>
            <p className="text-2xl font-heading font-extrabold text-[#2C1710] mt-1.5">
              {stats.available}
            </p>
            <span className="text-[10px] text-[#52525b]">Tables ready for guests</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "RESERVED" ? "ALL" : "RESERVED")}
            className={`p-4 rounded-3xl bg-white border text-left transition-all shadow-[0_8px_25px_rgba(0,0,0,0.02)] ${
              statusFilter === "RESERVED" ? "border-blue-600 ring-2 ring-blue-400" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                Reserved
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <p className="text-2xl font-heading font-extrabold text-blue-700 mt-1.5">
              {stats.reserved}
            </p>
            <span className="text-[10px] text-blue-600 font-semibold">10m temporary lock</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "NEW" ? "ALL" : "NEW")}
            className={`p-4 rounded-3xl bg-white border text-left transition-all shadow-[0_8px_25px_rgba(0,0,0,0.02)] ${
              statusFilter === "NEW" ? "border-red-600 ring-2 ring-red-400" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                New Orders
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            </div>
            <p className="text-2xl font-heading font-extrabold text-red-600 mt-1.5">
              {stats.newOrders}
            </p>
            <span className="text-[10px] text-red-500 font-semibold">Requires KOT dispatch</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "YELLOW" ? "ALL" : "YELLOW")}
            className={`p-4 rounded-3xl bg-white border text-left transition-all shadow-[0_8px_25px_rgba(0,0,0,0.02)] ${
              statusFilter === "YELLOW" ? "border-amber-500 ring-2 ring-amber-300" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Action Needed
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            </div>
            <p className="text-2xl font-heading font-extrabold text-amber-700 mt-1.5">
              {stats.actionNeeded}
            </p>
            <span className="text-[10px] text-amber-600">Viewed / Manual KOT</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "GREEN" ? "ALL" : "GREEN")}
            className={`p-4 rounded-3xl bg-white border text-left transition-all shadow-[0_8px_25px_rgba(0,0,0,0.02)] ${
              statusFilter === "GREEN" ? "border-emerald-600 ring-2 ring-emerald-300" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                KOT Confirmed
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-2xl font-heading font-extrabold text-emerald-700 mt-1.5">
              {stats.kotSent}
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold">Dining / Awaiting pay</span>
          </button>
        </div>

        {/* FILTER BAR & SEARCH (Replicating Image 2 Reference) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/70 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-black/5">
          {/* Section Tabs (ALL / DINE-IN / ROOFTOP) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                activeTab === "ALL"
                  ? "bg-[#3A1710] text-[#FFF9F5] shadow-xs"
                  : "bg-white text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setActiveTab("DINE-IN")}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                activeTab === "DINE-IN"
                  ? "bg-[#3A1710] text-[#FFF9F5] shadow-xs"
                  : "bg-white text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              DINE-IN
            </button>
            <button
              onClick={() => setActiveTab("ROOFTOP")}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                activeTab === "ROOFTOP"
                  ? "bg-[#3A1710] text-[#FFF9F5] shadow-xs"
                  : "bg-white text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              ROOFTOP
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search table or order..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-black/10 rounded-2xl text-xs font-semibold text-[#2C1710] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
              />
            </div>

            <button
              onClick={() => setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-black/10 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0"
              title="Sort Tables"
            >
              <ArrowUpDown size={14} />
              <span>{sortOrder === "ASC" ? "Ascending" : "Descending"}</span>
            </button>
          </div>
        </div>

        {/* FLOATING TABLE CARDS GRID (Replicating Image 2 Reference) */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-3 border-[#CA340A] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold text-zinc-600">Loading restaurant floor tables...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="py-20 bg-white/60 rounded-3xl border border-dashed border-zinc-300 text-center p-8 space-y-3">
            <Utensils size={36} className="mx-auto text-zinc-400" />
            <h3 className="text-base font-bold text-zinc-800">No tables found</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              No tables match your selected filter criteria. Click below to add a new table.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 bg-[#CA340A] text-white text-xs font-bold rounded-2xl hover:bg-[#B73F1D] shadow-sm transition-all"
            >
              + Create Table
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {filteredTables.map((t) => {
              const isWhite = t.color === "WHITE";
              const isBlue = t.color === "BLUE";
              const isRed = t.color === "RED";
              const isYellow = t.color === "YELLOW";
              const isGreen = t.color === "GREEN";

              return (
                <div
                  key={t.tableNumber}
                  onClick={() => router.push(`/admin/tables/${t.tableNumber}`)}
                  className={`group relative rounded-3xl p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[170px] ${
                    isWhite
                      ? "bg-white border border-black/5 shadow-[0_12px_32px_rgba(44,23,16,0.04)] hover:shadow-[0_20px_45px_rgba(44,23,16,0.08)] hover:-translate-y-1"
                      : isBlue
                      ? "bg-[#EFF6FF] border-2 border-blue-400 shadow-[0_12px_32px_rgba(59,130,246,0.14)] hover:shadow-[0_20px_45px_rgba(59,130,246,0.22)] hover:-translate-y-1"
                      : isRed
                      ? "bg-[#FEF2F2] border-2 border-red-300 shadow-[0_12px_32px_rgba(239,68,68,0.12)] hover:shadow-[0_20px_45px_rgba(239,68,68,0.20)] hover:-translate-y-1"
                      : isYellow
                      ? "bg-[#FFFBEB] border-2 border-amber-300 shadow-[0_12px_32px_rgba(245,158,11,0.12)] hover:shadow-[0_20px_45px_rgba(245,158,11,0.20)] hover:-translate-y-1"
                      : "bg-[#F0FDF4] border-2 border-emerald-300 shadow-[0_12px_32px_rgba(34,197,94,0.12)] hover:shadow-[0_20px_45px_rgba(34,197,94,0.20)] hover:-translate-y-1"
                  }`}
                >
                  {/* Top Status Row */}
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-extrabold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                        isWhite
                          ? "bg-zinc-100 text-zinc-600 border border-zinc-200"
                          : isBlue
                          ? "bg-blue-600 text-white shadow-xs"
                          : isRed
                          ? "bg-red-500 text-white shadow-xs"
                          : isYellow
                          ? "bg-amber-400 text-amber-950 font-bold shadow-xs"
                          : "bg-emerald-600 text-white shadow-xs"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isWhite
                            ? "bg-zinc-400"
                            : isBlue
                            ? "bg-white animate-pulse"
                            : isRed
                            ? "bg-white animate-ping"
                            : isYellow
                            ? "bg-amber-900"
                            : "bg-white"
                        }`}
                      />
                      {t.statusLabel}
                    </span>

                    {isBlue && t.reservation?.remainingSeconds !== undefined ? (
                      <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1 bg-blue-100 px-2 py-0.5 rounded-full">
                        <Clock size={11} />
                        {Math.floor(t.reservation.remainingSeconds / 60)}m {t.reservation.remainingSeconds % 60}s left
                      </span>
                    ) : t.elapsedMinutes !== undefined && !isWhite ? (
                      <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
                        <Clock size={12} />
                        {t.elapsedMinutes}m ago
                      </span>
                    ) : null}
                  </div>

                  {/* Center Table Number & Capacity */}
                  <div className="my-3 text-center">
                    <h2
                      className={`font-heading font-extrabold text-3xl sm:text-4xl tracking-tight transition-transform group-hover:scale-105 ${
                        isWhite
                          ? "text-[#2C1710]"
                          : isBlue
                          ? "text-blue-900"
                          : isRed
                          ? "text-red-700"
                          : isYellow
                          ? "text-amber-800"
                          : "text-emerald-800"
                      }`}
                    >
                      {t.tableNumber}
                    </h2>
                    <p className="text-xs font-semibold text-[#52525b] mt-1 flex items-center justify-center gap-1.5">
                      <Users size={13} className="text-zinc-400" />
                      Capacity: {t.capacity}
                      {isBlue
                        ? t.reservation?.customerPhone
                          ? ` • Guest: +91 ******${t.reservation.customerPhone.slice(-4)}`
                          : " • Table Selected"
                        : t.itemsCount
                        ? ` • ${t.itemsCount} Items`
                        : ""}
                    </p>
                  </div>

                  {/* Bottom Order Total Row */}
                  <div
                    className={`pt-2.5 border-t flex items-center justify-between text-xs ${
                      isWhite
                        ? "border-zinc-100 text-zinc-600"
                        : isBlue
                        ? "border-blue-200 text-blue-900 font-semibold"
                        : isRed
                        ? "border-red-200 text-red-900"
                        : isYellow
                        ? "border-amber-200 text-amber-900"
                        : "border-emerald-200 text-emerald-900"
                    }`}
                  >
                    <span className="font-bold">
                      {isBlue ? (
                        <span className="text-blue-700 font-bold">10m Temp Reservation</span>
                      ) : (
                        <>
                          Order Total:{" "}
                          <span className="font-extrabold text-sm">
                            {t.totalAmount ? `₹${t.totalAmount}` : "--"}
                          </span>
                        </>
                      )}
                    </span>

                    <ChevronRight
                      size={16}
                      className="text-zinc-400 group-hover:translate-x-1 transition-transform"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateTableModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => fetchTables()}
        suggestedNumber={suggestedNextTable}
      />

      <PrinterStatusModal
        isOpen={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        connectionState={printer}
        onRefreshStatus={() => {
          printer.refresh();
        }}
      />
    </AdminLayout>
  );
}

