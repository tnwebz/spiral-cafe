"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  description?: string;
  notes?: string;
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
}

interface CartContextType {
  cart: CartItem[];
  tableNumber: string;
  setTableNumber: (table: string) => void;
  customerSessionId: string;
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
  placeOrder: (notes?: string) => Promise<{ success: boolean; order?: PlacedOrder; error?: string }>;
  selectCashPayment: (orderId: string) => Promise<boolean>;
  processOnlinePayment: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  fetchSessionOrders: () => Promise<void>;
  openCart: () => void;
  openOrders: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumberState] = useState<string>("Table 01");
  const [customerSessionId, setCustomerSessionId] = useState<string>("");
  const [taxPercentage, setTaxPercentage] = useState<number>(5);
  const [packagingFee, setPackagingFee] = useState<number>(0);
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [activeSheetTab, setActiveSheetTab] = useState<"cart" | "orders">("cart");
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Initialize Session ID & Table from URL / localStorage
  useEffect(() => {
    try {
      // 1. Customer Session ID
      let storedSession = localStorage.getItem("spiral_customer_session_id");
      if (!storedSession) {
        storedSession = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("spiral_customer_session_id", storedSession);
      }
      setCustomerSessionId(storedSession);

      // 2. Table number from URL query or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const urlTable = urlParams.get("table");
      if (urlTable) {
        let clean = urlTable.trim();
        if (/^\d+$/.test(clean)) clean = `Table ${clean.padStart(2, "0")}`;
        else if (!clean.toLowerCase().startsWith("table")) clean = `Table ${clean}`;
        setTableNumberState(clean);
        localStorage.setItem("spiral_table_session", clean);
      } else {
        const storedTable = localStorage.getItem("spiral_table_session");
        if (storedTable) setTableNumberState(storedTable);
      }

      // 3. Cart persistence
      const savedCart = localStorage.getItem("spiral_cart_v1");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {
      console.error("Initialization error:", e);
    }

    // 4. Fetch Cafe Config (Taxes & Fees)
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.config) {
          setTaxPercentage(data.config.taxPercentage ?? 5);
          setPackagingFee(data.config.packagingFee ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  // Save Cart on updates
  useEffect(() => {
    try {
      localStorage.setItem("spiral_cart_v1", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Set table helper
  const setTableNumber = useCallback((table: string) => {
    let clean = table.trim();
    if (/^\d+$/.test(clean)) clean = `Table ${clean.padStart(2, "0")}`;
    else if (!clean.toLowerCase().startsWith("table")) clean = `Table ${clean}`;
    setTableNumberState(clean);
    try {
      localStorage.setItem("spiral_table_session", clean);
    } catch {}
  }, []);

  // Fetch orders placed by this customer session
  const fetchSessionOrders = useCallback(async () => {
    if (!customerSessionId) return;
    try {
      const res = await fetch(`/api/orders?sessionId=${encodeURIComponent(customerSessionId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setPlacedOrders(data.orders);
      }
    } catch (err) {
      console.error("Failed to fetch session orders:", err);
    }
  }, [customerSessionId]);

  // Real-time synchronization via Server-Sent Events (SSE) with fallback polling
  useEffect(() => {
    if (!customerSessionId) return;

    fetchSessionOrders();

    // Connect to Server-Sent Events stream
    const sseUrl = `/api/orders/stream?sessionId=${encodeURIComponent(customerSessionId)}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.orders && Array.isArray(payload.orders)) {
          setPlacedOrders(payload.orders);
        }
      } catch (e) {
        console.error("Error parsing order stream event:", e);
      }
    };

    eventSource.onerror = () => {
      // EventSource reconnects automatically
    };

    // 3.5s Smart short-polling backup guarantee
    const pollInterval = setInterval(() => {
      fetchSessionOrders();
    }, 3500);

    return () => {
      clearInterval(pollInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
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
    try {
      localStorage.removeItem("spiral_cart_v1");
    } catch {}
  }, []);

  // Pricing math
  const totalItems = cart.reduce((sum, it) => sum + it.quantity, 0);
  const subtotal = cart.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const tax = Math.round((subtotal * taxPercentage) / 100);
  const grandTotal = subtotal + tax + packagingFee;

  // Place Order
  const placeOrder = useCallback(
    async (notes?: string) => {
      if (cart.length === 0) {
        return { success: false, error: "Basket is empty." };
      }
      if (!customerSessionId) {
        return { success: false, error: "Missing session." };
      }

      setIsPlacingOrder(true);
      try {
        const payload = {
          tableNumber,
          customerSessionId,
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
          clearCart();
          setPlacedOrders((prev) => [data.order, ...prev.filter((o) => o.id !== data.order.id)]);
          setActiveSheetTab("orders");
          return { success: true, order: data.order };
        } else {
          return { success: false, error: data.error || "Failed to place order." };
        }
      } catch (err: any) {
        return { success: false, error: err.message || "Network error while placing order." };
      } finally {
        setIsPlacingOrder(false);
      }
    },
    [cart, customerSessionId, tableNumber, clearCart]
  );

  // Cash payment request
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

  // Process Online Payment
  const processOnlinePayment = useCallback(async (orderId: string) => {
    try {
      // 1. Create payment session
      const createRes = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, method: "ONLINE" }),
      });
      const createData = await createRes.json();
      if (!createData.success) {
        return { success: false, error: createData.error || "Payment session error." };
      }

      // 2. Verify payment on server
      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentSessionId: createData.paymentSessionId,
          transactionId: `TXN_${Date.now()}`,
          method: "ONLINE",
        }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success && verifyData.order) {
        setPlacedOrders((prev) =>
          prev.map((o) => (o.id === orderId ? verifyData.order : o))
        );
        return { success: true };
      }
      return { success: false, error: verifyData.error || "Payment verification failed." };
    } catch (err: any) {
      return { success: false, error: err.message || "Payment network error." };
    }
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
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        getItemQuantity,
        clearCart,
        placeOrder,
        selectCashPayment,
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
