"use client";

/**
 * Loads the external Razorpay Checkout SDK dynamically.
 */
export async function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return;
  if ((window as any).Razorpay) return;

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay SDK")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

export interface RazorpayCheckoutOptions {
  keyId: string;
  orderId: string; // Razorpay order id (e.g. order_xxx)
  amount: number; // in paise
  currency: string;
  orderNumber: string;
  tableNumber?: string;
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  themeColor?: string;
}

export interface ClientPaymentVerificationData {
  provider: "razorpay";
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
  rawPayload?: any;
}

/**
 * Launches the official Razorpay Checkout modal in a promise-wrapped lifecycle.
 */
export async function launchRazorpayModal(
  options: RazorpayCheckoutOptions
): Promise<
  | { success: true; verificationData: ClientPaymentVerificationData }
  | { success: false; error: string }
> {
  await loadRazorpayScript();

  if (typeof window === "undefined" || !(window as any).Razorpay) {
    return { success: false, error: "Razorpay Checkout SDK is not available in browser." };
  }

  return new Promise((resolve) => {
    const rzpOptions = {
      key: options.keyId,
      amount: options.amount,
      currency: options.currency || "INR",
      name: "Spiral Cafe",
      description: `Dining Order #${options.orderNumber} (${options.tableNumber || "Dine-in"})`,
      image: "/logo.png",
      order_id: options.orderId,
      prefill: {
        contact: options.customerPhone || "",
        name: options.customerName || "",
        email: options.customerEmail || "",
      },
      theme: {
        color: options.themeColor || "#CA340A",
      },
      handler: function (response: any) {
        resolve({
          success: true,
          verificationData: {
            provider: "razorpay",
            providerOrderId: response.razorpay_order_id,
            providerPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            rawPayload: response,
          },
        });
      },
      modal: {
        ondismiss: function () {
          resolve({ success: false, error: "Payment cancelled by guest." });
        },
      },
    };

    const rzp = new (window as any).Razorpay(rzpOptions);
    rzp.on("payment.failed", function (response: any) {
      resolve({
        success: false,
        error: response.error?.description || "Payment was declined by payment gateway.",
      });
    });
    rzp.open();
  });
}
