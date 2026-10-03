import { NextResponse } from "next/server";
import { getAllOrders, getAllInvoices, getAllCustomers, getConfig } from "@/lib/db";

export async function GET() {
  try {
    const [orders, invoices, customers, config] = await Promise.all([
      getAllOrders(),
      getAllInvoices(),
      getAllCustomers(),
      getConfig(),
    ]);

    const todayStr = new Date().toISOString().split("T")[0];
    const todayOrders = orders.filter((o) => o.createdAt.startsWith(todayStr));

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

    const avgOrderValue = todayPaidOrders.length > 0
      ? Math.round(todaySales / todayPaidOrders.length)
      : (todayOrders.length > 0 ? Math.round(todayOrders.reduce((s, o) => s + o.grandTotal, 0) / todayOrders.length) : 0);

    const activeTablesSet = new Set(
      orders
        .filter((o) => o.status === "PENDING" || o.status === "PREPARING" || o.status === "READY")
        .map((o) => o.tableNumber)
    );

    // Sales & Orders by Hour
    const hourlyData: Array<{ hour: string; count: number; sales: number }> = [];
    for (let h = 0; h < 24; h++) {
      const hourStr = `${h.toString().padStart(2, "0")}:00`;
      const hourOrders = todayOrders.filter((o) => new Date(o.createdAt).getHours() === h);
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

    const pendingOrders = orders.filter((o) => o.status === "PENDING").length;
    const preparingOrders = orders.filter((o) => o.status === "PREPARING").length;
    const readyOrders = orders.filter((o) => o.status === "READY").length;

    // Current / Active orders: in kitchen pipeline OR unpaid / awaiting cash settlement
    const currentOrders = orders.filter(
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
