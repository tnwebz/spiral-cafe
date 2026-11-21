"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AdminLayout from "@/components/Admin/AdminLayout";
import PrinterStatusModal from "@/components/Admin/PrinterStatusModal";
import ReceivePaymentModal from "@/components/Admin/ReceivePaymentModal";
import { Order, OrderItem } from "@/lib/db";
import { KotData, KotReceiptEngine, buildKotData } from "@/lib/kot";
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
  ChevronDown,
  Trash2,
  Plus,
  Minus,
  Loader2,
  Info,
  X,
  ShoppingBag,
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

  const isPrivateOrder = orders.some(
    (o) =>
      o.orderType === "PRIVATE" ||
      (o.notes || "").includes("[ORDER_TYPE:PRIVATE]") ||
      (o.orderNumber || "").startsWith("PRV-")
  );
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
  const [sendingKotOrderId, setSendingKotOrderId] = useState<string | null>(null);
  const [markingManualOrderId, setMarkingManualOrderId] = useState<string | null>(null);
  const [printingCounterKotOrderId, setPrintingCounterKotOrderId] = useState<string | null>(null);
  const [openManageKotOrderId, setOpenManageKotOrderId] = useState<string | null>(null);
  const [orderNotices, setOrderNotices] = useState<
    Record<
      string,
      | { type: "SUCCESS"; message: string }
      | { type: "WARNING"; message: string }
      | { type: "RECONCILE"; round: number; kotId: string; message: string }
    >
  >({});
  const [expandedSlipOrderId, setExpandedSlipOrderId] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // Modals
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [manualTransferModalOpen, setManualTransferModalOpen] = useState(false);
  const [availableFloors, setAvailableFloors] = useState<string[]>([]);
  const [targetFloorTable, setTargetFloorTable] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isPrintingTransferNotice, setIsPrintingTransferNotice] = useState(false);
  const [transferNoticeResult, setTransferNoticeResult] = useState<string | null>(null);

  // Direct Counter Bill Print
  const [isPrintingBillDirect, setIsPrintingBillDirect] = useState(false);
  const [billPrintDirectNotice, setBillPrintDirectNotice] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const bannerTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const showNotification = useCallback((type: "success" | "error" | "info", message: string) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setActionBanner({ type, message });
    bannerTimerRef.current = setTimeout(() => {
      setActionBanner(null);
    }, 3800);
  }, []);

  const openManualTransferModal = async () => {
    setTransferError(null);
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
    setTransferError(null);
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
        // Automatically dispatch kitchen table transfer notice if orders exist
        if (orders.length > 0) {
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
        }

        router.push(`/admin/tables/${targetFloorTable}`);
      } else {
        const errorMsg = d.error || "Failed to transfer table.";
        setTransferError(errorMsg);
        setActionBanner({ type: "error", message: errorMsg });
      }
    } catch (err: any) {
      const errorMsg = err.message || "Failed to transfer table.";
      setTransferError(errorMsg);
      setActionBanner({ type: "error", message: errorMsg });
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

  // Handler: Update Item Quantity in Active Order
  const handleUpdateItemQty = async (orderId: string, item: OrderItem, newQty: number) => {
    if (newQty <= 0) {
      return handleDeleteOrderItem(orderId, item);
    }
    const itemKey = item.id || item.name;
    setUpdatingItemId(itemKey);

    // Optimistic UI update
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const newItems = ord.items.map((it) => {
          if ((item.id && it.id === item.id) || it.name === item.name) {
            return { ...it, quantity: newQty, lineTotal: it.price * newQty };
          }
          return it;
        });
        const newSubtotal = newItems.reduce((acc, it) => acc + (it.lineTotal || it.price * it.quantity), 0);
        const newTax = Math.round(newSubtotal * 0.05);
        return {
          ...ord,
          items: newItems,
          subtotal: newSubtotal,
          tax: newTax,
          grandTotal: newSubtotal + newTax + (ord.packagingFee || 0) + (ord.serviceCharge || 0),
        };
      })
    );

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, itemName: item.name, quantity: newQty }),
      });
      const data = await res.json();
      if (!data.success) {
        setActionBanner({ type: "error", message: data.error || "Failed to update item quantity." });
      }
      await fetchTableData();
    } catch (err: any) {
      setActionBanner({ type: "error", message: err.message || "Failed to update item quantity." });
      await fetchTableData();
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Handler: Delete Entire Product from Order
  const handleDeleteOrderItem = async (orderId: string, item: OrderItem) => {
    const itemKey = item.id || item.name;
    setUpdatingItemId(itemKey);

    // Optimistic UI update
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const newItems = ord.items.filter((it) => (item.id ? it.id !== item.id : it.name !== item.name));
        const newSubtotal = newItems.reduce((acc, it) => acc + (it.lineTotal || it.price * it.quantity), 0);
        const newTax = Math.round(newSubtotal * 0.05);
        return {
          ...ord,
          items: newItems,
          subtotal: newSubtotal,
          tax: newTax,
          grandTotal: newSubtotal + newTax + (ord.packagingFee || 0) + (ord.serviceCharge || 0),
          status: newItems.length === 0 ? "CANCELLED" : ord.status,
        };
      })
    );

    // Immediate professional in-app feedback (no browser popup)
    showNotification("success", `"${item.name}" removed from order.`);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, itemName: item.name }),
      });
      const data = await res.json();
      if (!data.success) {
        showNotification("error", data.error || "Failed to delete item.");
      }
      await fetchTableData();
    } catch (err: any) {
      showNotification("error", err.message || "Failed to delete item.");
      await fetchTableData();
    } finally {
      setUpdatingItemId(null);
    }
  };

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
        setActionBanner({ type: "error", message: d.error || "Failed to release table." });
      }
    } catch (err: any) {
      setActionBanner({ type: "error", message: err.message || "Failed to release table." });
    } finally {
      setIsReleasing(false);
    }
  };

  // When admin returns to floor grid, check if any pending orders were left without sending KOT
  const handleBackToGrid = useCallback(() => {
    const hasUnsentOrders = orders.some(
      (o) =>
        o.status === "PENDING" &&
        !(o.notes || "").includes("[KOT_CONFIRMED") &&
        !(o.notes || "").includes("[KOT_MANUALLY_DELIVERED]")
    );
    if (hasUnsentOrders) {
      fetch(`/api/tables/${encodeURIComponent(tableId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitedWithoutKot: true }),
        keepalive: true,
      }).catch(() => {});
    }
  }, [orders, tableId]);

  useEffect(() => {
    return () => {
      handleBackToGrid();
    };
  }, [handleBackToGrid]);

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

  // Handler: SEND KOT TO CN811-UEWB VIA DIRECT TCP PRINT CONNECTOR (Order-Isolated)
  const handleSendKot = async (specificOrderId: string, forceReprint = false) => {
    if (!specificOrderId || sendingKotOrderId) return;
    const target = orders.find((o) => o.id === specificOrderId);
    if (!target) return;

    setSendingKotOrderId(target.id);
    setOrderNotices((prev) => {
      const copy = { ...prev };
      delete copy[target.id];
      return copy;
    });

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
        setOrderNotices((prev) => ({
          ...prev,
          [target.id]: {
            type: "SUCCESS",
            message: `KOT Ticket #${printResult.kotId} for Order #${target.orderNumber} successfully transmitted to kitchen printer (TCP delivered). Kitchen notified.`,
          },
        }));
        await fetchTableData();
      } else if (printResult.outcome === "RECONCILIATION_REQUIRED") {
        setOrderNotices((prev) => ({
          ...prev,
          [target.id]: {
            type: "RECONCILE",
            round: targetRound,
            kotId: printResult.kotId,
            message: printResult.message,
          },
        }));
        await fetchTableData();
      } else if (printResult.outcome === "UNKNOWN") {
        setOrderNotices((prev) => ({
          ...prev,
          [target.id]: {
            type: "WARNING",
            message:
              "Print connection was interrupted during transmission. Please check with kitchen before resending to avoid duplicate tickets.",
          },
        }));
        await fetchTableData();
      } else {
        setOrderNotices((prev) => ({
          ...prev,
          [target.id]: {
            type: "WARNING",
            message:
              printResult.message ||
              "Kitchen printer is unavailable or disconnected. The KOT was not transmitted. Order is saved and can be delivered manually.",
          },
        }));
        await fetchTableData();
      }
    } catch (err: any) {
      setOrderNotices((prev) => ({
        ...prev,
        [target.id]: {
          type: "WARNING",
          message: err.message || "Failed to communicate with kitchen printer.",
        },
      }));
    } finally {
      setSendingKotOrderId(null);
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
        setOrderNotices((prev) => ({
          ...prev,
          [orderId]: {
            type: "SUCCESS",
            message: "Order status reconciled in database. Kitchen preparation confirmed.",
          },
        }));
        await fetchTableData();
      } else {
        setActionBanner({ type: "error", message: `Failed to reconcile database state: ${res.error || "Unknown error"}` });
      }
    } catch (err: any) {
      setActionBanner({ type: "error", message: `Reconciliation error: ${err.message || "Network error"}` });
    } finally {
      setIsReconciling(false);
    }
  };

  // Handler: MARK MANUALLY DELIVERED (Supports targeting specific order)
  const handleMarkManual = async (specificOrderId: string) => {
    if (!specificOrderId || markingManualOrderId) return;
    const target = orders.find((o) => o.id === specificOrderId);
    if (!target) return;

    setMarkingManualOrderId(target.id);
    try {
      await PrinterClient.recordManualHandoff(target.id, 1, "Admin Staff (Manual Paper)");
      setOrderNotices((prev) => ({
        ...prev,
        [target.id]: {
          type: "SUCCESS",
          message: `Order #${target.orderNumber} recorded as manually handed over to the kitchen.`,
        },
      }));
      await fetchTableData();
    } catch {
      setActionBanner({ type: "error", message: "Failed to update manual delivery status." });
    } finally {
      setMarkingManualOrderId(null);
    }
  };

  // Handler: PRINT KOT AT COUNTER (58mm Emergency USB print during power cuts/offline kitchen)
  const handlePrintCounterKot = async (specificOrderId: string) => {
    if (!specificOrderId || printingCounterKotOrderId) return;
    const target = orders.find((o) => o.id === specificOrderId);
    if (!target) return;

    setPrintingCounterKotOrderId(target.id);
    try {
      const kotData = buildKotData(target, (target as any).round || 1);
      const res = await PrinterClient.printKotAtCounter(kotData);
      if (res.success) {
        await PrinterClient.recordManualHandoff(target.id, (target as any).round || 1, "Counter USB Emergency KOT");
        setOrderNotices((prev) => ({
          ...prev,
          [target.id]: {
            type: "SUCCESS",
            message: `Emergency KOT printed on Counter USB printer! Order #${target.orderNumber} dispatched.`,
          },
        }));
        await fetchTableData();
      } else {
        setActionBanner({ type: "error", message: `Counter KOT Print Failed: ${res.message}` });
      }
    } catch (err: any) {
      setActionBanner({ type: "error", message: `Error printing counter KOT: ${err.message || "Unknown error"}` });
    } finally {
      setPrintingCounterKotOrderId(null);
      setOpenManageKotOrderId(null);
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
              onClick={handleBackToGrid}
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
            {(hasActiveOrder || isReserved) && (
              <button
                onClick={openManualTransferModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 shadow-xs transition-all cursor-pointer"
                title="Counter Staff: Transfer active dining session or seat reservation to another table"
              >
                <ArrowLeftRight size={14} className="text-amber-700" />
                <span>Transfer Table</span>
              </button>
            )}

            {hasActiveOrder && (
              <button
                onClick={handlePrintTransferNoticeDirect}
                disabled={isPrintingTransferNotice}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 shadow-xs transition-all cursor-pointer"
                title="Print physical table transfer notice to kitchen"
              >
                <Printer size={14} className={isPrintingTransferNotice ? "animate-pulse" : ""} />
                <span>{isPrintingTransferNotice ? "Printing..." : "Transfer Slip"}</span>
              </button>
            )}

            {(isReserved || isPrivateOrder) && (
              <button
                onClick={handleReleaseTable}
                disabled={isReleasing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 shadow-xs transition-all cursor-pointer"
                title="Release this table immediately"
              >
                <RotateCcw size={14} className={isReleasing ? "animate-spin" : ""} />
                <span>{isPrivateOrder ? "Free Table" : "Release Table"}</span>
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

        {/* Action Status Banner */}
        {actionBanner && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xs transition-all duration-200 animate-in fade-in slide-in-from-top-1 ${
              actionBanner.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : actionBanner.type === "error"
                ? "bg-red-50 border-red-300 text-red-800"
                : "bg-blue-50 border-blue-300 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {actionBanner.type === "success" && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
              {actionBanner.type === "error" && <AlertTriangle size={16} className="text-red-600 shrink-0" />}
              {actionBanner.type === "info" && <Info size={16} className="text-blue-600 shrink-0" />}
              <span>{actionBanner.message}</span>
            </div>
            <button
              onClick={() => setActionBanner(null)}
              className="text-zinc-400 hover:text-zinc-800 p-1 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}

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
                const isManuallyHandedOver = (ord.notes || "").includes("[KOT_MANUALLY_DELIVERED]");
                const isLatest = oIdx === 0;
                const notice = orderNotices[ord.id];
                const isSlipExpanded = expandedSlipOrderId === ord.id;
                const ordKotData = buildKotData(ord, 1, printerSettings.terminalName);
                const ordPlainSlip = KotReceiptEngine.formatPlainSlip(ordKotData);

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
                                : isManuallyHandedOver
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOrderPending
                                  ? "bg-red-600"
                                  : isManuallyHandedOver
                                  ? "bg-amber-600"
                                  : "bg-emerald-600"
                              }`}
                            />
                            {isOrderPending
                              ? "NEW ORDER (PENDING KOT)"
                              : isManuallyHandedOver
                              ? "PAPER HANDOFF (COOKING)"
                              : "KOT SENT & COOKING"}
                          </span>
                          {isLatest && orders.length > 1 && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                              NEWEST
                            </span>
                          )}
                          {((ord.notes || "").includes("[TAKEAWAY]") ||
                            (ord.notes || "").includes("[PARCEL]") ||
                            ord.tableNumber === "TAKEAWAY") && (
                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                              <ShoppingBag size={11} />
                              TAKE AWAY (PARCEL)
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
                        const isUpdatingThis = updatingItemId === (item.id || item.name);

                        return (
                          <div
                            key={item.id || idx}
                            className="p-3.5 rounded-2xl bg-[#FFF9F5] border border-[#CA340A]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all hover:border-[#CA340A]/30"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
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
                              <div className="min-w-0">
                                <h4 className="font-heading font-extrabold text-sm text-[#2C1710] truncate flex items-center gap-1.5">
                                  <span>{item.name}</span>
                                  {((ord.notes || "").includes("[TAKEAWAY]") ||
                                    (ord.notes || "").includes("[PARCEL]") ||
                                    ord.tableNumber === "TAKEAWAY" ||
                                    (item.notes || "").toLowerCase().includes("(parcel)")) && (
                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-md">
                                      (parcel)
                                    </span>
                                  )}
                                </h4>

                                <p className="text-xs font-bold text-[#52525b] mt-0.5">
                                  Price: <span className="text-[#2C1710]">₹{item.price} each</span>
                                </p>

                                {cleanNote && (
                                  <p className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg inline-block mt-1 border border-amber-200">
                                    + {cleanNote}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Quantity Adjuster, Total, and Delete Button */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                              {/* Stepper (- / qty / +) */}
                              <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-xl p-1 shadow-2xs">
                                <button
                                  type="button"
                                  disabled={isUpdatingThis}
                                  onClick={() => handleUpdateItemQty(ord.id, item, item.quantity - 1)}
                                  className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                                  title="Decrease quantity"
                                >
                                  <Minus size={13} />
                                </button>

                                <span className="font-heading font-extrabold text-xs text-[#CA340A] min-w-[24px] text-center px-1">
                                  {isUpdatingThis ? (
                                    <Loader2 size={12} className="animate-spin inline text-[#CA340A]" />
                                  ) : (
                                    item.quantity
                                  )}
                                </span>

                                <button
                                  type="button"
                                  disabled={isUpdatingThis}
                                  onClick={() => handleUpdateItemQty(ord.id, item, item.quantity + 1)}
                                  className="w-7 h-7 rounded-lg bg-[#CA340A] hover:bg-[#B73F1D] text-white flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                                  title="Increase quantity"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>

                              {/* Price Breakdown */}
                              <div className="text-right min-w-[65px]">
                                <span className="text-xs text-zinc-500 font-semibold block">
                                  Total
                                </span>
                                <span className="text-sm font-heading font-extrabold text-[#2C1710]">
                                  ₹{item.lineTotal || item.price * (item.quantity || 1)}
                                </span>
                              </div>

                              {/* Delete Whole Item Button */}
                              <button
                                type="button"
                                disabled={isUpdatingThis}
                                onClick={() => handleDeleteOrderItem(ord.id, item)}
                                className="p-2 rounded-xl text-red-500 hover:text-white hover:bg-red-600 bg-red-50 border border-red-200/60 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                title={`Remove ${item.name} from order`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 80mm ESC/POS Thermal Slip Preview Toggle for THIS ORDER */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSlipOrderId(isSlipExpanded ? null : ord.id)
                        }
                        className="text-[11px] font-bold text-zinc-600 hover:text-[#CA340A] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText size={13} />
                        <span>{isSlipExpanded ? "Hide Kitchen Ticket Preview" : "View 80mm Kitchen Slip Format"}</span>
                      </button>

                      {isSlipExpanded && (
                        <div className="mt-2.5 p-4 bg-zinc-950 text-emerald-400 rounded-2xl border border-emerald-950/60 shadow-inner">
                          <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-800 pb-2 mb-2 font-mono">
                            <span>80mm Thermal KOT Slip — #{ord.orderNumber}</span>
                            <span>CN811-UEWB</span>
                          </div>
                          <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre select-all">
                            {ordPlainSlip}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Order-Specific Notice Banners */}
                    {notice && notice.type === "SUCCESS" && (
                      <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 border border-emerald-200 shadow-xs">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        <span>{notice.message}</span>
                      </div>
                    )}

                    {notice && notice.type === "RECONCILE" && (
                      <div className="p-3.5 bg-sky-50 text-sky-950 rounded-2xl text-xs flex items-start gap-2 border border-sky-300 shadow-xs">
                        <CheckCircle2 size={16} className="text-sky-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sky-950">
                            ℹ Print Delivered — Database Sync Required
                          </p>
                          <p className="text-[11px] text-sky-800 mt-0.5">{notice.message}</p>
                        </div>
                      </div>
                    )}

                    {notice && notice.type === "WARNING" && (
                      <div className="p-3.5 bg-amber-50 text-amber-900 rounded-2xl text-xs flex items-start gap-2 border border-amber-300 shadow-xs">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-950">
                            ⚠ Kitchen Printer Notice
                          </p>
                          <p className="text-[11px] text-amber-800 mt-0.5">{notice.message}</p>
                        </div>
                      </div>
                    )}

                    {/* Dedicated Order Action Footer */}
                    <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      {notice && notice.type === "RECONCILE" ? (
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => handleReconcileOrder(ord.id, notice.round || 1)}
                            disabled={isReconciling}
                            className="py-2.5 px-4 rounded-2xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-md shadow-sky-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            <span>{isReconciling ? "Syncing..." : "Confirm in DB (Do Not Reprint)"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendKot(ord.id, true)}
                            disabled={sendingKotOrderId === ord.id}
                            className="py-2 px-3 rounded-xl border border-sky-300 text-sky-800 font-bold text-xs hover:bg-sky-50 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Force Reprint
                          </button>
                        </div>
                      ) : isOrderPending ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSendKot(ord.id)}
                            disabled={sendingKotOrderId === ord.id}
                            className="py-2.5 px-5 rounded-2xl bg-[#CA340A] text-white font-bold text-xs hover:bg-[#B73F1D] shadow-md shadow-[#CA340A]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                          >
                            {sendingKotOrderId === ord.id ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Printing KOT for #{ord.orderNumber}...</span>
                              </>
                            ) : notice && notice.type === "WARNING" ? (
                              <>
                                <RotateCcw size={14} />
                                <span>Resend KOT for #{ord.orderNumber}</span>
                              </>
                            ) : (
                              <>
                                <Send size={14} />
                                <span>SEND KOT FOR ORDER #{ord.orderNumber}</span>
                              </>
                            )}
                          </button>

                          {/* Manage KOT Dropdown (Deliver on Paper OR Print KOT at Counter) */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenManageKotOrderId(openManageKotOrderId === ord.id ? null : ord.id)}
                              disabled={markingManualOrderId === ord.id || sendingKotOrderId === ord.id || printingCounterKotOrderId === ord.id}
                              className="py-2.5 px-3.5 rounded-2xl border border-zinc-300 text-zinc-700 font-bold text-xs hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                              <HandHelping size={14} className={markingManualOrderId === ord.id || printingCounterKotOrderId === ord.id ? "animate-pulse" : ""} />
                              <span>Manage KOT</span>
                              <ChevronDown size={13} className={`transition-transform duration-200 ${openManageKotOrderId === ord.id ? "rotate-180" : ""}`} />
                            </button>

                            {openManageKotOrderId === ord.id && (
                              <div className="absolute right-0 bottom-full mb-1.5 w-64 bg-white rounded-2xl shadow-xl border border-zinc-200 z-50 p-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                  Power Cut / Offline KOT Options
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenManageKotOrderId(null);
                                    handleMarkManual(ord.id);
                                  }}
                                  disabled={markingManualOrderId === ord.id}
                                  className="w-full text-left p-2 hover:bg-zinc-50 rounded-xl flex items-center gap-2.5 text-zinc-800 cursor-pointer transition-colors"
                                >
                                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                    <HandHelping size={14} />
                                  </div>
                                  <div>
                                    <div className="font-bold text-xs">Deliver on Paper</div>
                                    <div className="text-[10px] text-zinc-500 font-normal">Handwritten chef acknowledgment</div>
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handlePrintCounterKot(ord.id);
                                  }}
                                  disabled={printingCounterKotOrderId === ord.id}
                                  className="w-full text-left p-2 hover:bg-orange-50/60 rounded-xl flex items-center gap-2.5 text-zinc-800 cursor-pointer transition-colors mt-1 border-t border-zinc-100 pt-1.5"
                                >
                                  <div className="w-7 h-7 rounded-lg bg-[#CA340A]/10 text-[#CA340A] flex items-center justify-center shrink-0">
                                    <Printer size={14} />
                                  </div>
                                  <div>
                                    <div className="font-bold text-xs text-[#CA340A]">
                                      {printingCounterKotOrderId === ord.id ? "Printing Counter Slip..." : "Print KOT at Counter"}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-normal">58mm emergency slip via USB printer</div>
                                  </div>
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span>
                              {isManuallyHandedOver
                                ? "HANDED OVER (Paper)"
                                : "KOT SENT 🔒 (Locked against duplicate print)"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSendKot(ord.id, true)}
                            disabled={sendingKotOrderId === ord.id}
                            className="py-1.5 px-3 rounded-xl border border-zinc-300 text-zinc-700 font-bold text-xs hover:bg-zinc-100 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <Printer size={13} />
                            <span>Reprint Ticket</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Back to Floor Link */}
              <div className="pt-2">
                <Link
                  href="/admin/tables"
                  onClick={handleBackToGrid}
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

                {/* BILL PRINT DIRECT NOTICE */}
                {billPrintDirectNotice && (
                  <div className="p-3 bg-stone-100 text-stone-900 rounded-2xl text-xs flex items-center gap-2 border border-stone-200">
                    <Receipt size={15} className="shrink-0 text-[#CA340A]" />
                    <span>{billPrintDirectNotice}</span>
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

                  {isPrivateOrder ? (
                    <div>
                      <button
                        onClick={handleReleaseTable}
                        disabled={isReleasing}
                        className="w-full py-3.5 px-4 rounded-2xl bg-[#3A1710] text-white font-bold text-xs hover:bg-[#2C1710] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 size={17} />
                        <span>COMPLETE & FREE TABLE {tableId}</span>
                      </button>
                      <p className="text-[11px] text-zinc-500 text-center mt-1">
                        Completes this internal/staff ticket and marks Table {tableId} available.
                      </p>
                    </div>
                  ) : (
                    <div>
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
                  )}
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
                <span>Session Status:</span>
                <span className="font-bold text-[#4A2117]">
                  {hasActiveOrder && orders.length > 0
                    ? `${orders.length} order(s) placed`
                    : isReserved
                    ? "Seat Reserved (Blue Stage)"
                    : "Active Session"}
                </span>
              </div>
              {hasActiveOrder && orders.length > 0 ? (
                <div className="flex justify-between text-[#8C5E51]">
                  <span>Current Grand Total:</span>
                  <span className="font-bold text-[#B73F1D]">₹{displayTotalVisitValue}</span>
                </div>
              ) : reservation?.customerPhone ? (
                <div className="flex justify-between text-[#8C5E51]">
                  <span>Customer Phone:</span>
                  <span className="font-bold text-[#4A2117]">{reservation.customerPhone}</span>
                </div>
              ) : null}
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

            {transferError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-bold flex items-center gap-2">
                <span className="text-sm shrink-0">⚠️</span>
                <span>{transferError}</span>
              </div>
            )}

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

