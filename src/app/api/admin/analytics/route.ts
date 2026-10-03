import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, getAllMenuItems } from "@/lib/db";
import { menuData } from "@/data/menu";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "today"; // today, week, month, year, date, custom
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const orders = await getAllOrders();
    const now = new Date();

    let startDate: Date;
    let endDate: Date;
    let periodLabel = "";
    let selectedDateLabel = "";

    const formatDateShort = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    if (range === "date" && dateParam) {
      const parts = dateParam.split("-").map(Number);
      startDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      endDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      const formatted = formatDateShort(startDate);
      periodLabel = formatted;
      selectedDateLabel = formatted;
    } else if (range === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = "Today";
      selectedDateLabel = formatDateShort(startDate);
    } else if (range === "week" || range === "this_week") {
      const currentDay = now.getDay();
      const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59, 999);
      periodLabel = "This Week";
      selectedDateLabel = `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`;
    } else if (range === "month" || range === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      periodLabel = monthYear;
      selectedDateLabel = monthYear;
    } else if (range === "year" || range === "this_year") {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      const yearStr = `${now.getFullYear()}`;
      periodLabel = yearStr;
      selectedDateLabel = yearStr;
    } else if (range === "custom" && startDateParam) {
      const sParts = startDateParam.split("-").map(Number);
      startDate = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0);
      if (endDateParam) {
        const eParts = endDateParam.split("-").map(Number);
        endDate = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999);
      } else {
        endDate = new Date(sParts[0], sParts[1] - 1, sParts[2], 23, 59, 59, 999);
      }
      const sFormatted = formatDateShort(startDate);
      const eFormatted = formatDateShort(endDate);
      periodLabel = sFormatted === eFormatted ? sFormatted : `${sFormatted} – ${eFormatted}`;
      selectedDateLabel = periodLabel;
    } else {
      // Default to today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = "Today";
      selectedDateLabel = formatDateShort(startDate);
    }

    const filteredOrders = orders.filter((o) => {
      if (!o.createdAt) return false;
      const orderDate = new Date(o.createdAt);
      if (range === "date" && dateParam) {
        const orderLocalStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`;
        const orderUtcStr = o.createdAt.slice(0, 10);
        return (
          orderLocalStr === dateParam ||
          orderUtcStr === dateParam ||
          (orderDate.getTime() >= startDate.getTime() && orderDate.getTime() <= endDate.getTime())
        );
      }
      return orderDate.getTime() >= startDate.getTime() && orderDate.getTime() <= endDate.getTime();
    });

    const paidOrders = filteredOrders.filter((o) => o.paymentStatus === "PAID");
    const grossSales = paidOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

    const cashSales = paidOrders
      .filter((o) => o.paymentMethod === "CASH")
      .reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

    const onlineSales = paidOrders
      .filter((o) => o.paymentMethod === "ONLINE")
      .reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

    const totalOrders = filteredOrders.filter((o) => o.status !== "CANCELLED").length;

    // 1. Catalog Gathering
    const catalogMap = new Map<string, { name: string; category?: string; price?: number }>();

    menuData.forEach((cat) => {
      cat.items.forEach((it) => {
        catalogMap.set(it.name.trim().toLowerCase(), {
          name: it.name.trim(),
          category: cat.name,
          price: it.price,
        });
      });
    });

    try {
      const dynamicItems = await getAllMenuItems();
      dynamicItems.forEach((it) => {
        if (it.name && it.available !== false) {
          catalogMap.set(it.name.trim().toLowerCase(), {
            name: it.name.trim(),
            category: it.categoryName,
            price: it.price,
          });
        }
      });
    } catch (e) {
      console.error("Error loading dynamic menu items for analytics:", e);
    }

    // 2. Count quantities sold for non-cancelled orders in period
    const soldMap: Record<string, { name: string; quantity: number; revenue: number; category?: string }> = {};

    filteredOrders
      .filter((o) => o.status !== "CANCELLED")
      .forEach((o) => {
        (o.items || []).forEach((it) => {
          if (!it.name) return;
          const key = it.name.trim().toLowerCase();
          if (!soldMap[key]) {
            const catalogItem = catalogMap.get(key);
            soldMap[key] = {
              name: catalogItem?.name || it.name.trim(),
              quantity: 0,
              revenue: 0,
              category: catalogItem?.category,
            };
          }
          const qty = Number(it.quantity) || 1;
          const price = Number((it as any).unitPrice || it.price) || 0;
          const lineTotal = Number(it.lineTotal) || price * qty;
          soldMap[key].quantity += qty;
          soldMap[key].revenue += lineTotal;
        });
      });

    // 3. Top Selling, Low Selling, Not Sold
    const soldItems = Object.values(soldMap).filter((item) => item.quantity > 0);

    const topSelling = [...soldItems].sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return b.revenue - a.revenue;
    });

    const lowSelling = [...soldItems].sort((a, b) => {
      if (a.quantity !== b.quantity) return a.quantity - b.quantity;
      return a.revenue - b.revenue;
    });

    const notSold: Array<{ name: string; quantity: number; category?: string }> = [];
    catalogMap.forEach((item, key) => {
      if (!soldMap[key] || soldMap[key].quantity === 0) {
        notSold.push({
          name: item.name,
          quantity: 0,
          category: item.category,
        });
      }
    });
    notSold.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      range,
      periodLabel,
      selectedDateLabel,
      metrics: {
        grossSales,
        totalOrders,
        cashSales,
        onlineSales,
        orderCount: totalOrders,
        paidOrders: paidOrders.length,
      },
      topSelling,
      lowSelling,
      notSold,
    });
  } catch (err: any) {
    console.error("Analytics API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
