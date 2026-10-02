"use client";

import { launchRazorpayModal } from "./razorpay-checkout";

export * from "./razorpay-checkout";

export interface GenericClientPaymentResult {
  success: boolean;
  error?: string;
  verificationPayload?: {
    provider: string;
    providerOrderId: string;
    providerPaymentId: string;
    signature?: string;
    rawPayload?: any;
  };
}

/**
 * Provider-agnostic client payment launcher.
 * Dispatches to the corresponding gateway SDK based on the active provider metadata.
 */
export async function launchClientCheckout(clientPayload: {
  provider: string;
  keyId?: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  orderNumber?: string;
  tableNumber?: string;
  customerPhone?: string;
  [key: string]: any;
}): Promise<GenericClientPaymentResult> {
  const provider = (clientPayload.provider || "razorpay").toLowerCase();

  switch (provider) {
    case "razorpay": {
      const modalResult = await launchRazorpayModal({
        keyId: clientPayload.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TglDyNQunmzfuz",
        orderId: clientPayload.providerOrderId,
        amount: clientPayload.amount,
        currency: clientPayload.currency || "INR",
        orderNumber: clientPayload.orderNumber || "",
        tableNumber: clientPayload.tableNumber,
        customerPhone: clientPayload.customerPhone,
      });

      if (!modalResult.success) {
        return { success: false, error: modalResult.error };
      }

      return {
        success: true,
        verificationPayload: {
          provider: "razorpay",
          providerOrderId: modalResult.verificationData.providerOrderId,
          providerPaymentId: modalResult.verificationData.providerPaymentId,
          signature: modalResult.verificationData.signature,
          rawPayload: modalResult.verificationData.rawPayload,
        },
      };
    }

    case "zoho":
      return {
        success: false,
        error: "Zoho Payments client checkout is not yet supported.",
      };

    default:
      return {
        success: false,
        error: `Unsupported payment provider client launcher: "${provider}".`,
      };
  }
}
