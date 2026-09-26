import { NextRequest } from "next/server";
import { getSessionOrders, getAllOrders, orderEvents } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

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

      // 1. Send initial session orders
      const initialOrders = sessionId ? getSessionOrders(sessionId) : getAllOrders();
      send({ type: "init", orders: initialOrders });

      // 2. Listen for order updates
      const handleOrderUpdate = () => {
        const updatedOrders = sessionId ? getSessionOrders(sessionId) : getAllOrders();
        send({ type: "update", orders: updatedOrders });
      };

      orderEvents.on("orders_changed", handleOrderUpdate);

      // 3. Heartbeat to keep connection open through reverse proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // 4. Cleanup when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        orderEvents.off("orders_changed", handleOrderUpdate);
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
