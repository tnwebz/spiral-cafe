"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type MotionStatus =
  | "UNSUPPORTED"
  | "PERMISSION_REQUIRED"
  | "DISABLED"
  | "MONITORING"
  | "WALKING"
  | "STILL_WAITING"
  | "COOLDOWN";

interface UseTableMotionOptions {
  enabled: boolean;
  hasActiveOrders: boolean;
  tableNumber: string;
  onPromptWalkingDetected?: () => void;
  maxAlertsPerVisit?: number;
}

const WALKING_THRESHOLD = 1.35; // m/s^2 acceleration delta
const STILLNESS_THRESHOLD = 0.4; // m/s^2
const WALKING_DURATION_MS = 8000; // 8 seconds sustained walking
const STILLNESS_DURATION_MS = 15000; // 15 seconds stationary after walking
const COOLDOWN_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export function useTableMotion({
  enabled,
  hasActiveOrders,
  tableNumber,
  onPromptWalkingDetected,
  maxAlertsPerVisit = 2,
}: UseTableMotionOptions) {
  const [motionStatus, setMotionStatus] = useState<MotionStatus>("DISABLED");
  const [alertCount, setAlertCount] = useState(0);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [userOptIn, setUserOptIn] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("spiral_motion_optin");
      return saved === "true";
    }
    return false;
  });

  const walkingStartRef = useRef<number | null>(null);
  const stillnessStartRef = useRef<number | null>(null);
  const lastMagnitudeRef = useRef<number>(9.8);
  const cooldownUntilRef = useRef<number>(0);
  const alertCountRef = useRef<number>(0);
  const isHiddenRef = useRef<boolean>(false);

  // Sync alert count ref
  useEffect(() => {
    alertCountRef.current = alertCount;
  }, [alertCount]);

  // Handle Page Visibility API: pause when tab is hidden to save battery
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      isHiddenRef.current = document.hidden;
      if (document.hidden) {
        walkingStartRef.current = null;
        stillnessStartRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Request accelerometer permission (iOS 13+ requirement)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    try {
      const dm = window.DeviceMotionEvent as any;
      if (typeof dm?.requestPermission === "function") {
        const response = await dm.requestPermission();
        if (response === "granted") {
          setIsPermissionGranted(true);
          setUserOptIn(true);
          localStorage.setItem("spiral_motion_optin", "true");
          return true;
        } else {
          setMotionStatus("DISABLED");
          setUserOptIn(false);
          localStorage.setItem("spiral_motion_optin", "false");
          return false;
        }
      } else if ("DeviceMotionEvent" in window) {
        // Android / non-iOS permissions are implicitly granted over HTTPS / localhost
        setIsPermissionGranted(true);
        setUserOptIn(true);
        localStorage.setItem("spiral_motion_optin", "true");
        return true;
      } else {
        setMotionStatus("UNSUPPORTED");
        return false;
      }
    } catch {
      setMotionStatus("UNSUPPORTED");
      return false;
    }
  }, []);

  // Toggle user preference
  const toggleOptIn = useCallback(async () => {
    if (!userOptIn) {
      const ok = await requestPermission();
      if (!ok) {
        setUserOptIn(false);
      }
    } else {
      setUserOptIn(false);
      localStorage.setItem("spiral_motion_optin", "false");
      setMotionStatus("DISABLED");
    }
  }, [userOptIn, requestPermission]);

  // Main Motion Event Listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceMotionEvent" in window)) {
      setMotionStatus("UNSUPPORTED");
      return;
    }

    // Only monitor if:
    // 1. Opt-in enabled
    // 2. Active orders placed
    // 3. Haven't exceeded max alerts per visit
    if (!enabled || !userOptIn || !hasActiveOrders || alertCountRef.current >= maxAlertsPerVisit) {
      if (!userOptIn) setMotionStatus("DISABLED");
      return;
    }

    setMotionStatus("MONITORING");

    let lastSampleTime = 0;

    const handleMotionEvent = (event: DeviceMotionEvent) => {
      if (isHiddenRef.current) return;
      if (alertCountRef.current >= maxAlertsPerVisit) return;

      const now = Date.now();
      // Throttle sensor to ~10 Hz (every 100ms) to conserve battery
      if (now - lastSampleTime < 100) return;
      lastSampleTime = now;

      // Check cooldown
      if (now < cooldownUntilRef.current) {
        setMotionStatus("COOLDOWN");
        return;
      }

      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;

      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const delta = Math.abs(magnitude - lastMagnitudeRef.current);
      lastMagnitudeRef.current = magnitude;

      // Step 1: Detect sustained walking
      if (delta >= WALKING_THRESHOLD) {
        if (!walkingStartRef.current) {
          walkingStartRef.current = now;
        } else if (now - walkingStartRef.current >= WALKING_DURATION_MS) {
          // Sustained walking detected! Transition to watching for stillness
          setMotionStatus("WALKING");
          if (!stillnessStartRef.current) {
            stillnessStartRef.current = now;
          }
        }
      } else {
        // Movement is low / still
        if (walkingStartRef.current && now - walkingStartRef.current >= WALKING_DURATION_MS) {
          // Customer was walking, and has now stopped!
          setMotionStatus("STILL_WAITING");

          if (!stillnessStartRef.current) {
            stillnessStartRef.current = now;
          } else if (now - stillnessStartRef.current >= STILLNESS_DURATION_MS) {
            // Customer walked sustained, then sat still for 15 seconds!
            // Trigger alert asking if they moved tables
            walkingStartRef.current = null;
            stillnessStartRef.current = null;
            cooldownUntilRef.current = now + COOLDOWN_DURATION_MS;

            setAlertCount((prev) => {
              const next = prev + 1;
              alertCountRef.current = next;
              return next;
            });

            setMotionStatus("COOLDOWN");

            if (onPromptWalkingDetected) {
              onPromptWalkingDetected();
            }
          }
        } else if (delta < STILLNESS_THRESHOLD) {
          // Customer is completely still without previous walking: reset walking timer
          walkingStartRef.current = null;
          stillnessStartRef.current = null;
          setMotionStatus("MONITORING");
        }
      }
    };

    window.addEventListener("devicemotion", handleMotionEvent, { passive: true });

    return () => {
      window.removeEventListener("devicemotion", handleMotionEvent);
    };
  }, [enabled, userOptIn, hasActiveOrders, maxAlertsPerVisit, onPromptWalkingDetected]);

  return {
    motionStatus,
    userOptIn,
    toggleOptIn,
    requestPermission,
    alertCount,
    resetAlerts: () => setAlertCount(0),
  };
}

