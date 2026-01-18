import type { modelPrices } from "@/lib/db/schema";
import type { UsageOverview, ModelUsage, UsageSeriesPoint } from "@/lib/types";
import { estimateCost, priceMap } from "@/lib/usage";

// ============ 共享类型定义 ============

export type PriceRow = typeof modelPrices.$inferSelect;

export type ModelAggRow = {
  model: string;
  requests: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export type TotalsRow = {
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  successCount: number;
  failureCount: number;
};

export type DayAggRow = { label: string; requests: number; tokens: number };

export type DayModelAggRow = {
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export type HourAggRow = {
  label: string;
  hourStart: Date | string;
  requests: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
};

export type OverviewMeta = {
  page: number;
  pageSize: number;
  totalModels: number;
  totalPages: number;
};

export type OverviewResult = {
  overview: UsageOverview;
  empty: boolean;
  days: number;
  meta: OverviewMeta;
  filters: { models: string[]; routes: string[] };
};

// ============ 共享工具函数 ============

export function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeDays(days?: number | null): number {
  const fallback = 14;
  if (days == null || Number.isNaN(days)) return fallback;
  return Math.min(Math.max(Math.floor(days), 1), 90);
}

export function parseDateInput(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function withDayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function withDayEnd(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function normalizePage(value?: number | null): number {
  const fallback = 1;
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

export function normalizePageSize(value?: number | null): number {
  const fallback = 10;
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), 5), 500);
}

// ============ 共享结果构建函数 ============

export function buildOverviewResult(
  totalsRowResult: TotalsRow[],
  priceRows: PriceRow[],
  totalModelsRowResult: { count: number }[],
  byModelRows: ModelAggRow[],
  allModelsForCost: ModelAggRow[],
  byDayRows: DayAggRow[],
  byDayModelRows: DayModelAggRow[],
  byHourRows: HourAggRow[],
  availableModelsRows: { model: string }[],
  availableRoutesRows: { route: string }[],
  days: number,
  page: number,
  pageSize: number
): OverviewResult {
  const totalsRow =
    totalsRowResult[0] ?? {
      totalRequests: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedTokens: 0,
      successCount: 0,
      failureCount: 0
    };

  const totalModelsRow = totalModelsRowResult[0] ?? { count: 0 };
  const prices = priceMap(
    priceRows.map((p: PriceRow) => ({
      model: p.model,
      inputPricePer1M: Number(p.inputPricePer1M),
      cachedInputPricePer1M: Number(p.cachedInputPricePer1M),
      outputPricePer1M: Number(p.outputPricePer1M)
    }))
  );

  const models: ModelUsage[] = byModelRows.map((row) => {
    const cost = estimateCost(
      {
        inputTokens: toNumber(row.inputTokens),
        cachedTokens: toNumber(row.cachedTokens),
        outputTokens: toNumber(row.outputTokens)
      },
      row.model,
      prices
    );
    return {
      model: row.model,
      requests: toNumber(row.requests),
      tokens: toNumber(row.tokens),
      inputTokens: toNumber(row.inputTokens),
      outputTokens: toNumber(row.outputTokens),
      cost
    };
  });

  const dailyCostMap = new Map<string, number>();
  for (const row of byDayModelRows) {
    const cost = estimateCost(
      {
        inputTokens: toNumber(row.inputTokens),
        cachedTokens: toNumber(row.cachedTokens),
        outputTokens: toNumber(row.outputTokens)
      },
      row.model,
      prices
    );
    dailyCostMap.set(row.label, (dailyCostMap.get(row.label) ?? 0) + cost);
  }

  const byDay: UsageSeriesPoint[] = byDayRows.map((row) => ({
    label: row.label,
    requests: toNumber(row.requests),
    tokens: toNumber(row.tokens),
    cost: Number((dailyCostMap.get(row.label) ?? 0).toFixed(2))
  }));

  const byHour: UsageSeriesPoint[] = byHourRows.map((row) => ({
    label: row.label,
    timestamp: (() => {
      const d = new Date(row.hourStart as string);
      return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
    })(),
    requests: toNumber(row.requests),
    tokens: toNumber(row.tokens),
    inputTokens: toNumber(row.inputTokens),
    outputTokens: toNumber(row.outputTokens),
    reasoningTokens: toNumber(row.reasoningTokens),
    cachedTokens: toNumber(row.cachedTokens)
  }));

  // 使用所有模型数据计算总费用（不受分页限制）
  const totalCost = allModelsForCost.reduce((acc, row) => {
    const cost = estimateCost(
      {
        inputTokens: toNumber(row.inputTokens),
        cachedTokens: toNumber(row.cachedTokens),
        outputTokens: toNumber(row.outputTokens)
      },
      row.model,
      prices
    );
    return acc + cost;
  }, 0);

  const totalRequests = toNumber(totalsRow.totalRequests);
  const successCount = toNumber(totalsRow.successCount);
  const failureCount = toNumber(totalsRow.failureCount);
  const successRate = totalRequests === 0 ? 1 : successCount / totalRequests;

  const overview: UsageOverview = {
    totalRequests,
    totalTokens: toNumber(totalsRow.totalTokens),
    totalInputTokens: toNumber(totalsRow.inputTokens),
    totalOutputTokens: toNumber(totalsRow.outputTokens),
    totalReasoningTokens: toNumber(totalsRow.reasoningTokens),
    totalCachedTokens: toNumber(totalsRow.cachedTokens),
    successCount,
    failureCount,
    successRate,
    totalCost: Number(totalCost.toFixed(4)),
    models,
    byDay,
    byHour
  };

  const totalModels = toNumber(totalModelsRow.count);
  const totalPages = Math.max(1, Math.ceil(totalModels / pageSize));

  const filters = {
    models: availableModelsRows.map((r) => r.model).filter(Boolean),
    routes: availableRoutesRows.map((r) => r.route).filter(Boolean)
  };

  return {
    overview,
    empty: totalRequests === 0,
    days,
    meta: { page, pageSize, totalModels, totalPages },
    filters
  };
}
