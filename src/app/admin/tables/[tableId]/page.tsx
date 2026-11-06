"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import PrinterStatusModal from "@/components/Admin/PrinterStatusModal";
import ReceivePaymentModal from "@/components/Admin/ReceivePaymentModal";
import { Order, OrderItem } from "@/lib/db";
import { KotData, KotReceiptEngine } from "@/lib/kot";
import type { PrinterSettings, KotStatus } from "@/lib/tables";
import { PrinterClient, PrinterState, CustomerBillPayload } from "@/services/printerClient";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";
import {
  ArrowLeft,
  Printer,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Send,
  Lock,
  RotateCcw,
  HandHelping,
  CreditCard,
  Banknote,
  UtensilsCrossed,
  Sparkles,
  RefreshCw,
  FileText,
  ArrowLeftRight,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function extractKotStateFromOrder(order: Order): {
  kotStatus: KotStatus;
  confirmedRounds: number[];
  highestRound: number;
  hasUnconfirmedAddons: boolean;
  viewedAt?: string;
  manuallyDelivered: boolean;
} {
  const notes = order.notes || "";
  const rounds = order.items.map((it) => {
    const match = (it.notes || "").match(/\[ROUND:(\d+)\]/);
    return match ? parseInt(match[1], 10) : it.round || 1;
  });
  const highestRound = rounds.length > 0 ? Math.max(...rounds) : 1;

  const confirmedMatch = notes.match(/\[KOT_CONFIRMED_ROUNDS:([0-9,]+)\]/);
  const confirmedRounds = confirmedMatch
    ? confirmedMatch[1]
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n))
    : [];

  const manuallyDelivered = notes.includes("[KOT_MANUALLY_DELIVERED]");
  const isFailed = notes.includes("[KOT_FAILED]");
  const isUnknown = notes.includes("[KOT_UNKNOWN]");
  const isViewed = notes.includes("[KOT_VIEWED_EXITED]") || notes.includes("[KOT_EXITED_WITHOUT_KOT]");
  const hasUnconfirmedAddons = highestRound > 1 && !confirmedRounds.includes(highestRound);

  let kotStatus: KotStatus = "NOT_SENT";
  if (confirmedRounds.includes(highestRound) || order.status === "PREPARING" || order.status === "READY") {
    kotStatus = "PRINT_CONFIRMED";
  } else if (hasUnconfirmedAddons) {
    kotStatus = "NOT_SENT";
  } else if (manuallyDelivered) {
    kotStatus = "MANUALLY_DELIVERED";
  } else if (isFailed) {
    kotStatus = "FAILED";
  } else if (isUnknown) {
    kotStatus = "UNKNOWN";
  } else if (isViewed) {
    kotStatus = "VIEWED";
  }

  const viewedMatch = notes.match(/\[KOT_VIEWED_AT:([^\]]+)\]/);
  const viewedAt = viewedMatch ? viewedMatch[1] : undefined;

  return {
    kotStatus,
    confirmedRounds,
    highestRound,
    hasUnconfirmedAddons,
    viewedAt,
    manuallyDelivered,
  };
}

