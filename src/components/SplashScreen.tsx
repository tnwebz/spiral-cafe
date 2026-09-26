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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#B73F1D] p-0 sm:p-4 select-none overflow-hidden"
        >
          {/* Central Poster Canvas */}
          <div className="relative w-full h-full sm:max-w-md sm:h-[90vh] sm:max-h-[750px] sm:rounded-3xl overflow-hidden shadow-2xl bg-[#B73F1D]">
            {/* Background Poster Image */}
            <Image
              src="/loding.png"
              alt="Spiral Cafe Rooftop Poster"
              fill
              priority
              className="object-cover object-center pointer-events-none"
            />

            {/* Embedded Loading Elements inside the Upper Orange Gap */}
            <div className="absolute top-[12%] sm:top-[14%] inset-x-0 flex flex-col items-center justify-center px-4 text-center z-10">
              {/* Rotating Spiral Logo */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative mb-3.5"
              >
                {/* Glow ring */}
                <div className="absolute -inset-2 rounded-full bg-cream/25 blur-md" />
                
                {/* Circular Badge */}
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#FFF8F3] p-2.5 shadow-2xl flex items-center justify-center border-3 border-[#E2C7BA]/70">
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
                      alt="Spiral Cafe Logo"
                      fill
                      className="object-contain"
                      priority
                    />
                  </motion.div>
                </div>
              </motion.div>

              {/* Cafe Branding Typography */}
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
                className="flex flex-col items-center"
              >
                <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight text-[#FFF8F3] drop-shadow-md">
                  Spiral Cafe
                </h1>
                <p className="text-[10px] sm:text-[11px] font-bold text-[#E2C7BA] tracking-[0.22em] uppercase mt-1 drop-shadow-sm">
                  Rooftop Cafe &amp; Artisan Bites
                </p>
              </motion.div>

              {/* Animated Progress Indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="w-24 sm:w-28 h-1 bg-[#FFF8F3]/30 rounded-full mt-4 overflow-hidden shadow-inner"
              >
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-full h-full bg-[#FFF8F3] rounded-full"
                />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
