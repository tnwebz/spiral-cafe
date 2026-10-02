import {
  PaymentProviderName,
  PaymentCreateInput,
  PaymentCreateResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
  PaymentRefundInput,
  PaymentRefundResult,
} from "./types";

/**
 * Generic contract that any online payment provider (Razorpay, Zoho Payments, etc.)
 * must implement to be integrated into Spiral Cafe.
 */
export interface PaymentProvider {
  /**
   * Provider identifier ("razorpay" | "zoho")
   */
  readonly name: PaymentProviderName;

  /**
   * Initializes a payment order with the upstream provider gateway.
   */
  createPayment(input: PaymentCreateInput): Promise<PaymentCreateResult>;

  /**
   * Cryptographically verifies the upstream provider signature or callback authenticity.
   */
  verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult>;

  /**
   * Optional refund capability.
   */
  refundPayment?(input: PaymentRefundInput): Promise<PaymentRefundResult>;
}
