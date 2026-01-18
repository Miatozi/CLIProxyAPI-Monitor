import { and, eq, sql, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modelPrices, usageHourlyAgg, usageDailyAgg } from "@/lib/db/schema";
import type { UsageOverview, ModelUsage, UsageSeriesPoint } from "@/lib/types";
import { estimateCost, priceMap } from "@/lib/usage";

type PriceRow = typeof modelPrices.$inferSelect;
type ModelAggRow = {
  model: string;
  requests: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};
type TotalsRow = {
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  successCount: number;
  failureCount: number;
};
type DayAggRow = { label: string; requests: number; tokens: number };
type DayModelAggRow = { label: string; model: string; inputTokens: number; outputTokens: number; cachedTokens: number };
type HourAggRow = {
  label: string;
  hourStart: Date | string;
  requests: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
};
type OverviewMeta = { page: number; pageSize: number; totalModels: number; totalPages: number };

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeDays(days?: number | null) {
  const fallback = 14;
  if (days == null || Number.isNaN(days)) return fallback;
  return Math.min(Math.max(Math.floor(days), 1), 90);
}

function parseDateInput(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function withDayStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function withDayEnd(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function normalizePage(value?: number | null) {
  const fallback = 1;
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function normalizePageSize(value?: number | null) {
  const fallback = 10;
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), 5), 500);
}

/**
 * 预聚合读路径：使用 usageHourlyAgg 和 usageDailyAgg
 * 策略：
 * - 自定义日期范围：dailyAgg（totals/byDay/byModel）+ hourlyAgg（byHour）
 * - 预设天数：hourlyAgg 全链路（避免非日对齐偏差）
 */
export async function getOverviewAgg(
  daysInput?: number,
  opts?: { model?: string | null; route?: string | null; page?: number | null; pageSize?: number | null; start?: string | Date | null; end?: string | Date | null }
): Promise<{ overview: UsageOverview; empty: boolean; days: number; meta: OverviewMeta; filters: { models: string[]; routes: string[] } }> {
  const startDate = parseDateInput(opts?.start);
  const endDate = parseDateInput(opts?.end);
  const hasCustomRange = startDate && endDate && endDate >= startDate;

  const days = hasCustomRange ? Math.max(1, Math.round((withDayEnd(endDate).getTime() - withDayStart(startDate).getTime()) / DAY_MS) + 1) : normalizeDays(daysInput);
  const page = normalizePage(opts?.page ?? undefined);
  const pageSize = normalizePageSize(opts?.pageSize ?? undefined);
  const offset = (page - 1) * pageSize;
  const since = hasCustomRange ? withDayStart(startDate!) : new Date(Date.now() - days * DAY_MS);
  const until = hasCustomRange ? withDayEnd(endDate!) : undefined;

  if (hasCustomRange) {
    // 策略 A：自定义日期范围，使用 dailyAgg + hourlyAgg
    return getOverviewFromDailyAgg(since, until!, days, page, pageSize, offset, opts);
  } else {
    // 策略 B：预设天数，使用 hourlyAgg 全链路
    return getOverviewFromHourlyAgg(since, days, page, pageSize, offset, opts);
  }
}

/**
 * 策略 A：自定义日期范围，使用 dailyAgg + hourlyAgg
 */
