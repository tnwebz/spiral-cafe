"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import SplashScreen from "@/components/SplashScreen";

export default function GlobalSplashScreen() {
  const pathname = usePathname();
  const [showSplash, setShowSplash] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Never display splash screen on internal operational portals
    if (
      pathname?.startsWith("/admin-sp-access") ||
      pathname?.startsWith("/kitchen") ||
      pathname?.startsWith("/invoice")
    ) {
      return;
    }

    try {
      const hasSeen = sessionStorage.getItem("spiral_cafe_splash");
      if (!hasSeen) {
        setShowSplash(true);
      }
    } catch {}
  }, [pathname]);

  const handleSplashComplete = () => {
    setShowSplash(false);
    try {
      sessionStorage.setItem("spiral_cafe_splash", "true");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("spiral_splash_complete"));
      }
    } catch {}
  };

  if (!mounted || !showSplash) {
    return null;
  }

  return <SplashScreen onComplete={handleSplashComplete} />;
}
