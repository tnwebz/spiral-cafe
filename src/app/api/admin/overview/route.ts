import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, getAllInvoices, getAllCustomers, getConfig } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;
  try {
    const [allOrdersRaw, invoices, customers, config] = await Promise.all([
      getAllOrders(),
      getAllInvoices(),
      getAllCustomers(),
      getConfig(),
    ]);

    // Exclude private orders strictly from normal customer overview metrics
    const orders = allOrdersRaw.filter((o) => o.orderType !== "PRIVATE");

    // Accurate Kolkata date for today's cafe business shift
    const todayKolkata = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const isToday = (dateStr: string) => {
      try {
        const orderDateKolkata = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(dateStr));
        return orderDateKolkata === todayKolkata;
      } catch {
        return false;
      }
    };

    const todayOrders = orders.filter((o) => isToday(o.createdAt));

    // KPI Metrics
    const todayPaidOrders = todayOrders.filter((o) => o.paymentStatus === "PAID");
    const todayUnpaidOrders = todayOrders.filter(
      (o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED"
    );

    const todaySales = todayPaidOrders.reduce((sum, o) => sum + o.grandTotal, 0);
    const pendingPaymentsAmount = todayUnpaidOrders.reduce((sum, o) => sum + o.grandTotal, 0);
    const taxCollected = todayPaidOrders.reduce((sum, o) => sum + o.tax, 0);

    const cashPayments = todayPaidOrders
      .filter((o) => o.paymentMethod === "CASH")
      .reduce((sum, o) => sum + o.grandTotal, 0);

    const onlinePayments = todayPaidOrders
      .filter((o) => o.paymentMethod === "ONLINE")
      .reduce((sum, o) => sum + o.grandTotal, 0);

    // Real average settled ticket value:
    const avgOrderValue = todayPaidOrders.length > 0
      ? Math.round(todaySales / todayPaidOrders.length)
      : 0;

    // Active dining tables strictly for today's active dine-in orders:
    const activeTablesSet = new Set(
      todayOrders
        .filter(
          (o) =>
            (o.status === "PENDING" || o.status === "PREPARING" || o.status === "READY") &&
            o.paymentStatus !== "PAID" &&
            o.tableNumber &&
            !o.tableNumber.toUpperCase().includes("TAKEAWAY")
        )
        .map((o) => o.tableNumber)
    );

    // Sales & Orders by Hour in Kolkata timezone
    const hourlyData: Array<{ hour: string; count: number; sales: number }> = [];
    for (let h = 0; h < 24; h++) {
      const hourStr = `${h.toString().padStart(2, "0")}:00`;
      const hourOrders = todayOrders.filter((o) => {
        try {
          const orderHour = parseInt(
            new Intl.DateTimeFormat("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "numeric",
              hour12: false,
            }).format(new Date(o.createdAt)),
            10
          );
          return orderHour === h;
        } catch {
          return false;
        }
      });
      const hourSales = hourOrders
        .filter((o) => o.paymentStatus === "PAID")
        .reduce((sum, o) => sum + o.grandTotal, 0);

      hourlyData.push({
        hour: hourStr,
        count: hourOrders.length,
        sales: hourSales,
      });
    }

    // Top Selling Items Today
    const itemCounts: Record<string, { name: string; quantity: number; total: number }> = {};
    todayOrders.forEach((o) => {
      o.items.forEach((it) => {
        if (!itemCounts[it.name]) {
          itemCounts[it.name] = { name: it.name, quantity: 0, total: 0 };
        }
        itemCounts[it.name].quantity += it.quantity;
        itemCounts[it.name].total += it.lineTotal;
      });
    });

    const topSellingItems = Object.values(itemCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const paymentSplit = {
      cash: cashPayments,
      online: onlinePayments,
      unpaid: pendingPaymentsAmount,
    };

    // Kitchen & Order Pipeline counts strictly for today:
    const pendingOrders = todayOrders.filter((o) => o.status === "PENDING").length;
    const preparingOrders = todayOrders.filter((o) => o.status === "PREPARING").length;
    const readyOrders = todayOrders.filter((o) => o.status === "READY").length;

    // Current / Active orders strictly for today awaiting settlement or fulfillment
    const currentOrders = todayOrders.filter(
      (o) => !(o.status === "COMPLETED" && o.paymentStatus === "PAID") && o.status !== "CANCELLED"
    );

    return NextResponse.json({
      success: true,
      kpis: {
        todaySales,
        ordersToday: todayOrders.length,
        paidOrders: todayPaidOrders.length,
        unpaidOrders: todayUnpaidOrders.length,
        pendingPaymentsAmount,
        pendingPayments: pendingPaymentsAmount,
        pendingOrders,
        preparingOrders,
        readyOrders,
        avgOrderValue,
        onlinePayments,
        cashPayments,
        activeTables: activeTablesSet.size,
        taxCollected,
        totalCustomers: customers.length,
        totalInvoices: invoices.length,
      },
      hourlySales: hourlyData,
      paymentSplit,
      topSellingItems,
      currentOrders: currentOrders.slice(0, 20),
      recentOrders: orders.slice(0, 20),
    });
  } catch (err: any) {
    console.error("Admin overview API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
