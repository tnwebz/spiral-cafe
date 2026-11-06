"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Order } from "@/lib/db";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface OrderSyncState {
  isOnline: boolean;
  realtimeStatus: "CONNECTED" | "CONNECTING" | "OFFLINE";
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  orders: Order[];
  newOrdersRetrieved: number;
  unprintedKotsCount: number;
  syncOrders: (isSilent?: boolean) => Promise<{ success: boolean; newCount: number }>;
  clearNewBadge: () => void;
}

// Synthetic chime using Web Audio API (zero external assets needed)
function playOrderChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Graceful fallback if user hasn't interacted or audio is blocked
  }
}

export function useOrderSync(pollIntervalMs = 10000): OrderSyncState {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [realtimeStatus, setRealtimeStatus] = useState<"CONNECTED" | "CONNECTING" | "OFFLINE">("CONNECTING");
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrdersRetrieved, setNewOrdersRetrieved] = useState(0);

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const inFlightRef = useRef(false);

  // Calculate unprinted KOTs (orders pending KOT confirmation or active unprinted rounds)
  const unprintedKotsCount = orders.filter((o) => {
    if (o.status === "CANCELLED" || o.paymentStatus === "PAID") return false;
    const notes = o.notes || "";
    // If order is PENDING, or doesn't have confirmed KOT round matching highest round
    const rounds = o.items.map((it) => {
      const match = (it.notes || "").match(/\[ROUND:(\d+)\]/);
      return match ? parseInt(match[1], 10) : it.round || 1;
    });
    const highestRound = rounds.length > 0 ? Math.max(...rounds) : 1;
    const confirmedMatch = notes.match(/\[KOT_CONFIRMED_ROUNDS:([0-9,]+)\]/);
    const confirmedRounds = confirmedMatch
      ? confirmedMatch[1].split(",").map(Number).filter((n) => !isNaN(n))
      : [];

    const isConfirmed = confirmedRounds.includes(highestRound) || o.status === "PREPARING" || o.status === "READY";
    const manuallyDelivered = notes.includes("[KOT_MANUALLY_DELIVERED]");
    return !isConfirmed && !manuallyDelivered;
  }).length;

  const syncOrders = useCallback(async (isSilent = false): Promise<{ success: boolean; newCount: number }> => {
    if (inFlightRef.current) {
      return { success: true, newCount: 0 };
    }
    inFlightRef.current = true;
    if (!isSilent) setIsSyncing(true);

    try {
      const res = await fetch("/api/orders", {
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        throw new Error(`Cloud DB HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !Array.isArray(data.orders)) {
        throw new Error(data.error || "Failed to parse orders response");
      }

      const fetchedOrders: Order[] = data.orders;
      let newlyDiscoveredCount = 0;

      if (initialLoadDoneRef.current) {
        // Detect newly discovered orders that were created while offline or disconnected
        for (const ord of fetchedOrders) {
          if (!knownOrderIdsRef.current.has(ord.id)) {
            newlyDiscoveredCount++;
          }
        }
      }

      // Update known IDs
      const nextIdSet = new Set<string>();
      fetchedOrders.forEach((o) => nextIdSet.add(o.id));
      knownOrderIdsRef.current = nextIdSet;

      // Update orders state
      setOrders(fetchedOrders);
      setLastSyncTime(new Date());
      setSyncError(null);

      if (newlyDiscoveredCount > 0) {
        setNewOrdersRetrieved((prev) => prev + newlyDiscoveredCount);
        playOrderChime();
      }

      initialLoadDoneRef.current = true;
      return { success: true, newCount: newlyDiscoveredCount };
    } catch (err: any) {
      const msg = err.message || "Failed to reach Cloud database";
      setSyncError(msg);
      return { success: false, newCount: 0 };
    } finally {
      inFlightRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  const clearNewBadge = useCallback(() => {
    setNewOrdersRetrieved(0);
  }, []);

  // 1. Online / Offline network listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Immediately reconcile with cloud when connectivity is restored
      syncOrders(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setRealtimeStatus("OFFLINE");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOrders]);

  // 2. Tab focus & visibility listeners (triggers sync when staff switches back to tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncOrders(true);
      }
    };

    const handleFocus = () => {
      syncOrders(true);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncOrders]);

  // 3. Periodic fallback poll (every 10s) to catch any missed WebSockets
  useEffect(() => {
    // Initial fetch on mount
    syncOrders(false);

    const interval = setInterval(() => {
      syncOrders(true);
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [syncOrders, pollIntervalMs]);

  // 4. Supabase Realtime channel subscription with reconnect listener
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("admin_order_sync_monitor")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          // On DB change, trigger fast authoritative fetch
          syncOrders(true);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("CONNECTED");
          // Reconnection complete: pull fresh state to backfill any dropped events
          syncOrders(true);
        } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
          setRealtimeStatus("OFFLINE");
        } else {
          setRealtimeStatus("CONNECTING");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncOrders]);

  return {
    isOnline,
    realtimeStatus,
    isSyncing,
    lastSyncTime,
    syncError,
    orders,
    newOrdersRetrieved,
    unprintedKotsCount,
    syncOrders,
    clearNewBadge,
  };
}

