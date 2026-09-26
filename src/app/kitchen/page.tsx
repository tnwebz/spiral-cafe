"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
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
  Banknote,
  CreditCard,
  ChefHat,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { PlacedOrder } from "@/context/CartContext";

// Play kitchen chime using Web Audio API (Zero external mp3 needed)
function playKitchenChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Two-tone friendly chime: C5 (523Hz) -> G5 (784Hz)
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
  const [showHistory, setShowHistory] = useState<boolean>(false);

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
  const fetchKitchenOrders = useCallback(async (activePin: string) => {
    try {
      const res = await fetch(`/api/kitchen/orders?pin=${encodeURIComponent(activePin)}`);
      const data = await res.json();
      if (data.success) {
        setPendingOrders(data.pending || []);
        setPreparingOrders(data.preparing || []);
        setReadyOrders(data.ready || []);
        setRecentCompleted(data.recentCompleted || []);
        setIsConnected(true);
      } else {
        if (res.status === 401) {
          setIsAuthenticated(false);
          setAuthError("Session expired or invalid PIN.");
        }
      }
    } catch {
      setIsConnected(false);
    }
  }, []);

  // Real-time SSE Connection
  useEffect(() => {
    if (!isAuthenticated || !pin) return;

    fetchKitchenOrders(pin);

    const sseUrl = `/api/kitchen/stream?pin=${encodeURIComponent(pin)}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.pending) setPendingOrders(data.pending);
        if (data.preparing) setPreparingOrders(data.preparing);
        if (data.ready) setReadyOrders(data.ready);
        if (data.recentCompleted) setRecentCompleted(data.recentCompleted);

        // Sound alert for new incoming tickets
        if (data.pending && Array.isArray(data.pending)) {
          const currentIds = new Set<string>(data.pending.map((o: PlacedOrder) => o.id));
          let hasNewTicket = false;
          for (const id of currentIds) {
            if (!prevPendingIdsRef.current.has(id)) {
              hasNewTicket = true;
              break;
            }
          }
          if (hasNewTicket && soundEnabled) {
            playKitchenChime();
          }
          prevPendingIdsRef.current = currentIds;
        }
      } catch (err) {
        console.error("Kitchen SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    // 4s polling fallback
    const pollInterval = setInterval(() => {
      fetchKitchenOrders(pin);
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isAuthenticated, pin, soundEnabled, fetchKitchenOrders]);

  // Action Handler
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

  // Format relative elapsed time
  const getElapsedTime = (isoString: string) => {
    const elapsedMinutes = Math.floor(
      (Date.now() - new Date(isoString).getTime()) / (1000 * 60)
    );
    if (elapsedMinutes < 1) return "Just now";
    return `${elapsedMinutes}m ago`;
  };

  // If Not Authenticated, show Staff PIN gate
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#2D140E] text-[#FFF8F3] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#3E1C15] p-8 rounded-3xl border border-[#B73F1D]/40 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-[#B73F1D] flex items-center justify-center mx-auto mb-4 text-[#FFF8F3] shadow-lg">
            <Lock size={28} />
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-cream">
            Spiral Cafe KDS
          </h1>
          <p className="text-xs text-[#E2C7BA] mt-1 mb-6">
            Kitchen Display System • Staff Authorization
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter Staff PIN (1234)"
              className="w-full text-center py-3 px-4 bg-[#230C07] border border-[#B73F1D]/50 rounded-2xl text-lg font-extrabold tracking-widest text-[#FFF8F3] focus:outline-none focus:ring-2 focus:ring-[#B73F1D]"
              autoFocus
            />

            {authError && (
              <p className="text-xs text-red-400 font-semibold">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#B73F1D] hover:bg-[#9D3E22] text-[#FFF8F3] font-heading font-extrabold text-sm rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer mt-2"
            >
              UNLOCK KITCHEN DISPLAY
            </button>
          </form>

          <p className="text-[11px] text-[#E2C7BA]/70 mt-6">
            Default Master Kitchen PIN: <strong className="text-cream">1234</strong>
          </p>
        </div>
      </main>
    );
  }

  const totalActive = pendingOrders.length + preparingOrders.length + readyOrders.length;

  return (
    <main className="min-h-screen bg-[#1F0C07] text-[#FFF8F3] flex flex-col">
      {/* Top Kitchen Header Bar */}
      <header className="bg-[#2D140E] border-b border-[#B73F1D]/30 px-5 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-cream p-1 border border-beige/60 flex items-center justify-center shrink-0">
            <Image src="/logo.png" alt="Spiral Cafe" width={34} height={34} className="object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-lg sm:text-xl text-cream tracking-tight">
                SPIRAL CAFE
              </h1>
              <span className="text-[10px] font-extrabold bg-[#B73F1D] text-cream px-2 py-0.5 rounded-full uppercase tracking-wider">
                KDS
              </span>
            </div>
            <p className="text-xs text-[#E2C7BA]">Kitchen Display &amp; Ticket Dispatch</p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Real-time Connection Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#1F0C07] rounded-full border border-white/10 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-[11px] font-semibold text-[#E2C7BA]">
              {isConnected ? "LIVE CONNECTED" : "RECONNECTING"}
            </span>
          </div>

          {/* Active Tickets Pill */}
          <div className="px-3 py-1 bg-[#B73F1D]/30 border border-[#B73F1D]/60 rounded-full text-xs font-bold text-cream">
            {totalActive} Active {totalActive === 1 ? "Ticket" : "Tickets"}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-[#3E1C15] hover:bg-[#4E241B] text-[#E2C7BA] transition-colors cursor-pointer"
            title={soundEnabled ? "Mute Kitchen Chime" : "Enable Kitchen Chime"}
          >
            {soundEnabled ? <Volume2 size={18} className="text-emerald-400" /> : <VolumeX size={18} />}
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchKitchenOrders(pin)}
            className="p-2 rounded-xl bg-[#3E1C15] hover:bg-[#4E241B] text-[#E2C7BA] transition-colors cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw size={18} />
          </button>

          {/* Clock */}
          <div className="font-heading font-extrabold text-sm sm:text-base text-cream tracking-wider min-w-[75px] text-right">
            {currentTime}
          </div>

          {/* Logout / Lock */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-[#3E1C15] hover:bg-red-950 text-[#E2C7BA] transition-colors cursor-pointer"
            title="Lock Kitchen Terminal"
          >
            <Unlock size={17} />
          </button>
        </div>
      </header>

      {/* Main 3 Column Kanban Board */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto">
        {/* COLUMN 1: NEW INCOMING ORDERS (Pending) */}
        <section className="bg-[#2D140E] rounded-3xl p-4 border border-amber-500/30 flex flex-col shadow-lg">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              <h2 className="font-heading font-extrabold text-base text-amber-300 tracking-wide uppercase">
                1. New Incoming
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
              {pendingOrders.length} {pendingOrders.length === 1 ? "Ticket" : "Tickets"}
            </span>
          </div>

          {/* Pending Tickets List */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3.5 pr-1">
            {pendingOrders.length === 0 ? (
              <div className="my-auto py-12 text-center text-[#E2C7BA]/60 flex flex-col items-center">
                <Clock size={36} className="mb-2 opacity-40 text-amber-400" />
                <h3 className="font-heading font-bold text-sm text-[#E2C7BA]">No Pending Orders</h3>
                <p className="text-xs text-[#E2C7BA]/50 mt-1 max-w-[200px]">
                  New customer orders will appear here automatically with audio alert.
                </p>
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-[#3A1A12] border-2 border-amber-500/40 rounded-2xl p-4 shadow-md flex flex-col justify-between transition-all"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-amber-500/20 pb-2.5">
                      <div>
                        <div className="text-[10px] text-amber-400 font-extrabold tracking-wider uppercase">
                          TICKET NO.
                        </div>
                        <div className="font-heading font-extrabold text-lg text-cream">
                          #{order.orderNumber}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="px-3 py-1 bg-amber-400 text-[#2D140E] font-heading font-extrabold text-sm rounded-xl tracking-tight shadow-xs">
                          {order.tableNumber}
                        </div>
                        <div className="text-[11px] text-amber-300/80 font-medium mt-1">
                          {getElapsedTime(order.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="py-3 flex flex-col gap-2">
                      {order.items.map((it) => (
                        <div key={it.id} className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="font-bold text-cream">
                            {it.name}{" "}
                            <span className="text-amber-400 font-extrabold">×{it.quantity}</span>
                          </span>
                          <span className="text-[#E2C7BA] font-semibold">₹{it.lineTotal}</span>
                        </div>
                      ))}

                      {order.notes && (
                        <div className="mt-2 p-2 bg-[#230C07] rounded-xl text-xs text-amber-200 border border-amber-500/20">
                          <strong className="text-amber-400">Note:</strong> {order.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-amber-500/20 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold text-[#E2C7BA]">
                      <span>TOTAL:</span>
                      <span className="font-heading font-extrabold text-base text-cream">
                        ₹{order.grandTotal}
                      </span>
                    </div>

                    <button
                      disabled={actionLoading === `${order.id}-START_PREPARING`}
                      onClick={() => handleKitchenAction(order.id, "START_PREPARING")}
                      className="w-full py-3 bg-[#B73F1D] hover:bg-[#D95D39] text-[#FFF8F3] font-heading font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ChefHat size={16} />
                      <span>START PREPARING</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* COLUMN 2: COOKING IN KITCHEN (Preparing) */}
        <section className="bg-[#2D140E] rounded-3xl p-4 border border-blue-500/30 flex flex-col shadow-lg">
          <div className="flex items-center justify-between border-b border-blue-500/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-blue-400 animate-pulse" />
              <h2 className="font-heading font-extrabold text-base text-blue-300 tracking-wide uppercase">
                2. Cooking In Kitchen
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold">
              {preparingOrders.length} Cooking
            </span>
          </div>

          {/* Preparing Tickets */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3.5 pr-1">
            {preparingOrders.length === 0 ? (
              <div className="my-auto py-12 text-center text-[#E2C7BA]/60 flex flex-col items-center">
                <ChefHat size={36} className="mb-2 opacity-40 text-blue-400" />
                <h3 className="font-heading font-bold text-sm text-[#E2C7BA]">Kitchen is Idle</h3>
                <p className="text-xs text-[#E2C7BA]/50 mt-1 max-w-[200px]">
                  No orders are currently being prepared.
                </p>
              </div>
            ) : (
              preparingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-[#3A1A12] border-2 border-blue-500/40 rounded-2xl p-4 shadow-md flex flex-col justify-between transition-all"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-blue-500/20 pb-2.5">
                      <div>
                        <div className="text-[10px] text-blue-400 font-extrabold tracking-wider uppercase">
                          PREPARING TICKET
                        </div>
                        <div className="font-heading font-extrabold text-lg text-cream">
                          #{order.orderNumber}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="px-3 py-1 bg-blue-400 text-[#2D140E] font-heading font-extrabold text-sm rounded-xl tracking-tight shadow-xs">
                          {order.tableNumber}
                        </div>
                        <div className="text-[11px] text-blue-300/80 font-medium mt-1">
                          Cooking {getElapsedTime(order.preparingAt || order.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="py-3 flex flex-col gap-2">
                      {order.items.map((it) => (
                        <div key={it.id} className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="font-bold text-cream">
                            {it.name}{" "}
                            <span className="text-blue-400 font-extrabold">×{it.quantity}</span>
                          </span>
                          <span className="text-[#E2C7BA] font-semibold">₹{it.lineTotal}</span>
                        </div>
                      ))}

                      {order.notes && (
                        <div className="mt-2 p-2 bg-[#230C07] rounded-xl text-xs text-blue-200 border border-blue-500/20">
                          <strong className="text-blue-400">Note:</strong> {order.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-blue-500/20 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold text-[#E2C7BA]">
                      <span>TOTAL:</span>
                      <span className="font-heading font-extrabold text-base text-cream">
                        ₹{order.grandTotal}
                      </span>
                    </div>

                    <button
                      disabled={actionLoading === `${order.id}-MARK_READY`}
                      onClick={() => handleKitchenAction(order.id, "MARK_READY")}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={16} />
                      <span>MARK AS READY</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* COLUMN 3: READY FOR DINE-IN / PAYMENT */}
        <section className="bg-[#2D140E] rounded-3xl p-4 border border-emerald-500/30 flex flex-col shadow-lg">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <h2 className="font-heading font-extrabold text-base text-emerald-300 tracking-wide uppercase">
                3. Ready &amp; Serving
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
              {readyOrders.length} Ready
            </span>
          </div>

          {/* Ready Tickets */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3.5 pr-1">
            {readyOrders.length === 0 ? (
              <div className="my-auto py-12 text-center text-[#E2C7BA]/60 flex flex-col items-center">
                <CheckCircle2 size={36} className="mb-2 opacity-40 text-emerald-400" />
                <h3 className="font-heading font-bold text-sm text-[#E2C7BA]">All Caught Up</h3>
                <p className="text-xs text-[#E2C7BA]/50 mt-1 max-w-[200px]">
                  No orders currently waiting for service or settlement.
                </p>
              </div>
            ) : (
              readyOrders.map((order) => {
                const isCashPending = order.paymentStatus === "PENDING_CASH";
                const isPaid = order.paymentStatus === "PAID";

                return (
                  <div
                    key={order.id}
                    className="bg-[#3A1A12] border-2 border-emerald-500/40 rounded-2xl p-4 shadow-md flex flex-col justify-between transition-all"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between border-b border-emerald-500/20 pb-2.5">
                        <div>
                          <div className="text-[10px] text-emerald-400 font-extrabold tracking-wider uppercase">
                            READY FOR SERVICE
                          </div>
                          <div className="font-heading font-extrabold text-lg text-cream">
                            #{order.orderNumber}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="px-3 py-1 bg-emerald-500 text-white font-heading font-extrabold text-sm rounded-xl tracking-tight shadow-xs">
                            {order.tableNumber}
                          </div>
                          <div className="text-[11px] text-emerald-300/80 font-medium mt-1">
                            Ready {getElapsedTime(order.readyAt || order.updatedAt)}
                          </div>
                        </div>
                      </div>

                      {/* Payment Status Pill */}
                      <div className="mt-2.5 p-2 rounded-xl flex items-center justify-between text-xs font-bold border">
                        {isCashPending && (
                          <div className="w-full flex items-center justify-between text-amber-300 bg-amber-950/40 border-amber-600/40 p-1.5 rounded-lg">
                            <span className="flex items-center gap-1.5">
                              <Banknote size={15} /> Cash Payment Pending
                            </span>
                            <span className="text-cream font-extrabold">₹{order.grandTotal}</span>
                          </div>
                        )}
                        {isPaid && (
                          <div className="w-full flex items-center justify-between text-emerald-300 bg-emerald-950/40 border-emerald-600/40 p-1.5 rounded-lg">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 size={15} /> Payment Confirmed (Paid)
                            </span>
                            <span className="text-cream font-extrabold">₹{order.grandTotal}</span>
                          </div>
                        )}
                        {!isCashPending && !isPaid && (
                          <div className="w-full flex items-center justify-between text-[#E2C7BA] bg-[#230C07] p-1.5 rounded-lg border-white/10">
                            <span>Awaiting Customer Payment</span>
                            <span className="text-cream font-extrabold">₹{order.grandTotal}</span>
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      <div className="py-2.5 flex flex-col gap-1.5">
                        {order.items.map((it) => (
                          <div key={it.id} className="flex justify-between items-center text-xs">
                            <span className="text-cream font-medium">
                              {it.name}{" "}
                              <span className="text-emerald-400 font-bold">×{it.quantity}</span>
                            </span>
                            <span className="text-[#E2C7BA]">₹{it.lineTotal}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-emerald-500/20 flex flex-col gap-2">
                      {isCashPending && (
                        <button
                          disabled={actionLoading === `${order.id}-MARK_CASH_RECEIVED`}
                          onClick={() => handleKitchenAction(order.id, "MARK_CASH_RECEIVED")}
                          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-heading font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Banknote size={16} />
                          <span>MARK CASH RECEIVED</span>
                        </button>
                      )}

                      <button
                        disabled={actionLoading === `${order.id}-COMPLETE_ORDER`}
                        onClick={() => handleKitchenAction(order.id, "COMPLETE_ORDER")}
                        className="w-full py-2.5 bg-[#4E241B] hover:bg-[#602F23] text-cream font-heading font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border border-white/10"
                      >
                        <CheckCircle2 size={15} />
                        <span>COMPLETE ORDER &amp; ARCHIVE</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Bottom Shift History Drawer Toggle */}
      <footer className="bg-[#2D140E] border-t border-[#B73F1D]/30 px-5 py-2.5 flex items-center justify-between text-xs text-[#E2C7BA] shrink-0">
        <div className="flex items-center gap-3">
          <span>Spiral Cafe Kitchen Operating System</span>
          <span>•</span>
          <span>Chengalpattu Rooftop</span>
        </div>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs font-bold text-amber-300 hover:underline cursor-pointer"
        >
          {showHistory ? "Hide Shift History" : `View Completed Orders (${recentCompleted.length})`}
        </button>
      </footer>

      {/* Completed Orders Drawer */}
      {showHistory && (
        <div className="bg-[#230C07] border-t border-[#B73F1D]/40 p-4 max-h-60 overflow-y-auto">
          <h3 className="font-heading font-extrabold text-sm text-cream mb-2">
            Recently Completed Shift Tickets
          </h3>
          {recentCompleted.length === 0 ? (
            <p className="text-xs text-[#E2C7BA]/60">No completed orders yet for this shift.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {recentCompleted.map((o) => (
                <div key={o.id} className="p-2.5 bg-[#3A1A12] rounded-xl text-xs border border-white/10">
                  <div className="flex justify-between font-bold text-cream">
                    <span>#{o.orderNumber}</span>
                    <span className="text-emerald-400">₹{o.grandTotal}</span>
                  </div>
                  <div className="text-[11px] text-[#E2C7BA] mt-0.5">
                    {o.tableNumber} • {new Date(o.updatedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
