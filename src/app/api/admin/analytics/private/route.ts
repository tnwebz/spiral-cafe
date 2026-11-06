import { NextRequest, NextResponse } from "next/server";
import { getPrivateOrders, getAllMenuItems } from "@/lib/db";
import { menuData } from "@/data/menu";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "today"; // yesterday, today, week, 30days, year, custom
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const purposeFilter = searchParams.get("purpose"); // OWNER, STAFF, OTHER_INTERNAL

    let orders = await getPrivateOrders();
    if (purposeFilter) {
      orders = orders.filter((o) => o.privatePurpose === purposeFilter);
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let periodLabel = "";
    let selectedDateLabel = "";

    const formatDateShort = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    if (range === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      periodLabel = "Yesterday";
      selectedDateLabel = formatDateShort(startDate);
    } else if (range === "date" && dateParam) {
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
    } else if (range === "week" || range === "this_week" || range === "7days") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = "Past 7 Days";
      selectedDateLabel = `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`;
    } else if (range === "30days" || range === "month" || range === "this_month") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = "Past 30 Days";
      selectedDateLabel = `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`;
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
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = "Today";
      selectedDateLabel = formatDateShort(startDate);
    }

    const filteredOrders = orders.filter((o) => {
      if (!o.createdAt) return false;
      const orderDate = new Date(o.createdAt);
      return orderDate.getTime() >= startDate.getTime() && orderDate.getTime() <= endDate.getTime();
    });

    const nonCancelledOrders = filteredOrders.filter((o) => o.status !== "CANCELLED");

    let totalPrivateSales = 0;
    let staffConsumption = 0;
    let ownerConsumption = 0;
    let otherConsumption = 0;
    let totalItemsCount = 0;

    nonCancelledOrders.forEach((o) => {
      const total = Number(o.grandTotal) || 0;
      totalPrivateSales += total;
      const purpose = o.privatePurpose || "STAFF";
      if (purpose === "STAFF") staffConsumption += total;
      else if (purpose === "OWNER") ownerConsumption += total;
      else otherConsumption += total;

      (o.items || []).forEach((it) => {
        totalItemsCount += Number(it.quantity) || 1;
      });
    });

    const totalOrders = nonCancelledOrders.length;
    const aov = totalOrders > 0 ? Math.round(totalPrivateSales / totalOrders) : 0;

    // Timeline construction
    let timeline: Array<{ label: string; date: string; amount: number; orders: number; fullPayment: number; credit: number }> = [];

    if (range === "today" || range === "yesterday" || range === "date") {
      const hoursMap: Record<number, { amount: number; orders: number }> = {};
      for (let h = 0; h < 24; h++) hoursMap[h] = { amount: 0, orders: 0 };

      nonCancelledOrders.forEach((o) => {
        const h = new Date(o.createdAt).getHours();
        if (hoursMap[h]) {
          hoursMap[h].amount += Number(o.grandTotal) || 0;
          hoursMap[h].orders += 1;
        }
      });

      timeline = Object.entries(hoursMap).map(([hStr, data]) => {
        const h = Number(hStr);
        const ampm = h >= 12 ? "PM" : "AM";
        const displayH = h % 12 === 0 ? 12 : h % 12;
        return {
          label: `${displayH} ${ampm}`,
          date: `${displayH} ${ampm}`,
          amount: data.amount,
          orders: data.orders,
          fullPayment: data.amount,
          credit: 0,
        };
      });
    } else {
      const daysDiff = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const daysMap: Record<string, { amount: number; orders: number; label: string }> = {};

      for (let i = 0; i <= daysDiff; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        daysMap[key] = { amount: 0, orders: 0, label };
      }

      nonCancelledOrders.forEach((o) => {
        const key = new Date(o.createdAt).toISOString().split("T")[0];
        if (daysMap[key]) {
          daysMap[key].amount += Number(o.grandTotal) || 0;
          daysMap[key].orders += 1;
        }
      });

      timeline = Object.entries(daysMap).map(([key, data]) => ({
        label: data.label,
        date: key,
        amount: data.amount,
        orders: data.orders,
        fullPayment: data.amount,
        credit: 0,
      }));
    }

    // Catalog mapping for photos and categories
    const catalogMap = new Map<string, { id: string; name: string; category: string; price: number; image: string }>();

    menuData.forEach((cat) => {
      cat.items.forEach((it) => {
        catalogMap.set(it.name.trim().toLowerCase(), {
          id: it.id,
          name: it.name.trim(),
          category: cat.name.toUpperCase(),
          price: it.price,
          image: it.image || "",
        });
      });
    });

    try {
      const dynamicItems = await getAllMenuItems();
      dynamicItems.forEach((it) => {
        if (it.name && it.available !== false) {
          catalogMap.set(it.name.trim().toLowerCase(), {
            id: it.id,
            name: it.name.trim(),
            category: (it.categoryName || "SPECIALS").toUpperCase(),
            price: it.price,
            image: it.image || "",
          });
        }
      });
    } catch (e) {
      console.error("Error loading dynamic menu items for private analytics:", e);
    }

    // Tally private consumed items
    const soldMap: Record<
      string,
      { id: string; name: string; category: string; image: string; quantity: number; revenue: number; unitPrice: number }
    > = {};

    nonCancelledOrders.forEach((o) => {
      (o.items || []).forEach((it) => {
        if (!it.name) return;
        const key = it.name.trim().toLowerCase();
        const catalogItem = catalogMap.get(key);

        if (!soldMap[key]) {
          soldMap[key] = {
            id: catalogItem?.id || key,
            name: catalogItem?.name || it.name.trim(),
            category: catalogItem?.category || "SPECIALS",
            image: catalogItem?.image || it.image || "",
            quantity: 0,
            revenue: 0,
            unitPrice: Number(it.price) || catalogItem?.price || 0,
          };
        }

        const qty = Number(it.quantity) || 1;
        const price = Number(it.price) || soldMap[key].unitPrice;
        const lineTotal = Number(it.lineTotal) || price * qty;
        soldMap[key].quantity += qty;
        soldMap[key].revenue += lineTotal;
      });
    });

    const soldItems = Object.values(soldMap);

    // Trending items: only items with quantity > 0
    const trendingItems = [...soldItems]
      .filter((i) => i.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 15);

    // Full product sold history for inventory buying table
    const productSoldHistory = [...soldItems]
      .filter((i) => i.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);

    // Purpose Donut percentages
    const donutTotal = totalPrivateSales;
    const staffPct = donutTotal > 0 ? Math.round((staffConsumption / donutTotal) * 100) : 0;
    const ownerPct = donutTotal > 0 ? Math.round((ownerConsumption / donutTotal) * 100) : 0;
    const otherPct = donutTotal > 0 ? Math.max(0, 100 - staffPct - ownerPct) : 0;

    return NextResponse.json({
      success: true,
      storeName: "Spiral Cafe (Private & Internal)",
      range,
      periodLabel,
      selectedDateLabel,
      metrics: {
        totalSales: totalPrivateSales,
        grossSales: totalPrivateSales,
        totalOrders,
        totalItems: totalItemsCount,
        paidOrders: totalOrders,
        cashSales: 0,
        onlineSales: 0,
        creditSales: 0,
        staffConsumption,
        ownerConsumption,
        otherConsumption,
        expenses: totalPrivateSales,
        averageOrderValue: aov,
      },
      donut: {
        staff: staffConsumption,
        owner: ownerConsumption,
        other: otherConsumption,
        staffPct,
        ownerPct,
        otherPct,
        fullPayment: staffConsumption,
        credit: ownerConsumption,
        fullPaymentPct: staffPct,
        creditPct: ownerPct,
      },
      timeline,
      trendingItems,
      productSoldHistory,
      ordersList: nonCancelledOrders.slice(0, 50).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        purpose: o.privatePurpose || "STAFF",
        note: o.privateNote || "",
        grandTotal: o.grandTotal,
        itemsCount: (o.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0),
        items: o.items,
        createdAt: o.createdAt,
      })),
      insights: {
        aov,
        staffSummary: `₹${totalPrivateSales} total internal consumption across ${totalOrders} private orders.`,
        topPurposeText:
          ownerConsumption > staffConsumption
            ? `Owner consumption accounts for ₹${ownerConsumption} (${ownerPct}%) this period.`
            : `Staff food consumption accounts for ₹${staffConsumption} (${staffPct}%) this period.`,
      },
    });
  } catch (err: any) {
    console.error("Private Analytics API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

