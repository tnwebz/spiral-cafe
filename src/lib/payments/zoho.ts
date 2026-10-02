import { PaymentProvider } from "./provider";
import {
  PaymentCreateInput,
  PaymentCreateResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
  PaymentRefundInput,
  PaymentRefundResult,
} from "./types";

/**
 * Zoho Payments Provider Placeholder.
 *
 * Implements the PaymentProvider contract for future migration.
 * Throws clean configuration errors until Zoho credentials and endpoints
 * are officially provided.
 */
export class ZohoPaymentProvider implements PaymentProvider {
  public readonly name = "zoho" as const;

  async createPayment(_input: PaymentCreateInput): Promise<PaymentCreateResult> {
    throw new Error(
      "Zoho Payments provider is not configured yet. Set PAYMENT_PROVIDER=razorpay or configure Zoho Payments credentials."
    );
  }

  async verifyPayment(_input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    throw new Error(
      "Zoho Payments provider is not configured yet. Cannot verify payments with Zoho."
    );
  }

  async refundPayment?(_input: PaymentRefundInput): Promise<PaymentRefundResult> {
    throw new Error("Zoho Payments refunds are not supported yet.");
  }
}
