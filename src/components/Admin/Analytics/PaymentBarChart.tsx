"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PaymentBarPoint {
  label: string;
  cash: number;
  online: number;
}

interface PaymentBarChartProps {
  data: PaymentBarPoint[];
  currencySymbol?: string;
}

export default function PaymentBarChart({
  data,
  currencySymbol = "₹",
}: PaymentBarChartProps) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
        <div>
          <h3 className="font-heading font-extrabold text-base text-zinc-900">
            Payment Method Comparison
          </h3>
          <p className="text-xs text-zinc-500 font-medium">
            Cash in drawer vs Razorpay / Online UPI
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <span className="text-zinc-600">Cash</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <span className="text-zinc-600">Online / UPI</span>
          </div>
        </div>
      </div>

      <div className="h-64 sm:h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#71717a", fontSize: 11, fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#71717a", fontSize: 11, fontWeight: 500 }}
              tickFormatter={(v) => `${currencySymbol}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const cashVal = payload.find((p) => p.dataKey === "cash")?.value || 0;
                const onlineVal = payload.find((p) => p.dataKey === "online")?.value || 0;
                return (
                  <div className="bg-zinc-900 text-white rounded-2xl p-3 shadow-xl text-xs flex flex-col gap-1 border border-zinc-800">
                    <div className="font-bold text-zinc-300 border-b border-zinc-800 pb-1 mb-1">
                      {label}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Cash:
                      </span>
                      <span className="font-mono font-bold">
                        {currencySymbol}{Number(cashVal).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-blue-400">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Online/UPI:
                      </span>
                      <span className="font-mono font-bold">
                        {currencySymbol}{Number(onlineVal).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="cash"
              name="Cash"
              fill="#059669"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="online"
              name="Online/UPI"
              fill="#2563eb"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

