"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import CollectCashModal from "@/components/Admin/CollectCashModal";
import ThermalReceiptModal from "@/components/Admin/ThermalReceipt";
import { Order, Invoice } from "@/lib/db";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PrinterClient, CustomerBillPayload } from "@/services/printerClient";
import {
  Calendar,
  Search,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Printer,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  User,
  ShoppingBag,
  CreditCard,
  Banknote,
  RotateCcw,
  X,
  Loader2,
} from "lucide-react";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected order for Detail Inspector
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"ORDERS" | "PAYMENT" | "CUSTOMER">(
    "ORDERS",
  );

  // Filters matching POS image reference
  const [dateFilter, setDateFilter] = useState<string>("");
  const [orderIdFilter, setOrderIdFilter] = useState<string>("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>("ALL");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [contactFilter, setContactFilter] = useState<string>("");

  // Modals & Action states
  const [selectedOrderForCash, setSelectedOrderForCash] =
    useState<Order | null>(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] =
    useState<Invoice | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [printFeedback, setPrintFeedback] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showActionNotice = useCallback(
    (type: "success" | "error", message: string) => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      setActionNotice({ type, message });
      noticeTimerRef.current = setTimeout(() => {
        setActionNotice(null);
      }, 3800);
    },
    [],
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 35;

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?onlyPaid=true");
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
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
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchOrders();
          }, 200);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        () => {
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchOrders();
          }, 200);
        },
      )
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  // Invoice handlers
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

  // Direct USB Bill Print
  const handleDirectPrintCustomerBill = async (
    order: Order,
    isReprint = true,
  ) => {
    setPrintingOrderId(order.id);
    setPrintFeedback(null);
    try {
      const billPayload: CustomerBillPayload = {
        visitId: (order as any).visitId || `V-${order.id}`,
        billNumber:
          (order as any).billNumber ||
          (order.orderNumber
            ? order.orderNumber.replace(/^(ORD-|#)/, "")
            : String(Date.now()).slice(-4)),
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        dateStr: new Date(order.createdAt).toLocaleDateString("en-GB"),
        timeStr: new Date(order.createdAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        terminalName: "Billing 1",
        paymentMode: order.paymentMethod || "CASH",
        items: (order.items || []).map((it) => ({
          name: it.name,
          quantity: it.quantity || 1,
          price: it.price || 0,
          lineTotal: (it.price || 0) * (it.quantity || 1),
        })),
        totalItems: order.items?.length || 0,
        totalQuantity:
          order.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0,
        subtotal: order.subtotal || order.grandTotal || 0,
        tax: order.tax || 0,
        packagingFee: (order as any).packagingFee || 0,
        grandTotal: order.grandTotal || 0,
        isDuplicate: isReprint,
      };

      const res = await PrinterClient.printCustomerBill(billPayload);
      if (res.success) {
        setPrintFeedback({
          id: order.id,
          success: true,
          message: "Bill printed to counter printer!",
        });
      } else {
        setPrintFeedback({
          id: order.id,
          success: false,
          message: res.message || "Counter printer offline or disconnected.",
        });
      }
      setTimeout(() => setPrintFeedback(null), 4000);
    } catch (err: any) {
      setPrintFeedback({
        id: order.id,
        success: false,
        message: err.message || "Print failed.",
      });
      setTimeout(() => setPrintFeedback(null), 4000);
    } finally {
      setPrintingOrderId(null);
    }
  };

  // 1. Strict Order History Rule: Only show orders AFTER successful payment (never unpaid in-flight orders)
  const paidOrdersOnly = useMemo(() => {
    return orders.filter((o) => {
      return (
        o.paymentStatus === "PAID" ||
        (o.status === "COMPLETED" && o.paymentStatus !== "UNPAID")
      );
    });
  }, [orders]);

  // 2. Multi-Round Table Consolidation:
  // If multiple orders were placed on the same table visit before payment,
  // consolidate them into a single billing history record so it only shows ONCE.
  const consolidatedOrders = useMemo(() => {
    const groups = new Map<string, Order[]>();

    paidOrdersOnly.forEach((ord) => {
      const visitMatch = (ord.notes || "").match(/\[VISIT_ID:([^\]]+)\]/);
      const visitKey = visitMatch ? visitMatch[1] : null;
      const txnKey = ord.paymentTxnId && ord.paymentTxnId.trim() ? ord.paymentTxnId.trim() : null;
      const isTableOrder = ord.tableNumber && ord.tableNumber !== "TAKEAWAY";

      let key = "";
      if (txnKey) {
        key = `txn_${txnKey}_${ord.tableNumber}`;
      } else if (visitKey) {
        key = `visit_${visitKey}_${ord.tableNumber}`;
      } else if (isTableOrder) {
        // Group orders on the same table settled within the same 30-minute window
        const dt = new Date(ord.updatedAt || ord.createdAt);
        const roundedTime = Math.floor(dt.getTime() / (30 * 60 * 1000));
        key = `tbl_${ord.tableNumber}_${roundedTime}`;
      } else {
        key = `ord_${ord.id}`;
      }

      const list = groups.get(key) || [];
      list.push(ord);
      groups.set(key, list);
    });

    const result: (Order & { consolidatedCount?: number; subOrders?: Order[] })[] = [];

    groups.forEach((group) => {
      if (group.length === 1) {
        result.push(group[0]);
        return;
      }

      // Multiple rounds placed on this table before payment:
      // Sort chronologically (oldest round first)
      group.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const primary = group[0];
      const latest = group[group.length - 1];

      // Combine items from all rounds
      const combinedItems: any[] = [];
      group.forEach((o) => {
        if (Array.isArray(o.items)) {
          combinedItems.push(...o.items);
        }
      });

      // Sum all financial amounts
      const sumSubtotal = group.reduce(
        (sum, o) => sum + (o.subtotal || o.grandTotal || 0),
        0
      );
      const sumTax = group.reduce((sum, o) => sum + (o.tax || 0), 0);
      const sumPackaging = group.reduce(
        (sum, o) => sum + ((o as any).packagingFee || 0),
        0
      );
      const sumGrand = group.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

      // Clean order numbers e.g. "#121, #122"
      const numberLabels = group
        .map((o) => o.orderNumber.replace(/^(ORD-|#)/, ""))
        .join(", #");

      const mergedOrder: Order & { consolidatedCount?: number; subOrders?: Order[] } = {
        ...primary,
        id: primary.id,
        orderNumber: `#${numberLabels}`,
        items: combinedItems,
        subtotal: sumSubtotal,
        tax: sumTax,
        grandTotal: sumGrand,
        paymentStatus: "PAID",
        paymentMethod: latest.paymentMethod || primary.paymentMethod || "CASH",
        paymentTxnId: latest.paymentTxnId || primary.paymentTxnId,
        status: "COMPLETED",
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt || latest.createdAt,
        notes: `[CONSOLIDATED_VISIT: ${group.length} Rounds] ${primary.notes || ""}`,
        consolidatedCount: group.length,
        subOrders: group,
      };

      (mergedOrder as any).packagingFee = sumPackaging;

      result.push(mergedOrder);
    });

    // Sort newest settlement first
    result.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );

    return result;
  }, [paidOrdersOnly]);

  // Filter logic over consolidated paid orders
  const filteredOrders = useMemo(() => {
    return consolidatedOrders.filter((o) => {
      // 1. Date Filter
      if (dateFilter) {
        const orderDate = new Date(o.createdAt).toISOString().split("T")[0];
        if (orderDate !== dateFilter) return false;
      }

      // 2. Order ID Filter
      if (orderIdFilter.trim()) {
        const q = orderIdFilter.toLowerCase();
        const num = o.orderNumber.toLowerCase();
        const shortNum = o.orderNumber.replace(/^[A-Za-z]+-/, "").toLowerCase();
        if (!num.includes(q) && !shortNum.includes(q)) return false;
      }

      // 3. Payment Type Filter
      if (paymentTypeFilter !== "ALL") {
        const m = (o.paymentMethod || "").toUpperCase();
        if (paymentTypeFilter === "CASH" && m !== "CASH") return false;
        if (
          paymentTypeFilter === "UPI" &&
          m !== "UPI" &&
          m !== "ONLINE" &&
          m !== "RAZORPAY"
        )
          return false;
      }

      // 4. Order Status Filter
      if (orderStatusFilter !== "ALL") {
        if (o.status !== orderStatusFilter) return false;
      }

      // 5. Contact Search Filter
      if (contactFilter.trim()) {
        const q = contactFilter.toLowerCase();
        const phone = (o.customerPhone || "").toLowerCase();
        const notes = (o.notes || "").toLowerCase();
        if (!phone.includes(q) && !notes.includes(q)) return false;
      }

      return true;
    });
  }, [
    consolidatedOrders,
    dateFilter,
    orderIdFilter,
    paymentTypeFilter,
    orderStatusFilter,
    contactFilter,
  ]);

  // Selected Order
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId && filteredOrders.length > 0) {
      return filteredOrders[0];
    }
    return (
      filteredOrders.find((o) => o.id === selectedOrderId) ||
      filteredOrders[0] ||
      null
    );
  }, [filteredOrders, selectedOrderId]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const handleClearFilters = () => {
    setDateFilter("");
    setOrderIdFilter("");
    setPaymentTypeFilter("ALL");
    setOrderStatusFilter("ALL");
    setContactFilter("");
    setCurrentPage(1);
  };

  const handleCopyPaymentId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#F4F5F7] text-[#1E1E24] p-3 sm:p-5 flex flex-col gap-3 font-sans">
        {/* ========================================================= */}
        {/* TOP COMMAND HEADER (Replicating Image Reference) */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-zinc-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left Title & Settings */}
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-extrabold text-sm sm:text-base tracking-wide text-[#1E1E24] uppercase flex items-center gap-2">
              <span>BILLING LISTS</span>
              <Settings
                size={15}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              />
            </h1>
          </div>

          {/* Filter Controls Row */}
          <div className="flex items-center gap-2 flex-wrap flex-1 justify-start md:justify-center">
            {/* Date Filter */}
            <div className="relative">
              <Calendar
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
              />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-2 py-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
              />
            </div>

            {/* Order ID */}
            <input
              type="text"
              value={orderIdFilter}
              onChange={(e) => {
                setOrderIdFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Order ID"
              className="w-24 sm:w-28 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
            />

            {/* Payment Type */}
            <select
              value={paymentTypeFilter}
              onChange={(e) => {
                setPaymentTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
            >
              <option value="ALL">Payment Type</option>
              <option value="CASH">CASH</option>
              <option value="UPI">UPI / ONLINE</option>
            </select>

            {/* Order Status */}
            <select
              value={orderStatusFilter}
              onChange={(e) => {
                setOrderStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
            >
              <option value="ALL">Order Status (All)</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="PENDING">PENDING</option>
              <option value="PREPARING">PREPARING</option>
              <option value="READY">READY</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            {/* Contact Search */}
            <input
              type="text"
              value={contactFilter}
              onChange={(e) => {
                setContactFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Contact Search..."
              className="w-32 sm:w-36 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#CA340A]"
            />

            {/* Clear Button */}
            {(dateFilter ||
              orderIdFilter ||
              paymentTypeFilter !== "ALL" ||
              orderStatusFilter !== "ALL" ||
              contactFilter) && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Right Cafe Badge */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold border border-zinc-200 flex items-center gap-1.5">
              <span>Spiral Cafe</span>
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MASTER-DETAIL SPLIT CONTAINER (Left: Cards, Right: Inspector) */}
        {/* ========================================================= */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[75vh]">
          {/* LEFT COLUMN: ORDER CARDS LIST (5 Cols on LG) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-400 text-xs">
                  <div className="w-8 h-8 border-2 border-[#CA340A] border-t-transparent rounded-full animate-spin mb-2" />
                  <span>Loading billing history...</span>
                </div>
              ) : paginatedOrders.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-400 text-xs text-center p-4">
                  <CheckCircle2 size={32} className="mb-2 opacity-50" />
                  <span className="font-bold">No orders found</span>
                  <span className="text-[11px] text-zinc-400 mt-0.5">
                    Try clearing filters or changing date
                  </span>
                </div>
              ) : (
                paginatedOrders.map((ord) => {
                  const isSelected = selectedOrder?.id === ord.id;
                  const isPaid = ord.paymentStatus === "PAID";
                  const isCash = ord.paymentMethod === "CASH";
                  const shortId = ord.orderNumber.replace(/^[A-Za-z]+-/, "");
                  const dt = new Date(ord.createdAt);
                  const dateStr = dt.toLocaleDateString("en-GB");
                  const timeStr = dt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`p-3 rounded-2xl transition-all cursor-pointer border flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-[#3B1220] text-white border-[#3B1220] shadow-md shadow-[#3B1220]/20"
                          : "bg-zinc-50/70 hover:bg-zinc-100/80 text-[#1E1E24] border-zinc-200/60"
                      }`}
                    >
                      {/* Left Block */}
                      <div className="space-y-1.5 min-w-0">
                        {/* Status Badge */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${
                              isSelected
                                ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                                : ord.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ord.status === "CANCELLED"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ord.status === "COMPLETED"
                              ? "Completed"
                              : ord.status}
                          </span>
                        </div>

                        {/* Order ID & Payment Pill */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`text-[11px] font-semibold ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}
                          >
                            Order Id
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border ${
                              isSelected
                                ? "bg-white/10 text-white border-white/20"
                                : "bg-white text-zinc-700 border-zinc-300"
                            }`}
                          >
                            {isCash ? "CASH" : "UPI"}
                          </span>
                        </div>

                        {/* Order Number (#2170) */}
                        <div className="font-heading font-black text-lg sm:text-xl tracking-tight leading-none">
                          #{shortId}
                        </div>

                        {/* Full Payment Badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              isSelected
                                ? "bg-emerald-500/20 text-emerald-300"
                                : isPaid
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isPaid ? "Full payment" : "Unpaid"}
                          </span>
                          {(ord as any).consolidatedCount > 1 && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                isSelected
                                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                                  : "bg-amber-100 text-amber-900 border border-amber-300"
                              }`}
                            >
                              {(ord as any).consolidatedCount} Orders Combined
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Block */}
                      <div className="text-right space-y-1.5 shrink-0">
                        {/* Amount */}
                        <div
                          className={`font-heading font-black text-base sm:text-lg tracking-tight ${
                            isSelected ? "text-white" : "text-[#1E1E24]"
                          }`}
                        >
                          ₹{(ord.grandTotal || 0).toLocaleString()}
                        </div>

                        {/* Date Time */}
                        <div
                          className={`text-[10px] font-mono ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}
                        >
                          {dateStr} {timeStr}
                        </div>

                        {/* Terminal Badge & Quick Print */}
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                              isSelected
                                ? "bg-black/30 text-zinc-200"
                                : "bg-zinc-200/80 text-zinc-700"
                            }`}
                          >
                            Billing 1
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectPrintCustomerBill(ord, false);
                            }}
                            title="Print Counter Bill (58mm)"
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              isSelected
                                ? "hover:bg-white/20 text-white"
                                : "hover:bg-zinc-200 text-zinc-600"
                            }`}
                          >
                            <Printer size={12} className={printingOrderId === ord.id ? "animate-spin text-[#CA340A]" : ""} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Pagination Bar */}
            <div className="p-2.5 border-t border-zinc-200/80 bg-zinc-50/50 flex items-center justify-between text-xs text-zinc-600">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">{pageSize}</span>
                <ChevronDown size={12} className="text-zinc-400" />
              </div>

              <div className="font-semibold text-[11px]">
                {paginatedOrders.length > 0 ? (
                  <span>
                    {(currentPage - 1) * pageSize + 1}-
                    {Math.min(currentPage * pageSize, filteredOrders.length)} of{" "}
                    {filteredOrders.length}
                  </span>
                ) : (
                  <span>0 of 0</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-lg hover:bg-zinc-200 text-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="p-1 rounded-lg hover:bg-zinc-200 text-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: DETAIL INSPECTOR (7 Cols on LG) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col overflow-hidden">
            {!selectedOrder ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-xs p-8 text-center">
                <Receipt size={36} className="mb-2 opacity-40" />
                <span className="font-bold text-sm text-zinc-600">
                  No order selected
                </span>
                <span className="text-zinc-400 mt-1">
                  Select an order ticket from the left to view breakdown
                </span>
              </div>
            ) : (
              <>
                {/* 3 Tabs Header: Orders | Payment Information | Customer Details */}
                <div className="px-5 pt-4 border-b border-zinc-200 flex items-center gap-6 shrink-0 bg-white">
                  <button
                    onClick={() => setDetailTab("ORDERS")}
                    className={`pb-3 text-xs font-bold tracking-wide uppercase transition-all cursor-pointer relative ${
                      detailTab === "ORDERS"
                        ? "text-[#CA340A]"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Orders
                    {detailTab === "ORDERS" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CA340A] rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setDetailTab("PAYMENT")}
                    className={`pb-3 text-xs font-bold tracking-wide uppercase transition-all cursor-pointer relative ${
                      detailTab === "PAYMENT"
                        ? "text-[#CA340A]"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Payment Information
                    {detailTab === "PAYMENT" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CA340A] rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setDetailTab("CUSTOMER")}
                    className={`pb-3 text-xs font-bold tracking-wide uppercase transition-all cursor-pointer relative ${
                      detailTab === "CUSTOMER"
                        ? "text-[#CA340A]"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Customer Details
                    {detailTab === "CUSTOMER" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CA340A] rounded-full" />
                    )}
                  </button>
                </div>

                {/* TAB 1: ORDERS CONTENT */}
                {detailTab === "ORDERS" && (
                  <div className="flex-1 flex flex-col justify-between overflow-hidden">
                    <div className="p-5 overflow-y-auto space-y-5">
                      {/* Print Feedback Banner */}
                      {printFeedback && printFeedback.id === selectedOrder.id && (
                        <div
                          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border animate-in fade-in ${
                            printFeedback.success
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-red-50 text-red-800 border-red-200"
                          }`}
                        >
                          {printFeedback.success ? (
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle size={16} className="text-red-600 shrink-0" />
                          )}
                          <span>{printFeedback.message}</span>
                        </div>
                      )}

                      {/* Big Order Title & Top Quick Print Buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="font-heading font-black text-2xl text-[#1E1E24] tracking-tight">
                            Order #
                            {selectedOrder.orderNumber.replace(/^[A-Za-z]+-/, "")}
                          </h2>
                          {(selectedOrder as any).consolidatedCount > 1 && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              {(selectedOrder as any).consolidatedCount} Orders Consolidated
                            </span>
                          )}
                        </div>

                        {/* Top Direct Print Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDirectPrintCustomerBill(selectedOrder, false)}
                            disabled={printingOrderId === selectedOrder.id}
                            className="py-1.5 px-3 bg-[#3B1220] hover:bg-[#2A0B16] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            title="Print Counter Bill to 58mm Thermal Printer"
                          >
                            <Printer size={13} className={printingOrderId === selectedOrder.id ? "animate-spin" : ""} />
                            <span>{printingOrderId === selectedOrder.id ? "Printing..." : "Print Bill (58mm)"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDirectPrintCustomerBill(selectedOrder, true)}
                            disabled={printingOrderId === selectedOrder.id}
                            className="py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            title="Reprint Bill with DUPLICATE Tag"
                          >
                            <RotateCcw size={13} className="text-[#CA340A]" />
                            <span>Reprint Bill</span>
                          </button>
                        </div>
                      </div>

                      {/* Key-Value Metadata Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                        <div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Date &amp; Time
                          </div>
                          <div className="font-semibold text-zinc-800 mt-0.5">
                            {new Date(
                              selectedOrder.createdAt,
                            ).toLocaleDateString("en-CA")}{" "}
                            {new Date(
                              selectedOrder.createdAt,
                            ).toLocaleTimeString([], { hour12: false })}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Payment Type
                          </div>
                          <div className="font-semibold text-zinc-800 mt-0.5">
                            {selectedOrder.paymentStatus === "PAID"
                              ? "FULL-PAYMENT"
                              : "UNPAID"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Payment ID
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-zinc-800 mt-0.5">
                            <span>Pay_{selectedOrder.id.slice(0, 6)}...</span>
                            <button
                              onClick={() =>
                                handleCopyPaymentId(`Pay_${selectedOrder.id}`)
                              }
                              className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                              title="Copy ID"
                            >
                              <Copy size={12} />
                            </button>
                            {copiedId && (
                              <span className="text-[10px] text-emerald-600 font-bold">
                                Copied!
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Table Name
                          </div>
                          <div className="font-heading font-extrabold text-sm text-[#CA340A] mt-0.5">
                            {selectedOrder.tableNumber === "TAKEAWAY"
                              ? "TAKE AWAY"
                              : selectedOrder.tableNumber}
                          </div>
                        </div>
                      </div>

                      {/* Professional Notification Banner */}
                      {actionNotice && (
                        <div
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all duration-200 animate-in fade-in slide-in-from-top-1 ${
                            actionNotice.type === "success"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                              : "bg-red-50 border-red-300 text-red-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {actionNotice.type === "success" ? (
                              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                            ) : (
                              <AlertCircle size={15} className="text-red-600 shrink-0" />
                            )}
                            <span>{actionNotice.message}</span>
                          </div>
                          <button
                            onClick={() => setActionNotice(null)}
                            className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded-sm"
                            title="Close"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}

                      {/* Items Section */}
                      <div className="pt-2">
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                          Items ({selectedOrder.items?.length || 0})
                        </div>

                        <div className="divide-y divide-zinc-100 border-t border-b border-zinc-100">
                          {(selectedOrder.items || []).map((it, idx) => {
                            return (
                              <div
                                key={it.id || idx}
                                className="py-2.5 flex items-center justify-between text-xs gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-zinc-900 truncate">
                                    {it.name}
                                  </div>
                                  {it.notes && (
                                    <div className="text-[11px] text-zinc-400 italic">
                                      +{" "}
                                      {it.notes
                                        .replace(/\[[^\]]+\]/g, "")
                                        .trim()}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-zinc-500 mt-0.5">
                                    ₹{it.price} each
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  {/* Immutable Historical Quantity Badge */}
                                  <span className="font-heading font-extrabold text-xs text-[#CA340A] bg-[#FFF9F5] border border-[#CA340A]/20 px-2.5 py-1 rounded-lg">
                                    Qty: {it.quantity}
                                  </span>

                                  {/* Line Total */}
                                  <span className="font-heading font-extrabold text-sm text-[#2C1710] min-w-[55px] text-right">
                                    ₹{(it.price || 0) * (it.quantity || 1)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Summary & Actions Footer */}
                    <div className="p-4 sm:p-5 bg-zinc-50/70 border-t border-zinc-200/80 space-y-3 shrink-0">
                      <div className="space-y-1 text-xs text-zinc-600">
                        <div className="flex justify-between">
                          <span>Total Items</span>
                          <span className="font-bold">
                            {selectedOrder.items?.length || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Order Quantity</span>
                          <span className="font-bold">
                            {selectedOrder.items?.reduce(
                              (acc, it) => acc + (it.quantity || 1),
                              0,
                            ) || 0}
                          </span>
                        </div>
                        <div className="flex justify-between font-heading font-extrabold text-base text-[#1E1E24] pt-1.5 border-t border-zinc-200">
                          <span>Total</span>
                          <span className="text-[#CA340A]">
                            ₹{selectedOrder.grandTotal}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleDirectPrintCustomerBill(selectedOrder, false)
                          }
                          disabled={printingOrderId === selectedOrder.id}
                          className="flex-1 py-2 px-3 bg-[#3B1220] hover:bg-[#2A0B16] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Printer
                            size={14}
                            className={
                              printingOrderId === selectedOrder.id
                                ? "animate-spin text-white"
                                : "text-white"
                            }
                          />
                          <span>
                            {printingOrderId === selectedOrder.id
                              ? "Printing Bill..."
                              : "Print Bill (58mm Counter)"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDirectPrintCustomerBill(selectedOrder, true)
                          }
                          disabled={printingOrderId === selectedOrder.id}
                          className="flex-1 py-2 px-3 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-800 flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw size={14} className="text-[#CA340A]" />
                          <span>Reprint Bill</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleViewInvoice(selectedOrder.id)}
                          className="py-2 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <Receipt size={14} />
                          <span>Invoice</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: PAYMENT INFORMATION CONTENT */}
                {detailTab === "PAYMENT" && (
                  <div className="p-5 overflow-y-auto space-y-4 text-xs">
                    <h3 className="font-heading font-extrabold text-sm text-zinc-900 uppercase tracking-wide">
                      Payment Settlement Breakdown
                    </h3>

                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2.5">
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-medium">
                          Payment Mode
                        </span>
                        <span className="font-bold uppercase text-zinc-900">
                          {selectedOrder.paymentMethod || "CASH"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-medium">
                          Settlement Status
                        </span>
                        <span className="font-bold text-emerald-700">
                          {selectedOrder.paymentStatus === "PAID"
                            ? "Full payment (Settled)"
                            : "Pending Settlement"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-medium">
                          Transaction ID
                        </span>
                        <span className="font-mono font-bold text-zinc-800">
                          ORD-TXN-{selectedOrder.id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-medium">
                          Subtotal
                        </span>
                        <span className="font-semibold text-zinc-900">
                          ₹{selectedOrder.subtotal || selectedOrder.grandTotal}
                        </span>
                      </div>
                      {(selectedOrder.tax || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-medium">
                            GST / Taxes
                          </span>
                          <span className="font-semibold text-zinc-900">
                            ₹{selectedOrder.tax}
                          </span>
                        </div>
                      )}
                      {((selectedOrder as any).packagingFee || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-medium">
                            Packaging Fee
                          </span>
                          <span className="font-semibold text-zinc-900">
                            ₹{(selectedOrder as any).packagingFee}
                          </span>
                        </div>
                      )}
                      {((selectedOrder as any).serviceCharge || 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-medium">
                            Service Charge
                          </span>
                          <span className="font-semibold text-zinc-900">
                            ₹{(selectedOrder as any).serviceCharge}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-heading font-extrabold text-sm text-zinc-900 pt-2 border-t border-zinc-200">
                        <span>Grand Total Paid</span>
                        <span className="text-[#CA340A]">
                          ₹{selectedOrder.grandTotal}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: CUSTOMER DETAILS CONTENT */}
                {detailTab === "CUSTOMER" && (
                  <div className="p-5 overflow-y-auto space-y-4 text-xs">
                    <h3 className="font-heading font-extrabold text-sm text-zinc-900 uppercase tracking-wide">
                      Customer &amp; Session Info
                    </h3>

                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2.5">
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-medium">
                          Phone Number
                        </span>
                        <span className="font-bold text-zinc-900">
                          {selectedOrder.customerPhone
                            ? `+91 ${selectedOrder.customerPhone}`
                            : "Walk-in Guest"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-medium">
                          Dining Mode
                        </span>
                        <span className="font-bold text-zinc-900">
                          {(() => {
                            const hasParcel = (selectedOrder.items || []).some((i) => i.name.toLowerCase().includes("(parcel)") || (i.notes || "").toLowerCase().includes("parcel"));
                            const hasDineIn = (selectedOrder.items || []).some((i) => !i.name.toLowerCase().includes("(parcel)") && !(i.notes || "").toLowerCase().includes("parcel"));
                            const isMixed = (hasParcel && hasDineIn) || (selectedOrder.notes || "").includes("DINE_IN_AND_TAKEAWAY");
                            if (isMixed) return `Dine-In & Take Away (Table ${selectedOrder.tableNumber})`;
                            if (selectedOrder.tableNumber === "TAKEAWAY" || (selectedOrder.notes || "").includes("[TAKEAWAY]") || hasParcel) return "Take Away / Parcel";
                            return `Dine-In (Table ${selectedOrder.tableNumber})`;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-medium">
                          Customer Session ID
                        </span>
                        <span className="font-mono text-[11px] text-zinc-700">
                          {selectedOrder.customerSessionId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-medium">
                          Order Placed At
                        </span>
                        <span className="font-semibold text-zinc-900">
                          {new Date(selectedOrder.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {selectedOrder.notes && (
                        <div className="pt-2 border-t border-zinc-200">
                          <span className="text-zinc-500 font-medium block mb-1">
                            Notes / Special Instructions
                          </span>
                          <span className="font-normal text-zinc-800 bg-white p-2 rounded-xl block border border-zinc-200">
                            {selectedOrder.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modals */}
        {selectedOrderForCash && (
          <CollectCashModal
            order={selectedOrderForCash}
            onClose={() => setSelectedOrderForCash(null)}
            onSuccess={() => {
              setSelectedOrderForCash(null);
              fetchOrders();
            }}
          />
        )}

        {selectedInvoiceForPrint && (
          <ThermalReceiptModal
            invoice={selectedInvoiceForPrint}
            onClose={() => setSelectedInvoiceForPrint(null)}
          />
        )}
      </div>
    </AdminLayout>
  );
}