export default function TableDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawTableId = (params?.tableId as string) || "A1";
  const tableId = decodeURIComponent(rawTableId).toUpperCase();

  const [loading, setLoading] = useState(true);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [isReserved, setIsReserved] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [isReleasing, setIsReleasing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [billing, setBilling] = useState<{
    acceptedOrdersCount: number;
    pendingOrdersCount: number;
    acceptedSubtotal: number;
    acceptedTax: number;
    acceptedPackaging: number;
    acceptedGrandTotal: number;
    pendingValue: number;
    totalVisitValue: number;
  } | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [kotState, setKotState] = useState<{
    kotStatus: KotStatus;
    confirmedRounds: number[];
    highestRound: number;
    hasUnconfirmedAddons: boolean;
    manuallyDelivered: boolean;
  }>({
    kotStatus: "NOT_SENT",
    confirmedRounds: [],
    highestRound: 1,
    hasUnconfirmedAddons: false,
    manuallyDelivered: false,
  });

  const [kotData, setKotData] = useState<KotData | null>(null);
  const [plainSlip, setPlainSlip] = useState<string>("");
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({
    printerModel: "CN811-UEWB",
    interfaceType: "ETHERNET",
    ipAddress: "192.168.1.50",
    port: 9100,
    paperWidthMm: 80,
    qzPrinterName: "CN811-UEWB",
    terminalName: "Billing 1",
    autoCut: true,
  });

  // Real-time printer status hook (direct TCP socket to CN811-UEWB port 9100)
  const printer = usePrinterStatus(6000);
  const [isSendingKot, setIsSendingKot] = useState(false);
  const [kotWarningMessage, setKotWarningMessage] = useState<string | null>(null);
  const [printSuccessNotice, setPrintSuccessNotice] = useState<string | null>(null);
  const [reconciliationNotice, setReconciliationNotice] = useState<{
    orderId: string;
    orderNumber: string;
    round: number;
    kotId: string;
    message: string;
  } | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Modals
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [manualTransferModalOpen, setManualTransferModalOpen] = useState(false);
  const [availableFloors, setAvailableFloors] = useState<string[]>([]);
  const [targetFloorTable, setTargetFloorTable] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [isPrintingTransferNotice, setIsPrintingTransferNotice] = useState(false);
  const [transferNoticeResult, setTransferNoticeResult] = useState<string | null>(null);

  // Direct Counter Bill Print
  const [isPrintingBillDirect, setIsPrintingBillDirect] = useState(false);
  const [billPrintDirectNotice, setBillPrintDirectNotice] = useState<string | null>(null);

  const openManualTransferModal = async () => {
    try {
      const res = await fetch("/api/tables");
      const d = await res.json();
      if (d.success && Array.isArray(d.tables)) {
        const avail = d.tables
          .filter((t: any) => t.color === "WHITE" && t.tableNumber !== tableId)
          .map((t: any) => t.tableNumber);
        setAvailableFloors(avail);
        if (avail.length > 0) setTargetFloorTable(avail[0]);
      }
    } catch {}
    setManualTransferModalOpen(true);
  };

  const handleExecuteManualTransfer = async () => {
    if (!targetFloorTable) return;
    setTransferring(true);
    try {
      const res = await fetch("/api/tables/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MANUAL",
          fromTable: tableId,
          toTable: targetFloorTable,
          adminUser: "Cashier Staff",
        }),
      });
      const d = await res.json();
      if (d.success) {
        // Automatically dispatch kitchen table transfer notice
        const activeVisitId =
          (orders[0] as any)?.visit_id ||
          orders[0]?.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1] ||
          `VISIT-${tableId}`;

        PrinterClient.printTableTransferNotice({
          visitId: activeVisitId,
          fromTable: tableId as string,
          toTable: targetFloorTable,
          orderCount: orders.length,
          totalBill: displayTotalVisitValue,
          adminUser: "Cashier Staff",
        }).catch(() => {});

        router.push(`/admin/tables/${targetFloorTable}`);
      } else {
        alert(d.error || "Failed to transfer table.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to transfer table.");
    } finally {
      setTransferring(false);
    }
  };

  const handlePrintTransferNoticeDirect = async () => {
    setIsPrintingTransferNotice(true);
    setTransferNoticeResult(null);
    try {
      const activeVisitId =
        (orders[0] as any)?.visit_id ||
        orders[0]?.notes?.match(/\[VISIT_ID:([^\]]+)\]/)?.[1] ||
        `VISIT-${tableId}`;

      const res = await PrinterClient.printTableTransferNotice({
        visitId: activeVisitId,
        fromTable: (orders[0]?.notes?.match(/\[TABLE_TRANSFERRED:FROM_([^_]+)/)?.[1]) || (tableId as string),
        toTable: tableId as string,
        orderCount: orders.length,
        totalBill: displayTotalVisitValue,
        adminUser: "Cashier Staff",
      });
      setTransferNoticeResult(res.message);
    } catch (err: any) {
      setTransferNoticeResult(err.message || "Failed to print notice.");
    } finally {
      setIsPrintingTransferNotice(false);
    }
  };

  const handlePrintCounterBill = async () => {
    if (!combinedOrderForPayment) return;
    setIsPrintingBillDirect(true);
    setBillPrintDirectNotice(null);

    const billPayload: CustomerBillPayload = {
      visitId: (combinedOrderForPayment as any).visitId || `V-${combinedOrderForPayment.id}`,
      billNumber:
        (combinedOrderForPayment as any).billNumber ||
        (combinedOrderForPayment.orderNumber
          ? combinedOrderForPayment.orderNumber.replace(/^(ORD-|#)/, "")
          : String(Date.now()).slice(-4)),
      orderNumber: combinedOrderForPayment.orderNumber || String(combinedOrderForPayment.id),
      tableNumber: String(tableId),
      dateStr: new Date().toLocaleDateString("en-GB"),
      timeStr: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      terminalName: "Billing 1",
      paymentMode: combinedOrderForPayment.paymentMethod || "CASH",
      items: allVisitItems.map((it) => ({
        name: it.name,
        quantity: it.quantity || 1,
        price: it.price || 0,
        lineTotal: it.lineTotal || it.price * (it.quantity || 1),
      })),
      totalItems: allVisitItems.length,
      totalQuantity: allVisitItems.reduce((acc, it) => acc + (it.quantity || 1), 0),
      subtotal: displayAcceptedSubtotal > 0 ? displayAcceptedSubtotal : displayTotalVisitValue,
      tax: displayAcceptedTax,
      packagingFee: displayAcceptedPackaging,
      grandTotal: displayAcceptedGrandTotal > 0 ? displayAcceptedGrandTotal : displayTotalVisitValue,
      isDuplicate: false,
    };

    const res = await PrinterClient.printCustomerBill(billPayload);
    setIsPrintingBillDirect(false);
    if (res.success) {
      setBillPrintDirectNotice("Customer bill printed to counter printer!");
    } else {
      setBillPrintDirectNotice(res.message || "Failed to print counter bill.");
    }
    setTimeout(() => setBillPrintDirectNotice(null), 5000);
  };

  // Fetch Table & Active Orders
  const fetchTableData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}`);
      const data = await res.json();

      if (data.success) {
        setHasActiveOrder(data.hasActiveOrder);
        setOrders(data.orders || (data.activeOrder ? [data.activeOrder] : []));
        setOrder(data.activeOrder || null);
        if (data.billing) setBilling(data.billing);
        setIsReserved(Boolean(data.isReserved));
        setReservation(data.reservation || null);
        if (data.kotState) setKotState(data.kotState);
        if (data.kotData) setKotData(data.kotData);
        if (data.plainSlip) setPlainSlip(data.plainSlip);
        if (data.printerSettings) setPrinterSettings(data.printerSettings);
      }
    } catch (e) {
      console.error("Fetch table error:", e);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  // Handler: ADMIN OVERRIDE RELEASE TABLE
  const handleReleaseTable = async () => {
    if (
      !confirm(
        `Are you sure you want to release Table ${tableId}? This will cancel the temporary reservation and release the table immediately.`
      )
    ) {
      return;
    }
    setIsReleasing(true);
    try {
      const res = await fetch("/api/tables/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: tableId, adminUser: "Admin Staff" }),
      });
      const d = await res.json();
      if (d.success) {
        router.push("/admin/tables");
      } else {
        alert(d.error || "Failed to release table.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to release table.");
    } finally {
      setIsReleasing(false);
    }
  };

  // Mark table as exited without KOT when admin leaves without sending KOT
  const markExitedWithoutKot = useCallback(() => {
    if (order?.id && kotState.kotStatus === "NOT_SENT") {
      fetch(`/api/tables/${encodeURIComponent(tableId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, exitedWithoutKot: true }),
        keepalive: true,
      }).catch(() => {});
    }
  }, [order?.id, kotState.kotStatus, tableId]);

  useEffect(() => {
    return () => {
      // If unmounting while order is pending KOT, mark exited
      markExitedWithoutKot();
    };
  }, [markExitedWithoutKot]);

  useEffect(() => {
    fetchTableData();

    // Listen to real-time order updates on Supabase
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`table_detail_${tableId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchTableData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTableData, tableId]);

  // Handler: SEND KOT TO CN811-UEWB VIA DIRECT TCP PRINT CONNECTOR
  const handleSendKot = async (specificOrderId?: string, forceReprint = false) => {
    const target = specificOrderId
      ? orders.find((o) => o.id === specificOrderId) || order
      : order || orders[0];

    if (!target || isSendingKot) return;

    setIsSendingKot(true);
    setKotWarningMessage(null);
    setPrintSuccessNotice(null);
    setReconciliationNotice(null);

    const targetKotState = extractKotStateFromOrder(target);
    const targetRound = targetKotState.hasUnconfirmedAddons ? targetKotState.highestRound : 1;

    try {
      const printResult = await PrinterClient.dispatchKotPrint(
        target.id,
        targetRound,
        printerSettings.terminalName || "Billing 1",
        forceReprint
      );

      if (printResult.success && printResult.outcome === "CONFIRMED") {
        setPrintSuccessNotice(
          `KOT Ticket #${printResult.kotId} for Order #${target.orderNumber} successfully transmitted to kitchen printer (TCP delivered). Kitchen notified.`
        );
        fetchTableData();
      } else if (printResult.outcome === "RECONCILIATION_REQUIRED") {
        setReconciliationNotice({
          orderId: target.id,
          orderNumber: target.orderNumber,
          round: targetRound,
          kotId: printResult.kotId,
          message: printResult.message,
        });
        fetchTableData();
      } else if (printResult.outcome === "UNKNOWN") {
        setKotWarningMessage(
          "Print connection was interrupted during transmission. Please check with kitchen before resending to avoid duplicate tickets."
        );
        fetchTableData();
      } else {
        setKotWarningMessage(
          printResult.message ||
            "Kitchen printer is unavailable or disconnected. The KOT was not transmitted. The order is saved and can be delivered manually."
        );
        fetchTableData();
      }
    } catch (err: any) {
      setKotWarningMessage(
        err.message || "Failed to communicate with kitchen printer."
      );
    } finally {
      setIsSendingKot(false);
    }
  };

  // Handler: RECONCILE KOT DATABASE STATUS (WITHOUT REPRINTING)
  const handleReconcileOrder = async (orderId: string, round = 1) => {
    if (isReconciling) return;
    setIsReconciling(true);
    try {
      const res = await PrinterClient.reconcileKotStatus(
        orderId,
        round,
        printerSettings.terminalName || "Counter Admin"
      );
      if (res.success) {
        setReconciliationNotice(null);
        setPrintSuccessNotice(`Order status reconciled in database. Kitchen preparation confirmed.`);
        fetchTableData();
      } else {
        alert(`Failed to reconcile database state: ${res.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Reconciliation error: ${err.message || "Network error"}`);
    } finally {
      setIsReconciling(false);
    }
  };

  // Handler: MARK MANUALLY DELIVERED (Supports targeting specific order)
  const handleMarkManual = async (specificOrderId?: string) => {
    const target = specificOrderId
      ? orders.find((o) => o.id === specificOrderId) || order
      : order || orders[0];
    if (!target) return;
    try {
      await PrinterClient.recordManualHandoff(target.id, 1, "Admin Staff (Manual Paper)");
      setKotWarningMessage(null);
      setPrintSuccessNotice(`Order #${target.orderNumber} recorded as manually handed over to the kitchen.`);
      fetchTableData();
    } catch {
      alert("Failed to update status.");
    }
  };

  // Multi-order status computations
  const hasAnyPendingOrder = orders.some(
    (o) => o.status === "PENDING" && !(o.notes || "").includes("[KOT_CONFIRMED")
  );
  const isNewOrder = hasAnyPendingOrder || kotState.kotStatus === "NOT_SENT" || kotState.hasUnconfirmedAddons;
  const isKotConfirmed =
    !hasAnyPendingOrder &&
    (kotState.kotStatus === "PRINT_CONFIRMED" ||
      (orders.length > 0 &&
        orders.every(
          (o) =>
            (o.notes || "").includes("[KOT_CONFIRMED") ||
            o.status === "PREPARING" ||
            o.status === "READY" ||
            o.status === "COMPLETED"
        )));
  const isActionNeeded =
    !isNewOrder &&
    (kotState.kotStatus === "VIEWED" ||
      kotState.kotStatus === "FAILED" ||
      kotState.kotStatus === "UNKNOWN" ||
      kotState.manuallyDelivered);

  // Consolidated items across all orders in current active visit
  const allVisitItems = orders.flatMap((ord) =>
    ord.items.map((it) => ({
      ...it,
      orderNumber: ord.orderNumber,
      orderId: ord.id,
      isPending: ord.status === "PENDING" && !(ord.notes || "").includes("[KOT_CONFIRMED"),
    }))
  );

  const displayAcceptedSubtotal = billing ? billing.acceptedSubtotal : order?.subtotal || 0;
  const displayAcceptedTax = billing ? billing.acceptedTax : order?.tax || 0;
  const displayAcceptedPackaging = billing ? billing.acceptedPackaging : order?.packagingFee || 0;
  const displayAcceptedGrandTotal = billing ? billing.acceptedGrandTotal : order?.grandTotal || 0;
  const displayPendingValue = billing ? billing.pendingValue : 0;
  const displayTotalVisitValue = billing ? billing.totalVisitValue : order?.grandTotal || 0;

  // Order object passed to payment modal with authoritative total
  const combinedOrderForPayment: Order | null = order
    ? {
        ...order,
        grandTotal: displayAcceptedGrandTotal > 0 ? displayAcceptedGrandTotal : displayTotalVisitValue,
        subtotal: displayAcceptedSubtotal,
        tax: displayAcceptedTax,
      }
    : null;

  return (
    <AdminLayout>
      {/* Warm Beige Editorial Background (#F5F0E8) */}
      <div className="min-h-screen bg-[#F5F0E8] text-[#2C1710] p-4 sm:p-6 lg:p-8 space-y-6">
        {/* TOP COMMAND BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/tables"
              onClick={markExitedWithoutKot}
              className="p-2.5 rounded-2xl bg-white border border-black/10 text-zinc-700 hover:bg-zinc-100 transition-colors shadow-xs"
              title="Back to Floor Tables"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#2C1710]">
                  Table {tableId}
                </h1>
                {hasActiveOrder ? (
                  <span
                    className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                      isKotConfirmed
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : isNewOrder
                        ? "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isKotConfirmed
                          ? "bg-emerald-500"
                          : isNewOrder
                          ? "bg-red-500"
                          : "bg-amber-500"
                      }`}
                    />
                    {isKotConfirmed
                      ? "KOT SENT (GREEN)"
                      : isNewOrder
                      ? "NEW ORDER (RED)"
                      : "ACTION NEEDED (YELLOW)"}
                  </span>
                ) : isReserved ? (
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 bg-blue-100 text-blue-800 border border-blue-300">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    TEMPORARILY RESERVED (BLUE)
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[#52525b]">
                {hasActiveOrder && orders.length > 0
                  ? `${orders.length} ${orders.length === 1 ? "Order" : "Orders"} in Session • Latest: #${orders[0].orderNumber} (${new Date(orders[0].createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
                  : isReserved
                  ? `Reservation started ${reservation?.reservedAt ? new Date(reservation.reservedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"} • ${Math.floor((reservation?.remainingSeconds || 0) / 60)}m left • Order: Not Placed`
                  : "Floor Status: Ready & Available"}
              </p>
            </div>
          </div>

          {/* Top Right: Actions & Printer Status */}
          <div className="flex items-center gap-2">
            {hasActiveOrder && (
              <>
                <button
                  onClick={openManualTransferModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 shadow-xs transition-all cursor-pointer"
                  title="Counter Staff: Transfer active dining session to another table"
                >
                  <ArrowLeftRight size={14} className="text-amber-700" />
                  <span>Transfer Table</span>
                </button>

                <button
                  onClick={handlePrintTransferNoticeDirect}
                  disabled={isPrintingTransferNotice}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 shadow-xs transition-all cursor-pointer"
                  title="Print physical table transfer notice to kitchen"
                >
                  <Printer size={14} className={isPrintingTransferNotice ? "animate-pulse" : ""} />
                  <span>{isPrintingTransferNotice ? "Printing..." : "Transfer Slip"}</span>
                </button>
              </>
            )}

            {isReserved && (
              <button
                onClick={handleReleaseTable}
                disabled={isReleasing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 shadow-xs transition-all cursor-pointer"
                title="Admin override to release this reserved table immediately"
              >
                <RotateCcw size={14} className={isReleasing ? "animate-spin" : ""} />
                <span>Release Table</span>
              </button>
            )}

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
                  ? "Printer Ready"
                  : printer.status === "WARNING"
                  ? "Printer Warning"
                  : "Printer Disconnected"}
              </span>
            </button>

            <button
              onClick={fetchTableData}
              className="p-2.5 rounded-2xl bg-white border border-black/10 text-zinc-700 hover:bg-zinc-100 transition-colors shadow-xs"
              title="Refresh order"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-3 border-[#CA340A] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold text-zinc-600">Loading table orders...</p>
          </div>
        ) : !hasActiveOrder || !order ? (
          isReserved ? (
            /* Table Temporarily Reserved State (Blue) */
            <div className="bg-white rounded-3xl p-8 sm:p-10 text-center border-2 border-blue-200 shadow-[0_15px_35px_rgba(59,130,246,0.06)] max-w-lg mx-auto space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                <Clock size={32} />
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-extrabold uppercase tracking-wider mb-2 border border-blue-200">
                  10-Minute Lock Active
                </span>
                <h3 className="font-heading font-extrabold text-2xl text-[#2C1710]">
                  Table {tableId}
                </h3>
                <p className="text-xs text-[#52525b] mt-1 font-medium">
                  Status: <span className="font-bold text-blue-700">Temporarily Reserved</span>
                </p>
              </div>

              <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100 text-left space-y-2.5 text-xs text-zinc-700">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">Reservation Started:</span>
                  <span className="font-bold">
                    {reservation?.reservedAt
                      ? new Date(reservation.reservedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">Remaining Time:</span>
                  <span className="font-mono font-extrabold text-blue-700 text-sm">
                    {reservation?.remainingSeconds !== undefined
                      ? `${Math.floor(reservation.remainingSeconds / 60)}m ${reservation.remainingSeconds % 60}s`
                      : "10:00"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">Order Placed:</span>
                  <span className="font-bold text-amber-700">No (Browsing Menu)</span>
                </div>
                {reservation?.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-medium">Customer Phone:</span>
                    <span className="font-mono font-bold">+91 ******{reservation.customerPhone.slice(-4)}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={handleReleaseTable}
                  disabled={isReleasing}
                  className="px-5 py-2.5 rounded-2xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-md shadow-red-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw size={14} className={isReleasing ? "animate-spin" : ""} />
                  <span>Release Table</span>
                </button>

                <Link
                  href="/admin/tables"
                  className="px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all"
                >
                  Floor Overview
                </Link>
              </div>
            </div>
          ) : (
            /* Table Empty State (White) */
            <div className="bg-white rounded-3xl p-12 text-center border border-black/5 shadow-[0_15px_35px_rgba(0,0,0,0.03)] max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-500">
                <UtensilsCrossed size={32} />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-xl text-[#2C1710]">
                  Table {tableId} is Available
                </h3>
                <p className="text-xs text-[#52525b] mt-1">
                  No active orders are currently placed for this table. When a customer scans the
                  QR code and places an order, this card will turn RED.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/admin/tables"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-[#CA340A] text-white text-xs font-bold hover:bg-[#B73F1D] shadow-md transition-all"
                >
                  Back to Floor Overview
                </Link>
              </div>
            </div>
          )
        ) : (
          /* TWO-PANEL ORDER DETAILS & KOT BILLING SPLIT LAYOUT */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT PANEL — ORDERED ITEMS & IMAGES (60% / 7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* RENDER ALL ORDERS IN SESSION — NEWEST AT THE TOP */}
              {orders.map((ord, oIdx) => {
                const isOrderPending =
                  ord.status === "PENDING" && !(ord.notes || "").includes("[KOT_CONFIRMED");
                const isLatest = oIdx === 0;

                return (
                  <div
                    key={ord.id}
                    className={`bg-white rounded-3xl p-6 border shadow-[0_15px_35px_rgba(0,0,0,0.03)] space-y-5 transition-all ${
                      isOrderPending
                        ? "border-2 border-red-300 ring-2 ring-red-100"
                        : "border-black/5"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 pb-4 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                              isOrderPending
                                ? "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOrderPending ? "bg-red-600" : "bg-emerald-600"
                              }`}
                            />
                            {isOrderPending ? "NEW ORDER (PENDING KOT)" : "KOT SENT & COOKING"}
                          </span>
                          {isLatest && orders.length > 1 && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                              NEWEST
                            </span>
                          )}
                        </div>
                        <h2 className="font-heading font-extrabold text-lg text-[#2C1710] mt-1">
                          Order #{ord.orderNumber}
                        </h2>
                        <p className="text-xs text-[#52525b]">
                          Placed{" "}
                          {new Date(ord.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {ord.customerPhone ? ` • Phone: ${ord.customerPhone}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-zinc-100 text-zinc-700">
                          {ord.items.reduce((acc, it) => acc + (it.quantity || 1), 0)} Items
                        </span>
                        <span className="text-sm font-heading font-extrabold text-[#CA340A]">
                          ₹{ord.grandTotal}
                        </span>
                      </div>
                    </div>

                    {/* Items in this specific order */}
                    <div className="space-y-3.5">
                      {ord.items.map((item, idx) => {
                        const cleanNote = (item.notes || "").replace(/\[[^\]]+\]/g, "").trim();
                        return (
                          <div
                            key={item.id || idx}
                            className="p-3.5 rounded-2xl bg-[#FFF9F5] border border-[#CA340A]/10 flex items-center justify-between gap-4 transition-all hover:border-[#CA340A]/30"
                          >
                            <div className="flex items-center gap-3.5">
                              {/* Item Thumbnail Image */}
                              <div className="relative w-16 h-16 rounded-2xl bg-zinc-200 overflow-hidden shrink-0 shadow-xs">
                                {item.image ? (
                                  <Image
                                    src={item.image}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="64px"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-100">
                                    <UtensilsCrossed size={20} />
                                  </div>
                                )}
                              </div>

                              {/* Details */}
                              <div>
                                <h4 className="font-heading font-extrabold text-sm text-[#2C1710]">
                                  {item.name}
                                </h4>

                                <p className="text-xs font-bold text-[#52525b] mt-0.5">
                                  Quantity:{" "}
                                  <span className="text-[#CA340A] font-extrabold text-sm">
                                    {item.quantity}
                                  </span>
                                </p>

                                {cleanNote && (
                                  <p className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg inline-block mt-1 border border-amber-200">
                                    + {cleanNote}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Price Breakdown */}
                            <div className="text-right shrink-0">
                              <span className="text-xs text-zinc-500 font-semibold block">
                                ₹{item.price} each
                              </span>
                              <span className="text-sm font-heading font-extrabold text-[#2C1710]">
                                ₹{item.lineTotal || item.price * (item.quantity || 1)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Dedicated Order Action Footer */}
                    <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      {reconciliationNotice?.orderId === ord.id ? (
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => handleReconcileOrder(ord.id, reconciliationNotice.round)}
                            disabled={isReconciling}
                            className="py-2.5 px-4 rounded-2xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-md shadow-sky-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            <span>Confirm in DB (Do Not Reprint)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendKot(ord.id, true)}
                            disabled={isSendingKot}
                            className="py-2 px-3 rounded-xl border border-sky-300 text-sky-800 font-bold text-xs hover:bg-sky-50 transition-colors"
                          >
                            Force Reprint
                          </button>
                        </div>
                      ) : isOrderPending ? (
                        <>
                          <button
                            onClick={() => handleSendKot(ord.id)}
                            disabled={isSendingKot}
                            className="py-2.5 px-5 rounded-2xl bg-[#CA340A] text-white font-bold text-xs hover:bg-[#B73F1D] shadow-md shadow-[#CA340A]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isSendingKot ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Printing KOT...</span>
                              </>
                            ) : (
                              <>
                                <Send size={14} />
                                <span>SEND KOT FOR ORDER #{ord.orderNumber}</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleMarkManual(ord.id)}
                            className="py-2 px-3 rounded-xl border border-zinc-300 text-zinc-700 font-bold text-xs hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <HandHelping size={13} />
                            <span>Deliver on Paper</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>KOT SENT 🔒 (Locked against duplicate print)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Physical Receipt Slip Preview (Format matching Image 4) */}
              {plainSlip && (
                <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.02)] space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="font-bold flex items-center gap-1.5">
                      <FileText size={14} /> 80mm ESC/POS Thermal Slip Format
                    </span>
                    <span className="text-[10px] font-mono bg-zinc-100 px-2 py-0.5 rounded-md">
                      CN811-UEWB
                    </span>
                  </div>
                  <pre className="p-4 bg-zinc-900 text-emerald-400 rounded-2xl text-[11px] font-mono leading-relaxed overflow-x-auto select-all">
                    {plainSlip}
                  </pre>
                </div>
              )}

              {/* Back to Floor Link */}
              <div className="pt-2">
                <Link
                  href="/admin/tables"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#CA340A] hover:underline"
                >
                  <ArrowLeft size={14} /> Back to Table Grid
                </Link>
              </div>
            </div>

            {/* RIGHT PANEL — ORDER SUMMARY, KOT & SETTLEMENT (40% / 5 cols) */}
            <div className="lg:col-span-5 space-y-5 sticky top-24">
              <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-[0_15px_35px_rgba(0,0,0,0.03)] space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-[#2C1710]">
                      Order Summary & Billing
                    </h3>
                    <p className="text-xs text-[#52525b]">
                      Table {tableId} • {orders.length} {orders.length === 1 ? "Order" : "Orders"}
                    </p>
                  </div>
                  <button
                    onClick={() => setPrinterModalOpen(true)}
                    className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
                    title="Configure Printer"
                  >
                    <Printer size={16} />
                  </button>
                </div>

                {/* Items Summary Table Across All Orders in Session */}
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 text-[10px] font-extrabold uppercase text-zinc-500">
                        <th className="py-2">Item</th>
                        <th className="py-2 text-center">Qty</th>
                        <th className="py-2 text-right">Price</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {allVisitItems.map((it, i) => (
                        <tr
                          key={i}
                          className={`font-semibold ${
                            it.isPending ? "text-amber-900 bg-amber-50/40" : "text-zinc-800"
                          }`}
                        >
                          <td className="py-2 pr-2 max-w-[130px] truncate">
                            <span>{it.name}</span>
                            {it.isPending && (
                              <span className="block text-[9px] font-bold text-amber-700 uppercase">
                                Pending Approval
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-center font-bold">{it.quantity}</td>
                          <td className="py-2 text-right text-zinc-600">₹{it.price}</td>
                          <td className="py-2 text-right font-extrabold text-[#2C1710]">
                            ₹{it.lineTotal || it.price * (it.quantity || 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Calculation Totals */}
                <div className="space-y-2 pt-3 border-t border-zinc-100 text-xs">
                  {displayPendingValue > 0 && (
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1 mb-2">
                      <div className="flex justify-between font-bold text-amber-900">
                        <span>Pending Order Value</span>
                        <span>+₹{displayPendingValue}</span>
                      </div>
                      <p className="text-[10px] text-amber-700">
                        Awaiting counter KOT approval. It will be added to the accepted total once KOT is sent.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between text-zinc-600">
                    <span>
                      Accepted Subtotal ({billing?.acceptedOrdersCount || 0}{" "}
                      {billing?.acceptedOrdersCount === 1 ? "order" : "orders"})
                    </span>
                    <span className="font-bold text-zinc-800">₹{displayAcceptedSubtotal}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>GST Tax (5%)</span>
                    <span className="font-bold text-zinc-800">₹{displayAcceptedTax}</span>
                  </div>
                  {displayAcceptedPackaging > 0 && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Packaging</span>
                      <span className="font-bold text-zinc-800">₹{displayAcceptedPackaging}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-200 text-base">
                    <div>
                      <span className="font-heading font-extrabold text-[#2C1710] block">
                        Grand Total
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        {displayAcceptedGrandTotal > 0
                          ? "All accepted orders combined"
                          : "Pending KOT approval"}
                      </span>
                    </div>
                    <span className="font-heading font-extrabold text-2xl text-[#CA340A]">
                      ₹{displayAcceptedGrandTotal > 0 ? displayAcceptedGrandTotal : displayPendingValue}
                    </span>
                  </div>
                </div>

                {/* Success Banner */}
                {printSuccessNotice && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 border border-emerald-200">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <span>{printSuccessNotice}</span>
                  </div>
                )}

                {/* Reconciliation Notice Banner (TCP delivery verified, DB state needs sync) */}
                {reconciliationNotice && (
                  <div className="p-4 bg-sky-50 text-sky-950 rounded-2xl text-xs space-y-2 border border-sky-300 shadow-xs">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={17} className="text-sky-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sky-950">
                          ℹ Print Delivered — Database Sync Required
                        </p>
                        <p className="text-[11px] text-sky-800 mt-0.5">
                          {reconciliationNotice.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleReconcileOrder(
                            reconciliationNotice.orderId,
                            reconciliationNotice.round
                          )
                        }
                        disabled={isReconciling}
                        className="flex-1 py-1.5 px-3 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                      >
                        {isReconciling ? "Syncing..." : "Confirm In Database (Do Not Reprint)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendKot(reconciliationNotice.orderId, true)}
                        disabled={isSendingKot}
                        className="py-1.5 px-3 bg-white border border-sky-300 hover:bg-sky-100 text-sky-900 rounded-xl text-xs font-bold transition-all"
                      >
                        Force Reprint KOT
                      </button>
                    </div>
                  </div>
                )}

                {/* Warning / Disconnection Banner */}
                {kotWarningMessage && (
                  <div className="p-4 bg-amber-50 text-amber-900 rounded-2xl text-xs space-y-2 border border-amber-300 shadow-xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-950">
                          ⚠ Kitchen Printer Notice
                        </p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          {kotWarningMessage}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSendKot()}
                        disabled={isSendingKot}
                        className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        {isSendingKot ? "Retrying..." : "Resend KOT"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkManual()}
                        className="flex-1 py-1.5 px-3 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition-all"
                      >
                        Mark Manually Sent
                      </button>
                    </div>
                  </div>
                )}

                {/* BILL PRINT DIRECT NOTICE */}
                {billPrintDirectNotice && (
                  <div className="p-3 bg-stone-100 text-stone-900 rounded-2xl text-xs flex items-center gap-2 border border-stone-200">
                    <Receipt size={15} className="shrink-0 text-[#CA340A]" />
                    <span>{billPrintDirectNotice}</span>
                  </div>
                )}

                {/* COUNTER BILL PRINT BUTTON */}
                <div className="pt-4 border-t border-zinc-200 space-y-2">
                  <button
                    type="button"
                    onClick={handlePrintCounterBill}
                    disabled={isPrintingBillDirect}
                    className="w-full py-3 px-4 rounded-2xl bg-[#3A1710] hover:bg-[#2C1710] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60"
                  >
                    <Printer size={16} className={isPrintingBillDirect ? "animate-spin text-[#CA340A]" : "text-amber-400"} />
                    <span>{isPrintingBillDirect ? "Printing Bill..." : "PRINT BILL (58MM COUNTER)"}</span>
                  </button>

                  <button
                    onClick={() => setPaymentModalOpen(true)}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#15803D] text-white font-bold text-xs hover:bg-[#166534] shadow-md shadow-[#15803D]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Banknote size={17} />
                    <span>RECEIVE PAYMENT (CASH / ONLINE)</span>
                  </button>
                  <p className="text-[11px] text-zinc-500 text-center mt-1">
                    Settles all orders for Table {tableId} and returns table to Available.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PrinterStatusModal
        isOpen={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        connectionState={printer}
        onRefreshStatus={() => {
          printer.refresh();
        }}
      />

      <ReceivePaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        order={combinedOrderForPayment}
        onSuccess={() => {
          // Once payment is confirmed, table returns to WHITE, redirect to table grid
          router.push("/admin/tables");
        }}
      />

      {/* Manual Staff Transfer Modal */}
      {manualTransferModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFF8F3] rounded-3xl p-6 border border-[#EBDAD0] shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#EBDAD0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                  <ArrowLeftRight size={16} />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-[#4A2117]">
                    Transfer Table {tableId}
                  </h3>
                  <p className="text-[11px] text-[#8C5E51]">
                    Move dining session &amp; orders to an available table
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManualTransferModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#EBDAD0]/60 hover:bg-[#EBDAD0] text-[#4A2117] flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-[#EBDAD0] space-y-1 text-xs">
              <div className="flex justify-between text-[#8C5E51]">
                <span>Active Orders:</span>
                <span className="font-bold text-[#4A2117]">{orders.length} order(s)</span>
              </div>
              <div className="flex justify-between text-[#8C5E51]">
                <span>Current Grand Total:</span>
                <span className="font-bold text-[#B73F1D]">₹{displayTotalVisitValue}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#4A2117] block">
                Destination Table (Available Floor Tables):
              </label>
              {availableFloors.length === 0 ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  No other tables are currently available (White).
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                  {availableFloors.map((floorNum) => (
                    <button
                      key={floorNum}
                      type="button"
                      onClick={() => setTargetFloorTable(floorNum)}
                      className={`p-2.5 rounded-xl border text-xs font-heading font-extrabold transition-all cursor-pointer ${
                        targetFloorTable === floorNum
                          ? "bg-[#CA340A] text-white border-[#CA340A] shadow-xs ring-2 ring-[#CA340A]/30"
                          : "bg-white text-[#4A2117] border-[#EBDAD0] hover:border-[#CA340A]"
                      }`}
                    >
                      {floorNum}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                disabled={transferring || !targetFloorTable || availableFloors.length === 0}
                onClick={handleExecuteManualTransfer}
                className="w-full py-3 bg-[#CA340A] hover:bg-[#B73F1D] text-white font-heading font-extrabold text-xs rounded-xl shadow-md disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {transferring ? (
                  <span>Transferring...</span>
                ) : (
                  <span>Confirm Move: Table {tableId} → Table {targetFloorTable}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setManualTransferModalOpen(false)}
                className="w-full py-2 bg-white text-[#8C5E51] text-xs font-bold rounded-xl border border-[#EBDAD0] hover:bg-[#FFF8F3] cursor-pointer"
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

