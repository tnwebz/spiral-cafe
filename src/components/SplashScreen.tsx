"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 3 seconds active duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 700); // 700ms smooth fade-out
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#B73F1D] overflow-hidden select-none"
        >
          {/* Main Poster Background Container */}
          <div className="relative w-full h-full max-w-md mx-auto flex flex-col justify-between items-center">
            {/* Background Image: loding.png */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <Image
                src="/loding.png"
                alt="Spiral Cafe Rooftop"
                fill
                priority
                className="object-cover sm:object-contain object-bottom"
              />
              {/* Subtle top ambient gradient for smooth integration */}
              <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#B73F1D]/80 via-[#B73F1D]/30 to-transparent" />
            </div>

            {/* Top Orange Gap: Spiral Loading Animation & Branding */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center pt-16 sm:pt-20 px-6 text-center">
              {/* Animated Rotating Spiral Logo */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative mb-4"
              >
                {/* Glow ring */}
                <div className="absolute -inset-2 rounded-full bg-cream/20 blur-md" />
                
                {/* Logo Badge */}
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-cream p-2.5 shadow-2xl flex items-center justify-center border-3 border-beige/60">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-full h-full relative"
                  >
                    <Image
                      src="/logo.png"
                      alt="Spiral Cafe"
                      fill
                      className="object-contain"
                      priority
                    />
                  </motion.div>
                </div>
              </motion.div>

              {/* Title & Subtitle */}
              <motion.div
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.7, ease: "easeOut" }}
                className="flex flex-col items-center"
              >
                <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight text-cream drop-shadow-md">
                  Spiral Cafe
                </h1>
                <p className="text-[11px] sm:text-xs font-semibold text-beige tracking-[0.2em] uppercase mt-1 drop-shadow-sm">
                  Rooftop Cafe & Artisan Bites
                </p>
              </motion.div>

              {/* Smooth Animated Loading Progress Bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="w-32 h-1 bg-cream/25 rounded-full mt-5 overflow-hidden shadow-inner"
              >
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-full h-full bg-cream rounded-full"
                />
              </motion.div>
            </div>

            {/* Bottom spacer for rooftop sketch alignment */}
            <div className="relative z-10 pb-8 text-center" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