async function getOverviewFromDailyAgg(
  since: Date,
  until: Date,
  days: number,
  page: number,
  pageSize: number,
  offset: number,
  opts?: { model?: string | null; route?: string | null }
): Promise<{ overview: UsageOverview; empty: boolean; days: number; meta: OverviewMeta; filters: { models: string[]; routes: string[] } }> {
  const baseWhereParts: SQL[] = [gte(usageDailyAgg.dayStart, since), lte(usageDailyAgg.dayStart, until)];
  const baseWhere = and(...baseWhereParts);

  const filterWhereParts: SQL[] = [...baseWhereParts];
  if (opts?.model) filterWhereParts.push(eq(usageDailyAgg.model, opts.model));
  if (opts?.route) filterWhereParts.push(eq(usageDailyAgg.route, opts.route));
  const filterWhere = and(...filterWhereParts);

  // byHour 使用 hourlyAgg
  const hourBaseWhereParts: SQL[] = [gte(usageHourlyAgg.bucketStart, since), lte(usageHourlyAgg.bucketStart, until)];
  const hourFilterWhereParts: SQL[] = [...hourBaseWhereParts];
  if (opts?.model) hourFilterWhereParts.push(eq(usageHourlyAgg.model, opts.model));
  if (opts?.route) hourFilterWhereParts.push(eq(usageHourlyAgg.route, opts.route));
  const hourFilterWhere = and(...hourFilterWhereParts);

  const totalsPromise: Promise<TotalsRow[]> = db
    .select({
      totalRequests: sql<number>`coalesce(sum(${usageDailyAgg.totalRequests}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageDailyAgg.totalTokens}), 0)`,
      inputTokens: sql<number>`coalesce(sum(${usageDailyAgg.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${usageDailyAgg.outputTokens}), 0)`,
      reasoningTokens: sql<number>`coalesce(sum(${usageDailyAgg.reasoningTokens}), 0)`,
      cachedTokens: sql<number>`coalesce(sum(${usageDailyAgg.cachedTokens}), 0)`,
      successCount: sql<number>`coalesce(sum(${usageDailyAgg.successCount}), 0)`,
      failureCount: sql<number>`coalesce(sum(${usageDailyAgg.failureCount}), 0)`
    })
    .from(usageDailyAgg)
    .where(filterWhere);

  const pricePromise: Promise<PriceRow[]> = db.select().from(modelPrices);

  const totalModelsPromise: Promise<{ count: number }[]> = db
    .select({ count: sql<number>`count(distinct ${usageDailyAgg.model})` })
    .from(usageDailyAgg)
    .where(filterWhere);

  const byModelPromise: Promise<ModelAggRow[]> = db
    .select({
      model: usageDailyAgg.model,
      requests: sql<number>`sum(${usageDailyAgg.totalRequests})`,
      tokens: sql<number>`sum(${usageDailyAgg.totalTokens})`,
      inputTokens: sql<number>`sum(${usageDailyAgg.inputTokens})`,
      outputTokens: sql<number>`sum(${usageDailyAgg.outputTokens})`,
      cachedTokens: sql<number>`coalesce(sum(${usageDailyAgg.cachedTokens}), 0)`
    })
    .from(usageDailyAgg)
    .where(filterWhere)
    .groupBy(usageDailyAgg.model)
    .orderBy(usageDailyAgg.model)
    .limit(pageSize)
    .offset(offset);

  // 用于计算总费用的查询（不受分页限制）
  const allModelsForCostPromise: Promise<ModelAggRow[]> = db
    .select({
      model: usageDailyAgg.model,
      requests: sql<number>`sum(${usageDailyAgg.totalRequests})`,
      tokens: sql<number>`sum(${usageDailyAgg.totalTokens})`,
      inputTokens: sql<number>`sum(${usageDailyAgg.inputTokens})`,
      outputTokens: sql<number>`sum(${usageDailyAgg.outputTokens})`,
      cachedTokens: sql<number>`coalesce(sum(${usageDailyAgg.cachedTokens}), 0)`
    })
    .from(usageDailyAgg)
    .where(filterWhere)
    .groupBy(usageDailyAgg.model);

  const byDayPromise: Promise<DayAggRow[]> = db
    .select({
      label: sql<string>`to_char(${usageDailyAgg.dayStart} at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`,
      requests: sql<number>`sum(${usageDailyAgg.totalRequests})`,
      tokens: sql<number>`sum(${usageDailyAgg.totalTokens})`
    })
    .from(usageDailyAgg)
    .where(filterWhere)
    .groupBy(usageDailyAgg.dayStart)
    .orderBy(usageDailyAgg.dayStart)
    .limit(days);

  const byDayModelPromise: Promise<DayModelAggRow[]> = db
    .select({
      label: sql<string>`to_char(${usageDailyAgg.dayStart} at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`,
      model: usageDailyAgg.model,
      inputTokens: sql<number>`sum(${usageDailyAgg.inputTokens})`,
      outputTokens: sql<number>`sum(${usageDailyAgg.outputTokens})`,
      cachedTokens: sql<number>`coalesce(sum(${usageDailyAgg.cachedTokens}), 0)`
    })
    .from(usageDailyAgg)
    .where(filterWhere)
    .groupBy(usageDailyAgg.dayStart, usageDailyAgg.model)
    .orderBy(usageDailyAgg.dayStart, usageDailyAgg.model);

  const byHourPromise: Promise<HourAggRow[]> = db
    .select({
      label: sql<string>`to_char(${usageHourlyAgg.bucketStart} at time zone 'Asia/Shanghai', 'MM-DD HH24')`,
      hourStart: sql<Date>`(${usageHourlyAgg.bucketStart}) at time zone 'Asia/Shanghai'`,
      requests: sql<number>`sum(${usageHourlyAgg.totalRequests})`,
      tokens: sql<number>`sum(${usageHourlyAgg.totalTokens})`,
      inputTokens: sql<number>`sum(${usageHourlyAgg.inputTokens})`,
      outputTokens: sql<number>`sum(${usageHourlyAgg.outputTokens})`,
      reasoningTokens: sql<number>`coalesce(sum(${usageHourlyAgg.reasoningTokens}), 0)`,
      cachedTokens: sql<number>`coalesce(sum(${usageHourlyAgg.cachedTokens}), 0)`
    })
    .from(usageHourlyAgg)
    .where(hourFilterWhere)
    .groupBy(usageHourlyAgg.bucketStart)
    .orderBy(usageHourlyAgg.bucketStart);

  const availableModelsPromise: Promise<{ model: string }[]> = db
    .select({ model: usageDailyAgg.model })
    .from(usageDailyAgg)
    .where(baseWhere)
    .groupBy(usageDailyAgg.model)
    .orderBy(usageDailyAgg.model);

  const availableRoutesPromise: Promise<{ route: string }[]> = db
    .select({ route: usageDailyAgg.route })
    .from(usageDailyAgg)
    .where(baseWhere)
    .groupBy(usageDailyAgg.route)
    .orderBy(usageDailyAgg.route);

  const [
    totalsRowResult,
    priceRows,
    totalModelsRowResult,
    byModelRows,
    allModelsForCost,
    byDayRows,
    byDayModelRows,
    byHourRows,
    availableModelsRows,
    availableRoutesRows
  ] = await Promise.all([
    totalsPromise,
    pricePromise,
    totalModelsPromise,
    byModelPromise,
    allModelsForCostPromise,
    byDayPromise,
    byDayModelPromise,
    byHourPromise,
    availableModelsPromise,
    availableRoutesPromise
  ]);

  return buildOverviewResult(
    totalsRowResult,
    priceRows,
    totalModelsRowResult,
    byModelRows,
    allModelsForCost,
    byDayRows,
    byDayModelRows,
    byHourRows,
    availableModelsRows,
    availableRoutesRows,
    days,
    page,
    pageSize
  );
}

