import { NextRequest } from "next/server";
import { getActiveKitchenOrders, getConfig, orderEvents } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pin = searchParams.get("pin");
  const config = getConfig();

  if (pin !== config.kitchenPin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (payload: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      // 1. Send current kitchen state on initial connection
      const initialData = getActiveKitchenOrders();
      send({ type: "init", ...initialData });

      // 2. Broadcast active updates whenever any order changes
      const handleOrdersChanged = (eventPayload: any) => {
        const currentData = getActiveKitchenOrders();
        send({
          type: "update",
          event: eventPayload.type,
          affectedOrder: eventPayload.order,
          ...currentData,
        });
      };

      orderEvents.on("orders_changed", handleOrdersChanged);

      // 3. Heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // 4. Cleanup
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        orderEvents.off("orders_changed", handleOrdersChanged);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
