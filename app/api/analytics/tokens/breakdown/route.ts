import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { usageHourlyAgg, usageDailyAgg } from "@/lib/db/schema";
import { sql, gte, and, eq } from "drizzle-orm";

interface TokenBreakdownPoint {
  bucket: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");
    const model = searchParams.get("model");
    const route = searchParams.get("route");
    const interval = searchParams.get("interval") || "hour"; // hour | day

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (interval === "day") {
      // 使用日聚合表
      const bucketSql = sql`${usageDailyAgg.dayStart}::text`;

      const results = await db
        .select({
          bucket: bucketSql,
          inputTokens: sql<number>`SUM(${usageDailyAgg.inputTokens})::bigint`,
          outputTokens: sql<number>`SUM(${usageDailyAgg.outputTokens})::bigint`,
          reasoningTokens: sql<number>`SUM(${usageDailyAgg.reasoningTokens})::bigint`,
          cachedTokens: sql<number>`SUM(${usageDailyAgg.cachedTokens})::bigint`,
          totalTokens: sql<number>`SUM(${usageDailyAgg.totalTokens})::bigint`,
        })
        .from(usageDailyAgg)
        .where(
          and(
            gte(usageDailyAgg.dayStart, since),
            model ? eq(usageDailyAgg.model, model) : undefined,
            route ? eq(usageDailyAgg.route, route) : undefined
          )
        )
        .groupBy(bucketSql)
        .orderBy(bucketSql);

      const data: TokenBreakdownPoint[] = results.map((row) => ({
        bucket: row.bucket,
        inputTokens: Number(row.inputTokens),
        outputTokens: Number(row.outputTokens),
        reasoningTokens: Number(row.reasoningTokens),
        cachedTokens: Number(row.cachedTokens),
        totalTokens: Number(row.totalTokens),
      }));

      return NextResponse.json({ data, hours, interval, model, route });
    } else {
      // 使用小时聚合表
      const bucketSql = sql`${usageHourlyAgg.bucketStart}::text`;

      const results = await db
        .select({
          bucket: bucketSql,
          inputTokens: sql<number>`SUM(${usageHourlyAgg.inputTokens})::bigint`,
          outputTokens: sql<number>`SUM(${usageHourlyAgg.outputTokens})::bigint`,
          reasoningTokens: sql<number>`SUM(${usageHourlyAgg.reasoningTokens})::bigint`,
          cachedTokens: sql<number>`SUM(${usageHourlyAgg.cachedTokens})::bigint`,
          totalTokens: sql<number>`SUM(${usageHourlyAgg.totalTokens})::bigint`,
        })
        .from(usageHourlyAgg)
        .where(
          and(
            gte(usageHourlyAgg.bucketStart, since),
            model ? eq(usageHourlyAgg.model, model) : undefined,
            route ? eq(usageHourlyAgg.route, route) : undefined
          )
        )
        .groupBy(bucketSql)
        .orderBy(bucketSql);

      const data: TokenBreakdownPoint[] = results.map((row) => ({
        bucket: row.bucket,
        inputTokens: Number(row.inputTokens),
        outputTokens: Number(row.outputTokens),
        reasoningTokens: Number(row.reasoningTokens),
        cachedTokens: Number(row.cachedTokens),
        totalTokens: Number(row.totalTokens),
      }));

      return NextResponse.json({ data, hours, interval, model, route });
    }
  } catch (error) {
    console.error("Failed to fetch token breakdown:", error);
    return NextResponse.json(
      { error: "Failed to fetch token breakdown" },
      { status: 500 }
    );
  }
}
