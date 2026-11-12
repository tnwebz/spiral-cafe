"use client";

import { useEffect } from "react";
import type { BeforeInstallPromptEvent } from "@/hooks/usePWAInstall";

export default function PWARegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Capture beforeinstallprompt event as early as possible
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__SPIRAL_DEFERRED_PWA_PROMPT = e as BeforeInstallPromptEvent;
      // Dispatch custom notification so any active listener can update UI
      window.dispatchEvent(new CustomEvent("spiral-pwa-ready"));
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // 2. Register Service Worker for PWA compliance and offline fallback
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            if (process.env.NODE_ENV === "development") {
              console.log("[PWA] ServiceWorker registered successfully:", reg.scope);
            }
          })
          .catch((err) => {
            console.warn("[PWA] ServiceWorker registration skipped/failed:", err);
          });
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  return null;
}