/**
 * 策略 B：预设天数，使用 hourlyAgg 全链路
 */
async function getOverviewFromHourlyAgg(
  since: Date,
  days: number,
  page: number,
  pageSize: number,
  offset: number,
  opts?: { model?: string | null; route?: string | null }
): Promise<{ overview: UsageOverview; empty: boolean; days: number; meta: OverviewMeta; filters: { models: string[]; routes: string[] } }> {
  const baseWhereParts: SQL[] = [gte(usageHourlyAgg.bucketStart, since)];
  const baseWhere = and(...baseWhereParts);

  const filterWhereParts: SQL[] = [...baseWhereParts];
  if (opts?.model) filterWhereParts.push(eq(usageHourlyAgg.model, opts.model));
  if (opts?.route) filterWhereParts.push(eq(usageHourlyAgg.route, opts.route));
  const filterWhere = and(...filterWhereParts);

  const dayExpr = sql`date_trunc('day', ${usageHourlyAgg.bucketStart} at time zone 'Asia/Shanghai')`;

  const totalsPromise: Promise<TotalsRow[]> = db
    .select({
      totalRequests: sql<number>`coalesce(sum(${usageHourlyAgg.totalRequests}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageHourlyAgg.totalTokens}), 0)`,
      inputTokens: sql<number>`coalesce(sum(${usageHourlyAgg.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${usageHourlyAgg.outputTokens}), 0)`,
      reasoningTokens: sql<number>`coalesce(sum(${usageHourlyAgg.reasoningTokens}), 0)`,
      cachedTokens: sql<number>`coalesce(sum(${usageHourlyAgg.cachedTokens}), 0)`,
      successCount: sql<number>`coalesce(sum(${usageHourlyAgg.successCount}), 0)`,
      failureCount: sql<number>`coalesce(sum(${usageHourlyAgg.failureCount}), 0)`
    })
    .from(usageHourlyAgg)
    .where(filterWhere);

  const pricePromise: Promise<PriceRow[]> = db.select().from(modelPrices);

  const totalModelsPromise: Promise<{ count: number }[]> = db
    .select({ count: sql<number>`count(distinct ${usageHourlyAgg.model})` })
    .from(usageHourlyAgg)
    .where(filterWhere);

  const byModelPromise: Promise<ModelAggRow[]> = db
    .select({
      model: usageHourlyAgg.model,
      requests: sql<number>`sum(${usageHourlyAgg.totalRequests})`,
      tokens: sql<number>`sum(${usageHourlyAgg.totalTokens})`,
      inputTokens: sql<number>`sum(${usageHourlyAgg.inputTokens})`,
      outputTokens: sql<number>`sum(${usageHourlyAgg.outputTokens})`,
      cachedTokens: sql<number>`coalesce(sum(${usageHourlyAgg.cachedTokens}), 0)`
    })
    .from(usageHourlyAgg)
    .where(filterWhere)
    .groupBy(usageHourlyAgg.model)
    .orderBy(usageHourlyAgg.model)
    .limit(pageSize)
    .offset(offset);

  // 用于计算总费用的查询（不受分页限制）
  const allModelsForCostPromise: Promise<ModelAggRow[]> = db
    .select({
      model: usageHourlyAgg.model,
      requests: sql<number>`sum(${usageHourlyAgg.totalRequests})`,
      tokens: sql<number>`sum(${usageHourlyAgg.totalTokens})`,
      inputTokens: sql<number>`sum(${usageHourlyAgg.inputTokens})`,
      outputTokens: sql<number>`sum(${usageHourlyAgg.outputTokens})`,
      cachedTokens: sql<number>`coalesce(sum(${usageHourlyAgg.cachedTokens}), 0)`
    })
    .from(usageHourlyAgg)
    .where(filterWhere)
    .groupBy(usageHourlyAgg.model);

  const byDayPromise: Promise<DayAggRow[]> = db
    .select({
      label: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
      requests: sql<number>`sum(${usageHourlyAgg.totalRequests})`,
      tokens: sql<number>`sum(${usageHourlyAgg.totalTokens})`
    })
    .from(usageHourlyAgg)
    .where(filterWhere)
    .groupBy(dayExpr)
    .orderBy(dayExpr)
    .limit(days);

  const byDayModelPromise: Promise<DayModelAggRow[]> = db
    .select({
      label: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
      model: usageHourlyAgg.model,
      inputTokens: sql<number>`sum(${usageHourlyAgg.inputTokens})`,
      outputTokens: sql<number>`sum(${usageHourlyAgg.outputTokens})`,
      cachedTokens: sql<number>`coalesce(sum(${usageHourlyAgg.cachedTokens}), 0)`
    })
    .from(usageHourlyAgg)
    .where(filterWhere)
    .groupBy(dayExpr, usageHourlyAgg.model)
    .orderBy(dayExpr, usageHourlyAgg.model);

  const byHourPromise: Promise<HourAggRow[]> = db
    .select({
      label: sql<string>`to_char(${usageHourlyAgg.bucketStart} at time zone 'Asia/Shanghai', 'MM-DD HH24')`,
      hourStart: sql<Date>`(${usageHourlyAgg.bucketStart}) at time zone 'Asia/Shanghai'`,
      requests: sql<number>`sum(${usageHourlyAgg.totalRequests})`,
      tokens: sql<number>`sum(${usageHourlyAgg.totalTokens})`,
      inputTokens: sql<number>`sum(${usageHourlyAgg.inputTokens})`,
      outputTokens: sql<number>`sum(${usageHourlyAgg.outputTokens})`,
      reasoningTokens: sql<number>`coalesce(sum(${usageHourlyAgg.reasoningTokens}), 0)`,
      cachedTokens: sql<number>`coalesce(sum(${usageHourlyAgg.cachedTokens}), 0)`
    })
    .from(usageHourlyAgg)
    .where(filterWhere)
    .groupBy(usageHourlyAgg.bucketStart)
    .orderBy(usageHourlyAgg.bucketStart);

  const availableModelsPromise: Promise<{ model: string }[]> = db
    .select({ model: usageHourlyAgg.model })
    .from(usageHourlyAgg)
    .where(baseWhere)
    .groupBy(usageHourlyAgg.model)
    .orderBy(usageHourlyAgg.model);

  const availableRoutesPromise: Promise<{ route: string }[]> = db
    .select({ route: usageHourlyAgg.route })
    .from(usageHourlyAgg)
    .where(baseWhere)
    .groupBy(usageHourlyAgg.route)
    .orderBy(usageHourlyAgg.route);

  const [
    totalsRowResult,
    priceRows,
    totalModelsRowResult,
    byModelRows,
    allModelsForCost,
    byDayRows,
    byDayModelRows,
    byHourRows,
    availableModelsRows,
    availableRoutesRows
  ] = await Promise.all([
    totalsPromise,
    pricePromise,
    totalModelsPromise,
    byModelPromise,
    allModelsForCostPromise,
    byDayPromise,
    byDayModelPromise,
    byHourPromise,
    availableModelsPromise,
    availableRoutesPromise
  ]);

  return buildOverviewResult(
    totalsRowResult,
    priceRows,
    totalModelsRowResult,
    byModelRows,
    allModelsForCost,
    byDayRows,
    byDayModelRows,
    byHourRows,
    availableModelsRows,
    availableRoutesRows,
    days,
    page,
    pageSize
  );
}

/**
 * 构建最终返回结果（复用逻辑）
 */
function buildOverviewResult(
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
): { overview: UsageOverview; empty: boolean; days: number; meta: OverviewMeta; filters: { models: string[]; routes: string[] } } {
  const totalsRow =
    totalsRowResult[0] ?? { totalRequests: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cachedTokens: 0, successCount: 0, failureCount: 0 };

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
      { inputTokens: toNumber(row.inputTokens), cachedTokens: toNumber(row.cachedTokens), outputTokens: toNumber(row.outputTokens) },
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
      { inputTokens: toNumber(row.inputTokens), cachedTokens: toNumber(row.cachedTokens), outputTokens: toNumber(row.outputTokens) },
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
      { inputTokens: toNumber(row.inputTokens), cachedTokens: toNumber(row.cachedTokens), outputTokens: toNumber(row.outputTokens) },
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
