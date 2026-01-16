"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Maximize2 } from "lucide-react";
import type { ModelUsage } from "@/lib/types";

interface ModelPieChartProps {
  data: ModelUsage[];
  title: string;
  onMaximize?: () => void;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6366f1", "#f43f5e"];

export function ModelPieChart({ data, title, onMaximize }: ModelPieChartProps) {
  const chartData = data.map((item) => ({
    name: item.model,
    value: item.cost,
  }));

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
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
            }}
            formatter={(value: number | undefined) => `$${(value ?? 0).toFixed(4)}`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
