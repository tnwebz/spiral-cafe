import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, getAllMenuItems } from "@/lib/db";
import { menuData } from "@/data/menu";
import { requireAdminAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "today"; // yesterday, today, week, 30days (or month), year, date, custom
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const allOrders = await getAllOrders();
    // Exclude private orders strictly from customer analytics
    const orders = allOrders.filter((o) => o.orderType !== "PRIVATE");
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
      // Default to today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = "Today";
      selectedDateLabel = formatDateShort(startDate);
    }

    // Filter orders within the selected time window
    const filteredOrders = orders.filter((o) => {
      if (!o.createdAt) return false;
      const orderDate = new Date(o.createdAt);
      return orderDate.getTime() >= startDate.getTime() && orderDate.getTime() <= endDate.getTime();
    });

    const nonCancelledOrders = filteredOrders.filter((o) => o.status !== "CANCELLED");
    const paidOrders = nonCancelledOrders.filter((o) => o.paymentStatus === "PAID");
    const creditOrders = nonCancelledOrders.filter((o) => o.paymentStatus !== "PAID");

    const fullPaymentSales = paidOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
    const creditSales = creditOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
    const totalGrossSales = fullPaymentSales + creditSales;

    const cashSales = paidOrders
      .filter((o) => o.paymentMethod === "CASH")
      .reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

    const onlineSales = paidOrders
      .filter((o) => o.paymentMethod === "ONLINE")
      .reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

    const totalOrders = nonCancelledOrders.length;
    const paidOrdersCount = paidOrders.length;
    const aov = paidOrdersCount > 0 ? fullPaymentSales / paidOrdersCount : (totalOrders > 0 ? totalGrossSales / totalOrders : 0);

    // Build timeline buckets matching the UI images
    interface TimelinePoint {
      label: string;
      fullLabel: string;
      sales: number;
      orders: number;
      cash: number;
      online: number;
      credit: number;
    }

    const timeline: TimelinePoint[] = [];

    const isSingleDay =
      range === "today" ||
      range === "yesterday" ||
      (range === "date" && dateParam) ||
      (range === "custom" && startDate.toDateString() === endDate.toDateString());

    if (isSingleDay) {
      // 12 2-hour buckets: 12am, 2am, 4am, 6am, 8am, 10am, 12pm, 2pm, 4pm, 6pm, 8pm, 10pm
      const hourlyLabels = [
        "12am", "2am", "4am", "6am", "8am", "10am",
        "12pm", "2pm", "4pm", "6pm", "8pm", "10pm"
      ];

      for (let i = 0; i < 12; i++) {
        const startHour = i * 2;
        const endHour = startHour + 2;

        const bucketOrders = nonCancelledOrders.filter((o) => {
          const d = new Date(o.createdAt);
          const h = d.getHours();
          return h >= startHour && h < endHour;
        });

        const bucketPaid = bucketOrders.filter((o) => o.paymentStatus === "PAID");
        const bucketCredit = bucketOrders.filter((o) => o.paymentStatus !== "PAID");

        const bucketSales = bucketPaid.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0);
        const bucketCreditVal = bucketCredit.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0);
        const bucketCash = bucketPaid.filter((o) => o.paymentMethod === "CASH").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0);
        const bucketOnline = bucketPaid.filter((o) => o.paymentMethod === "ONLINE").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0);

        timeline.push({
          label: hourlyLabels[i],
          fullLabel: `${hourlyLabels[i]} – ${hourlyLabels[(i + 1) % 12]}`,
          sales: bucketSales,
          orders: bucketOrders.length,
          cash: bucketCash,
          online: bucketOnline,
          credit: bucketCreditVal,
        });
      }
    } else if (range === "week" || range === "this_week") {
      // 7 day buckets: Mon, Tue, Wed, Thu, Fri, Sat, Sun
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + d);
        const dayStr = dayDate.toISOString().slice(0, 10);

        const bucketOrders = nonCancelledOrders.filter((o) => {
          return o.createdAt.slice(0, 10) === dayStr;
        });

        const bucketPaid = bucketOrders.filter((o) => o.paymentStatus === "PAID");
        const bucketCredit = bucketOrders.filter((o) => o.paymentStatus !== "PAID");

        timeline.push({
          label: dayNames[d],
          fullLabel: dayDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          sales: bucketPaid.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          orders: bucketOrders.length,
          cash: bucketPaid.filter((o) => o.paymentMethod === "CASH").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          online: bucketPaid.filter((o) => o.paymentMethod === "ONLINE").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          credit: bucketCredit.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
        });
      }
    } else if (range === "30days" || range === "month" || range === "this_month") {
      // 10 steps across the past 30 days (every 3 days)
      for (let d = 0; d < 30; d += 3) {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + d);
        const nextDate = new Date(dayDate);
        nextDate.setDate(dayDate.getDate() + 3);

        const bucketOrders = nonCancelledOrders.filter((o) => {
          const t = new Date(o.createdAt).getTime();
          return t >= dayDate.getTime() && t < nextDate.getTime();
        });

        const bucketPaid = bucketOrders.filter((o) => o.paymentStatus === "PAID");
        const bucketCredit = bucketOrders.filter((o) => o.paymentStatus !== "PAID");

        timeline.push({
          label: dayDate.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
          fullLabel: `${dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          sales: bucketPaid.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          orders: bucketOrders.length,
          cash: bucketPaid.filter((o) => o.paymentMethod === "CASH").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          online: bucketPaid.filter((o) => o.paymentMethod === "ONLINE").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          credit: bucketCredit.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
        });
      }
    } else if (range === "year" || range === "this_year") {
      // 12 months
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      for (let m = 0; m < 12; m++) {
        const bucketOrders = nonCancelledOrders.filter((o) => {
          const d = new Date(o.createdAt);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === m;
        });

        const bucketPaid = bucketOrders.filter((o) => o.paymentStatus === "PAID");
        const bucketCredit = bucketOrders.filter((o) => o.paymentStatus !== "PAID");

        timeline.push({
          label: months[m],
          fullLabel: `${months[m]} ${now.getFullYear()}`,
          sales: bucketPaid.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          orders: bucketOrders.length,
          cash: bucketPaid.filter((o) => o.paymentMethod === "CASH").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          online: bucketPaid.filter((o) => o.paymentMethod === "ONLINE").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          credit: bucketCredit.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
        });
      }
    } else {
      // Default: daily points for custom range
      const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const step = Math.max(1, Math.floor(diffDays / 10));
      for (let d = 0; d < diffDays; d += step) {
        const cur = new Date(startDate);
        cur.setDate(startDate.getDate() + d);
        const next = new Date(cur);
        next.setDate(cur.getDate() + step);

        const bucketOrders = nonCancelledOrders.filter((o) => {
          const t = new Date(o.createdAt).getTime();
          return t >= cur.getTime() && t < next.getTime();
        });

        const bucketPaid = bucketOrders.filter((o) => o.paymentStatus === "PAID");
        const bucketCredit = bucketOrders.filter((o) => o.paymentStatus !== "PAID");

        timeline.push({
          label: cur.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          fullLabel: cur.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          sales: bucketPaid.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          orders: bucketOrders.length,
          cash: bucketPaid.filter((o) => o.paymentMethod === "CASH").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          online: bucketPaid.filter((o) => o.paymentMethod === "ONLINE").reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
          credit: bucketCredit.reduce((acc, o) => acc + (Number(o.grandTotal) || 0), 0),
        });
      }
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
      console.error("Error loading dynamic menu items for analytics:", e);
    }

    // Tally sold items
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
            image: catalogItem?.image || (it as any).image || "",
            quantity: 0,
            revenue: 0,
            unitPrice: Number((it as any).unitPrice || it.price) || catalogItem?.price || 0,
          };
        }

        const qty = Number(it.quantity) || 1;
        const price = Number((it as any).unitPrice || it.price) || soldMap[key].unitPrice;
        const lineTotal = Number(it.lineTotal) || price * qty;
        soldMap[key].quantity += qty;
        soldMap[key].revenue += lineTotal;
      });
    });

    const soldItems = Object.values(soldMap);

    const trendingItems = [...soldItems]
      .filter((i) => i.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 15);

    // Full product sold history for inventory buying
    const productSoldHistory = [...soldItems]
      .filter((i) => i.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);

    // Products not sold in period
    const notSoldItems: Array<{ id: string; name: string; category: string; price: number; quantity: number }> = [];
    catalogMap.forEach((it, key) => {
      if (!soldMap[key] || soldMap[key].quantity === 0) {
        notSoldItems.push({
          id: it.id,
          name: it.name,
          category: it.category,
          price: it.price,
          quantity: 0,
        });
      }
    });

    // Peak sales hour detection
    const hourCounts: Record<number, number> = {};
    nonCancelledOrders.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });

    let peakHour = 21; // default 9 PM
    let peakCount = 0;
    Object.entries(hourCounts).forEach(([h, count]) => {
      const numH = Number(h);
      if (count > peakCount) {
        peakCount = count;
        peakHour = numH;
      }
    });

    const formatHourDisplay = (h: number) => {
      const ampm = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return `${displayH}${ampm}`;
    };

    const customersWithoutPhone = nonCancelledOrders.filter((o) => !o.customerPhone).length;

    // Donut percentages
    const donutTotal = fullPaymentSales + creditSales;
    const fullPaymentPct = donutTotal > 0 ? Math.round((fullPaymentSales / donutTotal) * 100) : 100;
    const creditPct = donutTotal > 0 ? 100 - fullPaymentPct : 0;

    return NextResponse.json({
      success: true,
      storeName: "Spiral Cafe",
      range,
      periodLabel,
      selectedDateLabel,
      metrics: {
        totalSales: fullPaymentSales,
        grossSales: totalGrossSales,
        totalOrders,
        paidOrders: paidOrdersCount,
        cashSales,
        onlineSales,
        creditSales,
        expenses: 0,
        averageOrderValue: aov,
      },
      donut: {
        fullPayment: fullPaymentSales,
        credit: creditSales,
        fullPaymentPct,
        creditPct,
      },
      timeline,
      trendingItems,
      productSoldHistory,
      notSoldItems,
      insights: {
        aov: aov,
        aovText: `₹${aov.toFixed(2)} average order value at Spiral Cafe! Either everyone's hungry or just living large 🔥🔥`,
        customerInfoText: `Spiral Cafe had ${totalOrders} orders but ${customersWithoutPhone} customer info! — Maybe customers are shy and didn't give their names 🍯`,
        peakHourText: `Spiral Cafe reaches its night sales peak around ${formatHourDisplay(peakHour)} -- night owls fueling up 🌙🔥`,
      },
    });
  } catch (err: any) {
    console.error("Analytics API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
