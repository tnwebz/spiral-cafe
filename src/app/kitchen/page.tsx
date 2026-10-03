"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Flame,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  RefreshCw,
  Lock,
  ChefHat,
  Check,
  Menu,
  RotateCcw,
  Utensils,
  Columns3,
  ListFilter,
  CheckCheck,
} from "lucide-react";
import { PlacedOrder } from "@/context/CartContext";
import { menuData } from "@/data/menu";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Play kitchen chime using Web Audio API (Zero external mp3 needed)
function playKitchenChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(783.99, now + 0.15);
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.7);
  } catch (e) {
    console.error("Audio playback error:", e);
  }
}

// Build category map lookup
const itemCategoryLookup: Record<string, string> = {};
menuData.forEach((cat) => {
  cat.items.forEach((it) => {
    itemCategoryLookup[it.id] = cat.name;
    itemCategoryLookup[it.name.toLowerCase().trim()] = cat.name;
  });
});

export default function KitchenDisplayPage() {
  const [pin, setPin] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");

  const [pendingOrders, setPendingOrders] = useState<PlacedOrder[]>([]);
  const [preparingOrders, setPreparingOrders] = useState<PlacedOrder[]>([]);
  const [readyOrders, setReadyOrders] = useState<PlacedOrder[]>([]);
  const [recentCompleted, setRecentCompleted] = useState<PlacedOrder[]>([]);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PENDING" | "COOKING" | "COMPLETED">("ALL");
  const [showRecentlyServed, setShowRecentlyServed] = useState<boolean>(false);

  // Track checked-off item IDs for assembly line cooks
  const [toggledItemKeys, setToggledItemKeys] = useState<Record<string, boolean>>({});

  const prevPendingIdsRef = useRef<Set<string>>(new Set());
  const realtimeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check saved session PIN
  useEffect(() => {
    try {
      const savedPin = sessionStorage.getItem("spiral_kitchen_pin");
      if (savedPin) {
        setPin(savedPin);
        setIsAuthenticated(true);
      }
    } catch {}
  }, []);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch kitchen orders
  const fetchKitchenOrders = useCallback(
    async (authPin: string) => {
      if (!authPin) return;
      try {
        const res = await fetch(`/api/kitchen/orders?pin=${authPin}`, {
          headers: { "x-kitchen-pin": authPin },
        });

        if (res.status === 401) {
          setIsAuthenticated(false);
          setAuthError("Unauthorized. Staff PIN session expired.");
          return;
        }

        const data = await res.json();
        if (data.success) {
          const newPending = (data.pending || []) as PlacedOrder[];
          const newPreparing = (data.preparing || []) as PlacedOrder[];
          const newReady = (data.ready || []) as PlacedOrder[];
          const newCompleted = (data.recentCompleted || []) as PlacedOrder[];

          // Audio notification check
          const currentPendingIds = new Set(newPending.map((o) => o.id));
          const hasNewIncoming = newPending.some(
            (o) => !prevPendingIdsRef.current.has(o.id)
          );

          if (hasNewIncoming && prevPendingIdsRef.current.size > 0 && soundEnabled) {
            playKitchenChime();
          }
          prevPendingIdsRef.current = currentPendingIds;

          setPendingOrders(newPending);
          setPreparingOrders(newPreparing);
          setReadyOrders(newReady);
          setRecentCompleted(newCompleted);
        }
      } catch (err) {
        console.error("Fetch kitchen error:", err);
      }
    },
    [soundEnabled]
  );

  // Supabase Realtime synchronization for kitchen orders
  useEffect(() => {
    if (!isAuthenticated || !pin) return;

    fetchKitchenOrders(pin);

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("kitchen_orders_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          if (payload.eventType === "INSERT" && soundEnabled) {
            playKitchenChime();
          }
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchKitchenOrders(pin);
          }, 150);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    const pollInterval = setInterval(() => {
      fetchKitchenOrders(pin);
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, pin, fetchKitchenOrders, soundEnabled]);

  // Action Dispatcher
  const handleKitchenAction = async (orderId: string, action: string) => {
    setActionLoading(`${orderId}-${action}`);

    // Optimistic UI updates for instant response
    if (action === "START_PREPARING") {
      const moved =
        pendingOrders.find((o) => o.id === orderId) ||
        readyOrders.find((o) => o.id === orderId) ||
        recentCompleted.find((o) => o.id === orderId);

      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
      setReadyOrders((prev) => prev.filter((o) => o.id !== orderId));
      setRecentCompleted((prev) => prev.filter((o) => o.id !== orderId));
      if (moved) {
        setPreparingOrders((prev) => [{ ...moved, status: "PREPARING" }, ...prev.filter((o) => o.id !== orderId)]);
      }
    } else if (action === "MARK_READY") {
      const moved = preparingOrders.find((o) => o.id === orderId);
      if (moved) {
        setPreparingOrders((prev) => prev.filter((o) => o.id !== orderId));
        setReadyOrders((prev) => [{ ...moved, status: "READY" }, ...prev.filter((o) => o.id !== orderId)]);
      }
    } else if (action === "COMPLETE_ORDER") {
      const moved = readyOrders.find((o) => o.id === orderId);
      setReadyOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (moved) {
        setRecentCompleted((prev) => [{ ...moved, status: "COMPLETED" }, ...prev.filter((o) => o.id !== orderId).slice(0, 19)]);
      }
    }

    try {
      const res = await fetch("/api/kitchen/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action, pin }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchKitchenOrders(pin);
      } else {
        alert(data.error || "Action failed.");
        await fetchKitchenOrders(pin);
      }
    } catch {
      alert("Network error.");
      await fetchKitchenOrders(pin);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === "1234") {
      setPin("1234");
      setIsAuthenticated(true);
      setAuthError("");
      try {
        sessionStorage.setItem("spiral_kitchen_pin", "1234");
      } catch {}
    } else {
      setAuthError("Incorrect PIN. Default staff PIN is 1234.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPin("");
    try {
      sessionStorage.removeItem("spiral_kitchen_pin");
    } catch {}
  };

  const toggleItemCheck = (itemKey: string) => {
    setToggledItemKeys((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

  const getElapsedTime = (isoString: string) => {
    const elapsedMinutes = Math.floor(
      (Date.now() - new Date(isoString).getTime()) / (1000 * 60)
    );
    if (elapsedMinutes < 1) return "<1m ago";
    return `${elapsedMinutes}m ago`;
  };

  const isUrgent = (isoString: string) => {
    const elapsedMinutes = (Date.now() - new Date(isoString).getTime()) / (1000 * 60);
    return elapsedMinutes >= 15;
  };

  // Compute Product Quantity Summary across active tickets (Pending + Preparing)
  const activeOrdersForSummary = [...pendingOrders, ...preparingOrders];
  const summaryMap: Record<string, { category: string; name: string; qty: number }> = {};

  activeOrdersForSummary.forEach((o) => {
    (o.items || []).forEach((it) => {
      const cat =
        itemCategoryLookup[it.productId] ||
        itemCategoryLookup[it.name?.toLowerCase().trim()] ||
        "SPECIALTY MENU";
      const key = `${cat}_${it.name}`;
      if (!summaryMap[key]) {
        summaryMap[key] = { category: cat.toUpperCase(), name: it.name, qty: 0 };
      }
      summaryMap[key].qty += it.quantity || 1;
    });
  });

  const summaryGrouped: Record<string, Array<{ name: string; qty: number }>> = {};
  Object.values(summaryMap).forEach((item) => {
    if (!summaryGrouped[item.category]) summaryGrouped[item.category] = [];
    summaryGrouped[item.category].push({ name: item.name, qty: item.qty });
  });

  // Staff PIN gate
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#F7F2EB] text-[#2C1710] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white p-8 rounded-3xl border border-[#E3D5C6] shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#CA340A] flex items-center justify-center mx-auto mb-4 text-[#FFF9F5] shadow-lg">
            <Lock size={28} />
          </div>
          <h1 className="font-heading font-black text-2xl text-[#2C1710] tracking-tight">
            SPIRAL CAFE KDS
          </h1>
          <p className="text-xs text-[#6E4B3D] mt-1 mb-6">
            Kitchen Display System Terminal
          </p>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter Staff PIN (1234)"
              className="w-full text-center py-3.5 px-4 bg-[#FAF5EE] border-2 border-[#DAC8B8] focus:border-[#CA340A] rounded-2xl text-2xl font-black tracking-widest text-[#2C1710] focus:outline-none transition-colors"
              autoFocus
            />

            {authError && (
              <p className="text-xs text-red-600 font-semibold">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer mt-2"
            >
              UNLOCK KITCHEN TERMINAL
            </button>
          </form>

          <p className="text-[11px] text-[#6E4B3D] mt-6">
            Default Kitchen Staff PIN: <strong className="text-[#2C1710]">1234</strong>
          </p>
        </div>
      </main>
    );
  }

  const completedTotal = readyOrders.length;
  const totalActive = pendingOrders.length + preparingOrders.length + readyOrders.length;

  // Render a Single Order Ticket Card
  const renderOrderCard = (order: PlacedOrder, type: "PENDING" | "PREPARING" | "READY" | "COMPLETED") => {
    const urgent = isUrgent(order.createdAt);
    const totalQty = (order.items || []).reduce((sum, i) => sum + i.quantity, 0);

    let headerBg = "bg-[#CA340A]";
    let borderStyle = "border-[#CA340A]";
    let statusLabel = "PENDING";
    let itemAccent = "text-[#CA340A]";
    let itemHover = "group-hover:text-[#CA340A]";
    let checkboxHover = "group-hover:border-[#CA340A]";

    if (order.isAddon) {
      headerBg = "bg-gradient-to-r from-purple-800 to-indigo-900";
      borderStyle = "border-purple-600 ring-2 ring-purple-400/40";
      statusLabel = `ROUND ${order.addonRound || 2} ADD-ON`;
      itemAccent = "text-purple-700";
      itemHover = "group-hover:text-purple-700";
      checkboxHover = "group-hover:border-purple-600";
    } else if (type === "PREPARING") {
      headerBg = "bg-amber-600";
      borderStyle = "border-amber-500";
      statusLabel = "COOKING";
      itemAccent = "text-amber-600";
      itemHover = "group-hover:text-amber-600";
      checkboxHover = "group-hover:border-amber-600";
    } else if (type === "READY") {
      headerBg = "bg-emerald-600";
      borderStyle = "border-emerald-600";
      statusLabel = "READY TO SERVE";
      itemAccent = "text-emerald-600";
      itemHover = "group-hover:text-emerald-600";
      checkboxHover = "group-hover:border-emerald-600";
    } else if (type === "COMPLETED") {
      headerBg = "bg-[#3A1710]";
      borderStyle = "border-zinc-300";
      statusLabel = "SERVED";
      itemAccent = "text-zinc-600";
      itemHover = "group-hover:text-zinc-700";
      checkboxHover = "group-hover:border-zinc-400";
    }

    // Only non-addon pending tickets change to red if delayed
    if (urgent && type === "PENDING" && !order.isAddon) {
      headerBg = "bg-red-600";
      borderStyle = "border-red-600 animate-pulse";
      statusLabel = "DELAYED";
    }

    const cleanOrderNotes = (order.notes || "")
      .replace(/\[ADDING_FOOD_UNTIL:\d+\]/g, "")
      .replace(/\[COOKING_ROUNDS:[0-9,]+\]/g, "")
      .trim();

    return (
      <div
        key={order.id}
        className={`bg-white text-[#2C1710] rounded-2xl border-2 ${borderStyle} shadow-md flex flex-col overflow-hidden transition-all shrink-0`}
      >
        {/* TICKET HEADER BAR */}
        <div className={`${headerBg} text-white px-3.5 py-2.5 flex items-center justify-between shadow-xs`}>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-sm font-black tracking-tight">
                {new Date(order.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-black/25 rounded">
                {statusLabel}
              </span>
              {order.cookingRounds && order.cookingRounds.length > 1 && type === "PREPARING" && (
                <span className="text-[9px] font-extrabold bg-amber-950/70 text-amber-200 px-1.5 py-0.5 rounded">
                  Rounds {order.cookingRounds.join(", ")} Active
                </span>
              )}
            </div>
            <div className="text-xs font-bold mt-0.5 opacity-95 truncate">
              Table: <strong className="font-black text-amber-200 text-sm">{order.tableNumber}</strong>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-black font-mono block">
              #{order.orderNumber.replace("ORD-", "")}
            </span>
            <span className="text-[10px] font-extrabold bg-black/30 px-2 py-0.5 rounded-full inline-block mt-0.5">
              {getElapsedTime(order.createdAt)}
            </span>
          </div>
        </div>

        {/* CUSTOMER ADDING FOOD WARNING BANNER */}
        {order.customerAddingFood && (
          <div className="bg-amber-100 border-b-2 border-amber-300 px-3.5 py-2 flex items-center gap-2 text-amber-950 animate-pulse">
            <Clock size={16} className="text-amber-700 animate-spin shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
                <span>CUSTOMER IS ADDING FOOD</span>
                <span className="text-[10px] bg-amber-600 text-white font-extrabold px-1.5 py-0.2 rounded">WAIT 2 MIN</span>
              </div>
              <div className="text-[10px] font-semibold text-amber-800 truncate">Customer selecting more items • Please hold preparation</div>
            </div>
          </div>
        )}

        {/* ADD-ON HEADER EXPLANATION */}
        {order.isAddon && (
          <div className="bg-purple-50 border-b border-purple-200 px-3.5 py-1.5 flex items-center justify-between text-[11px] font-extrabold text-purple-900">
            <span>Add-on from same customer</span>
            <span className="bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded font-black">Round {order.addonRound}</span>
          </div>
        )}

        {/* TICKET ITEMS LIST */}
        <div className="p-3.5 flex-1 space-y-2 max-h-[320px] overflow-y-auto divide-y divide-[#F0DDD3]">
          {(order.items || []).map((it, idx) => {
            const itemKey = `${order.id}_${it.id || idx}`;
            const isToggled = toggledItemKeys[itemKey];
            const cleanItemNote = (it.notes || "").replace(/\[ROUND:\d+\]/g, "").trim();

            return (
              <div
                key={itemKey}
                onClick={() => toggleItemCheck(itemKey)}
                className={`pt-2 first:pt-0 flex items-start justify-between cursor-pointer group transition-opacity ${
                  isToggled ? "opacity-35 line-through" : "opacity-100"
                }`}
              >
                <div className="pr-2">
                  <div className={`font-heading font-black text-sm text-[#2C1710] leading-snug ${itemHover}`}>
                    <span className={`font-extrabold ${itemAccent} mr-1.5`}>
                      {it.quantity}x
                    </span>
                    {it.name}
                    {it.round && it.round > 1 && !order.isAddon && (
                      <span className="text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-300 px-1.5 py-0.5 rounded ml-1.5 inline-block">
                        R{it.round} Add-on
                      </span>
                    )}
                  </div>

                  {cleanItemNote && (
                    <div className="text-[11px] font-bold text-red-600 uppercase tracking-wide mt-0.5">
                      ⚡ {cleanItemNote}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    isToggled
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : `border-[#DAC8B8] ${checkboxHover}`
                  }`}
                >
                  {isToggled && <Check size={13} />}
                </button>
              </div>
            );
          })}

          {cleanOrderNotes && (
            <div className="pt-2 text-xs font-semibold text-[#8C3A1E] bg-[#FAF3EB] p-2 rounded-xl border border-[#E8DACD]">
              <strong>Order Notes:</strong> {cleanOrderNotes}
            </div>
          )}
        </div>

        {/* TICKET FOOTER & ACTION BUTTON */}
        <div className="p-3 bg-[#FAF5EE] border-t border-[#EFE5DC] flex flex-col gap-2 shrink-0">
          <div className="flex justify-between text-[11px] font-extrabold text-[#6E4B3D]">
            <span>TOTAL ITEMS: {totalQty}</span>
            <span>₹{order.grandTotal}</span>
          </div>

          {type === "PENDING" && order.isAddon && (
            <button
              disabled={actionLoading === `${order.id}-START_PREPARING`}
              onClick={() => handleKitchenAction(order.id, "START_PREPARING")}
              className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-heading font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <ChefHat size={16} />
              <span>START COOKING (MERGE TO {order.tableNumber})</span>
            </button>
          )}

          {type === "PENDING" && !order.isAddon && (
            <button
              disabled={actionLoading === `${order.id}-START_PREPARING`}
              onClick={() => handleKitchenAction(order.id, "START_PREPARING")}
              className="w-full py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <ChefHat size={16} />
              <span>START COOKING</span>
            </button>
          )}

          {type === "PREPARING" && (
            <button
              disabled={actionLoading === `${order.id}-MARK_READY`}
              onClick={() => handleKitchenAction(order.id, "MARK_READY")}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-heading font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>MARK AS READY</span>
            </button>
          )}

          {type === "READY" && (
            <button
              disabled={actionLoading === `${order.id}-COMPLETE_ORDER`}
              onClick={() => handleKitchenAction(order.id, "COMPLETE_ORDER")}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-heading font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <CheckCheck size={16} />
              <span>SERVE &amp; DISPATCH</span>
            </button>
          )}

          {type === "COMPLETED" && (
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 size={13} />
                Served
              </span>
              <button
                disabled={actionLoading === `${order.id}-START_PREPARING`}
                onClick={() => handleKitchenAction(order.id, "START_PREPARING")}
                className="px-2.5 py-1 text-[11px] font-bold text-[#8C3A1E] hover:text-[#CA340A] bg-white rounded-lg border border-[#DAC8B8] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Recall order back to cooking"
              >
                <RotateCcw size={11} />
                <span>Recall</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#F7F2EB] text-[#2C1710] flex flex-col h-screen overflow-hidden antialiased select-none font-sans">
      {/* 1. KDS TOP HEADER BAR */}
      <header className="bg-[#EFE7DE] text-[#2C1710] px-4 py-2.5 flex items-center justify-between border-b border-[#E3D5C6] shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-2 rounded-xl transition-colors cursor-pointer border ${
              showSidebar
                ? "bg-[#CA340A] text-white border-[#CA340A]"
                : "bg-[#FAF5EE] text-[#4A2D22] border-[#DAC8B8] hover:bg-[#F3EBE0]"
            }`}
            title="Toggle Product Summary Sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs border border-[#E3D5C6]">
              <Image src="/logo.png" alt="Spiral Cafe" width={30} height={30} className="object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-black text-base sm:text-lg text-[#2C1710] tracking-tight leading-none">
                  SPIRAL CAFE
                </h1>
                <span className="text-[10px] font-black bg-[#CA340A] text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                  KDS TERMINAL
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-[#FAF5EE] rounded-full border border-[#DAC8B8] text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-[11px] font-bold text-[#4A2D22]">
              {isConnected ? "LIVE STREAM" : "OFFLINE"}
            </span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-[#FAF5EE] border border-[#DAC8B8] hover:bg-[#F3EBE0] text-[#4A2D22] transition-colors cursor-pointer"
            title={soundEnabled ? "Mute Chime" : "Enable Chime"}
          >
            {soundEnabled ? <Volume2 size={18} className="text-emerald-600" /> : <VolumeX size={18} />}
          </button>

          <button
            onClick={() => fetchKitchenOrders(pin)}
            className="p-2 rounded-xl bg-[#FAF5EE] border border-[#DAC8B8] hover:bg-[#F3EBE0] text-[#4A2D22] transition-colors cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw size={18} />
          </button>

          <div className="font-heading font-black text-sm sm:text-base text-[#8C3A1E] tracking-wider font-mono bg-[#FAF5EE] px-3 py-1 rounded-xl border border-[#DAC8B8]">
            {currentTime}
          </div>

          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-xl bg-[#FAF5EE] border border-[#DAC8B8] hover:bg-[#F3EBE0] text-[#4A2D22] text-xs font-bold transition-colors hidden md:block"
          >
            Admin
          </Link>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
            title="Lock KDS Terminal"
          >
            <Lock size={18} />
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA: SIDEBAR + 3-COLUMN SPLIT-UP */}
      <div className="flex-1 flex overflow-hidden">
        {/* Product Qty Summary Sidebar */}
        {showSidebar && (
          <aside className="w-64 sm:w-72 bg-[#F2EAE0] border-r border-[#E3D5C6] flex flex-col shrink-0 overflow-hidden transition-all">
            <div className="bg-[#E8DED1] px-4 py-3 border-b border-[#DAC8B8] flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-[#8C3A1E]">
              <span className="flex items-center gap-1.5">
                <Utensils size={14} className="text-[#CA340A]" />
                PRODUCT
              </span>
              <span>QTY</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 divide-y divide-[#E3D5C6]/60">
              {Object.keys(summaryGrouped).length === 0 ? (
                <div className="py-20 text-center text-zinc-500 text-xs">
                  <ChefHat size={32} className="mx-auto mb-2 opacity-40 text-[#CA340A]" />
                  <p className="font-bold text-[#2C1710]">No Items to Prepare</p>
                  <p className="text-[11px] text-[#6E4B3D] mt-1">
                    Live production quantities will summarize here automatically.
                  </p>
                </div>
              ) : (
                Object.entries(summaryGrouped).map(([category, items]) => (
                  <div key={category} className="pt-3 first:pt-0">
                    <h3 className="text-[11px] font-black text-[#8C3A1E] tracking-wider uppercase mb-2">
                      {category}
                    </h3>
                    <div className="space-y-1.5">
                      {items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-xs py-1.5 px-2.5 rounded-xl bg-[#FAF6F0] border border-[#E3D5C6] shadow-2xs"
                        >
                          <span className="font-bold text-[#2C1710] truncate pr-2">
                            {it.name}
                          </span>
                          <span className="font-heading font-black text-sm text-[#CA340A] bg-[#CA340A]/10 px-2 py-0.5 rounded border border-[#CA340A]/20 font-mono">
                            {it.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-[#E8DED1] border-t border-[#DAC8B8] text-[11px] text-[#5C3F34] flex justify-between items-center font-bold">
              <span>ACTIVE PREP ITEMS:</span>
              <span className="font-black text-[#CA340A] font-mono text-xs">
                {Object.values(summaryMap).reduce((sum, i) => sum + i.qty, 0)}
              </span>
            </div>
          </aside>
        )}

        {/* 3-COLUMN SPLIT-UP CONTAINER */}
        <div className="flex-1 bg-[#F7F2EB] p-3 sm:p-4 overflow-x-auto overflow-y-hidden">
          <div
            className={`h-full gap-4 ${
              activeFilter === "ALL"
                ? "grid grid-cols-1 md:grid-cols-3 min-w-[850px] md:min-w-0"
                : "grid grid-cols-1 max-w-2xl mx-auto"
            }`}
          >
            {/* ================================================================= */}
            {/* COLUMN 1: PENDING ORDERS */}
            {/* ================================================================= */}
            {(activeFilter === "ALL" || activeFilter === "PENDING") && (
              <section className="flex flex-col bg-[#EFE7DE]/80 rounded-2xl border-2 border-[#CA340A]/40 overflow-hidden shadow-xs h-full">
                {/* Column Header */}
                <div className="bg-[#CA340A] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-xs">
                  <div className="flex items-center gap-2">
                    <Clock size={18} />
                    <h2 className="font-heading font-black text-sm sm:text-base tracking-wide uppercase">
                      Pending Orders
                    </h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-black/25 text-white font-mono font-black text-xs">
                    {pendingOrders.length}
                  </span>
                </div>

                {/* Subtitle Bar */}
                <div className="px-4 py-1.5 bg-[#FAF5EE] border-b border-[#DAC8B8] text-[11px] font-bold text-[#6E4B3D] flex justify-between">
                  <span>Waiting for kitchen</span>
                  <span>Action: Start Cooking</span>
                </div>

                {/* Cards List */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {pendingOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 p-6">
                      <Clock size={36} className="text-[#CA340A] opacity-30 mb-2" />
                      <p className="font-bold text-xs text-[#2C1710]">No Pending Orders</p>
                      <p className="text-[11px] text-[#6E4B3D] mt-0.5">
                        New orders from tables will appear here.
                      </p>
                    </div>
                  ) : (
                    pendingOrders.map((order) => renderOrderCard(order, "PENDING"))
                  )}
                </div>
              </section>
            )}

            {/* ================================================================= */}
            {/* COLUMN 2: COOKING / PREPARING */}
            {/* ================================================================= */}
            {(activeFilter === "ALL" || activeFilter === "COOKING") && (
              <section className="flex flex-col bg-[#EFE7DE]/80 rounded-2xl border-2 border-amber-500/50 overflow-hidden shadow-xs h-full">
                {/* Column Header */}
                <div className="bg-amber-600 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-xs">
                  <div className="flex items-center gap-2">
                    <ChefHat size={18} />
                    <h2 className="font-heading font-black text-sm sm:text-base tracking-wide uppercase">
                      Cooking
                    </h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-black/25 text-white font-mono font-black text-xs">
                    {preparingOrders.length}
                  </span>
                </div>

                {/* Subtitle Bar */}
                <div className="px-4 py-1.5 bg-[#FAF5EE] border-b border-[#DAC8B8] text-[11px] font-bold text-[#6E4B3D] flex justify-between">
                  <span>In kitchen preparation</span>
                  <span>Action: Mark Ready</span>
                </div>

                {/* Cards List */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {preparingOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 p-6">
                      <ChefHat size={36} className="text-amber-600 opacity-30 mb-2" />
                      <p className="font-bold text-xs text-[#2C1710]">No Orders Cooking</p>
                      <p className="text-[11px] text-[#6E4B3D] mt-0.5">
                        Click "Start Cooking" on a pending order.
                      </p>
                    </div>
                  ) : (
                    preparingOrders.map((order) => renderOrderCard(order, "PREPARING"))
                  )}
                </div>
              </section>
            )}

            {/* ================================================================= */}
            {/* COLUMN 3: READY TO SERVE / DISPATCH */}
            {/* ================================================================= */}
            {(activeFilter === "ALL" || activeFilter === "COMPLETED") && (
              <section className="flex flex-col bg-[#EFE7DE]/80 rounded-2xl border-2 border-emerald-600/50 overflow-hidden shadow-xs h-full">
                {/* Column Header */}
                <div className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    <h2 className="font-heading font-black text-sm sm:text-base tracking-wide uppercase">
                      Ready to Serve
                    </h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-black/25 text-white font-mono font-black text-xs">
                    {readyOrders.length}
                  </span>
                </div>

                {/* Subtitle Bar */}
                <div className="px-4 py-1.5 bg-[#FAF5EE] border-b border-[#DAC8B8] text-[11px] font-bold text-[#6E4B3D] flex justify-between">
                  <span>{readyOrders.length} ready for dispatch</span>
                  <span>Action: Serve &amp; Dispatch</span>
                </div>

                {/* Cards List: ONLY active ready-to-serve tickets */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {readyOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 p-6 min-h-[180px]">
                      <CheckCircle2 size={36} className="text-emerald-600 opacity-30 mb-2" />
                      <p className="font-bold text-xs text-[#2C1710]">No Orders Waiting for Dispatch</p>
                      <p className="text-[11px] text-[#6E4B3D] mt-0.5">
                        Plated orders marked ready will appear here.
                      </p>
                    </div>
                  ) : (
                    readyOrders.map((order) => renderOrderCard(order, "READY"))
                  )}

                  {/* Collapsed Recently Served History Drawer */}
                  {recentCompleted.length > 0 && (
                    <div className="pt-3 border-t border-[#DAC8B8]/60 mt-3">
                      <button
                        type="button"
                        onClick={() => setShowRecentlyServed(!showRecentlyServed)}
                        className="w-full py-2 px-3 bg-[#FAF5EE] hover:bg-white border border-[#DAC8B8] rounded-xl text-xs font-bold text-[#6E4B3D] flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <CheckCheck size={14} className="text-emerald-700" />
                          <span>Recently Served ({recentCompleted.length})</span>
                        </span>
                        <span className="text-[10px] text-[#8C3A1E] font-semibold underline">
                          {showRecentlyServed ? "Hide History" : "View History"}
                        </span>
                      </button>

                      {showRecentlyServed && (
                        <div className="space-y-3 pt-3">
                          {recentCompleted.map((order) => renderOrderCard(order, "COMPLETED"))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* 4. BOTTOM ACTION & SPLIT FILTER BAR */}
      <footer className="bg-[#EFE7DE] border-t border-[#E3D5C6] p-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0 shadow-md">
        {/* Split / Column Filter Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveFilter("ALL")}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
              activeFilter === "ALL"
                ? "bg-[#2C1710] text-[#FFF9F5] ring-2 ring-[#2C1710]/40 shadow-md"
                : "bg-[#FAF5EE] text-[#4A2D22] border-[#DAC8B8] hover:bg-white"
            }`}
          >
            <Columns3 size={15} />
            <span>3-WAY SPLIT</span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/15 text-[10px] font-mono">
              {totalActive}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter("PENDING")}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
              activeFilter === "PENDING"
                ? "bg-[#CA340A] text-white ring-2 ring-[#CA340A]/40 shadow-md"
                : "bg-[#FAF5EE] text-[#4A2D22] border-[#DAC8B8] hover:bg-white"
            }`}
          >
            <Clock size={14} />
            <span>PENDING</span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/15 text-[10px] font-mono">
              {pendingOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter("COOKING")}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
              activeFilter === "COOKING"
                ? "bg-amber-600 text-white ring-2 ring-amber-600/40 shadow-md"
                : "bg-[#FAF5EE] text-[#4A2D22] border-[#DAC8B8] hover:bg-white"
            }`}
          >
            <ChefHat size={14} />
            <span>COOKING</span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/15 text-[10px] font-mono">
              {preparingOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter("COMPLETED")}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
              activeFilter === "COMPLETED"
                ? "bg-emerald-700 text-white ring-2 ring-emerald-700/40 shadow-md"
                : "bg-[#FAF5EE] text-[#4A2D22] border-[#DAC8B8] hover:bg-white"
            }`}
          >
            <CheckCircle2 size={14} />
            <span>READY TO SERVE</span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/15 text-[10px] font-mono">
              {readyOrders.length}
            </span>
          </button>
        </div>

        {/* Quick Recall & Sidebar Toggle */}
        <div className="flex items-center gap-2">
          {recentCompleted.length > 0 && (
            <button
              onClick={() => {
                const last = recentCompleted[0];
                if (last) {
                  handleKitchenAction(last.id, "START_PREPARING");
                }
              }}
              className="px-3 py-1.5 sm:py-2 bg-[#FAF5EE] hover:bg-white border border-[#DAC8B8] text-[#8C3A1E] text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Recall Last Served Ticket back to Cooking"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">RECALL LAST</span>
              <span className="font-mono">#{recentCompleted[0]?.orderNumber.slice(-4)}</span>
            </button>
          )}

          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="px-3 py-1.5 sm:py-2 bg-[#FAF5EE] hover:bg-white border border-[#DAC8B8] text-[#4A2D22] text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Utensils size={13} />
            <span className="hidden md:inline">{showSidebar ? "HIDE SUMMARY" : "SHOW SUMMARY"}</span>
          </button>
        </div>
      </footer>
    </main>
  );
}
