"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useTableMotion } from "@/hooks/useTableMotion";
import { ActiveTableBanner } from "./ActiveTableBanner";
import { TableMotionAlert } from "./TableMotionAlert";
import { PostOrderConfirmModal } from "./PostOrderConfirmModal";
import { ReopeningTableConfirmModal } from "./ReopeningTableConfirmModal";
import { TableTransferModal } from "./TableTransferModal";

export default function CustomerSessionProtection() {
  const pathname = usePathname();
  const {
    tableNumber,
    setTableNumber,
    customerSessionId,
    placedOrders,
    activeTableOrder,
  } = useCart();

  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [showMotionAlert, setShowMotionAlert] = useState(false);
  const [showPostOrderModal, setShowPostOrderModal] = useState(false);
  const [showReopeningModal, setShowReopeningModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<{
    fromTable: string;
    toTable: string;
  } | null>(null);

  const prevOrdersCountRef = useRef<number>(0);
  const lastPlacedOrderIdRef = useRef<string | null>(null);

  // Read saved customer phone on mount & listen for transfer trigger events
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = localStorage.getItem("spiral_customer_phone") || "";
      setCustomerPhone(p);

      const handleOpenTransfer = () => {
        setShowTransferModal(true);
      };
      window.addEventListener("open-table-transfer", handleOpenTransfer);
      return () => {
        window.removeEventListener("open-table-transfer", handleOpenTransfer);
      };
    }
  }, []);

  const isAdminOrKitchen =
    pathname?.startsWith("/admin") || pathname?.startsWith("/kitchen");

  // Determine active dining state
  const hasActiveOrders = Boolean(
    activeTableOrder ||
      placedOrders.some(
        (o) => o.status !== "CANCELLED" && o.status !== "COMPLETED"
      )
  );

  const totalBill =
    placedOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0) ||
    activeTableOrder?.grandTotal ||
    0;

  // Poll pending transfer request status for this customer
  useEffect(() => {
    if (isAdminOrKitchen || !customerSessionId) return;

    let isMounted = true;
    const checkPendingTransfer = async () => {
      try {
        const res = await fetch(
          `/api/tables/transfer?sessionId=${encodeURIComponent(
            customerSessionId
          )}&phone=${encodeURIComponent(customerPhone)}`
        );
        const data = await res.json();
        if (isMounted && data.success) {
          if (data.pendingRequest && data.pendingRequest.status === "PENDING") {
            setPendingTransfer({
              fromTable: data.pendingRequest.fromTable,
              toTable: data.pendingRequest.toTable,
            });
          } else {
            setPendingTransfer(null);
            // If transfer was just approved to a new table, sync local table number!
            if (
              data.pendingRequest &&
              data.pendingRequest.status === "APPROVED" &&
              data.pendingRequest.toTable !== tableNumber
            ) {
              setTableNumber(data.pendingRequest.toTable);
              try {
                localStorage.setItem("spiral_table_session", data.pendingRequest.toTable);
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn("Transfer check warning:", err);
      }
    };

    checkPendingTransfer();
    const interval = setInterval(checkPendingTransfer, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdminOrKitchen, customerSessionId, customerPhone, tableNumber, setTableNumber]);

  // LAYER 1: Post-Order Placement Confirmation
  useEffect(() => {
    if (isAdminOrKitchen) return;

    // Detect when a new order is added
    if (placedOrders.length > prevOrdersCountRef.current) {
      const newestOrder = placedOrders[0];
      if (newestOrder && newestOrder.id !== lastPlacedOrderIdRef.current) {
        lastPlacedOrderIdRef.current = newestOrder.id;
        // Show Layer 1 confirmation
        setShowPostOrderModal(true);
      }
    }
    prevOrdersCountRef.current = placedOrders.length;
  }, [placedOrders, isAdminOrKitchen]);

  // LAYER 3: Reopening Website Confirmation
  useEffect(() => {
    if (isAdminOrKitchen) return;

    // Coordinate with returning customer session
    const isSplashDone =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem("spiral_cafe_splash") === "true";

    const hasConfirmedKey = `spiral_table_confirmed_${tableNumber}_${customerSessionId}`;
    const alreadyConfirmed =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(hasConfirmedKey) === "true";

    if (hasActiveOrders && !alreadyConfirmed && isSplashDone) {
      const timer = setTimeout(() => {
        setShowReopeningModal(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [hasActiveOrders, tableNumber, customerSessionId, isAdminOrKitchen]);

  // LAYER 2: Native Accelerometer Walking Detection
  const {
    motionStatus,
    userOptIn,
    toggleOptIn,
  } = useTableMotion({
    enabled: !isAdminOrKitchen,
    hasActiveOrders,
    tableNumber,
    onPromptWalkingDetected: () => {
      setShowMotionAlert(true);
    },
    maxAlertsPerVisit: 2,
  });

  if (isAdminOrKitchen) return null;

  const handleConfirmReopening = () => {
    setShowReopeningModal(false);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        `spiral_table_confirmed_${tableNumber}_${customerSessionId}`,
        "true"
      );
    }
  };

  return (
    <>
      {/* Top Banner on Menu pages */}
      {(pathname === "/menu" || pathname === "/") && (
        <ActiveTableBanner
          currentTable={tableNumber}
          hasActiveOrders={hasActiveOrders}
          pendingTransfer={pendingTransfer}
          motionEnabled={userOptIn}
          onToggleMotion={toggleOptIn}
          onRequestChangeTable={() => setShowTransferModal(true)}
        />
      )}

      {/* Layer 1: Post-Order Modal */}
      <PostOrderConfirmModal
        isOpen={showPostOrderModal}
        orderNumber={placedOrders[0]?.orderNumber}
        tableNumber={tableNumber}
        onContinue={() => setShowPostOrderModal(false)}
        onRequestTransfer={() => {
          setShowPostOrderModal(false);
          setShowTransferModal(true);
        }}
      />

      {/* Layer 2: Motion Walking Detection Alert */}
      <TableMotionAlert
        isOpen={showMotionAlert}
        currentTable={tableNumber}
        onDismiss={() => setShowMotionAlert(false)}
        onRequestTransfer={() => {
          setShowMotionAlert(false);
          setShowTransferModal(true);
        }}
      />

      {/* Layer 3: Reopening Returning Visit Confirmation */}
      <ReopeningTableConfirmModal
        isOpen={showReopeningModal}
        tableNumber={tableNumber}
        orderCount={placedOrders.length || 1}
        currentBill={totalBill}
        onConfirmStillHere={handleConfirmReopening}
        onRequestTransfer={() => {
          setShowReopeningModal(false);
          setShowTransferModal(true);
        }}
      />

      {/* Interactive Table Transfer Modal */}
      <TableTransferModal
        isOpen={showTransferModal}
        currentTable={tableNumber}
        customerSessionId={customerSessionId}
        customerPhone={customerPhone}
        onClose={() => setShowTransferModal(false)}
        onTransferSuccess={(newTable) => {
          setTableNumber(newTable);
          try {
            localStorage.setItem("spiral_table_session", newTable);
            sessionStorage.setItem(
              `spiral_table_confirmed_${newTable}_${customerSessionId}`,
              "true"
            );
          } catch {}
          setShowTransferModal(false);
        }}
      />
    </>
  );
}
