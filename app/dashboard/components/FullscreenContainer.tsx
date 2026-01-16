"use client";

import { X } from "lucide-react";
import { useDashboardUI } from "@/app/dashboard/context/DashboardUIContext";
import { TrendChart } from "@/app/dashboard/components/charts/TrendChart";
import { HourlyChart } from "@/app/dashboard/components/charts/HourlyChart";
import { ModelPieChart } from "@/app/dashboard/components/charts/ModelPieChart";
import type { UsageOverview } from "@/lib/types";
import { useEffect } from "react";

interface FullscreenContainerProps {
  data: UsageOverview;
}

export function FullscreenContainer({ data }: FullscreenContainerProps) {
  const { fullscreenChart, setFullscreenChart } = useDashboardUI();

  // ESC 键关闭
  useEffect(() => {
    if (!fullscreenChart) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullscreenChart(null);
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [fullscreenChart, setFullscreenChart]);

  if (!fullscreenChart) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="全屏图表"
    >
      <div className="relative w-full max-w-7xl">
        <button
          onClick={() => setFullscreenChart(null)}
          className="absolute -top-12 right-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          title="关闭 (ESC)"
          aria-label="关闭全屏"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="glass-panel rounded-lg p-8">
          {fullscreenChart === "trend-requests" && (
            <TrendChart
              data={data.byDay}
              dataKey="requests"
              title="每日请求趋势"
              color="#3b82f6"
            />
          )}
          {fullscreenChart === "trend-tokens" && (
            <TrendChart
              data={data.byDay}
              dataKey="tokens"
              title="每日 Token 趋势"
              color="#8b5cf6"
            />
          )}
          {fullscreenChart === "trend-cost" && (
            <TrendChart
              data={data.byDay}
              dataKey="cost"
              title="每日费用趋势"
              color="#10b981"
            />
          )}
          {fullscreenChart === "hourly" && (
            <HourlyChart data={data.byHour} title="小时负载分布" />
          )}
          {fullscreenChart === "pie" && (
            <ModelPieChart data={data.models} title="模型费用分布" />
          )}
        </div>
      </div>
    </div>
  );
}
