"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { launchClientCheckout } from "@/lib/payments/client";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  description?: string;
  notes?: string;
}

export interface PersistentCartState {
  tableId: string;
  visitId: string;
  visitorId: string;
  items: CartItem[];
  updatedAt: string;
  expiresAt: string;
}

const CART_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes expiry for unsubmitted draft carts

function cleanClientTableCode(raw: string): string {
  if (!raw) return "";
  const clean = raw.trim();
  const match = clean.match(/^Table[\s\-_]*([A-Za-z0-9\-_]+)$/i);
  if (match) {
    const code = match[1].trim();
    if (/^\d+$/.test(code)) return `A${parseInt(code, 10)}`;
    return code.toUpperCase();
  }
  const letterMatch = clean.match(/^([A-Za-z]+[\-_\s]*\d+.*)$/);
  if (letterMatch) {
    return clean.replace(/[\s\-_]+/g, "").toUpperCase();
  }
  if (/^\d+$/.test(clean)) {
    return `A${parseInt(clean, 10)}`;
  }
  return clean.toUpperCase();
}

export type OrderStatus = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PENDING_CASH" | "PAID";
export type PaymentMethod = "UNSELECTED" | "CASH" | "ONLINE";

export interface PlacedOrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  image: string;
  notes?: string;
  round?: number;
}

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  tableNumber: string;
  customerSessionId: string;
  items: PlacedOrderItem[];
  subtotal: number;
  tax: number;
  packagingFee: number;
  serviceCharge: number;
  grandTotal: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  preparingAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  isAddon?: boolean;
  addonRound?: number;
  parentOrderId?: string;
  customerAddingFood?: boolean;
  addingFoodUntil?: number;
  cookingRounds?: number[];
}

export type FoodPreference = "VEG_ONLY" | "ALL";

export interface CustomerProfile {
  maskedPhone: string;
  foodPreference: FoodPreference;
  lastVisited: string;
  expiresAt: string;
}

export interface TableReservationState {
  tableNumber: string;
  remainingSeconds: number;
  expiresAt: string;
  isReserved: boolean;
  isExpired: boolean;
}

