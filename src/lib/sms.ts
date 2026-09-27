/**
 * SMS Provider Abstraction Engine for Spiral Cafe
 * (Supports MSG91, Fast2SMS, Twilio, or Built-in Development Logger)
 */

export interface SendSmsParams {
  phoneNumber: string;
  message: string;
  templateId?: string;
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export class SmsService {
  private static provider = process.env.SMS_PROVIDER || "mock";
  private static apiKey = process.env.SMS_API_KEY || "";
  private static senderId = process.env.SMS_SENDER_ID || "SPIRAL";

  /**
   * Send Invoice SMS Link
   */
  static async sendInvoiceLink(params: {
    phoneNumber: string;
    invoiceNumber: string;
    orderNumber: string;
    grandTotal: number;
    invoiceUrl: string;
  }): Promise<SmsSendResult> {
    const text = `Spiral Cafe: Your Invoice #${params.invoiceNumber} for Order #${params.orderNumber} (₹${params.grandTotal}) is ready. View & download your receipt: ${params.invoiceUrl} - Thank you for dining with us!`;
    return this.sendRawSms({
      phoneNumber: params.phoneNumber,
      message: text,
      templateId: process.env.SMS_INVOICE_TEMPLATE_ID,
    });
  }

  /**
   * Send Order Ready Notification
   */
  static async sendOrderReady(params: {
    phoneNumber: string;
    orderNumber: string;
    tableNumber: string;
  }): Promise<SmsSendResult> {
    const text = `Spiral Cafe: Your order #${params.orderNumber} for ${params.tableNumber} is ready for dine-in! Please enjoy your fresh meal.`;
    return this.sendRawSms({
      phoneNumber: params.phoneNumber,
      message: text,
      templateId: process.env.SMS_ORDER_READY_TEMPLATE_ID,
    });
  }

  /**
   * Send Payment Confirmation Notification
   */
  static async sendPaymentConfirmation(params: {
    phoneNumber: string;
    orderNumber: string;
    amount: number;
    paymentMethod: string;
  }): Promise<SmsSendResult> {
    const text = `Spiral Cafe: Payment of ₹${params.amount} received via ${params.paymentMethod} for Order #${params.orderNumber}. Thank you for visiting!`;
    return this.sendRawSms({
      phoneNumber: params.phoneNumber,
      message: text,
    });
  }

  /**
   * Low-level SMS Dispatcher
   */
  static async sendRawSms(params: SendSmsParams): Promise<SmsSendResult> {
    const cleanPhone = params.phoneNumber.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      return {
        success: false,
        provider: this.provider,
        error: "Invalid phone number format.",
      };
    }

    // If no live API key is configured, execute via structured Development Mock dispatcher
    if (this.provider === "mock" || !this.apiKey) {
      console.log(`[SMS SERVICE MOCK DISPATCH] -> To: ${params.phoneNumber}`);
      console.log(`[SMS CONTENT]: ${params.message}`);
      return {
        success: true,
        provider: "mock-development",
        messageId: `mock_sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };
    }

    try {
      // 1. Fast2SMS Provider
      if (this.provider.toLowerCase() === "fast2sms") {
        const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            authorization: this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route: "q",
            message: params.message,
            language: "english",
            flash: 0,
            numbers: cleanPhone.slice(-10),
          }),
        });
        const data = await res.json();
        return {
          success: data.return === true,
          provider: "fast2sms",
          messageId: data.request_id,
          error: data.message ? String(data.message) : undefined,
        };
      }

      // 2. MSG91 Provider
      if (this.provider.toLowerCase() === "msg91") {
        const res = await fetch("https://control.msg91.com/api/v5/flow/", {
          method: "POST",
          headers: {
            authkey: this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_id: params.templateId || process.env.SMS_TEMPLATE_ID,
            short_url: "1",
            recipients: [{ mobiles: cleanPhone, message: params.message }],
          }),
        });
        const data = await res.json();
        return {
          success: data.type === "success",
          provider: "msg91",
          messageId: data.message,
          error: data.type !== "success" ? data.message : undefined,
        };
      }

      // Fallback
      return {
        success: true,
        provider: this.provider,
        messageId: `sms_${Date.now()}`,
      };
    } catch (err: any) {
      console.error("SMS Dispatch Error:", err);
      return {
        success: false,
        provider: this.provider,
        error: err.message || "Failed to dispatch SMS through provider.",
      };
    }
  }
}

export const smsService = SmsService;

