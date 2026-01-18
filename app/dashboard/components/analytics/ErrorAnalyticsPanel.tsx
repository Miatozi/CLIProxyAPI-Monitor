"use client";

import { useEffect, useState } from "react";
import StatusStackChart from "../charts/StatusStackChart";
import TopFailuresList from "../tables/TopFailuresList";

interface ErrorTimeseriesPoint {
  bucket: string;
  successCount: number;
  failureCount: number;
  totalRequests: number;
  successRate: number;
  errorRate: number;
}

interface TopFailureEntry {
  model?: string;
  route?: string;
  failureCount: number;
  totalRequests: number;
  errorRate: number;
}

export default function ErrorAnalyticsPanel() {
  const [timeseriesData, setTimeseriesData] = useState<ErrorTimeseriesPoint[]>([]);
  const [topModelFailures, setTopModelFailures] = useState<TopFailureEntry[]>([]);
  const [topRouteFailures, setTopRouteFailures] = useState<TopFailureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(168); // 默认 7 天

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [timeseriesRes, topModelsRes, topRoutesRes] = await Promise.all([
          fetch(`/api/analytics/errors/timeseries?hours=${hours}&interval=day`),
          fetch(`/api/analytics/errors/top?hours=${hours}&groupBy=model&limit=5`),
          fetch(`/api/analytics/errors/top?hours=${hours}&groupBy=route&limit=5`),
        ]);

        const [timeseriesJson, topModelsJson, topRoutesJson] = await Promise.all([
          timeseriesRes.json(),
          topModelsRes.json(),
          topRoutesRes.json(),
        ]);

        setTimeseriesData(timeseriesJson.data || []);
        setTopModelFailures(topModelsJson.data || []);
        setTopRouteFailures(topRoutesJson.data || []);
      } catch (error) {
        console.error("Failed to fetch error analytics:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [hours]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">错误深度分析</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-96 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">错误深度分析</h2>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="px-3 py-1.5 border rounded-md text-sm bg-background"
        >
          <option value={24}>过去 24 小时</option>
          <option value={168}>过去 7 天</option>
          <option value={720}>过去 30 天</option>
        </select>
      </div>

      {/* 成功/失败堆叠图 */}
      {timeseriesData.length > 0 && (
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">成功率趋势</h3>
          <p className="text-sm text-muted-foreground mb-4">
            绿色代表成功请求,红色代表失败请求
          </p>
          <StatusStackChart data={timeseriesData} />
        </div>
      )}

      {/* Top 失败列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">Top 失败模型</h3>
          <p className="text-sm text-muted-foreground mb-4">
            点击可查看详细错误日志
          </p>
          <TopFailuresList data={topModelFailures} groupBy="model" />
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">Top 失败路由</h3>
          <p className="text-sm text-muted-foreground mb-4">
            点击可查看详细错误日志
          </p>
          <TopFailuresList data={topRouteFailures} groupBy="route" />
        </div>
      </div>
    </div>
  );
}
