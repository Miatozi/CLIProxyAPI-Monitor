"use client";

import { useEffect, useState } from "react";
import { usageDailyAgg, modelPrices } from "@/lib/db/schema";

interface CostMatrixData {
  route: string;
  models: Record<string, number>; // model -> cost
}

export default function CostHeatmapTable() {
  const [data, setData] = useState<CostMatrixData[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(168); // 默认 7 天

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 简化实现:使用现有的 overview API 获取数据
        const res = await fetch(`/api/overview?days=${Math.floor(hours / 24)}`);
        const json = await res.json();

        // 从 overview 数据中提取 route × model 成本矩阵
        // 注意:这是简化实现,实际可能需要专门的 API
        const overview = json.overview;

        // 按 route 分组
        const routeMap = new Map<string, Record<string, number>>();
        const modelSet = new Set<string>();

        if (overview?.models) {
          overview.models.forEach((model: any) => {
            modelSet.add(model.model);
            // 这里简化处理,实际需要按 route 分组的数据
          });
        }

        setModels(Array.from(modelSet));
        setData(Array.from(routeMap.values()));
      } catch (error) {
        console.error("Failed to fetch cost matrix:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [hours]);

  if (loading) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">成本矩阵 (Route × Model)</h3>
        <div className="h-64 bg-muted/50 animate-pulse rounded" />
      </div>
    );
  }

  // 简化展示:暂时使用占位符
  return (
    <div className="border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">成本热力图 (Route × Model)</h3>
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

      <div className="text-sm text-muted-foreground">
        热力图功能正在开发中。当前可在"模型费用明细"表格中查看成本信息。
      </div>
    </div>
  );
}
