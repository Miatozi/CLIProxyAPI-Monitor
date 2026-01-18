"use client";

import { useEffect, useState } from "react";
import TokenStructureChart from "../charts/TokenStructureChart";
import CostTrendChart from "../charts/CostTrendChart";

interface TokenBreakdownPoint {
  bucket: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
}

interface CostTrendPoint {
  bucket: string;
  model: string;
  cost: number;
  tokens: number;
}

export default function TokenAnalyticsPanel() {
  const [tokenData, setTokenData] = useState<TokenBreakdownPoint[]>([]);
  const [costData, setCostData] = useState<CostTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(168); // 默认 7 天

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [tokenRes, costRes] = await Promise.all([
          fetch(`/api/analytics/tokens/breakdown?hours=${hours}&interval=day`),
          fetch(`/api/analytics/cost/trend-by-model?hours=${hours}&interval=day`),
        ]);

        const tokenJson = await tokenRes.json();
        const costJson = await costRes.json();

        setTokenData(tokenJson.data || []);
        setCostData(costJson.data || []);
      } catch (error) {
        console.error("Failed to fetch analytics data:", error);
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
          <h2 className="text-2xl font-bold">Token 与成本分析</h2>
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
        <h2 className="text-2xl font-bold">Token 与成本分析</h2>
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

      {/* Token 结构分析 */}
      {tokenData.length > 0 && (
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">Token 结构组成</h3>
          <p className="text-sm text-muted-foreground mb-4">
            展示输入、输出、推理、缓存 Token 的堆叠趋势
          </p>
          <TokenStructureChart data={tokenData} />
        </div>
      )}

      {/* 成本趋势 */}
      {costData.length > 0 && (
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">按模型的成本趋势</h3>
          <p className="text-sm text-muted-foreground mb-4">
            对比不同模型的成本变化趋势
          </p>
          <CostTrendChart data={costData} />
        </div>
      )}
    </div>
  );
}
