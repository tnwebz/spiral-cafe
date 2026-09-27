import Razorpay from "razorpay";
import crypto from "crypto";

export const RAZORPAY_CONFIG = {
  keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_TglDyNQunmzfuz",
  keySecret: process.env.RAZORPAY_KEY_SECRET || "vl1Y1D6EfE5inteQhg27Q4cD",
};

export function getRazorpayInstance() {
  return new Razorpay({
    key_id: RAZORPAY_CONFIG.keyId,
    key_secret: RAZORPAY_CONFIG.keySecret,
  });
}

/**
 * Create a Razorpay Order on server
 */
export async function createRazorpayOrder(params: {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const instance = getRazorpayInstance();
  return await instance.orders.create({
    amount: params.amountInPaise,
    currency: params.currency || "INR",
    receipt: params.receipt,
    notes: params.notes,
  });
}

/**
 * Verify Razorpay payment signature
 */
export function verifyRazorpaySignature(params: {
  orderId?: string;
  paymentId?: string;
  signature?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}): boolean {
  try {
    const oId = params.orderId || params.razorpayOrderId || "";
    const pId = params.paymentId || params.razorpayPaymentId || "";
    const sig = params.signature || params.razorpaySignature || "";

    const generatedSignature = crypto
      .createHmac("sha256", RAZORPAY_CONFIG.keySecret)
      .update(`${oId}|${pId}`)
      .digest("hex");

    return generatedSignature === sig;
  } catch (err) {
    console.error("Error verifying Razorpay signature:", err);
    return false;
  }
}
