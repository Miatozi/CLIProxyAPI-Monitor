import { and, eq, sql, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modelPrices, usageRecords } from "@/lib/db/schema";
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

export async function getOverview(
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

  const baseWhereParts: SQL[] = [gte(usageRecords.occurredAt, since)];
  if (until) baseWhereParts.push(lte(usageRecords.occurredAt, until));
  const baseWhere = baseWhereParts.length ? and(...baseWhereParts) : undefined;

  const filterWhereParts: SQL[] = [...baseWhereParts];
  if (opts?.model) filterWhereParts.push(eq(usageRecords.model, opts.model));
  if (opts?.route) filterWhereParts.push(eq(usageRecords.route, opts.route));
  const filterWhere = filterWhereParts.length ? and(...filterWhereParts) : undefined;

  const dayExpr = sql`date_trunc('day', ${usageRecords.occurredAt} at time zone 'Asia/Shanghai')`;
  const hourExpr = sql`date_trunc('hour', ${usageRecords.occurredAt} at time zone 'Asia/Shanghai')`;

  const totalsPromise: Promise<TotalsRow[]> = db
    .select({
      totalRequests: sql<number>`coalesce(sum(${usageRecords.totalRequests}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}), 0)`,
      inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      reasoningTokens: sql<number>`coalesce(sum(${usageRecords.reasoningTokens}), 0)`,
      cachedTokens: sql<number>`coalesce(sum(${usageRecords.cachedTokens}), 0)`,
      successCount: sql<number>`coalesce(sum(${usageRecords.successCount}), 0)`,
      failureCount: sql<number>`coalesce(sum(${usageRecords.failureCount}), 0)`
    })
    .from(usageRecords)
    .where(filterWhere);

  const pricePromise: Promise<PriceRow[]> = db.select().from(modelPrices);

  const totalModelsPromise: Promise<{ count: number }[]> = db
    .select({ count: sql<number>`count(distinct ${usageRecords.model})` })
    .from(usageRecords)
    .where(filterWhere);

  const byModelPromise: Promise<ModelAggRow[]> = db
    .select({
      model: usageRecords.model,
      requests: sql<number>`sum(${usageRecords.totalRequests})`,
      tokens: sql<number>`sum(${usageRecords.totalTokens})`,
      inputTokens: sql<number>`sum(${usageRecords.inputTokens})`,
      outputTokens: sql<number>`sum(${usageRecords.outputTokens})`,
      cachedTokens: sql<number>`coalesce(sum(${usageRecords.cachedTokens}), 0)`
    })
    .from(usageRecords)
    .where(filterWhere)
    .groupBy(usageRecords.model)
    .orderBy(usageRecords.model)
    .limit(pageSize)
    .offset(offset);

  // 用于计算总费用的查询（不受分页限制）
  const allModelsForCostPromise: Promise<ModelAggRow[]> = db
    .select({
      model: usageRecords.model,
      requests: sql<number>`sum(${usageRecords.totalRequests})`,
      tokens: sql<number>`sum(${usageRecords.totalTokens})`,
      inputTokens: sql<number>`sum(${usageRecords.inputTokens})`,
      outputTokens: sql<number>`sum(${usageRecords.outputTokens})`,
      cachedTokens: sql<number>`coalesce(sum(${usageRecords.cachedTokens}), 0)`
    })
    .from(usageRecords)
    .where(filterWhere)
    .groupBy(usageRecords.model);

  const byDayPromise: Promise<DayAggRow[]> = db
    .select({
      label: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
      requests: sql<number>`sum(${usageRecords.totalRequests})`,
      tokens: sql<number>`sum(${usageRecords.totalTokens})`
    })
    .from(usageRecords)
    .where(filterWhere)
    .groupBy(dayExpr)
    .orderBy(dayExpr)
    .limit(days);

  const byDayModelPromise: Promise<DayModelAggRow[]> = db
    .select({
      label: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
      model: usageRecords.model,
      inputTokens: sql<number>`sum(${usageRecords.inputTokens})`,
      outputTokens: sql<number>`sum(${usageRecords.outputTokens})`,
      cachedTokens: sql<number>`coalesce(sum(${usageRecords.cachedTokens}), 0)`
    })
    .from(usageRecords)
    .where(filterWhere)
    .groupBy(dayExpr, usageRecords.model)
    .orderBy(dayExpr, usageRecords.model);

  const byHourPromise: Promise<HourAggRow[]> = db
    .select({
      label: sql<string>`to_char(${hourExpr}, 'MM-DD HH24')`,
      hourStart: sql<Date>`(${hourExpr}) at time zone 'Asia/Shanghai'`,
      requests: sql<number>`sum(${usageRecords.totalRequests})`,
      tokens: sql<number>`sum(${usageRecords.totalTokens})`,
      inputTokens: sql<number>`sum(${usageRecords.inputTokens})`,
      outputTokens: sql<number>`sum(${usageRecords.outputTokens})`,
      reasoningTokens: sql<number>`coalesce(sum(${usageRecords.reasoningTokens}), 0)`,
      cachedTokens: sql<number>`coalesce(sum(${usageRecords.cachedTokens}), 0)`
    })
    .from(usageRecords)
    .where(filterWhere)
    .groupBy(hourExpr)
    .orderBy(hourExpr);

  const availableModelsPromise: Promise<{ model: string }[]> = db
    .select({ model: usageRecords.model })
    .from(usageRecords)
    .where(baseWhere)
    .groupBy(usageRecords.model)
    .orderBy(usageRecords.model);

  const availableRoutesPromise: Promise<{ route: string }[]> = db
    .select({ route: usageRecords.route })
    .from(usageRecords)
    .where(baseWhere)
    .groupBy(usageRecords.route)
    .orderBy(usageRecords.route);

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
