"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TokenBreakdownPoint {
  bucket: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
}

interface TokenStructureChartProps {
  data: TokenBreakdownPoint[];
}

export default function TokenStructureChart({ data }: TokenStructureChartProps) {
  // 转换数据格式
  const chartData = data.map((point) => ({
    time: new Date(point.bucket).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
    }),
    输入: point.inputTokens,
    输出: point.outputTokens,
    推理: point.reasoningTokens,
    缓存: point.cachedTokens,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="time"
          className="text-xs"
          tick={{ fill: "currentColor" }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: "currentColor" }}
          label={{ value: "Token 数量", angle: -90, position: "insideLeft" }}
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
        <Area
          type="monotone"
          dataKey="输入"
          stackId="1"
          stroke="hsl(221, 83%, 53%)"
          fill="hsl(221, 83%, 53%)"
          fillOpacity={0.8}
        />
        <Area
          type="monotone"
          dataKey="输出"
          stackId="1"
          stroke="hsl(142, 71%, 45%)"
          fill="hsl(142, 71%, 45%)"
          fillOpacity={0.8}
        />
        <Area
          type="monotone"
          dataKey="推理"
          stackId="1"
          stroke="hsl(280, 100%, 70%)"
          fill="hsl(280, 100%, 70%)"
          fillOpacity={0.8}
        />
        <Area
          type="monotone"
          dataKey="缓存"
          stackId="1"
          stroke="hsl(47, 100%, 62%)"
          fill="hsl(47, 100%, 62%)"
          fillOpacity={0.8}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
