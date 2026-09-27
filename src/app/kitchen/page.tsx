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
} from "lucide-react";
import { PlacedOrder } from "@/context/CartContext";

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

  const getElapsedTime = (isoString: string) => {
    const elapsedMinutes = Math.floor(
      (Date.now() - new Date(isoString).getTime()) / (1000 * 60)
    );
    if (elapsedMinutes < 1) return "Just now";
    return `${elapsedMinutes}m elapsed`;
  };

  // Staff PIN gate
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#FFF9F5] text-[#2C1710] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-8 rounded-3xl border border-[#CA340A]/20 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#3A1710] flex items-center justify-center mx-auto mb-4 text-[#FFF9F5] shadow-md">
            <Lock size={26} className="text-[#CA340A]" />
          </div>
          <h1 className="font-heading font-black text-2xl text-[#2C1710]">
            Spiral Cafe KDS
          </h1>
          <p className="text-xs text-[#52525b] mt-1 mb-6">
            Kitchen Operations &amp; Display System
          </p>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter Staff PIN (1234)"
              className="w-full text-center py-3.5 px-4 bg-[#FFF9F5] border-2 border-[#CA340A]/20 focus:border-[#CA340A] rounded-2xl text-2xl font-black tracking-widest text-[#2C1710] focus:outline-none"
              autoFocus
            />

            {authError && (
              <p className="text-xs text-red-600 font-semibold">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer mt-2"
            >
              UNLOCK KITCHEN TERMINAL
            </button>
          </form>

          <p className="text-[11px] text-[#52525b] mt-6">
            Default Kitchen Staff PIN: <strong className="text-[#2C1710]">1234</strong>
          </p>
        </div>
      </main>
    );
  }

  const totalActive = pendingOrders.length + preparingOrders.length + readyOrders.length;

  return (
    <main className="min-h-screen bg-[#FFF9F5] text-[#2C1710] flex flex-col antialiased">
      {/* PROFESSIONAL KITCHEN HEADER */}
      <header className="bg-[#3A1710] text-[#FFF9F5] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-md border-b border-[#CA340A]/20">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-[#FFF9F5] p-1.5 flex items-center justify-center shrink-0 shadow-xs">
            <Image src="/logo.png" alt="Spiral Cafe" width={32} height={32} className="object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-lg sm:text-xl text-[#FFF9F5] tracking-tight">
                SPIRAL CAFE
              </h1>
              <span className="text-[10px] font-extrabold bg-[#CA340A] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                KDS
              </span>
            </div>
            <p className="text-xs text-[#E2C7BA]">Kitchen Operations &amp; Order Queue</p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Connection Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#2C1710] rounded-full border border-white/10 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
            <span className="text-[11px] font-semibold text-[#E2C7BA]">
              {isConnected ? "LIVE STREAM" : "CONNECTING"}
            </span>
          </div>

          {/* Active Tickets Badge */}
          <div className="px-3 py-1 bg-[#CA340A]/30 border border-[#CA340A]/60 rounded-full text-xs font-bold text-[#FFF9F5]">
            {totalActive} Active {totalActive === 1 ? "Ticket" : "Tickets"}
          </div>

          {/* Audio Chime Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-[#2C1710] hover:bg-[#4A2016] text-[#E2C7BA] transition-colors cursor-pointer"
            title={soundEnabled ? "Mute Kitchen Chime" : "Enable Kitchen Chime"}
          >
            {soundEnabled ? <Volume2 size={17} className="text-emerald-400" /> : <VolumeX size={17} />}
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchKitchenOrders(pin)}
            className="p-2 rounded-xl bg-[#2C1710] hover:bg-[#4A2016] text-[#E2C7BA] transition-colors cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw size={17} />
          </button>

          {/* Clock */}
          <div className="font-heading font-extrabold text-sm sm:text-base text-[#FFF9F5] tracking-wider min-w-[75px] text-right font-mono">
            {currentTime}
          </div>

          {/* Admin Link */}
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-[#2C1710] hover:bg-[#4A2016] text-[#E2C7BA] text-xs font-bold transition-colors"
            title="Admin Console"
          >
            Admin
          </Link>

          {/* Logout / Lock */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-[#2C1710] hover:bg-red-950 text-[#E2C7BA] transition-colors cursor-pointer"
            title="Lock Terminal"
          >
            <Unlock size={16} />
          </button>
        </div>
      </header>

      {/* MAIN 3-COLUMN KANBAN BOARD */}
      <div className="flex-1 p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* =================================================== */}
        {/* COLUMN 1: NEW ORDERS (Amber) */}
        {/* =================================================== */}
        <section className="bg-white rounded-3xl p-4 border-2 border-amber-400 shadow-xs flex flex-col h-full max-h-[85vh]">
          {/* Column Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
              <h2 className="font-heading font-extrabold text-sm sm:text-base text-amber-900 uppercase tracking-wide">
                1. New Orders
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
              {pendingOrders.length}
            </span>
          </div>

          {/* Tickets Stream */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {pendingOrders.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center">
                <Clock size={36} className="mb-2 opacity-30 text-amber-500" />
                <p className="font-bold text-xs text-zinc-600">No New Orders</p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-[180px]">
                  Incoming table orders will arrive here live with kitchen chime alert.
                </p>
              </div>
            ) : (
              pendingOrders.map((order) => {
                const totalItems = order.items.reduce((sum, it) => sum + it.quantity, 0);
                return (
                  <div
                    key={order.id}
                    className="bg-[#FFFDF9] border-2 border-amber-400 rounded-2xl p-4 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      {/* Ticket Header */}
                      <div className="flex items-start justify-between border-b border-amber-200/80 pb-2.5">
                        <div>
                          <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
                            TICKET #{order.orderNumber}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="px-3 py-1 bg-amber-500 text-[#2C1710] font-heading font-black text-xs rounded-xl shadow-2xs">
                            {order.tableNumber}
                          </span>
                          <span className="block text-[10px] font-bold text-amber-700 mt-1">
                            {getElapsedTime(order.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="py-3 space-y-2 text-xs">
                        {order.items.map((it) => (
                          <div key={it.id} className="flex justify-between items-start">
                            <span className="font-bold text-[#2C1710] pr-2">
                              {it.name}{" "}
                              <span className="text-[#CA340A] font-extrabold">×{it.quantity}</span>
                            </span>
                          </div>
                        ))}

                        {order.notes && (
                          <div className="mt-2 p-2 bg-amber-50 rounded-xl text-[11px] text-amber-900 border border-amber-200">
                            <strong>Note:</strong> {order.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer & Action */}
                    <div className="pt-3 border-t border-amber-200 flex flex-col gap-2">
                      <div className="flex justify-between text-[11px] font-bold text-zinc-500">
                        <span>TOTAL ITEMS: {totalItems}</span>
                        <span>₹{order.grandTotal}</span>
                      </div>

                      <button
                        disabled={actionLoading === `${order.id}-START_PREPARING`}
                        onClick={() => handleKitchenAction(order.id, "START_PREPARING")}
                        className="w-full py-2.5 bg-[#CA340A] hover:bg-[#A82806] text-white font-heading font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <ChefHat size={15} />
                        <span>START PREPARING</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* =================================================== */}
        {/* COLUMN 2: IN PREPARATION (Blue) */}
        {/* =================================================== */}
        <section className="bg-white rounded-3xl p-4 border-2 border-blue-400 shadow-xs flex flex-col h-full max-h-[85vh]">
          {/* Column Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              <h2 className="font-heading font-extrabold text-sm sm:text-base text-blue-900 uppercase tracking-wide">
                2. In Preparation
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-bold">
              {preparingOrders.length}
            </span>
          </div>

          {/* Tickets Stream */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {preparingOrders.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center">
                <ChefHat size={36} className="mb-2 opacity-30 text-blue-500" />
                <p className="font-bold text-xs text-zinc-600">No Orders in Cook</p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-[180px]">
                  Click "Start Preparing" on incoming tickets to track cooking timers.
                </p>
              </div>
            ) : (
              preparingOrders.map((order) => {
                const totalItems = order.items.reduce((sum, it) => sum + it.quantity, 0);
                return (
                  <div
                    key={order.id}
                    className="bg-[#F8FBFF] border-2 border-blue-400 rounded-2xl p-4 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      {/* Ticket Header */}
                      <div className="flex items-start justify-between border-b border-blue-200 pb-2.5">
                        <div>
                          <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider block">
                            TICKET #{order.orderNumber}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium">
                            Prep Started:{" "}
                            {order.preparingAt
                              ? new Date(order.preparingAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Now"}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="px-3 py-1 bg-blue-600 text-white font-heading font-black text-xs rounded-xl shadow-2xs">
                            {order.tableNumber}
                          </span>
                          <span className="block text-[10px] font-bold text-blue-700 mt-1">
                            {getElapsedTime(order.preparingAt || order.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="py-3 space-y-2 text-xs">
                        {order.items.map((it) => (
                          <div key={it.id} className="flex justify-between items-start">
                            <span className="font-bold text-[#2C1710] pr-2">
                              {it.name}{" "}
                              <span className="text-blue-700 font-extrabold">×{it.quantity}</span>
                            </span>
                          </div>
                        ))}

                        {order.notes && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-xl text-[11px] text-blue-900 border border-blue-200">
                            <strong>Note:</strong> {order.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="pt-3 border-t border-blue-200 flex flex-col gap-2">
                      <div className="flex justify-between text-[11px] font-bold text-zinc-500">
                        <span>TOTAL ITEMS: {totalItems}</span>
                        <span>Cooking...</span>
                      </div>

                      <button
                        disabled={actionLoading === `${order.id}-MARK_READY`}
                        onClick={() => handleKitchenAction(order.id, "MARK_READY")}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-heading font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <CheckCircle2 size={15} />
                        <span>MARK AS READY</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* =================================================== */}
        {/* COLUMN 3: READY TO SERVE (Green) */}
        {/* =================================================== */}
        <section className="bg-white rounded-3xl p-4 border-2 border-emerald-400 shadow-xs flex flex-col h-full max-h-[85vh]">
          {/* Column Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <h2 className="font-heading font-extrabold text-sm sm:text-base text-emerald-900 uppercase tracking-wide">
                3. Ready to Serve
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold">
              {readyOrders.length}
            </span>
          </div>

          {/* Tickets Stream */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {readyOrders.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center">
                <CheckCircle2 size={36} className="mb-2 opacity-30 text-emerald-500" />
                <p className="font-bold text-xs text-zinc-600">No Food Ready for Pickup</p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-[180px]">
                  Cooked orders will appear here for floor servers to dispatch to tables.
                </p>
              </div>
            ) : (
              readyOrders.map((order) => {
                const totalItems = order.items.reduce((sum, it) => sum + it.quantity, 0);
                return (
                  <div
                    key={order.id}
                    className="bg-[#F8FCF9] border-2 border-emerald-400 rounded-2xl p-4 shadow-sm flex flex-col justify-between animate-in fade-in"
                  >
                    <div>
                      {/* Ticket Header */}
                      <div className="flex items-start justify-between border-b border-emerald-200 pb-2.5">
                        <div>
                          <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                            TICKET #{order.orderNumber}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium">
                            Ready:{" "}
                            {order.readyAt
                              ? new Date(order.readyAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Just now"}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="px-3 py-1 bg-emerald-600 text-white font-heading font-black text-xs rounded-xl shadow-2xs">
                            {order.tableNumber}
                          </span>
                          <span className="block text-[10px] font-bold text-emerald-700 mt-1">
                            Awaiting Dispatch
                          </span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="py-3 space-y-2 text-xs">
                        {order.items.map((it) => (
                          <div key={it.id} className="flex justify-between items-start">
                            <span className="font-bold text-[#2C1710] pr-2">
                              {it.name}{" "}
                              <span className="text-emerald-700 font-extrabold">×{it.quantity}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="pt-3 border-t border-emerald-200 flex flex-col gap-2">
                      <div className="flex justify-between text-[11px] font-bold text-zinc-500">
                        <span>TOTAL ITEMS: {totalItems}</span>
                        <span className="text-emerald-700 font-bold">READY</span>
                      </div>

                      <button
                        disabled={actionLoading === `${order.id}-COMPLETE_ORDER`}
                        onClick={() => handleKitchenAction(order.id, "COMPLETE_ORDER")}
                        className="w-full py-2.5 bg-[#15803D] hover:bg-[#166534] text-white font-heading font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Check size={16} />
                        <span>SERVED &amp; DISPATCHED</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
