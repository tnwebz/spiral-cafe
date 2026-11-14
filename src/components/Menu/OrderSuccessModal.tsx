"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShoppingBag, Utensils, ArrowRight } from "lucide-react";

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber?: string;
  tableNumber?: string;
  totalAmount?: number;
}

// Gentle pleasant 2-tone Web Audio chime (C5 523Hz -> G5 784Hz)
function playGentleSuccessChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;

    // Tone 1: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.38);

    // Tone 2: G5 (783.99 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(783.99, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.72);
  } catch (e) {
    // Autoplay restrictions are quietly ignored
  }
}

// Pre-calculated confetti particle vectors (Orange, Gold, Emerald)
const CONFETTI_PARTICLES = [
  {
    x: -55,
    y: -45,
    r: 45,
    color: "#CA340A",
    size: 8,
    isCircle: false,
    delay: 0.15,
  },
  {
    x: 55,
    y: -40,
    r: -35,
    color: "#F59E0B",
    size: 7,
    isCircle: true,
    delay: 0.18,
  },
  {
    x: -45,
    y: 35,
    r: 60,
    color: "#10B981",
    size: 6,
    isCircle: false,
    delay: 0.2,
  },
  {
    x: 50,
    y: 38,
    r: -50,
    color: "#CA340A",
    size: 7,
    isCircle: true,
    delay: 0.22,
  },
  {
    x: -70,
    y: -10,
    r: 90,
    color: "#F59E0B",
    size: 8,
    isCircle: false,
    delay: 0.16,
  },
  {
    x: 70,
    y: -5,
    r: -75,
    color: "#10B981",
    size: 7,
    isCircle: false,
    delay: 0.19,
  },
  {
    x: -20,
    y: -65,
    r: 25,
    color: "#CA340A",
    size: 6,
    isCircle: true,
    delay: 0.14,
  },
  {
    x: 25,
    y: -60,
    r: -30,
    color: "#F59E0B",
    size: 8,
    isCircle: false,
    delay: 0.17,
  },
  {
    x: 0,
    y: 65,
    r: 40,
    color: "#10B981",
    size: 7,
    isCircle: true,
    delay: 0.25,
  },
  {
    x: -35,
    y: -50,
    r: -20,
    color: "#E05326",
    size: 5,
    isCircle: false,
    delay: 0.16,
  },
  {
    x: 38,
    y: -48,
    r: 35,
    color: "#D97706",
    size: 6,
    isCircle: true,
    delay: 0.18,
  },
  {
    x: -60,
    y: 20,
    r: -65,
    color: "#059669",
    size: 6,
    isCircle: false,
    delay: 0.21,
  },
];

