import { and, eq, sql, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modelPrices, usageHourlyAgg, usageDailyAgg } from "@/lib/db/schema";
import {
  type PriceRow,
  type ModelAggRow,
  type TotalsRow,
  type DayAggRow,
  type DayModelAggRow,
  type HourAggRow,
  type OverviewResult,
  DAY_MS,
  normalizeDays,
  parseDateInput,
  withDayStart,
  withDayEnd,
  normalizePage,
  normalizePageSize,
  buildOverviewResult
} from "@/lib/queries/shared";

/**
 * 预聚合读路径：使用 usageHourlyAgg 和 usageDailyAgg
 * 策略：
 * - 自定义日期范围：dailyAgg（totals/byDay/byModel）+ hourlyAgg（byHour）
 * - 预设天数：hourlyAgg 全链路（避免非日对齐偏差）
 */
export async function getOverviewAgg(
  daysInput?: number,
  opts?: { model?: string | null; route?: string | null; page?: number | null; pageSize?: number | null; start?: string | Date | null; end?: string | Date | null }
): Promise<OverviewResult> {
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
): Promise<OverviewResult> {
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
): Promise<OverviewResult> {
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
