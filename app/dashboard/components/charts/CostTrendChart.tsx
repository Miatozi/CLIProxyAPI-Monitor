"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface CostTrendPoint {
  bucket: string;
  model: string;
  cost: number;
  tokens: number;
}

interface CostTrendChartProps {
  data: CostTrendPoint[];
}

export default function CostTrendChart({ data }: CostTrendChartProps) {
  // 按时间和模型重组数据
  const timeMap = new Map<string, Record<string, number>>();
  const models = new Set<string>();

  data.forEach((point) => {
    const time = new Date(point.bucket).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
    });

    if (!timeMap.has(time)) {
      timeMap.set(time, { time });
    }

    const entry = timeMap.get(time)!;
    entry[point.model] = point.cost;
    models.add(point.model);
  });

  const chartData = Array.from(timeMap.values());

  // 为每个模型生成颜色 (使用 HSL 色彩空间)
  const modelColors = Array.from(models).reduce((acc, model, idx) => {
    const hue = (idx * 360) / models.size;
    acc[model] = `hsl(${hue}, 70%, 50%)`;
    return acc;
  }, {} as Record<string, string>);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="time"
          className="text-xs"
          tick={{ fill: "currentColor" }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: "currentColor" }}
          label={{ value: "成本 ($)", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
          labelStyle={{ color: "hsl(var(--popover-foreground))" }}
          formatter={(value: number) => `$${value.toFixed(4)}`}
        />
        <Legend />
        {Array.from(models).map((model) => (
          <Line
            key={model}
            type="monotone"
            dataKey={model}
            stroke={modelColors[model]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
