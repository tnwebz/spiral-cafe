"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/Admin/AdminLayout";
import CreateTableModal from "@/components/Admin/CreateTableModal";
import PrinterStatusModal from "@/components/Admin/PrinterStatusModal";
import AdminOrderModal from "@/components/Admin/AdminOrderModal";
import TakeawayDetailModal from "@/components/Admin/TakeawayDetailModal";
import PrivateOrderDetailModal from "@/components/Admin/PrivateOrderDetailModal";
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
  Receipt,
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
  ShoppingBag,
  UtensilsCrossed,
  ShieldAlert,
  MapPin,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AdminTablesPage() {
  const router = useRouter();

  const [tables, setTables] = useState<TableCardStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Sorting
  const [activeTab, setActiveTab] = useState<"ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "RESERVED" | "NEW" | "YELLOW" | "GREEN">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("ASC");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [takeawayModalOpen, setTakeawayModalOpen] = useState(false);
  const [manualOrderModalTable, setManualOrderModalTable] = useState<string | null>(null);
  const [availablePromptTable, setAvailablePromptTable] = useState<TableCardStatus | null>(null);
  const [activeTakeaways, setActiveTakeaways] = useState<any[]>([]);
  const [selectedTakeawayOrder, setSelectedTakeawayOrder] = useState<any | null>(null);

  // Active Private Orders State
  const [activePrivateOrders, setActivePrivateOrders] = useState<any[]>([]);
  const [selectedPrivateOrder, setSelectedPrivateOrder] = useState<any | null>(null);

  // Drag and drop / Merge takeaway into table
  const [draggedTakeaway, setDraggedTakeaway] = useState<any | null>(null);
  const [dragOverTable, setDragOverTable] = useState<string | null>(null);
  const [confirmMergeModal, setConfirmMergeModal] = useState<{
    takeawayOrder: any;
    targetTable: TableCardStatus;
  } | null>(null);
  const [pickerTakeawayOrder, setPickerTakeawayOrder] = useState<any | null>(null);
  const [isMergingTakeaway, setIsMergingTakeaway] = useState(false);

  // Table Transfers State
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferAlertMsg, setTransferAlertMsg] = useState<string | null>(null);

  // Printer real-time status hook (raw TCP to CN811-UEWB port 9100)
  const printer = usePrinterStatus(8000);

  // Fetch active takeaways
  const fetchTakeaways = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/takeaway");
      const d = await res.json();
      if (d.success && Array.isArray(d.orders)) {
        setActiveTakeaways(d.orders);
      }
    } catch {}
  }, []);

  // Fetch active private orders (3-color cycle: New Red -> Missed Yellow -> Sent Green -> Paid Vanish)
  const fetchPrivateOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/private-orders?limit=50");
      const d = await res.json();
      if (d.success && Array.isArray(d.orders)) {
        const active = d.orders.filter(
          (o: any) => o.status !== "COMPLETED" && o.status !== "CANCELLED"
        );
        setActivePrivateOrders(active);
      }
    } catch {}
  }, []);

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

  // Merge Takeaway Order into Floor Table
  const handleExecuteMergeTakeaway = async (takeawayOrderId: string, targetTableNumber: string) => {
    setIsMergingTakeaway(true);
    try {
      const res = await fetch("/api/admin/tables/merge-takeaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          takeawayOrderId,
          targetTable: targetTableNumber,
          adminUser: "Cashier Counter",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransferAlertMsg(data.message || `Takeaway order successfully merged into Table ${targetTableNumber}!`);
        setConfirmMergeModal(null);
        setPickerTakeawayOrder(null);
        setDraggedTakeaway(null);
        fetchTables(true);
        fetchTakeaways();
      } else {
        alert(data.error || "Failed to merge takeaway order into table.");
      }
    } catch (e: any) {
      alert(e.message || "Network error while merging takeaway order.");
    } finally {
      setIsMergingTakeaway(false);
    }
  };

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
        setTransferAlertMsg(`⚠️ ${data.error || "Failed to approve transfer."}`);
      }
    } catch (err: any) {
      setTransferAlertMsg(`⚠️ ${err.message || "Failed to approve transfer."}`);
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
    fetchTakeaways();
    fetchPrivateOrders();

    // Fast polling every 5s for live table, transfer, takeaway, and private order updates
    const pollTimer = setInterval(() => {
      fetchTables(true);
      fetchTransfers();
      fetchTakeaways();
      fetchPrivateOrders();
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
          fetchTakeaways();
          fetchPrivateOrders();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchTables, fetchTransfers, fetchTakeaways, fetchPrivateOrders]);

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
      {/* Warm Beige Editorial Background (#F5F0E8) - Compact All-in-One Floor View */}
      <div className="min-h-screen bg-[#F5F0E8] text-[#2C1710] p-3 sm:p-4 lg:p-5 space-y-3 sm:space-y-3.5">
        {/* TOP COMMAND BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/80 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-black/5 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-lg sm:text-xl text-[#2C1710] tracking-tight">
                Table Management
              </h1>
              {stats.newOrders > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {stats.newOrders} New Order{stats.newOrders > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#52525b] mt-0.5">
              Live floor overview, KOT dispatch, and instant payment settlement
            </p>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Kitchen Printer Connectivity Pill */}
            <button
              onClick={() => setPrinterModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                printer.connectorOnline && printer.kitchen.printerReachable
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
              }`}
              title="Kitchen 80mm ESC/POS TCP Printer Status"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  printer.connectorOnline && printer.kitchen.printerReachable
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <Printer size={13} />
              <span>
                {printer.connectorOnline && printer.kitchen.printerReachable
                  ? "Kitchen Ready"
                  : "Kitchen Offline"}
              </span>
            </button>

            {/* Counter KOT / Bill Printer Connectivity Pill */}
            <button
              onClick={() => setPrinterModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                printer.connectorOnline && printer.counter.ready
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  : "bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200"
              }`}
              title="Counter KOT & Bill 58mm USB Printer Status"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  printer.connectorOnline && printer.counter.ready
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-zinc-400"
                }`}
              />
              <Receipt size={13} />
              <span>
                {printer.connectorOnline && printer.counter.ready
                  ? "Counter KOT Ready"
                  : "Counter KOT Offline"}
              </span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchTables()}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white border border-black/10 text-[#2C1710] hover:bg-zinc-50 transition-colors shadow-2xs"
              title="Refresh Floor Tables"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin text-[#CA340A]" : ""} />
            </button>

            {/* Private Order Button */}
            <Link
              href="/admin-sp-access/private-order"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3A1710] text-[#FFF9F5] text-xs font-bold hover:bg-[#2A100A] shadow-xs transition-all cursor-pointer"
              title="Place internal or staff order (GIVE ON COUNTER)"
            >
              <Lock size={14} className="text-[#E2C7BA]" />
              <span>Private Order</span>
            </Link>

            {/* Take Away Action Button */}
            <button
              onClick={() => setTakeawayModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Create new customer Take Away order with (parcel) tags"
            >
              <ShoppingBag size={14} />
              <span>Take Away</span>
            </button>

            {/* + Create Table Button */}
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#B73F1D] shadow-xs transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Create Table</span>
            </button>
          </div>
        </div>

        {/* ACTIVE PRIVATE ORDERS (Counter & Staff/Owner Orders) */}
        {activePrivateOrders.length > 0 && (
          <div className="bg-white/80 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-purple-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-900 flex items-center justify-center font-bold">
                  <ShieldAlert size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-extrabold text-xs sm:text-sm text-[#2C1710]">
                      Active Private Orders
                    </h3>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300">
                      {activePrivateOrders.length} Active
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8C5E51]">
                    On-counter &amp; internal orders: 🔴 Placed (Red) &rarr; 🟡 Missed KOT (Yellow) &rarr; 🟢 KOT Sent (Green) &rarr; Paid/Finished (Vanish)
                  </p>
                </div>
              </div>
              <Link
                href="/admin-sp-access/private-order"
                className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} />
                <span>+ New Private Order</span>
              </Link>
            </div>

            {/* Horizontal Cards Scroll */}
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
              {activePrivateOrders.map((ord) => {
                const notes = ord.notes || "";
                const hasKotConfirmed =
                  notes.includes("[KOT_CONFIRMED") ||
                  notes.includes("[KOT_MANUALLY_DELIVERED]") ||
                  ord.status === "PREPARING" ||
                  ord.status === "READY" ||
                  ord.status === "SERVED";
                const hasViewedExited =
                  notes.includes("[KOT_VIEWED_EXITED]") ||
                  notes.includes("[KOT_EXITED_WITHOUT_KOT]") ||
                  notes.includes("[KOT_FAILED]") ||
                  notes.includes("[KOT_UNKNOWN]");

                let color: "RED" | "YELLOW" | "GREEN" = "RED";
                let statusLabel = "NEW ORDER";

                if (hasKotConfirmed) {
                  color = "GREEN";
                  statusLabel = "KOT SENT";
                } else if (hasViewedExited) {
                  color = "YELLOW";
                  statusLabel = "ACTION NEEDED";
                } else {
                  color = "RED";
                  statusLabel = "NEW ORDER";
                }

                const itemsCount = ord.items?.length || 0;
                const elapsedMins = Math.max(
                  0,
                  Math.floor((Date.now() - new Date(ord.createdAt).getTime()) / 60000)
                );
                const dest =
                  ord.tableNumber === "COUNTER" ||
                  ord.tableNumber === "GIVE ON COUNTER" ||
                  !ord.tableNumber
                    ? "COUNTER"
                    : `TABLE ${ord.tableNumber.toUpperCase()}`;

                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedPrivateOrder(ord)}
                    className={`min-w-[260px] max-w-[290px] p-3.5 border-2 rounded-2xl shadow-xs transition-all cursor-pointer hover:scale-101 shrink-0 flex flex-col justify-between select-none ${
                      color === "RED"
                        ? "bg-[#FEF2F2] border-rose-400 hover:border-rose-500 hover:shadow-md"
                        : color === "YELLOW"
                        ? "bg-[#FFFBEB] border-amber-400 hover:border-amber-500 hover:shadow-md"
                        : "bg-[#F0FDF4] border-emerald-400 hover:border-emerald-500 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-heading font-extrabold text-xs ${
                            color === "RED"
                              ? "text-rose-700"
                              : color === "YELLOW"
                              ? "text-amber-800"
                              : "text-emerald-800"
                          }`}
                        >
                          #{ord.orderNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
                          {ord.privatePurpose || "STAFF"}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                          color === "RED"
                            ? "bg-rose-500 text-white animate-pulse"
                            : color === "YELLOW"
                            ? "bg-amber-400 text-amber-950 font-bold"
                            : "bg-emerald-600 text-white font-bold"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            color === "RED"
                              ? "bg-white animate-ping"
                              : color === "YELLOW"
                              ? "bg-amber-950"
                              : "bg-white"
                          }`}
                        />
                        {statusLabel}
                      </span>
                    </div>

                    <div className="space-y-1 mb-2.5">
                      <div className="text-xs font-bold text-zinc-900 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-purple-900 font-extrabold">
                          <MapPin size={11} /> {dest}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {elapsedMins}m ago
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 line-clamp-1">
                        {ord.items && ord.items.length > 0
                          ? ord.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")
                          : `${itemsCount} item(s)`}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between gap-1.5">
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase tracking-wider block">Total Bill</span>
                        <span className="font-heading font-black text-sm text-[#CA340A] font-mono">
                          ₹{ord.grandTotal}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {color !== "GREEN" && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const res = await PrinterClient.dispatchPrivateKotPrint(ord.id);
                              if (res.success) {
                                fetchPrivateOrders();
                              } else {
                                alert(res.message);
                              }
                            }}
                            className="px-2 py-1 rounded-xl text-[10px] font-bold bg-[#CA340A] hover:bg-[#A82806] text-white shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            title="Print KOT to Kitchen immediately"
                          >
                            <Printer size={11} />
                            <span>KOT</span>
                          </button>
                        )}
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white/90 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-2xs">
                          Settle &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ACTIVE TAKE AWAY ORDERS BAR */}
        {activeTakeaways.length > 0 && (
          <div className="bg-white/80 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-[#EBDAD0] shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <ShoppingBag size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-extrabold text-xs sm:text-sm text-[#2C1710]">
                      Active Take Away Orders
                    </h3>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                      {activeTakeaways.length} Active
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8C5E51]">
                    Drag and drop any takeaway onto a table card, or tap &ldquo;Merge to Table&rdquo; to combine bills
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTakeawayModalOpen(true)}
                className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} />
                <span>New Take Away</span>
              </button>
            </div>

            {/* Horizontal Cards Scroll */}
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
              {activeTakeaways.map((ord) => {
                const notes = ord.notes || "";
                const hasKotConfirmed =
                  notes.includes("[KOT_CONFIRMED") ||
                  notes.includes("[KOT_MANUALLY_DELIVERED]") ||
                  ord.status === "PREPARING" ||
                  ord.status === "READY";
                const hasViewedExited =
                  notes.includes("[KOT_VIEWED_EXITED]") ||
                  notes.includes("[KOT_EXITED_WITHOUT_KOT]") ||
                  notes.includes("[KOT_FAILED]") ||
                  notes.includes("[KOT_UNKNOWN]");

                let takeawayColor: "RED" | "YELLOW" | "GREEN" = "RED";
                let takeawayStatusLabel = "NEW ORDER";

                if (hasKotConfirmed) {
                  takeawayColor = "GREEN";
                  takeawayStatusLabel = "KOT SENT";
                } else if (hasViewedExited) {
                  takeawayColor = "YELLOW";
                  takeawayStatusLabel = "ACTION NEEDED";
                } else {
                  takeawayColor = "RED";
                  takeawayStatusLabel = "NEW ORDER";
                }

                const itemsCount = ord.items?.length || 0;
                const elapsedMins = Math.max(0, Math.floor((Date.now() - new Date(ord.createdAt).getTime()) / 60000));
                const customerMatch = ord.notes?.match(/\[CUSTOMER_NAME:([^\]]+)\]/);
                const custName = customerMatch ? customerMatch[1].trim() : (ord.customerPhone ? `+91 ${ord.customerPhone}` : "Walk-in Guest");
                const isBeingDragged = draggedTakeaway?.id === ord.id;

                return (
                  <div
                    key={ord.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", ord.id);
                      setDraggedTakeaway(ord);
                    }}
                    onDragEnd={() => setDraggedTakeaway(null)}
                    onClick={() => setSelectedTakeawayOrder(ord)}
                    className={`min-w-[260px] max-w-[290px] p-3.5 border-2 rounded-2xl shadow-xs transition-all cursor-grab active:cursor-grabbing shrink-0 flex flex-col justify-between select-none ${
                      isBeingDragged
                        ? "border-amber-600 ring-2 ring-amber-400 opacity-60 scale-98"
                        : takeawayColor === "RED"
                        ? "bg-[#FEF2F2] border-red-400 hover:border-red-500 hover:shadow-md"
                        : takeawayColor === "YELLOW"
                        ? "bg-[#FFFBEB] border-amber-400 hover:border-amber-500 hover:shadow-md"
                        : "bg-[#F0FDF4] border-emerald-400 hover:border-emerald-500 hover:shadow-md"
                    }`}
                    title="Drag this card onto any floor table card to merge orders"
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 font-normal">⠿</span>
                        <span
                          className={`font-heading font-extrabold text-xs ${
                            takeawayColor === "RED"
                              ? "text-red-700"
                              : takeawayColor === "YELLOW"
                              ? "text-amber-800"
                              : "text-emerald-800"
                          }`}
                        >
                          #{ord.orderNumber}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 shadow-2xs ${
                          takeawayColor === "RED"
                            ? "bg-red-500 text-white animate-pulse"
                            : takeawayColor === "YELLOW"
                            ? "bg-amber-400 text-amber-950 font-bold"
                            : "bg-emerald-600 text-white"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            takeawayColor === "RED"
                              ? "bg-white animate-ping"
                              : takeawayColor === "YELLOW"
                              ? "bg-amber-900"
                              : "bg-white"
                          }`}
                        />
                        {takeawayStatusLabel}
                      </span>
                    </div>

                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-zinc-800 truncate">{custName}</div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                        <span>{itemsCount} item{itemsCount > 1 ? "s" : ""}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><Clock size={11} /> {elapsedMins}m ago</span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 font-medium block">Total Bill</span>
                        <span
                          className={`font-heading font-extrabold text-sm ${
                            takeawayColor === "RED"
                              ? "text-red-700"
                              : takeawayColor === "YELLOW"
                              ? "text-amber-800"
                              : "text-emerald-800"
                          }`}
                        >
                          ₹{ord.grandTotal}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPickerTakeawayOrder(ord);
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                          title="Merge into a table"
                        >
                          <ArrowRight size={11} />
                          <span>Merge to Table</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <button
            onClick={() => setStatusFilter(statusFilter === "AVAILABLE" ? "ALL" : "AVAILABLE")}
            className={`p-2.5 sm:p-3 rounded-2xl bg-white border text-left transition-all shadow-[0_4px_16px_rgba(0,0,0,0.02)] ${
              statusFilter === "AVAILABLE" ? "border-zinc-800 ring-2 ring-zinc-400" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider">
                Available
              </span>
              <span className="w-2 h-2 rounded-full bg-zinc-300" />
            </div>
            <p className="text-xl sm:text-2xl font-heading font-extrabold text-[#2C1710] mt-0.5">
              {stats.available}
            </p>
            <span className="text-[9px] text-[#52525b]">Tables ready for guests</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "RESERVED" ? "ALL" : "RESERVED")}
            className={`p-2.5 sm:p-3 rounded-2xl bg-white border text-left transition-all shadow-[0_4px_16px_rgba(0,0,0,0.02)] ${
              statusFilter === "RESERVED" ? "border-blue-600 ring-2 ring-blue-400" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                Reserved
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
            <p className="text-xl sm:text-2xl font-heading font-extrabold text-blue-700 mt-0.5">
              {stats.reserved}
            </p>
            <span className="text-[9px] text-blue-600 font-semibold">10m temporary lock</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "NEW" ? "ALL" : "NEW")}
            className={`p-2.5 sm:p-3 rounded-2xl bg-white border text-left transition-all shadow-[0_4px_16px_rgba(0,0,0,0.02)] ${
              statusFilter === "NEW" ? "border-red-600 ring-2 ring-red-400" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                New Orders
              </span>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            </div>
            <p className="text-xl sm:text-2xl font-heading font-extrabold text-red-600 mt-0.5">
              {stats.newOrders}
            </p>
            <span className="text-[9px] text-red-500 font-semibold">Requires KOT dispatch</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "YELLOW" ? "ALL" : "YELLOW")}
            className={`p-2.5 sm:p-3 rounded-2xl bg-white border text-left transition-all shadow-[0_4px_16px_rgba(0,0,0,0.02)] ${
              statusFilter === "YELLOW" ? "border-amber-500 ring-2 ring-amber-300" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                Action Needed
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <p className="text-xl sm:text-2xl font-heading font-extrabold text-amber-700 mt-0.5">
              {stats.actionNeeded}
            </p>
            <span className="text-[9px] text-amber-600">Viewed / Manual KOT</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "GREEN" ? "ALL" : "GREEN")}
            className={`p-2.5 sm:p-3 rounded-2xl bg-white border text-left transition-all shadow-[0_4px_16px_rgba(0,0,0,0.02)] ${
              statusFilter === "GREEN" ? "border-emerald-600 ring-2 ring-emerald-300" : "border-black/5 hover:border-black/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                KOT Confirmed
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-xl sm:text-2xl font-heading font-extrabold text-emerald-700 mt-0.5">
              {stats.kotSent}
            </p>
            <span className="text-[9px] text-emerald-600 font-semibold">Dining / Awaiting pay</span>
          </button>
        </div>

        {/* FILTER BAR & SEARCH */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white/70 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl border border-black/5">
          {/* Section Tabs (ALL only) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("ALL")}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-[#3A1710] text-[#FFF9F5] shadow-xs cursor-default"
            >
              ALL
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search table or order..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-black/10 rounded-xl text-xs font-semibold text-[#2C1710] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#CA340A]"
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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-6 gap-2 sm:gap-2.5">
            {filteredTables.map((t) => {
              const isWhite = t.color === "WHITE";
              const isBlue = t.color === "BLUE";
              const isRed = t.color === "RED";
              const isYellow = t.color === "YELLOW";
              const isGreen = t.color === "GREEN";
              const isDragTarget = dragOverTable === t.tableNumber;

              return (
                <div
                  key={t.tableNumber}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverTable !== t.tableNumber) setDragOverTable(t.tableNumber);
                  }}
                  onDragLeave={() => {
                    if (dragOverTable === t.tableNumber) setDragOverTable(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverTable(null);
                    if (draggedTakeaway) {
                      setConfirmMergeModal({ takeawayOrder: draggedTakeaway, targetTable: t });
                    }
                  }}
                  onClick={() => {
                    if (isWhite) {
                      setAvailablePromptTable(t);
                    } else {
                      router.push(`/admin-sp-access/tables/${t.tableNumber}`);
                    }
                  }}
                  className={`group relative rounded-xl p-2.5 sm:p-3 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[110px] sm:min-h-[118px] ${
                    isDragTarget
                      ? "ring-4 ring-amber-500 scale-102 bg-amber-50 border-2 border-amber-600 shadow-xl z-20"
                      : isWhite
                      ? "bg-white border border-black/5 shadow-2xs hover:shadow-md hover:-translate-y-0.5"
                      : isBlue
                      ? "bg-[#EFF6FF] border-2 border-blue-400 shadow-2xs hover:shadow-md hover:-translate-y-0.5"
                      : isRed
                      ? "bg-[#FEF2F2] border-2 border-red-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5"
                      : isYellow
                      ? "bg-[#FFFBEB] border-2 border-amber-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5"
                      : "bg-[#F0FDF4] border-2 border-emerald-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  {/* Drop Overlay when Dragging Takeaway Over Table */}
                  {isDragTarget && (
                    <div className="absolute inset-0 bg-amber-600/95 rounded-xl flex flex-col items-center justify-center text-white z-30 p-2 text-center animate-in fade-in duration-100 shadow-lg">
                      <ArrowRight size={20} className="rotate-90 animate-bounce mb-1 text-white" />
                      <span className="text-xs font-heading font-black">
                        Drop to Merge #{draggedTakeaway?.orderNumber}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-100">
                        into Table {t.tableNumber}
                      </span>
                    </div>
                  )}

                  {/* Top Status Row */}
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-extrabold text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                        isWhite
                          ? "bg-zinc-100 text-zinc-600 border border-zinc-200"
                          : isBlue
                          ? "bg-blue-600 text-white shadow-2xs"
                          : isRed
                          ? "bg-red-500 text-white shadow-2xs"
                          : isYellow
                          ? "bg-amber-400 text-amber-950 font-bold shadow-2xs"
                          : "bg-emerald-600 text-white shadow-2xs"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isWhite
                            ? "bg-zinc-400"
                            : isBlue
                            ? "bg-white"
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
                      <span className="text-[9px] font-bold text-blue-700 flex items-center gap-1 bg-blue-100 px-1.5 py-0.5 rounded-full">
                        <Clock size={9} />
                        {Math.floor(t.reservation.remainingSeconds / 60)}m {t.reservation.remainingSeconds % 60}s
                      </span>
                    ) : t.elapsedMinutes !== undefined && !isWhite ? (
                      <span className="text-[9px] font-semibold text-zinc-500 flex items-center gap-1">
                        <Clock size={10} />
                        {t.elapsedMinutes}m ago
                      </span>
                    ) : null}
                  </div>

                  {/* Center Table Number & Capacity */}
                  <div className="my-1 text-center">
                    <h2
                      className={`font-heading font-extrabold text-xl sm:text-2xl tracking-tight transition-transform group-hover:scale-105 ${
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
                    <p className="text-[10px] font-semibold text-[#52525b] mt-0.5 flex items-center justify-center gap-1">
                      <Users size={11} className="text-zinc-400" />
                      Cap: {t.capacity}
                      {isBlue
                        ? t.reservation?.customerPhone
                          ? ` • +91 ***${t.reservation.customerPhone.slice(-4)}`
                          : " • Selected"
                        : t.itemsCount
                        ? ` • ${t.itemsCount} Items`
                        : ""}
                    </p>
                    {(t as any).hasTakeawayParcel && (
                      <div className="mt-1 flex items-center justify-center">
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded-full flex items-center gap-0.5">
                          <ShoppingBag size={9} />
                          <span>Parcel</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Order Total Row */}
                  <div
                    className={`pt-1.5 border-t flex items-center justify-between text-[11px] ${
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
                        <span className="text-blue-700 font-bold">10m Reserved</span>
                      ) : (
                        <>
                          Total:{" "}
                          <span className="font-extrabold text-xs sm:text-sm">
                            {t.totalAmount ? `₹${t.totalAmount}` : "--"}
                          </span>
                        </>
                      )}
                    </span>

                    <ChevronRight
                      size={14}
                      className="text-zinc-400 group-hover:translate-x-0.5 transition-transform"
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

      {/* Take Away Creator Modal */}
      <AdminOrderModal
        isOpen={takeawayModalOpen}
        onClose={() => setTakeawayModalOpen(false)}
        defaultTableNumber="TAKEAWAY"
        onOrderCreated={() => {
          fetchTables();
          fetchTakeaways();
          fetchPrivateOrders();
        }}
      />

      {/* Manual Order by Admin on Table */}
      <AdminOrderModal
        isOpen={Boolean(manualOrderModalTable)}
        onClose={() => setManualOrderModalTable(null)}
        defaultTableNumber={manualOrderModalTable || "A1"}
        onOrderCreated={() => {
          fetchTables();
          fetchTakeaways();
          fetchPrivateOrders();
        }}
      />

      {/* Takeaway Order Detail & Action Inspector Modal */}
      <TakeawayDetailModal
        isOpen={Boolean(selectedTakeawayOrder)}
        order={selectedTakeawayOrder}
        onClose={() => setSelectedTakeawayOrder(null)}
        onOrderUpdated={() => {
          fetchTables();
          fetchTakeaways();
          fetchPrivateOrders();
        }}
      />

      {/* Private Order Detail & Action Inspector Modal */}
      {selectedPrivateOrder && (
        <PrivateOrderDetailModal
          isOpen={Boolean(selectedPrivateOrder)}
          order={selectedPrivateOrder}
          onClose={() => setSelectedPrivateOrder(null)}
          onOrderUpdated={() => {
            fetchTables();
            fetchTakeaways();
            fetchPrivateOrders();
          }}
        />
      )}

      {/* Available Table Choice Prompt */}
      {availablePromptTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-zinc-200 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <UtensilsCrossed size={22} />
            </div>

            <div>
              <h3 className="font-heading font-extrabold text-lg text-[#2C1710]">
                Table {availablePromptTable.tableNumber} is Available
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Would you like to take a manual order directly for walk-in guests?
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  const target = availablePromptTable.tableNumber;
                  setAvailablePromptTable(null);
                  setManualOrderModalTable(target);
                }}
                className="w-full py-2.5 px-4 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>Take Manual Order</span>
              </button>

              <button
                onClick={() => {
                  const target = availablePromptTable.tableNumber;
                  setAvailablePromptTable(null);
                  router.push(`/admin-sp-access/tables/${target}`);
                }}
                className="w-full py-2.5 px-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-heading font-bold text-xs rounded-xl border border-zinc-200 transition-all cursor-pointer"
              >
                <span>View Table Screen</span>
              </button>

              <button
                onClick={() => setAvailablePromptTable(null)}
                className="w-full py-1.5 text-zinc-400 hover:text-zinc-600 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MERGE TAKEAWAY INTO TABLE MODAL (Drag & Drop Confirmation) */}
      {confirmMergeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-amber-200 space-y-4 animate-in zoom-in-95 duration-150 relative">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                    Merge Takeaway into Table {confirmMergeModal.targetTable.tableNumber}
                  </h3>
                  <span className="text-[11px] text-zinc-500">
                    Combine takeaway order with table dining bill
                  </span>
                </div>
              </div>
              <button
                onClick={() => setConfirmMergeModal(null)}
                disabled={isMergingTakeaway}
                className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Order & Table Mapping Card */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 font-medium">Takeaway Order:</span>
                <span className="font-heading font-extrabold text-[#2C1710]">
                  #{confirmMergeModal.takeawayOrder.orderNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 font-medium">Takeaway Items:</span>
                <span className="font-bold text-zinc-800">
                  {confirmMergeModal.takeawayOrder.items?.length || 0} item(s) • ₹{confirmMergeModal.takeawayOrder.grandTotal}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                <span className="text-zinc-600 font-medium">Destination Table:</span>
                <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-lg font-heading font-extrabold text-xs">
                  Table {confirmMergeModal.targetTable.tableNumber}
                </span>
              </div>
            </div>

            {/* Explanation Note */}
            <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-[11px] text-blue-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-blue-950">
                <CheckCircle2 size={13} className="text-blue-700 shrink-0" />
                Single Unified Bill
              </p>
              <p className="text-blue-800 leading-relaxed">
                This takeaway order will be moved into Table {confirmMergeModal.targetTable.tableNumber}. Both dine-in and takeaway items will appear together under the table&apos;s bill, allowing the customer to pay for everything in a single transaction.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                disabled={isMergingTakeaway}
                onClick={() => setConfirmMergeModal(null)}
                className="flex-1 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-heading font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMergingTakeaway}
                onClick={() =>
                  handleExecuteMergeTakeaway(
                    confirmMergeModal.takeawayOrder.id,
                    confirmMergeModal.targetTable.tableNumber
                  )
                }
                className="flex-2 py-3 px-4 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isMergingTakeaway ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Merging Order...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight size={14} />
                    <span>Confirm Merge & Combine Bill</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE SELECT PICKER MODAL (Touchscreen / Tap Fallback) */}
      {pickerTakeawayOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                    Select Table for Order #{pickerTakeawayOrder.orderNumber}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Tap any table below to merge this takeaway order (₹{pickerTakeawayOrder.grandTotal}) into it
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPickerTakeawayOrder(null)}
                className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid of floor tables to pick from */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 overflow-y-auto p-1 max-h-[350px]">
              {tables.map((t) => {
                const isWhite = t.color === "WHITE";
                const isBlue = t.color === "BLUE";
                const isRed = t.color === "RED";
                const isYellow = t.color === "YELLOW";

                return (
                  <button
                    key={t.tableNumber}
                    type="button"
                    onClick={() => {
                      setConfirmMergeModal({
                        takeawayOrder: pickerTakeawayOrder,
                        targetTable: t,
                      });
                      setPickerTakeawayOrder(null);
                    }}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[90px] hover:scale-102 hover:shadow-md ${
                      isWhite
                        ? "bg-white border-zinc-200 hover:border-amber-400"
                        : isBlue
                        ? "bg-blue-50 border-blue-200 hover:border-blue-400"
                        : isRed
                        ? "bg-red-50 border-red-200 hover:border-red-400"
                        : isYellow
                        ? "bg-amber-50 border-amber-200 hover:border-amber-400"
                        : "bg-emerald-50 border-emerald-200 hover:border-emerald-400"
                    }`}
                  >
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider mb-1 block w-fit mx-auto bg-black/5 text-zinc-700">
                      {t.statusLabel}
                    </span>
                    <h4 className="font-heading font-black text-lg text-[#2C1710]">
                      {t.tableNumber}
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-semibold mt-1">
                      {isWhite ? "Free Table" : `₹${t.totalAmount || 0}`}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 shrink-0 border-t border-zinc-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPickerTakeawayOrder(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-heading font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

