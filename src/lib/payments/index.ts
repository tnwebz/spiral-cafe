import { PaymentProvider } from "./provider";
import { PaymentProviderName } from "./types";
import { RazorpayPaymentProvider } from "./razorpay";
import { ZohoPaymentProvider } from "./zoho";

export * from "./types";
export * from "./provider";
export * from "./razorpay";
export * from "./zoho";

/**
 * Returns the currently active PaymentProvider instance based on application configuration.
 *
 * Configured via process.env.PAYMENT_PROVIDER ("razorpay" | "zoho").
 * Defaults to "razorpay".
 *
 * Throws a clear configuration error if an unsupported provider is specified.
 */
export function getPaymentProvider(providerName?: PaymentProviderName | string): PaymentProvider {
  const activeName = (
    providerName ||
    process.env.PAYMENT_PROVIDER ||
    "razorpay"
  ).toLowerCase().trim();

  switch (activeName) {
    case "razorpay":
      return new RazorpayPaymentProvider();

    case "zoho":
      return new ZohoPaymentProvider();

    default:
      throw new Error(
        `Unsupported payment provider: "${activeName}". Valid configured options are "razorpay" and "zoho".`
      );
  }
}
