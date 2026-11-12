"use client";

import { useState, useEffect, useCallback } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __SPIRAL_DEFERRED_PWA_PROMPT?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [platform, setPlatform] = useState<"windows" | "android" | "apple" | "other">("windows");
  const [browserName, setBrowserName] = useState<"edge" | "chrome" | "safari" | "other">("chrome");

  useEffect(() => {
    // 1. Detect platform & browser
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("edg/")) {
        setBrowserName("edge");
      } else if (ua.includes("chrome") || ua.includes("crios")) {
        setBrowserName("chrome");
      } else if (ua.includes("safari")) {
        setBrowserName("safari");
      }

      if (ua.includes("win")) {
        setPlatform("windows");
      } else if (ua.includes("android")) {
        setPlatform("android");
      } else if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("mac")) {
        setPlatform("apple");
      } else {
        setPlatform("other");
      }

      // 2. Check if currently running in standalone display mode
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: window-controls-overlay)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");

      if (isStandalone) {
        setIsInstalled(true);
        setCanInstall(false);
      } else if (window.__SPIRAL_DEFERRED_PWA_PROMPT) {
        setCanInstall(true);
      }

      // 3. Listen for beforeinstallprompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        window.__SPIRAL_DEFERRED_PWA_PROMPT = e as BeforeInstallPromptEvent;
        setCanInstall(true);
      };

      // 4. Listen for appinstalled
      const handleAppInstalled = () => {
        window.__SPIRAL_DEFERRED_PWA_PROMPT = null;
        setCanInstall(false);
        setIsInstalled(true);
        setIsInstalling(false);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  const installApp = useCallback(async (): Promise<"accepted" | "dismissed" | "unsupported"> => {
    const promptEvent = window.__SPIRAL_DEFERRED_PWA_PROMPT;
    if (!promptEvent) {
      return "unsupported";
    }

    try {
      setIsInstalling(true);
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        window.__SPIRAL_DEFERRED_PWA_PROMPT = null;
        setCanInstall(false);
        setIsInstalled(true);
      }
      return choice.outcome;
    } catch (err) {
      console.warn("PWA installation prompt error:", err);
      return "unsupported";
    } finally {
      setIsInstalling(false);
    }
  }, []);

  return {
    canInstall,
    isInstalled,
    isInstalling,
    platform,
    browserName,
    installApp,
  };
}

