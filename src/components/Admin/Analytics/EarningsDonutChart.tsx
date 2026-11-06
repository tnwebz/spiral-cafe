"use client";

import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface EarningsDonutProps {
  cash: number;
  online: number;
  credit: number;
  currencySymbol?: string;
  totalOrders?: number;
}

const SEGMENT_COLORS = {
  online: "#2563eb", // Blue
  cash: "#059669",   // Emerald
  credit: "#f59e0b", // Amber
};

export default function EarningsDonutChart({
  cash = 0,
  online = 0,
  credit = 0,
  currencySymbol = "₹",
  totalOrders = 0,
}: EarningsDonutProps) {
  const { data, total, segments } = useMemo(() => {
    const sum = cash + online + credit;
    const safeSum = sum > 0 ? sum : 1;

    const items = [
      {
        name: "Online / UPI",
        key: "online",
        value: online,
        color: SEGMENT_COLORS.online,
        percent: Math.round((online / safeSum) * 100),
      },
      {
        name: "Cash in Drawer",
        key: "cash",
        value: cash,
        color: SEGMENT_COLORS.cash,
        percent: Math.round((cash / safeSum) * 100),
      },
      {
        name: "Credit / Unsettled",
        key: "credit",
        value: credit,
        color: SEGMENT_COLORS.credit,
        percent: Math.round((credit / safeSum) * 100),
      },
    ].filter((s) => s.value > 0 || sum === 0);

    // If all are 0, show placeholder
    const chartData = sum === 0 ? [{ name: "No Sales", value: 1, color: "#e4e4e7" }] : items;

    return {
      data: chartData,
      total: sum,
      segments: items,
    };
  }, [cash, online, credit]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
        <div>
          <h3 className="font-heading font-extrabold text-base text-zinc-900">
            Earnings &amp; Payment Breakdown
          </h3>
          <p className="text-xs text-zinc-500 font-medium">
            Collections grouped by channel &amp; settlement
          </p>
        </div>
        <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-3 py-1 rounded-full">
          {totalOrders} Orders
        </span>
      </div>

      {/* Donut Chart with Center Text */}
      <div className="relative h-56 w-full flex items-center justify-center my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const seg = payload[0].payload;
                if (total === 0) return null;
                return (
                  <div className="bg-zinc-900 text-white rounded-xl px-3 py-1.5 text-xs shadow-lg">
                    <span className="font-semibold">{seg.name}:</span>{" "}
                    <span className="font-bold text-emerald-400">
                      {currencySymbol}{Number(seg.value).toLocaleString()}
                    </span>{" "}
                    ({seg.percent}%)
                  </div>
                );
              }}
            />
            <Pie
              data={data}
              innerRadius={68}
              outerRadius={88}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              cornerRadius={6}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Total Revenue
          </span>
          <span className="font-heading font-extrabold text-2xl text-zinc-950">
            {currencySymbol}{total.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
            100% Realtime
          </span>
        </div>
      </div>

      {/* Segment Breakdown Pills */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-100">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col gap-0.5"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 truncate">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              ></span>
              <span className="truncate">{seg.name}</span>
            </div>
            <div className="font-heading font-extrabold text-sm text-zinc-900 mt-1">
              {currencySymbol}{seg.value.toLocaleString()}
            </div>
            <div className="text-[10px] font-bold text-zinc-400">
              {seg.percent}% of total
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