export default function OrderSuccessModal({
  isOpen,
  onClose,
  orderNumber,
  tableNumber,
  totalAmount,
}: OrderSuccessModalProps) {
  useEffect(() => {
    if (isOpen) {
      playGentleSuccessChime();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isTakeaway = (tableNumber || "").toUpperCase() === "TAKEAWAY";
  const displayTable = isTakeaway
    ? "Take Away / Parcel"
    : `Table ${(tableNumber || "A1").replace(/^Table\s*/i, "").toUpperCase()}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        {/* Animated Modal Card with Zoom-in + Spring Effect */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{
            type: "spring",
            damping: 24,
            stiffness: 300,
          }}
          className="relative w-full max-w-sm sm:max-w-md bg-[#FFFDFB] rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(44,23,16,0.3)] border border-[#EBDAD0] overflow-hidden text-center"
        >
          {/* Subtle Atmospheric Radial Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-gradient-to-b from-orange-200/40 via-amber-100/20 to-transparent rounded-full -z-10 pointer-events-none" />

          {/* Celebratory Success Icon Container with Confetti Burst */}
          <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
            {/* Burst Confetti Particles (Orange, Gold, Green) */}
            {CONFETTI_PARTICLES.map((p, idx) => (
              <motion.div
                key={idx}
                initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
                animate={{
                  x: p.x,
                  y: p.y,
                  scale: 1,
                  opacity: 0.9,
                  rotate: p.r,
                }}
                transition={{
                  delay: p.delay,
                  duration: 0.65,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  backgroundColor: p.color,
                  width: p.size,
                  height: p.isCircle ? p.size : p.size * 1.5,
                  borderRadius: p.isCircle ? "9999px" : "2px",
                }}
                className="absolute shadow-xs pointer-events-none"
              />
            ))}

            {/* Floating Sparkles */}
            <motion.div
              initial={{ scale: 0, opacity: 0, x: -15, y: -18 }}
              animate={{
                scale: 1,
                opacity: 0.85,
                x: -30,
                y: -28,
              }}
              transition={{
                delay: 0.25,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute text-amber-500 pointer-events-none"
            >
              <Sparkles size={20} />
            </motion.div>

            <motion.div
              initial={{ scale: 0, opacity: 0, x: 15, y: -18 }}
              animate={{
                scale: 1,
                opacity: 0.85,
                x: 32,
                y: -26,
              }}
              transition={{
                delay: 0.3,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute text-[#CA340A] pointer-events-none"
            >
              <Sparkles size={18} />
            </motion.div>

            <motion.div
              initial={{ scale: 0, opacity: 0, x: -15, y: 15 }}
              animate={{
                scale: 1,
                opacity: 0.85,
                x: -32,
                y: 28,
              }}
              transition={{
                delay: 0.35,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute text-emerald-500 pointer-events-none"
            >
              <Sparkles size={16} />
            </motion.div>

            {/* Glowing Backdrop Ring */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.08,
              }}
              className="w-22 h-22 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center shadow-lg shadow-emerald-500/15"
            >
              {/* Emerald Center Circle */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  delay: 0.15,
                  type: "spring",
                  stiffness: 280,
                  damping: 16,
                }}
                className="w-15 h-15 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30"
              >
                {/* Self-Drawing Animated SVG Checkmark */}
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                      duration: 0.65,
                      delay: 0.25,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                </svg>
              </motion.div>
            </motion.div>
          </div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            className="space-y-1 mb-3"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#CA340A]">
              Spiral Cafe
            </span>
            <h2 className="font-heading font-black text-2xl sm:text-[26px] text-[#2C1710] tracking-tight">
              Order Placed Successfully!
            </h2>
          </motion.div>

          {/* Elegant Replaced Message */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.45 }}
            className="mb-4"
          >
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="rounded-2xl border border-[#F4C9AF] bg-gradient-to-r from-[#FFF6EE] to-[#FFE8D9] px-4 py-3 shadow-sm max-w-xs w-full">
                <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-[#A85A32]">
                  Approximate Preparation Time
                </p>
                <p className="mt-1 text-center text-lg sm:text-xl font-extrabold text-[#D9480F]">
                  ⏳ 10–15 Minutes
                </p>
                <p className="mt-1 text-center text-[13px] font-medium text-[#6B4A3F] leading-relaxed">
                  Freshly made for you. Kindly wait while we prepare your
                  delicious order.
                </p>
              </div>
            </div>
            <span className="text-[10px] text-[#8C5E51] font-medium block mt-1">
              (Approximate preparation time)
            </span>
          </motion.div>

          {/* Minimalist Summary Card (Keep ONLY: Order ID, Table Number, Total Price) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.45 }}
            className="bg-white rounded-2xl border border-[#EBDAD0] p-4 text-left shadow-2xs space-y-3 mb-5"
          >
            <div className="flex items-center justify-between border-b border-[#F0E4DC] pb-2.5">
              <div>
                <span className="text-[10px] font-extrabold text-[#8C5E51] uppercase tracking-wider block">
                  ORDER ID
                </span>
                <span className="font-heading font-black text-base sm:text-lg text-[#2C1710]">
                  #{orderNumber || "ORD-PENDING"}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-extrabold text-[#8C5E51] uppercase tracking-wider block">
                  SERVICE DESTINATION
                </span>
                <span className="inline-flex items-center gap-1 font-heading font-black text-sm text-[#CA340A]">
                  {isTakeaway ? (
                    <ShoppingBag size={14} />
                  ) : (
                    <Utensils size={14} />
                  )}
                  <span>{displayTable}</span>
                </span>
              </div>
            </div>

            {/* Total Price Row */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-xs font-bold text-[#6B5E55] uppercase tracking-wide">
                Total Price
              </span>
              <span className="font-heading font-black text-base sm:text-lg text-[#2C1710]">
                ₹{totalAmount !== undefined ? totalAmount : 0}
              </span>
            </div>
          </motion.div>

          {/* Action CTA Button with Orange Gradient */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.45 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#CA340A] via-[#E05326] to-[#CA340A] hover:brightness-105 active:scale-98 text-white font-heading font-extrabold text-sm rounded-2xl shadow-lg shadow-[#CA340A]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue Browsing Menu</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
