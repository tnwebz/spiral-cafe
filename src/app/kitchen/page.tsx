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
  Unlock,
  AlertCircle,
  ChefHat,
  Sparkles,
  ArrowRight,
  Coffee,
  Check,
  Menu,
  RotateCcw,
  Layers,
  Filter,
  Utensils,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PlacedOrder } from "@/context/CartContext";
import { menuData } from "@/data/menu";

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
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PENDING" | "PREPARING" | "READY">("ALL");

  // Track checked-off item IDs for assembly line cooks
  const [toggledItemKeys, setToggledItemKeys] = useState<Record<string, boolean>>({});

  const prevPendingIdsRef = useRef<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

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

  // SSE Stream
  useEffect(() => {
    if (!isAuthenticated || !pin) return;

    fetchKitchenOrders(pin);

    const sseUrl = `/api/kitchen/stream?pin=${pin}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);

    es.addEventListener("order_event", (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "new_order" && soundEnabled) {
          playKitchenChime();
        }
        fetchKitchenOrders(pin);
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    });

    const pollInterval = setInterval(() => {
      fetchKitchenOrders(pin);
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      es.close();
    };
  }, [isAuthenticated, pin, fetchKitchenOrders, soundEnabled]);

  // Action Dispatcher
  const handleKitchenAction = async (orderId: string, action: string) => {
    setActionLoading(`${orderId}-${action}`);
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
      }
    } catch {
      alert("Network error.");
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

  // Compute Product Quantity Summary across all active tickets (Pending + Preparing)
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
      <main className="min-h-screen bg-[#1C0D0A] text-[#FFF9F5] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#2C1710] p-8 rounded-3xl border border-[#CA340A]/40 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#CA340A] flex items-center justify-center mx-auto mb-4 text-[#FFF9F5] shadow-lg">
            <Lock size={28} />
          </div>
          <h1 className="font-heading font-black text-2xl text-[#FFF9F5] tracking-tight">
            SPIRAL CAFE KDS
          </h1>
          <p className="text-xs text-[#E2C7BA] mt-1 mb-6">
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
              className="w-full text-center py-3.5 px-4 bg-[#1C0D0A] border-2 border-[#CA340A]/50 focus:border-[#CA340A] rounded-2xl text-2xl font-black tracking-widest text-[#FFF9F5] focus:outline-none"
              autoFocus
            />

            {authError && (
              <p className="text-xs text-red-400 font-semibold">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer mt-2"
            >
              UNLOCK KITCHEN TERMINAL
            </button>
          </form>

          <p className="text-[11px] text-[#E2C7BA]/70 mt-6">
            Default Kitchen Staff PIN: <strong className="text-white">1234</strong>
          </p>
        </div>
      </main>
    );
  }

  // Filter orders based on active tab
  let displayTickets: Array<{ order: PlacedOrder; type: "PENDING" | "PREPARING" | "READY" }> = [];

  if (activeFilter === "ALL" || activeFilter === "PENDING") {
    displayTickets.push(...pendingOrders.map((o) => ({ order: o, type: "PENDING" as const })));
  }
  if (activeFilter === "ALL" || activeFilter === "PREPARING") {
    displayTickets.push(...preparingOrders.map((o) => ({ order: o, type: "PREPARING" as const })));
  }
  if (activeFilter === "ALL" || activeFilter === "READY") {
    displayTickets.push(...readyOrders.map((o) => ({ order: o, type: "READY" as const })));
  }

  const totalActive = pendingOrders.length + preparingOrders.length + readyOrders.length;

  return (
    <main className="min-h-screen bg-[#140806] text-[#FFF9F5] flex flex-col h-screen overflow-hidden antialiased select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. KDS TOP HEADER BAR */}
      {/* ========================================================================= */}
      <header className="bg-[#2C1710] text-[#FFF9F5] px-4 py-2.5 flex items-center justify-between border-b border-[#CA340A]/30 shrink-0 shadow-md">
        {/* Left Brand Section */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-2 rounded-xl transition-colors cursor-pointer border ${
              showSidebar
                ? "bg-[#CA340A] text-white border-[#CA340A]"
                : "bg-[#1C0D0A] text-[#E2C7BA] border-white/10 hover:bg-[#3A1710]"
            }`}
            title="Toggle Product Summary Sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
              <Image src="/logo.png" alt="Spiral Cafe" width={30} height={30} className="object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-black text-base sm:text-lg text-white tracking-tight leading-none">
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
          {/* Connection Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-[#1C0D0A] rounded-full border border-white/10 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
            <span className="text-[11px] font-bold text-[#E2C7BA]">
              {isConnected ? "LIVE STREAM" : "OFFLINE"}
            </span>
          </div>

          {/* Audio Chime Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-[#1C0D0A] border border-white/10 hover:bg-[#3A1710] text-[#E2C7BA] transition-colors cursor-pointer"
            title={soundEnabled ? "Mute Chime" : "Enable Chime"}
          >
            {soundEnabled ? <Volume2 size={18} className="text-emerald-400" /> : <VolumeX size={18} />}
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchKitchenOrders(pin)}
            className="p-2 rounded-xl bg-[#1C0D0A] border border-white/10 hover:bg-[#3A1710] text-[#E2C7BA] transition-colors cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw size={18} />
          </button>

          {/* Live Monospaced Clock */}
          <div className="font-heading font-black text-sm sm:text-base text-amber-400 tracking-wider font-mono bg-[#1C0D0A] px-3 py-1 rounded-xl border border-white/10">
            {currentTime}
          </div>

          {/* Admin Link */}
          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-xl bg-[#1C0D0A] border border-white/10 hover:bg-[#3A1710] text-[#E2C7BA] text-xs font-bold transition-colors hidden md:block"
          >
            Admin
          </Link>

          {/* Lock / Exit Terminal Button */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-red-950/80 border border-red-700/50 text-red-200 hover:bg-red-900 transition-colors cursor-pointer"
            title="Lock KDS Terminal"
          >
            <Lock size={18} />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA: SUMMARY SIDEBAR + TICKET GRID */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* ======================================================================= */}
        {/* 2. LEFT SIDEBAR: AGGREGATED PRODUCT & QTY SUMMARY */}
        {/* ======================================================================= */}
        {showSidebar && (
          <aside className="w-72 bg-[#1C0D0A] border-r border-[#CA340A]/20 flex flex-col shrink-0 overflow-hidden transition-all">
            {/* Sidebar Header */}
            <div className="bg-[#2C1710] px-4 py-3 border-b border-[#CA340A]/20 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-amber-400">
              <span className="flex items-center gap-1.5">
                <Utensils size={14} className="text-[#CA340A]" />
                PRODUCT
              </span>
              <span>QTY</span>
            </div>

            {/* Aggregated List grouped by Category */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 divide-y divide-white/5">
              {Object.keys(summaryGrouped).length === 0 ? (
                <div className="py-20 text-center text-zinc-500 text-xs">
                  <ChefHat size={32} className="mx-auto mb-2 opacity-30 text-[#CA340A]" />
                  <p className="font-bold">No Items to Prepare</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Live production quantities will summarize here automatically.
                  </p>
                </div>
              ) : (
                Object.entries(summaryGrouped).map(([category, items]) => (
                  <div key={category} className="pt-3 first:pt-0">
                    <h3 className="text-[11px] font-black text-amber-500/90 tracking-wider uppercase mb-2">
                      {category}
                    </h3>
                    <div className="space-y-1.5">
                      {items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-[#2C1710]/60 border border-white/5"
                        >
                          <span className="font-bold text-[#FFF9F5] truncate pr-2">
                            {it.name}
                          </span>
                          <span className="font-heading font-black text-sm text-[#CA340A] bg-amber-400/10 px-2 py-0.5 rounded border border-[#CA340A]/30 font-mono">
                            {it.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sidebar Footer Info */}
            <div className="p-3 bg-[#2C1710]/80 border-t border-[#CA340A]/20 text-[11px] text-[#E2C7BA] flex justify-between items-center font-semibold">
              <span>ACTIVE PREP ITEMS:</span>
              <span className="font-black text-amber-400 font-mono">
                {Object.values(summaryMap).reduce((sum, i) => sum + i.qty, 0)}
              </span>
            </div>
          </aside>
        )}

        {/* ======================================================================= */}
        {/* 3. TICKET CARDS GRID */}
        {/* ======================================================================= */}
        <div className="flex-1 bg-[#140806] p-4 overflow-y-auto">
          {displayTickets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 p-8">
              <ChefHat size={48} className="text-[#CA340A] opacity-40 mb-3" />
              <h2 className="font-heading font-black text-lg text-white">ALL CLEAR! NO ACTIVE TICKETS</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                Incoming orders from table QR codes will appear here automatically with audio alerts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start pb-16">
              {displayTickets.map(({ order, type }) => {
                const urgent = isUrgent(order.createdAt);
                const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);

                // Color themes based on Status & Urgency
                let headerBg = "bg-[#CA340A]"; // New/Pending
                let borderStyle = "border-[#CA340A]";
                let statusLabel = "NEW TICKET";

                if (type === "PREPARING") {
                  headerBg = "bg-amber-600";
                  borderStyle = "border-amber-600";
                  statusLabel = "COOKING";
                } else if (type === "READY") {
                  headerBg = "bg-emerald-600";
                  borderStyle = "border-emerald-600";
                  statusLabel = "READY";
                }

                if (urgent && type !== "READY") {
                  headerBg = "bg-red-600";
                  borderStyle = "border-red-600 animate-pulse";
                  statusLabel = "DELAYED!";
                }

                return (
                  <div
                    key={order.id}
                    className={`bg-[#FFF9F5] text-[#2C1710] rounded-2xl border-2 ${borderStyle} shadow-xl flex flex-col overflow-hidden transition-all`}
                  >
                    {/* ------------------------------------------------------------- */}
                    {/* TICKET HEADER BAR */}
                    {/* ------------------------------------------------------------- */}
                    <div className={`${headerBg} text-white px-3.5 py-2.5 flex items-center justify-between shadow-xs`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black tracking-tight">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-black/25 rounded">
                            {statusLabel}
                          </span>
                        </div>
                        <div className="text-xs font-bold mt-0.5 opacity-90 truncate max-w-[140px]">
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

                    {/* ------------------------------------------------------------- */}
                    {/* TICKET ITEMS LIST */}
                    {/* ------------------------------------------------------------- */}
                    <div className="p-3.5 flex-1 space-y-2.5 max-h-[380px] overflow-y-auto divide-y divide-zinc-200">
                      {order.items.map((it, idx) => {
                        const itemKey = `${order.id}_${it.id || idx}`;
                        const isToggled = toggledItemKeys[itemKey];

                        return (
                          <div
                            key={itemKey}
                            onClick={() => toggleItemCheck(itemKey)}
                            className={`pt-2 first:pt-0 flex items-start justify-between cursor-pointer group transition-opacity ${
                              isToggled ? "opacity-35 line-through" : "opacity-100"
                            }`}
                          >
                            <div className="pr-2">
                              <div className="font-heading font-black text-sm text-[#2C1710] leading-snug group-hover:text-[#CA340A]">
                                <span className="font-extrabold text-[#CA340A] mr-1.5">
                                  {it.quantity}x
                                </span>
                                {it.name}
                              </div>

                              {/* Customer customization notes */}
                              {it.notes && (
                                <div className="text-[11px] font-bold text-red-600 uppercase tracking-wide mt-0.5">
                                  ⚡ {it.notes}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                isToggled
                                  ? "bg-emerald-600 border-emerald-600 text-white"
                                  : "border-zinc-300 group-hover:border-[#CA340A]"
                              }`}
                            >
                              {isToggled && <Check size={13} />}
                            </button>
                          </div>
                        );
                      })}

                      {/* Order level customer notes */}
                      {order.notes && (
                        <div className="pt-2 text-xs font-semibold text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200">
                          <strong>Order Notes:</strong> {order.notes}
                        </div>
                      )}
                    </div>

                    {/* ------------------------------------------------------------- */}
                    {/* TICKET FOOTER & ACTION BUTTON */}
                    {/* ------------------------------------------------------------- */}
                    <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex flex-col gap-2 shrink-0">
                      <div className="flex justify-between text-[11px] font-extrabold text-zinc-500">
                        <span>TOTAL ITEMS: {totalQty}</span>
                        <span>₹{order.grandTotal}</span>
                      </div>

                      {type === "PENDING" && (
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
                          <Check size={16} />
                          <span>SERVE &amp; DISPATCH</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BOTTOM TACTILE CONTROL / ACTION BAR (Reference KDS Style) */}
      {/* ========================================================================= */}
      <footer className="bg-[#1C0D0A] border-t border-[#CA340A]/30 p-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0 shadow-2xl">
        {/* Quick Filter Buttons */}
        <div className="flex items-center gap-2">
          {[
            { id: "ALL", label: "ALL TICKETS", count: totalActive, color: "bg-[#2C1710] text-[#E2C7BA]" },
            { id: "PENDING", label: "NEW (PENDING)", count: pendingOrders.length, color: "bg-[#CA340A] text-white" },
            { id: "PREPARING", label: "IN PREP", count: preparingOrders.length, color: "bg-amber-600 text-white" },
            { id: "READY", label: "READY", count: readyOrders.length, color: "bg-emerald-600 text-white" },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setActiveFilter(btn.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                activeFilter === btn.id
                  ? `${btn.color} ring-2 ring-white/40 shadow-lg scale-105`
                  : "bg-[#2C1710] text-zinc-400 border-white/5 hover:text-white"
              }`}
            >
              <span>{btn.label}</span>
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-[11px] font-mono">
                {btn.count}
              </span>
            </button>
          ))}
        </div>

        {/* Action / Recall Buttons */}
        <div className="flex items-center gap-2">
          {/* Recall Last Completed */}
          {recentCompleted.length > 0 && (
            <button
              onClick={() => {
                const last = recentCompleted[0];
                if (last) {
                  handleKitchenAction(last.id, "START_PREPARING");
                }
              }}
              className="px-3.5 py-2 bg-[#2C1710] hover:bg-amber-900/50 border border-amber-500/30 text-amber-300 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              title="Recall Last Completed Ticket"
            >
              <RotateCcw size={14} />
              <span>RECALL LAST (#{recentCompleted[0]?.orderNumber.slice(-4)})</span>
            </button>
          )}

          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="px-3.5 py-2 bg-[#2C1710] hover:bg-[#3A1710] border border-white/10 text-[#E2C7BA] text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Utensils size={14} />
            <span>{showSidebar ? "HIDE SUMMARY" : "SHOW SUMMARY"}</span>
          </button>
        </div>
      </footer>
    </main>
  );
}
