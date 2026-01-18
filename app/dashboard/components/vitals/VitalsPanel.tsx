"use client";

import { useEffect, useState } from "react";
import VitalCard from "./ui/VitalCard";
import VitalsTrendChart from "./charts/VitalsTrendChart";

interface VitalSummary {
  name: string;
  p75: number;
  count: number;
  rating: "good" | "needs-improvement" | "poor";
}

interface TimeseriesDataPoint {
  bucket: string;
  name: string;
  p75: number;
  count: number;
}

export default function VitalsPanel() {
  const [summary, setSummary] = useState<VitalSummary[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [summaryRes, timeseriesRes] = await Promise.all([
          fetch(`/api/vitals/summary?hours=${hours}`),
          fetch(`/api/vitals/timeseries?hours=${hours}&metrics=LCP,INP,CLS`),
        ]);

        const summaryData = await summaryRes.json();
        const timeseriesData = await timeseriesRes.json();

        setSummary(summaryData.data || []);
        setTimeseries(timeseriesData.data || []);
      } catch (error) {
        console.error("Failed to fetch vitals data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [hours]);

  // 筛选出核心 Web Vitals
  const coreVitals = ["LCP", "CLS", "INP"];
  const coreSummary = summary.filter((v) => coreVitals.includes(v.name));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">性能监控</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">性能监控 (Web Vitals)</h2>
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

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coreSummary.map((vital) => (
          <VitalCard
            key={vital.name}
            name={vital.name}
            value={vital.p75}
            rating={vital.rating}
            count={vital.count}
          />
        ))}
      </div>

      {/* 性能趋势图 */}
      {timeseries.length > 0 && (
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">性能趋势 (P75)</h3>
          <VitalsTrendChart data={timeseries} />
        </div>
      )}
    </div>
  );
}
