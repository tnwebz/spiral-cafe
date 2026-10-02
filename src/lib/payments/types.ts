/**
 * Provider-agnostic payment abstraction types for Spiral Cafe.
 * Supports current Razorpay integration and future Zoho Payments switching.
 */

export type PaymentProviderName = "razorpay" | "zoho";

export interface PaymentCreateInput {
  orderId: string;
  orderNumber: string;
  amount: number; // In primary currency units (e.g., 680 for ₹680)
  currency: string; // ISO currency code, e.g. "INR"
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  tableNumber?: string;
  notes?: Record<string, string>;
}

export interface PaymentCreateResult {
  provider: PaymentProviderName;
  providerOrderId: string;
  amount: number; // In minor units (paise for INR)
  currency: string;
  clientPayload: {
    provider: PaymentProviderName;
    keyId?: string;
    orderId?: string;
    providerOrderId: string;
    amount: number;
    currency: string;
    orderNumber?: string;
    tableNumber?: string;
    customerPhone?: string;
    [key: string]: any;
  };
}

export interface PaymentVerifyInput {
  provider: PaymentProviderName;
  orderId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature?: string;
  rawPayload?: Record<string, any>;
}

export interface PaymentVerifyResult {
  success: boolean;
  provider: PaymentProviderName;
  providerPaymentId?: string;
  providerOrderId?: string;
  status: "PAID" | "FAILED" | "PENDING";
  error?: string;
  rawResponse?: Record<string, any>;
}

export interface PaymentRefundInput {
  orderId: string;
  providerPaymentId: string;
  amount?: number;
  reason?: string;
}

export interface PaymentRefundResult {
  success: boolean;
  refundId?: string;
  status: "REFUNDED" | "FAILED" | "PENDING";
  error?: string;
}

/**
 * Centrally converts major currency units (e.g. ₹680) to minor units (e.g. 68000 paise).
 * Avoids floating-point precision issues.
 */
export function toMinorUnits(amount: number, currency = "INR"): number {
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new Error(`Invalid amount supplied to toMinorUnits: ${amount}`);
  }
  // Standard currencies like INR, USD, EUR use 2 decimal places (factor of 100)
  const factor = 100;
  return Math.round((amount + Number.EPSILON) * factor);
}

/**
 * Centrally converts minor units (e.g. 68000 paise) back to major units (e.g. ₹680).
 */
export function fromMinorUnits(minorAmount: number, currency = "INR"): number {
  if (typeof minorAmount !== "number" || isNaN(minorAmount)) {
    throw new Error(`Invalid minorAmount supplied to fromMinorUnits: ${minorAmount}`);
  }
  return minorAmount / 100;
}
