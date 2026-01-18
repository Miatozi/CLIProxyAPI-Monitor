import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { usageDailyAgg } from "@/lib/db/schema";
import { sql, gte } from "drizzle-orm";

interface TopFailureEntry {
  model: string;
  route: string;
  failureCount: number;
  totalRequests: number;
  errorRate: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "168"); // 默认 7 天
    const groupBy = searchParams.get("groupBy") || "model"; // model | route
    const limit = parseInt(searchParams.get("limit") || "10");

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (groupBy === "model") {
      // 按模型分组
      const results = await db
        .select({
          model: usageDailyAgg.model,
          failureCount: sql<number>`SUM(${usageDailyAgg.failureCount})::bigint`,
          totalRequests: sql<number>`SUM(${usageDailyAgg.totalRequests})::bigint`,
        })
        .from(usageDailyAgg)
        .where(gte(usageDailyAgg.dayStart, since))
        .groupBy(usageDailyAgg.model)
        .orderBy(sql`SUM(${usageDailyAgg.failureCount}) DESC`)
        .limit(limit);

      const data: Omit<TopFailureEntry, "route">[] = results.map((row) => {
        const failureCount = Number(row.failureCount);
        const totalRequests = Number(row.totalRequests);
        const errorRate = totalRequests > 0 ? failureCount / totalRequests : 0;

        return {
          model: row.model,
          failureCount,
          totalRequests,
          errorRate,
        };
      });

      return NextResponse.json({ data, hours, groupBy, limit });
    } else {
      // 按路由分组
      const results = await db
        .select({
          route: usageDailyAgg.route,
          failureCount: sql<number>`SUM(${usageDailyAgg.failureCount})::bigint`,
          totalRequests: sql<number>`SUM(${usageDailyAgg.totalRequests})::bigint`,
        })
        .from(usageDailyAgg)
        .where(gte(usageDailyAgg.dayStart, since))
        .groupBy(usageDailyAgg.route)
        .orderBy(sql`SUM(${usageDailyAgg.failureCount}) DESC`)
        .limit(limit);

      const data: Omit<TopFailureEntry, "model">[] = results.map((row) => {
        const failureCount = Number(row.failureCount);
        const totalRequests = Number(row.totalRequests);
        const errorRate = totalRequests > 0 ? failureCount / totalRequests : 0;

        return {
          route: row.route,
          failureCount,
          totalRequests,
          errorRate,
        };
      });

      return NextResponse.json({ data, hours, groupBy, limit });
    }
  } catch (error) {
    console.error("Failed to fetch top failures:", error);
    return NextResponse.json(
      { error: "Failed to fetch top failures" },
      { status: 500 }
    );
  }
}
