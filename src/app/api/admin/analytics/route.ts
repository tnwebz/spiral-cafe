import { NextRequest, NextResponse } from "next/server";
import { getAllOrders } from "@/lib/db";
import { menuData } from "@/data/menu";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7days"; // today, yesterday, 7days, 30days, custom
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const orders = getAllOrders();
    const now = new Date();

    let startDate: Date;
    let endDate = new Date();

    if (range === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (range === "yesterday") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    } else if (range === "30days") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (range === "custom" && startDateParam) {
      startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      if (endDateParam) {
        endDate = new Date(endDateParam);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      // default 7 days
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    const filteredOrders = orders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    const paidOrders = filteredOrders.filter((o) => o.paymentStatus === "PAID");
    const unpaidOrders = filteredOrders.filter(
      (o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED"
    );

    const grossSales = paidOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const totalTax = paidOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
    const netSales = grossSales - totalTax;

    const cashCollection = paidOrders
      .filter((o) => o.paymentMethod === "CASH")
      .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    const onlineCollection = paidOrders
      .filter((o) => o.paymentMethod === "ONLINE")
      .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    const avgOrderValue = paidOrders.length > 0 ? Math.round(grossSales / paidOrders.length) : 0;

    // Daily breakdown for charts
    const dailyMap: Record<string, { date: string; sales: number; orders: number; cash: number; online: number }> = {};

    filteredOrders.forEach((o) => {
      const dateKey = o.createdAt ? o.createdAt.split("T")[0] : new Date().toISOString().split("T")[0];
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, sales: 0, orders: 0, cash: 0, online: 0 };
      }
      dailyMap[dateKey].orders += 1;
      if (o.paymentStatus === "PAID") {
        dailyMap[dateKey].sales += (o.grandTotal || 0);
        if (o.paymentMethod === "CASH") dailyMap[dateKey].cash += (o.grandTotal || 0);
        if (o.paymentMethod === "ONLINE") dailyMap[dateKey].online += (o.grandTotal || 0);
      }
    });

    const dailyTrends = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Category mapping lookup
    const itemToCategory: Record<string, string> = {};
    menuData.forEach((cat) => {
      cat.items.forEach((it) => {
        itemToCategory[it.id] = cat.name;
        itemToCategory[it.name.toLowerCase().trim()] = cat.name;
      });
    });

    // Category Sales Breakdown & Items ranking & Table performance
    const categoryMap: Record<string, { name: string; revenue: number; quantity: number }> = {};
    const itemMap: Record<string, { name: string; quantity: number; revenue: number; total: number }> = {};
    const tablePerformance: Record<string, { table: string; orders: number; revenue: number; sales: number }> = {};

    filteredOrders.forEach((o) => {
      const tbl = o.tableNumber || "Takeout";
      if (!tablePerformance[tbl]) {
        tablePerformance[tbl] = { table: tbl, orders: 0, revenue: 0, sales: 0 };
      }
      tablePerformance[tbl].orders += 1;
      if (o.paymentStatus === "PAID") {
        tablePerformance[tbl].revenue += (o.grandTotal || 0);
        tablePerformance[tbl].sales += (o.grandTotal || 0);
      }

      (o.items || []).forEach((it) => {
        if (!itemMap[it.name]) {
          itemMap[it.name] = { name: it.name, quantity: 0, revenue: 0, total: 0 };
        }
        itemMap[it.name].quantity += (it.quantity || 1);
        itemMap[it.name].revenue += (it.lineTotal || 0);
        itemMap[it.name].total += (it.lineTotal || 0);

        const catName =
          itemToCategory[it.productId] ||
          itemToCategory[it.name?.toLowerCase().trim()] ||
          "Specialty Menu";

        if (!categoryMap[catName]) {
          categoryMap[catName] = { name: catName, revenue: 0, quantity: 0 };
        }
        categoryMap[catName].quantity += (it.quantity || 1);
        categoryMap[catName].revenue += (it.lineTotal || 0);
      });
    });

    const sortedItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);
    const topSellingItems = sortedItems.slice(0, 8);
    const leastSellingItems = [...sortedItems].reverse().slice(0, 5);
    const categoryBreakdown = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue);
    const tablePerformanceList = Object.values(tablePerformance).sort((a, b) => b.sales - a.sales);

    return NextResponse.json({
      success: true,
      range,
      metrics: {
        grossSales,
        netSales,
        totalTax,
        taxCollected: totalTax,
        orderCount: filteredOrders.length,
        paidOrders: paidOrders.length,
        unpaidOrders: unpaidOrders.length,
        cashCollection,
        cashSales: cashCollection,
        onlineCollection,
        onlineSales: onlineCollection,
        avgOrderValue,
      },
      dailyTrends,
      dailyTrend: dailyTrends,
      categoryBreakdown,
      topSellingItems,
      topItems: topSellingItems,
      leastSellingItems,
      leastItems: leastSellingItems,
      tablePerformance: tablePerformanceList,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
