import { PaymentProvider } from "./provider";
import {
  PaymentCreateInput,
  PaymentCreateResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
  PaymentRefundInput,
  PaymentRefundResult,
  toMinorUnits,
} from "./types";

/**
 * Universal Base64 helper portable across Node.js, Web Browsers, and Cloudflare Workers.
 */
function toBase64(str: string): string {
  if (typeof btoa === "function") {
    return btoa(str);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str).toString("base64");
  }
  throw new Error("No Base64 encoder available in current runtime environment.");
}

/**
 * Constant-time string equality check to prevent timing attacks.
 * Independent of Node's crypto.timingSafeEqual for complete Cloudflare Edge compatibility.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Cloudflare/Edge-compatible HMAC-SHA256 signature generator using the standard Web Crypto API (globalThis.crypto.subtle).
 */
export async function generateWebCryptoHmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Cryptographically verifies Razorpay payment callback signature:
 * HMAC_SHA256(order_id + "|" + payment_id, secret) === signature
 */
export async function verifyRazorpayHmac(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = await generateWebCryptoHmacSha256(secret, `${orderId}|${paymentId}`);
    return timingSafeEqual(expectedSignature.toLowerCase(), signature.toLowerCase());
  } catch (err) {
    console.error("Error computing Web Crypto HMAC for Razorpay:", err);
    return false;
  }
}

/**
 * Razorpay Payment Provider Adapter.
 *
 * Implements server-side REST API order creation using standard fetch(),
 * and Web Crypto HMAC-SHA256 signature verification.
 * 100% compatible with Node.js and Cloudflare Workers runtime.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  public readonly name = "razorpay" as const;

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly apiBase = "https://api.razorpay.com/v1";

  constructor() {
    this.keyId =
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      "rzp_test_TglDyNQunmzfuz";

    this.keySecret =
      process.env.RAZORPAY_KEY_SECRET ||
      "vl1Y1D6EfE5inteQhg27Q4cD";

    if (!this.keyId || !this.keySecret) {
      console.warn("Razorpay credentials missing. Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.");
    }
  }

  /**
   * Creates a Razorpay Order via direct HTTPS REST API.
   * Completely bypasses heavy Node SDK dependencies.
   */
  async createPayment(input: PaymentCreateInput): Promise<PaymentCreateResult> {
    const amountInPaise = toMinorUnits(input.amount, input.currency);

    const authHeader = `Basic ${toBase64(`${this.keyId}:${this.keySecret}`)}`;

    const payload = {
      amount: amountInPaise,
      currency: input.currency || "INR",
      receipt: input.orderNumber,
      notes: {
        orderId: input.orderId,
        tableNumber: input.tableNumber || "N/A",
        customerPhone: input.customerPhone || "N/A",
        ...(input.notes || {}),
      },
    };

    const res = await fetch(`${this.apiBase}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errorMsg = `Razorpay API error: ${res.statusText} (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.description) {
          errorMsg = errJson.error.description;
        }
      } catch {}
      throw new Error(errorMsg);
    }

    const data = await res.json();

    return {
      provider: "razorpay",
      providerOrderId: data.id,
      amount: data.amount,
      currency: data.currency,
      clientPayload: {
        provider: "razorpay",
        keyId: this.keyId,
        orderId: input.orderId,
        providerOrderId: data.id,
        amount: data.amount,
        currency: data.currency,
        orderNumber: input.orderNumber,
        tableNumber: input.tableNumber,
        customerPhone: input.customerPhone,
      },
    };
  }

  /**
   * Verifies Razorpay payment signature via Web Crypto HMAC-SHA256.
   */
  async verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    const { providerOrderId, providerPaymentId, signature } = input;

    if (!providerOrderId || !providerPaymentId || !signature) {
      return {
        success: false,
        provider: "razorpay",
        status: "FAILED",
        error: "Missing required Razorpay verification parameters (providerOrderId, providerPaymentId, signature).",
      };
    }

    const isValid = await verifyRazorpayHmac(
      providerOrderId,
      providerPaymentId,
      signature,
      this.keySecret
    );

    if (!isValid) {
      return {
        success: false,
        provider: "razorpay",
        providerPaymentId,
        providerOrderId,
        status: "FAILED",
        error: "Razorpay payment signature verification failed. HMAC mismatch.",
      };
    }

    return {
      success: true,
      provider: "razorpay",
      providerPaymentId,
      providerOrderId,
      status: "PAID",
    };
  }

  /**
   * Razorpay refund stub for future implementation.
   */
  async refundPayment(_input: PaymentRefundInput): Promise<PaymentRefundResult> {
    throw new Error("Razorpay online refunds are not yet configured for Spiral Cafe.");
  }
}
