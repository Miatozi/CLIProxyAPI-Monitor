"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TimeseriesDataPoint {
  bucket: string;
  name: string;
  p75: number;
  count: number;
}

interface VitalsTrendChartProps {
  data: TimeseriesDataPoint[];
}

export default function VitalsTrendChart({ data }: VitalsTrendChartProps) {
  // 转换数据为 Recharts 格式
  // 将数组转为 { bucket, LCP, INP, CLS } 格式
  const chartData = data.reduce((acc, point) => {
    const bucket = new Date(point.bucket).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let existing = acc.find((item) => item.bucket === bucket);
    if (!existing) {
      existing = { bucket };
      acc.push(existing);
    }

    existing[point.name] = point.p75;
    return acc;
  }, [] as Record<string, any>[]);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="bucket"
          className="text-xs"
          tick={{ fill: "currentColor" }}
        />
        <YAxis
          yAxisId="left"
          label={{ value: "LCP / INP (ms)", angle: -90, position: "insideLeft" }}
          className="text-xs"
          tick={{ fill: "currentColor" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          label={{ value: "CLS (score)", angle: 90, position: "insideRight" }}
          className="text-xs"
          tick={{ fill: "currentColor" }}
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
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="LCP"
          stroke="hsl(221, 83%, 53%)"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="LCP (ms)"
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="INP"
          stroke="hsl(142, 71%, 45%)"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="INP (ms)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="CLS"
          stroke="hsl(280, 100%, 70%)"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="CLS (score)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
