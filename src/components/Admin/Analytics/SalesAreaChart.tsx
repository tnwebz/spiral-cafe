"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface SalesPoint {
  label: string;
  fullLabel?: string;
  sales: number;
  orders?: number;
}

interface SalesAreaChartProps {
  data: SalesPoint[];
  periodLabel?: string;
  currencySymbol?: string;
}

// Custom dot renderer for key inflection points (min, max, start)
const CustomizedDot = (props: any) => {
  const { cx, cy, index, dataLength, isExtremum } = props;
  if (!isExtremum && index !== 0 && index !== dataLength - 1) {
    return null;
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#a855f7" stroke="#ffffff" strokeWidth={2.5} className="shadow-sm" />
      <circle cx={cx} cy={cy} r={2} fill="#ffffff" />
    </g>
  );
};

export default function SalesAreaChart({
  data,
  periodLabel = "Today's Sales",
  currencySymbol = "₹",
}: SalesAreaChartProps) {
  const { totalSales, high, low, changePct, extremumIndices, minIndex } = useMemo(() => {
    if (!data || data.length === 0) {
      return { totalSales: 0, high: 0, low: 0, changePct: 0, extremumIndices: new Set<number>(), minIndex: -1 };
    }

    const salesValues = data.map((d) => d.sales);
    const sum = salesValues.reduce((a, b) => a + b, 0);
    const maxVal = Math.max(...salesValues);
    const minVal = Math.min(...salesValues);

    const maxIdx = salesValues.indexOf(maxVal);
    const minIdx = salesValues.indexOf(minVal);

    const first = salesValues[0] || 1;
    const last = salesValues[salesValues.length - 1] || 0;
    const change = first > 0 ? (((last - first) / first) * 100).toFixed(2) : "0.00";

    const indices = new Set<number>();
    if (maxIdx >= 0) indices.add(maxIdx);
    if (minIdx >= 0 && minIdx !== maxIdx) indices.add(minIdx);
    indices.add(0);
    indices.add(data.length - 1);

    return {
      totalSales: sum,
      high: maxVal,
      low: minVal,
      changePct: Number(change),
      extremumIndices: indices,
      minIndex: minIdx,
    };
  }, [data]);

  const minPoint = minIndex >= 0 ? data[minIndex] : null;

  return (
    <div className="bg-[#121118] text-white rounded-3xl p-6 shadow-2xl border border-zinc-800/80">
      {/* Top Header Metrics as in Reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/60">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-zinc-400 text-sm font-medium">{periodLabel}:</span>
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {currencySymbol}{totalSales.toLocaleString()}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                changePct >= 0
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}
            >
              {changePct >= 0 ? `+${changePct}%` : `${changePct}%`}
            </span>
          </div>
        </div>

        {/* High, Low, Change Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-zinc-400 mr-1.5 font-medium">High:</span>
            <span className="text-sky-400 font-extrabold font-mono">
              {high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-px h-3 bg-zinc-800"></div>
          <div>
            <span className="text-zinc-400 mr-1.5 font-medium">Low:</span>
            <span className="text-amber-400 font-extrabold font-mono">
              {low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-px h-3 bg-zinc-800"></div>
          <div>
            <span className="text-zinc-400 mr-1.5 font-medium">Change:</span>
            <span
              className={`font-extrabold font-mono ${
                changePct >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {changePct >= 0 ? `+${changePct}%` : `${changePct}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Spline Curve */}
      <div className="h-64 sm:h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
            <defs>
              {/* Glassy purple transparent gradient underneath spline */}
              <linearGradient id="purpleSalesGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.28} />
                <stop offset="50%" stopColor="#a855f7" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.00} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#27272a"
              strokeOpacity={0.6}
            />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#71717a", fontSize: 11, fontWeight: 500 }}
              dy={10}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#71717a", fontSize: 11, fontWeight: 500 }}
              tickFormatter={(val) => `${currencySymbol}${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as SalesPoint;
                return (
                  <div className="bg-zinc-900/95 border border-purple-500/30 rounded-2xl p-3 shadow-2xl backdrop-blur-md text-xs">
                    <div className="text-zinc-400 font-medium mb-1">
                      {point.fullLabel || point.label}
                    </div>
                    <div className="text-purple-300 font-extrabold text-sm flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      <span>
                        Sales: {currencySymbol}{point.sales.toLocaleString()}
                      </span>
                    </div>
                    {point.orders !== undefined && (
                      <div className="text-zinc-400 text-[11px] mt-0.5">
                        Orders: {point.orders}
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Vertical dashed reference line at minimum or hovered point */}
            {minPoint && (
              <ReferenceLine
                x={minPoint.label}
                stroke="#c084fc"
                strokeDasharray="3 3"
                strokeWidth={1.5}
              />
            )}

            <Area
              type="monotone"
              dataKey="sales"
              stroke="#c084fc"
              strokeWidth={3}
              fill="url(#purpleSalesGlow)"
              dot={(props) => (
                <CustomizedDot
                  key={props.index}
                  {...props}
                  dataLength={data.length}
                  isExtremum={extremumIndices.has(props.index)}
                />
              )}
              activeDot={{
                r: 7,
                fill: "#a855f7",
                stroke: "#ffffff",
                strokeWidth: 3,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

