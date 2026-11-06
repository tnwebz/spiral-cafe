"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  PrinterClient,
  PrinterState,
  CounterPrinterState,
  DualPrinterState,
} from "@/services/printerClient";

export interface ExtendedPrinterHookState extends PrinterState {
  version?: string;
  uptimeSeconds?: number;
  kitchen: PrinterState;
  counter: CounterPrinterState;
  isChecking: boolean;
  refresh: () => Promise<void>;
}

export function usePrinterStatus(pollIntervalMs = 4000): ExtendedPrinterHookState {
  const defaultKitchen: PrinterState = {
    connectorOnline: false,
    printerReachable: false,
    status: "CHECKING",
    latencyMs: 0,
    lastChecked: "--",
    printerIp: "192.168.1.233",
    printerPort: 9100,
    printerModel: "CN811-UEWB",
  };

  const defaultCounter: CounterPrinterState = {
    printerModel: "KP206B-UB",
    printerName: "POS-58-Series",
    interface: "USB",
    paperWidthMm: 58,
    status: "OFFLINE",
    ready: false,
    deviceFound: false,
    driverInstalled: false,
    message: "Initializing status check...",
    lastChecked: "--",
  };

  const [state, setState] = useState<{
    connectorOnline: boolean;
    version?: string;
    uptimeSeconds?: number;
    kitchen: PrinterState;
    counter: CounterPrinterState;
  }>({
    connectorOnline: false,
    version: undefined,
    uptimeSeconds: undefined,
    kitchen: defaultKitchen,
    counter: defaultCounter,
  });

  const [isChecking, setIsChecking] = useState(false);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const sequenceRef = useRef(0);

  const executeCheck = useCallback(async (force = false) => {
    // 1. Prevent overlapping requests
    if (inFlightRef.current && !force) return;
    inFlightRef.current = true;
    setIsChecking(true);

    const currentSeq = ++sequenceRef.current;

    try {
      const [dualResult, health] = await Promise.all([
        PrinterClient.getDualPrinterStatus(force),
        PrinterClient.getConnectorHealthDetails().catch(() => ({
          online: false,
          version: undefined,
          uptimeSeconds: undefined,
        })),
      ]);

      // 2. Ignore superseded out-of-order responses
      if (!mountedRef.current || currentSeq !== sequenceRef.current) {
        return;
      }

      setState({
        connectorOnline: dualResult.connectorOnline,
        version: health.version,
        uptimeSeconds: health.uptimeSeconds,
        kitchen: dualResult.kitchen,
        counter: dualResult.counter,
      });
    } catch (err: any) {
      if (mountedRef.current && currentSeq === sequenceRef.current) {
        setState((prev) => ({
          ...prev,
          connectorOnline: false,
          kitchen: {
            ...prev.kitchen,
            status: "DISCONNECTED",
            error: err.message || "Failed to query print connector",
          },
        }));
      }
    } finally {
      if (mountedRef.current && currentSeq === sequenceRef.current) {
        setIsChecking(false);
      }
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    executeCheck(true);

    const timer = setInterval(() => {
      // Background poll only when page/tab is visible
      if (typeof document !== "undefined" && document.hidden) return;
      executeCheck(false);
    }, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [executeCheck, pollIntervalMs]);

  return {
    ...state.kitchen,
    connectorOnline: state.connectorOnline,
    version: state.version,
    uptimeSeconds: state.uptimeSeconds,
    kitchen: state.kitchen,
    counter: state.counter,
    isChecking,
    refresh: () => executeCheck(true),
  };
}
