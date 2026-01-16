"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Maximize2 } from "lucide-react";
import type { UsageSeriesPoint } from "@/lib/types";

interface HourlyChartProps {
  data: UsageSeriesPoint[];
  title: string;
  onMaximize?: () => void;
}

export function HourlyChart({ data, title, onMaximize }: HourlyChartProps) {
  return (
    <div className="glass-panel rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {onMaximize && (
          <button
            onClick={onMaximize}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
            title="全屏查看"
            aria-label={`全屏查看${title}`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
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
          <Bar dataKey="requests" fill="#3b82f6" name="请求数" />
          <Bar dataKey="tokens" fill="#8b5cf6" name="Token数" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
