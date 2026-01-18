"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ErrorTimeseriesPoint {
  bucket: string;
  successCount: number;
  failureCount: number;
  totalRequests: number;
  successRate: number;
  errorRate: number;
}

interface StatusStackChartProps {
  data: ErrorTimeseriesPoint[];
}

export default function StatusStackChart({ data }: StatusStackChartProps) {
  // 转换数据格式
  const chartData = data.map((point) => ({
    time: new Date(point.bucket).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
    }),
    成功: point.successCount,
    失败: point.failureCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="time"
          className="text-xs"
          tick={{ fill: "currentColor" }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: "currentColor" }}
          label={{ value: "请求数", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
          labelStyle={{ color: "hsl(var(--popover-foreground))" }}
        />
        <Legend />
        <Bar
          dataKey="成功"
          stackId="stack"
          fill="hsl(142, 76%, 36%)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="失败"
          stackId="stack"
          fill="hsl(0, 84%, 60%)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
