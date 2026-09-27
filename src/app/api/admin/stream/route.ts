import { NextRequest } from "next/server";
import { orderEvents, getAllOrders, getAllInvoices, getSettlementSummary } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat and data snapshot
      const initialPayload = JSON.stringify({
        type: "init",
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`event: message\ndata: ${initialPayload}\n\n`));

      // Order created listener
      const onOrderCreated = (order: any) => {
        const payload = JSON.stringify({ type: "order_created", order });
        controller.enqueue(encoder.encode(`event: order\ndata: ${payload}\n\n`));
      };

      // Order updated listener
      const onOrderUpdated = (order: any) => {
        const payload = JSON.stringify({ type: "order_updated", order });
        controller.enqueue(encoder.encode(`event: order\ndata: ${payload}\n\n`));
      };

      // Payment updated listener
      const onPaymentUpdated = (order: any) => {
        const payload = JSON.stringify({ type: "payment_updated", order });
        controller.enqueue(encoder.encode(`event: payment\ndata: ${payload}\n\n`));
      };

      // Invoice created listener
      const onInvoiceCreated = (invoice: any) => {
        const payload = JSON.stringify({ type: "invoice_created", invoice });
        controller.enqueue(encoder.encode(`event: invoice\ndata: ${payload}\n\n`));
      };

      // Menu updated listener
      const onMenuUpdated = (menu: any) => {
        const payload = JSON.stringify({ type: "menu_updated" });
        controller.enqueue(encoder.encode(`event: menu\ndata: ${payload}\n\n`));
      };

      orderEvents.on("order_created", onOrderCreated);
      orderEvents.on("order_updated", onOrderUpdated);
      orderEvents.on("payment_updated", onPaymentUpdated);
      orderEvents.on("invoice_created", onInvoiceCreated);
      orderEvents.on("menu_updated", onMenuUpdated);

      // Keep-alive heartbeat every 20s
      const interval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`: heartbeat ${new Date().toISOString()}\n\n`)
          );
        } catch {
          clearInterval(interval);
        }
      }, 20000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        orderEvents.off("order_created", onOrderCreated);
        orderEvents.off("order_updated", onOrderUpdated);
        orderEvents.off("payment_updated", onPaymentUpdated);
        orderEvents.off("invoice_created", onInvoiceCreated);
        orderEvents.off("menu_updated", onMenuUpdated);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