interface CartContextType {
  cart: CartItem[];
  tableNumber: string;
  setTableNumber: (table: string) => void;
  customerSessionId: string;
  foodPreference: FoodPreference;
  setFoodPreference: (pref: FoodPreference) => void;
  customerProfile: CustomerProfile | null;
  setCustomerProfile: (profile: CustomerProfile | null) => void;
  tableReservation: TableReservationState | null;
  refreshTableReservation: () => Promise<void>;
  transferTableReservation: (newTable: string) => Promise<{ success: boolean; error?: string }>;
  totalItems: number;
  subtotal: number;
  taxPercentage: number;
  tax: number;
  packagingFee: number;
  grandTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  activeSheetTab: "cart" | "orders";
  setActiveSheetTab: (tab: "cart" | "orders") => void;
  placedOrders: PlacedOrder[];
  isPlacingOrder: boolean;
  activeTableOrder: PlacedOrder | null;
  notifyAddingFood: (isAdding?: boolean) => Promise<void>;
  addToCart: (item: {
    id: string;
    name: string;
    price: number;
    image: string;
    description?: string;
  }) => void;
  removeFromCart: (id: string) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  getItemQuantity: (id: string) => number;
  clearCart: () => void;
  placeOrder: (notes?: string, overrideTable?: string) => Promise<{ success: boolean; order?: PlacedOrder; error?: string }>;
  selectCashPayment: (orderId: string) => Promise<boolean>;
  switchPaymentMethod: (orderId: string, method: "CASH" | "ONLINE") => Promise<boolean>;
  processOnlinePayment: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  resetCustomerSession: (newPhone?: string) => string;
  fetchSessionOrders: () => Promise<void>;
  openCart: () => void;
  openOrders: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumberState] = useState<string>("");
  const [customerSessionId, setCustomerSessionId] = useState<string>("");
  const [visitorId, setVisitorId] = useState<string>("");
  const [activeVisitId, setActiveVisitId] = useState<string>("");
  const [taxPercentage, setTaxPercentage] = useState<number>(5);
  const [packagingFee, setPackagingFee] = useState<number>(0);
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [activeSheetTab, setActiveSheetTab] = useState<"cart" | "orders">("cart");
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [foodPreference, setFoodPreferenceState] = useState<FoodPreference>("ALL");
  const [customerProfile, setCustomerProfileState] = useState<CustomerProfile | null>(null);
  const [tableReservation, setTableReservation] = useState<TableReservationState | null>(null);

  // Restore 30-day customer profile & food preference on client mount
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem("spiral_customer_profile");
      if (savedProfile) {
        const parsed: CustomerProfile = JSON.parse(savedProfile);
        const isExpired = parsed.expiresAt
          ? Date.now() > new Date(parsed.expiresAt).getTime()
          : false;

        if (!isExpired && parsed.foodPreference) {
          setFoodPreferenceState(parsed.foodPreference);
          setCustomerProfileState(parsed);
        } else if (isExpired) {
          localStorage.removeItem("spiral_customer_profile");
          localStorage.removeItem("spiral_customer_phone");
        }
      }
    } catch {}
  }, []);

  const setFoodPreference = useCallback((pref: FoodPreference) => {
    setFoodPreferenceState(pref);
    try {
      const existing = localStorage.getItem("spiral_customer_profile");
      let profile: CustomerProfile;
      if (existing) {
        profile = JSON.parse(existing);
        profile.foodPreference = pref;
        profile.lastVisited = new Date().toISOString();
      } else {
        profile = {
          maskedPhone: "",
          foodPreference: pref,
          lastVisited: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      localStorage.setItem("spiral_customer_profile", JSON.stringify(profile));
      setCustomerProfileState(profile);

      // Background preference update to server
      const phone = localStorage.getItem("spiral_customer_phone");
      if (phone) {
        fetch("/api/customers/preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: phone, foodPreference: pref }),
        }).catch(() => {});
      }
    } catch {}
  }, []);

  const setCustomerProfile = useCallback((profile: CustomerProfile | null) => {
    setCustomerProfileState(profile);
    if (profile) {
      setFoodPreferenceState(profile.foodPreference);
      try {
        localStorage.setItem("spiral_customer_profile", JSON.stringify(profile));
      } catch {}
    } else {
      try {
        localStorage.removeItem("spiral_customer_profile");
        localStorage.removeItem("spiral_customer_phone");
      } catch {}
    }
  }, []);

  const realtimeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const checkoutIdRef = useRef<string | null>(null);

  // Validate and sync active table session & restore unsubmitted cart if valid
  const syncTableSessionAndCart = useCallback(
    async (tableCode: string, currentVisitor: string) => {
      try {
        const res = await fetch(
          `/api/tables/session?table=${encodeURIComponent(tableCode)}&visitorId=${encodeURIComponent(currentVisitor)}`
        );
        const data = await res.json();
        const serverVisitId =
          data.success && data.visitId ? data.visitId : `VISIT-${tableCode}-IDLE`;
        setActiveVisitId(serverVisitId);

        // Reservation status check
        if (data.success && data.status === "RESERVED" && data.isMyReservation) {
          setTableReservation({
            tableNumber: data.tableNumber,
            remainingSeconds: data.remainingSeconds ?? 600,
            expiresAt: data.expiresAt ?? new Date(Date.now() + 600000).toISOString(),
            isReserved: true,
            isExpired: (data.remainingSeconds ?? 600) <= 0,
          });
        } else if (data.status === "OCCUPIED") {
          setTableReservation(null);
        }

        // Check unsubmitted cart in browser localStorage
        const storageKey = `spiral_cart_${tableCode}`;
        const rawSaved = localStorage.getItem(storageKey);
        if (rawSaved) {
          try {
            const parsed: PersistentCartState = JSON.parse(rawSaved);
            const isTableMatch = parsed.tableId === tableCode;
            const isVisitorMatch = !parsed.visitorId || parsed.visitorId === currentVisitor;
            const isVisitMatch = !parsed.visitId || parsed.visitId === serverVisitId;
            const isNotExpired = parsed.expiresAt
              ? Date.now() <= new Date(parsed.expiresAt).getTime()
              : false;

            if (
              isTableMatch &&
              isVisitorMatch &&
              isVisitMatch &&
              isNotExpired &&
              Array.isArray(parsed.items) &&
              parsed.items.length > 0
            ) {
              // Valid draft cart restored!
              setCart(parsed.items);
              return;
            } else {
              // Visit changed (e.g. previous customer paid and table closed) or cart expired
              localStorage.removeItem(storageKey);
              setCart([]);
            }
          } catch {
            localStorage.removeItem(storageKey);
            setCart([]);
          }
        } else {
          setCart([]);
        }
      } catch (err) {
        console.warn("Table visit sync warning:", err);
      }
    },
    []
  );

  const refreshTableReservation = useCallback(async () => {
    if (!tableNumber) return;
    try {
      const res = await fetch(
        `/api/tables/session?table=${encodeURIComponent(tableNumber)}&visitorId=${encodeURIComponent(visitorId)}&sessionId=${encodeURIComponent(customerSessionId)}`
      );
      const data = await res.json();
      if (data.success && data.status === "RESERVED" && data.isMyReservation) {
        setTableReservation({
          tableNumber: data.tableNumber,
          remainingSeconds: data.remainingSeconds ?? 600,
          expiresAt: data.expiresAt ?? new Date(Date.now() + 600000).toISOString(),
          isReserved: true,
          isExpired: (data.remainingSeconds ?? 600) <= 0,
        });
      } else {
        setTableReservation(null);
      }
    } catch {
      // ignore
    }
  }, [tableNumber, visitorId, customerSessionId]);

  const transferTableReservation = useCallback(
    async (newTable: string) => {
      const cleanTo = cleanClientTableCode(newTable);
      try {
        if (tableReservation && tableReservation.isReserved && !tableReservation.isExpired) {
          const res = await fetch("/api/tables/transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fromTable: tableNumber,
              toTable: cleanTo,
              customerSessionId,
            }),
          });
          const d = await res.json();
          if (d.success) {
            setTableNumberState(cleanTo);
            try {
              localStorage.setItem("spiral_table_session", cleanTo);
            } catch {}
            if (visitorId) {
              await syncTableSessionAndCart(cleanTo, visitorId);
            }
            return { success: true };
          } else {
            return { success: false, error: d.error || "Failed to switch table reservation." };
          }
        } else {
          // Reserve directly
          const customerPhone =
            typeof window !== "undefined"
              ? localStorage.getItem("spiral_customer_phone") || ""
              : "";
          const res = await fetch("/api/tables/reserve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tableNumber: cleanTo,
              customerSessionId,
              customerPhone,
            }),
          });
          const d = await res.json();
          if (d.success) {
            setTableNumberState(cleanTo);
            try {
              localStorage.setItem("spiral_table_session", cleanTo);
            } catch {}
            if (visitorId) {
              await syncTableSessionAndCart(cleanTo, visitorId);
            }
            return { success: true };
          } else {
            return { success: false, error: d.error || "Failed to reserve table." };
          }
        }
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to transfer table." };
      }
    },
    [tableReservation, tableNumber, customerSessionId, visitorId, syncTableSessionAndCart]
  );

  // Countdown timer for 10-minute temporary reservation
  useEffect(() => {
    if (!tableReservation || !tableReservation.isReserved || tableReservation.isExpired) return;
    const interval = setInterval(() => {
      setTableReservation((prev) => {
        if (!prev || !prev.isReserved) return null;
        const nextRem = prev.remainingSeconds - 1;
        if (nextRem <= 0) {
          return {
            ...prev,
            remainingSeconds: 0,
            isExpired: true,
          };
        }
        return {
          ...prev,
          remainingSeconds: nextRem,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tableReservation?.isReserved, tableReservation?.isExpired]);

  // Initialize Session ID & Table from URL / localStorage
  useEffect(() => {
    let initialTable = "";
    let currentVisitor = "";

    try {
      // 1. Customer Session ID
      let storedSession = localStorage.getItem("spiral_customer_session_id");
      if (!storedSession) {
        storedSession = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("spiral_customer_session_id", storedSession);
      }
      setCustomerSessionId(storedSession);

      // 2. Browser-specific Visitor ID (scoped to this browser instance)
      let storedVisitor = localStorage.getItem("spiral_visitor_id");
      if (!storedVisitor) {
        storedVisitor = `VISITOR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
        localStorage.setItem("spiral_visitor_id", storedVisitor);
      }
      currentVisitor = storedVisitor;
      setVisitorId(storedVisitor);

      // 3. Table number from URL query or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const urlTable = urlParams.get("table");
      if (urlTable) {
        const clean = cleanClientTableCode(urlTable);
        initialTable = clean;
        setTableNumberState(clean);
        localStorage.setItem("spiral_table_session", clean);
      } else {
        const storedTable = localStorage.getItem("spiral_table_session");
        if (storedTable) {
          const clean = cleanClientTableCode(storedTable);
          initialTable = clean;
          setTableNumberState(clean);
        }
      }
    } catch (e) {
      console.error("Initialization error:", e);
    }

    // 4. Validate Table Session & Restore unsubmitted cart (10-min expiry + visit matching)
    if (currentVisitor && initialTable) {
      syncTableSessionAndCart(initialTable, currentVisitor);
    }

    // 5. Fetch Cafe Config (Taxes & Fees)
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.config) {
          setTaxPercentage(data.config.taxPercentage ?? 5);
          setPackagingFee(data.config.packagingFee ?? 0);
        }
      })
      .catch(() => {});
  }, [syncTableSessionAndCart]);

  // Persist unsubmitted cart items scoped by table, visitId, and visitorId with 10-minute expiry
  useEffect(() => {
    if (!tableNumber || !visitorId) return;
    const storageKey = `spiral_cart_${tableNumber}`;

    if (cart.length === 0) {
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem("spiral_cart_v1"); // cleanup legacy key
      } catch {}
      return;
    }

    const now = Date.now();
    const payload: PersistentCartState = {
      tableId: tableNumber,
      visitId: activeVisitId || `VISIT-${tableNumber}-OPEN`,
      visitorId,
      items: cart,
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CART_EXPIRY_MS).toISOString(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {}
  }, [cart, tableNumber, activeVisitId, visitorId]);

  // Set table helper: switches table scope and revalidates cart for new table
  const setTableNumber = useCallback(
    (table: string) => {
      const clean = cleanClientTableCode(table);
      setTableNumberState(clean);
      try {
        localStorage.setItem("spiral_table_session", clean);
      } catch {}
      if (visitorId) {
        syncTableSessionAndCart(clean, visitorId);
      }
    },
    [visitorId, syncTableSessionAndCart]
  );

  // Fetch orders placed by this customer session scoped to current table visit
  const fetchSessionOrders = useCallback(async () => {
    if (!customerSessionId) return;
    try {
      const activeTable = tableNumber || "";
      const query = new URLSearchParams({
        sessionId: customerSessionId,
      });
      if (activeTable) {
        query.set("table", activeTable);
      }
      if (activeVisitId && !activeVisitId.endsWith("-IDLE") && !activeVisitId.endsWith("-OPEN")) {
        query.set("visitId", activeVisitId);
      }

      const res = await fetch(`/api/orders?${query.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        // Double check all orders belong to the current table
        const matchingOrders = activeTable
          ? data.orders.filter(
              (o: PlacedOrder) =>
                o.tableNumber?.toUpperCase() === activeTable.toUpperCase() &&
                o.paymentStatus !== "PAID" &&
                o.status !== "CANCELLED"
            )
          : data.orders;

        setPlacedOrders(matchingOrders);
        if (
          data.visitId &&
          (!activeVisitId || activeVisitId.endsWith("-IDLE") || activeVisitId.endsWith("-OPEN"))
        ) {
          setActiveVisitId(data.visitId);
        }
      } else {
        setPlacedOrders([]);
      }
    } catch (err) {
      console.error("Failed to fetch session orders:", err);
    }
  }, [customerSessionId, tableNumber, activeVisitId]);

  // Real-time synchronization via Supabase Realtime with fallback safety polling
  useEffect(() => {
    if (!customerSessionId) return;

    fetchSessionOrders();

    const supabase = getSupabaseBrowserClient();
    const channelName = `customer_orders_${customerSessionId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_session_id=eq.${customerSessionId}`,
        },
        () => {
          // Debounce rapid event changes before authoritative fetch
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchSessionOrders();
          }, 200);
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn("Supabase Realtime customer subscription notice:", err);
      });

    // 15s fallback poll for offline/reconnect edge cases
    const pollInterval = setInterval(() => {
      fetchSessionOrders();
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [customerSessionId, fetchSessionOrders]);

  // Cart operations
  const addToCart = useCallback(
    (item: { id: string; name: string; price: number; image: string; description?: string }) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.id === item.id);
        if (existing) {
          return prev.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [
          ...prev,
          {
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            image: item.image,
            description: item.description,
          },
        ];
      });
    },
    []
  );

  const increaseQuantity = useCallback((id: string) => {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i))
    );
  }, []);

  const decreaseQuantity = useCallback((id: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const getItemQuantity = useCallback(
    (id: string) => {
      const found = cart.find((i) => i.id === id);
      return found ? found.quantity : 0;
    },
    [cart]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    if (tableNumber) {
      try {
        localStorage.removeItem(`spiral_cart_${tableNumber}`);
        localStorage.removeItem("spiral_cart_v1");
      } catch {}
    }
  }, [tableNumber]);

  // Pricing math
  const totalItems = cart.reduce((sum, it) => sum + it.quantity, 0);
  const subtotal = cart.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const tax = Math.round((subtotal * taxPercentage) / 100);
  const grandTotal = subtotal + tax + packagingFee;

  // Place Order with Idempotency Key & Safe Unsubmitted Cart Clearing
  const placeOrder = useCallback(
    async (notes?: string, overrideTable?: string) => {
      if (cart.length === 0) {
        return { success: false, error: "Basket is empty." };
      }
      if (!customerSessionId) {
        return { success: false, error: "Missing session." };
      }

      const activeTable = cleanClientTableCode(overrideTable || tableNumber || "A1");
      if (overrideTable && overrideTable.trim()) {
        setTableNumberState(activeTable);
        try {
          localStorage.setItem("spiral_table_session", activeTable);
        } catch (e) {}
      }

      // Generate or reuse active checkoutId for idempotency
      if (!checkoutIdRef.current) {
        checkoutIdRef.current = `CHK-${customerSessionId.slice(-6)}-${Date.now()}`;
      }
      const checkoutId = checkoutIdRef.current;

      setIsPlacingOrder(true);
      try {
        const customerPhone =
          typeof window !== "undefined"
            ? localStorage.getItem("spiral_customer_phone") || undefined
            : undefined;

        const payload = {
          tableNumber: activeTable,
          customerSessionId,
          checkoutId,
          customerPhone,
          items: cart.map((it) => ({
            productId: it.id,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            image: it.image,
            notes: it.notes,
          })),
          notes,
        };

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success && data.order) {
          // Success confirmed by server:
          // 1. Reset checkoutId for future add-on orders
          checkoutIdRef.current = null;

          // 2. Clear submitted items from localStorage & draft cart state
          clearCart();
          setTableReservation(null);

          // 3. Keep confirmed order in session orders and backend database (newest first)
          setPlacedOrders((prev) => [data.order, ...prev.filter((o) => o.id !== data.order.id)]);

          // 4. Update active visit ID
          if (data.visitId) {
            setActiveVisitId(data.visitId);
          } else if (data.order.id) {
            setActiveVisitId(`VISIT-${activeTable}-${data.order.id.slice(0, 8).toUpperCase()}`);
          }

          // 5. Open orders tab to track live KOT / preparation status
          setActiveSheetTab("orders");
          return { success: true, order: data.order };
        } else {
          return { success: false, error: data.error || "Failed to place order." };
        }
      } catch (err: any) {
        // Network error: DO NOT clear cart! Keep draft intact for retry with same checkoutId
        return {
          success: false,
          error: err.message || "Network error while placing order. Your basket is saved.",
        };
      } finally {
        setIsPlacingOrder(false);
      }
    },
    [cart, customerSessionId, tableNumber, clearCart]
  );

  // Cash payment request (Sets method to CASH, status remains UNPAID until counter confirms)
  const selectCashPayment = useCallback(async (orderId: string) => {
    try {
      const res = await fetch("/api/orders/payment-method", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, method: "CASH" }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setPlacedOrders((prev) =>
          prev.map((o) => (o.id === orderId ? data.order : o))
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Switch or reset payment method (e.g. switch back to ONLINE from CASH)
  const switchPaymentMethod = useCallback(async (orderId: string, method: "CASH" | "ONLINE") => {
    try {
      const res = await fetch("/api/orders/payment-method", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, method }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setPlacedOrders((prev) =>
          prev.map((o) => (o.id === orderId ? data.order : o))
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Process Online Payment via provider-abstracted payment layer
  const processOnlinePayment = useCallback(async (orderId: string) => {
    try {
      // 1. Create payment session on server using authoritative grandTotal
      const createRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const paymentData = await createRes.json();
      if (!paymentData.success) {
        return { success: false, error: paymentData.error || "Failed to initialize payment gateway." };
      }

      // 2. Launch provider checkout modal (Razorpay / Zoho / etc.)
      const checkoutResult = await launchClientCheckout(paymentData.clientPayload);
      if (!checkoutResult.success || !checkoutResult.verificationPayload) {
        return {
          success: false,
          error: checkoutResult.error || "Payment was cancelled or declined.",
        };
      }

      // 3. Cryptographically verify payment on server via provider-neutral verification route
      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          ...checkoutResult.verificationPayload,
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyData.success && verifyData.order) {
        setPlacedOrders((prev) =>
          prev.map((o) => (o.id === orderId ? verifyData.order : o))
        );
        return { success: true };
      }

      return {
        success: false,
        error: verifyData.error || "Payment verification failed.",
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Payment network error." };
    }
  }, []);

  const activeTableOrder =
    placedOrders.find((o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED") || null;

  const notifyAddingFood = useCallback(
    async (isAdding = true) => {
      try {
        const activeTable = tableNumber || "A1";
        const currentActive = placedOrders.find(
          (o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED"
        );
        await fetch("/api/orders/adding-food", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: currentActive?.id,
            tableNumber: activeTable,
            isAdding,
          }),
        });
      } catch (e) {
        console.warn("Adding food notification warning:", e);
      }
    },
    [tableNumber, placedOrders]
  );

  const resetCustomerSession = useCallback((newPhone?: string): string => {
    let newSession = "";
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      newSession = `sess_${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}`;
    } else {
      newSession = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    }
    const newVisitor = `VISITOR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase();

    try {
      localStorage.setItem("spiral_customer_session_id", newSession);
      localStorage.setItem("spiral_visitor_id", newVisitor);
      localStorage.removeItem("spiral_table_session");
      localStorage.removeItem("spiral_customer_profile");
      localStorage.removeItem("spiral_placed_orders");

      if (newPhone) {
        localStorage.setItem("spiral_customer_phone", newPhone);
      } else {
        localStorage.removeItem("spiral_customer_phone");
      }

      // Remove any cart keys for any tables
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("spiral_cart") || key.startsWith("cart_"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn("Storage reset warning:", e);
    }

    setCustomerSessionId(newSession);
    setVisitorId(newVisitor);
    setTableNumberState("");
    setCart([]);
    setPlacedOrders([]);
    setTableReservation(null);
    setActiveVisitId("");
    setCustomerProfileState(null);

    return newSession;
  }, []);

  const openCart = useCallback(() => {
    setActiveSheetTab("cart");
    setIsCartOpen(true);
  }, []);

  const openOrders = useCallback(() => {
    setActiveSheetTab("orders");
    setIsCartOpen(true);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        tableNumber,
        setTableNumber,
        customerSessionId,
        resetCustomerSession,
        foodPreference,
        setFoodPreference,
        customerProfile,
        setCustomerProfile,
        tableReservation,
        refreshTableReservation,
        transferTableReservation,
        totalItems,
        subtotal,
        taxPercentage,
        tax,
        packagingFee,
        grandTotal,
        isCartOpen,
        setIsCartOpen,
        activeSheetTab,
        setActiveSheetTab,
        placedOrders,
        isPlacingOrder,
        activeTableOrder,
        notifyAddingFood,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        getItemQuantity,
        clearCart,
        placeOrder,
        selectCashPayment,
        switchPaymentMethod,
        processOnlinePayment,
        fetchSessionOrders,
        openCart,
        openOrders,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
