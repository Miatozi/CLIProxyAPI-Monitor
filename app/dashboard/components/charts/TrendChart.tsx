"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Maximize2 } from "lucide-react";
import type { UsageSeriesPoint } from "@/lib/types";

interface TrendChartProps {
  data: UsageSeriesPoint[];
  dataKey: "requests" | "tokens" | "cost";
  title: string;
  color?: string;
  onMaximize?: () => void;
}

export function TrendChart({ data, dataKey, title, color = "#3b82f6", onMaximize }: TrendChartProps) {
  return (
    <div className="glass-panel rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        {onMaximize && (
          <button
            onClick={onMaximize}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
            title="全屏查看"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
