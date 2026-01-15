"use client";

import { useState } from "react";
import { DashboardUIProvider } from "@/app/dashboard/context/DashboardUIContext";
import { TrendChart, HourlyChart, ModelPieChart, CostTable } from "@/app/dashboard/components/LazyCharts";
import type { UsageOverview } from "@/lib/types";

interface DashboardClientProps {
  initialData: {
    overview: UsageOverview;
    empty: boolean;
    days: number;
    meta?: { page: number; pageSize: number; totalModels: number; totalPages: number };
    filters?: { models: string[]; routes: string[] };
  };
  initialFilters?: {
    days?: number;
    start?: string;
    end?: string;
    model?: string;
    route?: string;
  };
}

export function DashboardClient({ initialData, initialFilters }: DashboardClientProps) {
  const [data] = useState(initialData);

  if (data.empty) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-slate-400 text-lg">暂无数据</p>
          <p className="text-slate-500 text-sm mt-2">请先同步数据</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardUIProvider>
      <div className="space-y-6 p-6">
        {/* 趋势图 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrendChart
            data={data.overview.byDay}
            dataKey="requests"
            title="每日请求趋势"
            color="#3b82f6"
          />
          <TrendChart
            data={data.overview.byDay}
            dataKey="tokens"
            title="每日 Token 趋势"
            color="#8b5cf6"
          />
        </div>

        {/* 小时统计 */}
        <HourlyChart data={data.overview.byHour} title="小时负载分布" />

        {/* 模型分布 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ModelPieChart data={data.overview.models} title="模型费用分布" />
          <CostTable data={data.overview.models} title="模型费用明细" />
        </div>
      </div>
    </DashboardUIProvider>
  );
}
