import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { usageHourlyAgg, usageDailyAgg } from "@/lib/db/schema";
import { sql, gte, and, eq } from "drizzle-orm";

interface ErrorTimeseriesPoint {
  bucket: string;
  successCount: number;
  failureCount: number;
  totalRequests: number;
  successRate: number;
  errorRate: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "168"); // 默认 7 天
    const model = searchParams.get("model");
    const route = searchParams.get("route");
    const interval = searchParams.get("interval") || "day"; // hour | day

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (interval === "day") {
      // 使用日聚合表
      const results = await db
        .select({
          bucket: sql<string>`${usageDailyAgg.dayStart}::text`,
          successCount: sql<number>`SUM(${usageDailyAgg.successCount})::bigint`,
          failureCount: sql<number>`SUM(${usageDailyAgg.failureCount})::bigint`,
          totalRequests: sql<number>`SUM(${usageDailyAgg.totalRequests})::bigint`,
        })
        .from(usageDailyAgg)
        .where(
          and(
            gte(usageDailyAgg.dayStart, since),
            model ? eq(usageDailyAgg.model, model) : undefined,
            route ? eq(usageDailyAgg.route, route) : undefined
          )
        )
        .groupBy(usageDailyAgg.dayStart)
        .orderBy(usageDailyAgg.dayStart);

      const data: ErrorTimeseriesPoint[] = results.map((row) => {
        const totalRequests = Number(row.totalRequests);
        const successCount = Number(row.successCount);
        const failureCount = Number(row.failureCount);
        const successRate = totalRequests > 0 ? successCount / totalRequests : 0;
        const errorRate = totalRequests > 0 ? failureCount / totalRequests : 0;

        return {
          bucket: row.bucket,
          successCount,
          failureCount,
          totalRequests,
          successRate,
          errorRate,
        };
      });

      return NextResponse.json({ data, hours, interval, model, route });
    } else {
      // 使用小时聚合表
      const results = await db
        .select({
          bucket: sql<string>`${usageHourlyAgg.bucketStart}::text`,
          successCount: sql<number>`SUM(${usageHourlyAgg.successCount})::bigint`,
          failureCount: sql<number>`SUM(${usageHourlyAgg.failureCount})::bigint`,
          totalRequests: sql<number>`SUM(${usageHourlyAgg.totalRequests})::bigint`,
        })
        .from(usageHourlyAgg)
        .where(
          and(
            gte(usageHourlyAgg.bucketStart, since),
            model ? eq(usageHourlyAgg.model, model) : undefined,
            route ? eq(usageHourlyAgg.route, route) : undefined
          )
        )
        .groupBy(usageHourlyAgg.bucketStart)
        .orderBy(usageHourlyAgg.bucketStart);

      const data: ErrorTimeseriesPoint[] = results.map((row) => {
        const totalRequests = Number(row.totalRequests);
        const successCount = Number(row.successCount);
        const failureCount = Number(row.failureCount);
        const successRate = totalRequests > 0 ? successCount / totalRequests : 0;
        const errorRate = totalRequests > 0 ? failureCount / totalRequests : 0;

        return {
          bucket: row.bucket,
          successCount,
          failureCount,
          totalRequests,
          successRate,
          errorRate,
        };
      });

      return NextResponse.json({ data, hours, interval, model, route });
    }
  } catch (error) {
    console.error("Failed to fetch error timeseries:", error);
    return NextResponse.json(
      { error: "Failed to fetch error timeseries" },
      { status: 500 }
    );
  }
}
