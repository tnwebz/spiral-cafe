import {
  RazorpayPaymentProvider,
  verifyRazorpayHmac,
  generateWebCryptoHmacSha256,
  timingSafeEqual,
} from "./payments/razorpay";

export const RAZORPAY_CONFIG = {
  keyId: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TglDyNQunmzfuz",
  keySecret: process.env.RAZORPAY_KEY_SECRET || "vl1Y1D6EfE5inteQhg27Q4cD",
};

/**
 * Legacy helper maintained for backward compatibility.
 * Delegates to the Cloudflare-compatible REST API payment provider.
 */
export async function createRazorpayOrder(params: {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const provider = new RazorpayPaymentProvider();
  const result = await provider.createPayment({
    orderId: params.notes?.orderId || params.receipt,
    orderNumber: params.receipt,
    amount: params.amountInPaise / 100, // Converts paise back to major units for provider input
    currency: params.currency || "INR",
    tableNumber: params.notes?.tableNumber,
    customerPhone: params.notes?.customerPhone,
    notes: params.notes,
  });

  return {
    id: result.providerOrderId,
    amount: result.amount,
    currency: result.currency,
    receipt: params.receipt,
    status: "created",
  };
}

/**
 * Legacy signature verification helper maintained for backward compatibility.
 * Uses Web Crypto HMAC-SHA256 (Cloudflare / Edge compatible).
 */
export async function verifyRazorpaySignatureAsync(params: {
  orderId?: string;
  paymentId?: string;
  signature?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}): Promise<boolean> {
  const oId = params.orderId || params.razorpayOrderId || "";
  const pId = params.paymentId || params.razorpayPaymentId || "";
  const sig = params.signature || params.razorpaySignature || "";

  return verifyRazorpayHmac(oId, pId, sig, RAZORPAY_CONFIG.keySecret);
}

/**
 * Re-export synchronous signature check for compatibility.
 * Note: Modern callers should use `PaymentProvider.verifyPayment()` or `verifyRazorpayHmac`.
 */
export { verifyRazorpayHmac, generateWebCryptoHmacSha256, timingSafeEqual };
