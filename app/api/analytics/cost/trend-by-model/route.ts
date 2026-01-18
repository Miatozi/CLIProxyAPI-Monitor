import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { usageHourlyAgg, usageDailyAgg, modelPrices } from "@/lib/db/schema";
import { sql, gte, and, eq } from "drizzle-orm";

interface CostTrendPoint {
  bucket: string;
  model: string;
  cost: number;
  tokens: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "168"); // 默认 7 天
    const route = searchParams.get("route");
    const interval = searchParams.get("interval") || "day"; // hour | day

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // 获取价格表
    const prices = await db.select().from(modelPrices);
    const priceMap = new Map(prices.map((p) => [p.model, p]));

    if (interval === "day") {
      // 使用日聚合表
      const results = await db
        .select({
          bucket: sql<string>`${usageDailyAgg.dayStart}::text`,
          model: usageDailyAgg.model,
          inputTokens: sql<number>`SUM(${usageDailyAgg.inputTokens})::bigint`,
          outputTokens: sql<number>`SUM(${usageDailyAgg.outputTokens})::bigint`,
          cachedTokens: sql<number>`SUM(${usageDailyAgg.cachedTokens})::bigint`,
          totalTokens: sql<number>`SUM(${usageDailyAgg.totalTokens})::bigint`,
        })
        .from(usageDailyAgg)
        .where(
          and(
            gte(usageDailyAgg.dayStart, since),
            route ? eq(usageDailyAgg.route, route) : undefined
          )
        )
        .groupBy(usageDailyAgg.dayStart, usageDailyAgg.model)
        .orderBy(usageDailyAgg.dayStart, usageDailyAgg.model);

      const data: CostTrendPoint[] = results.map((row) => {
        const price = priceMap.get(row.model);
        let cost = 0;

        if (price) {
          const inputCost = (Number(row.inputTokens) / 1_000_000) * Number(price.inputPricePer1M);
          const outputCost = (Number(row.outputTokens) / 1_000_000) * Number(price.outputPricePer1M);
          const cachedCost = (Number(row.cachedTokens) / 1_000_000) * Number(price.cachedInputPricePer1M);
          cost = inputCost + outputCost + cachedCost;
        }

        return {
          bucket: row.bucket,
          model: row.model,
          cost,
          tokens: Number(row.totalTokens),
        };
      });

      return NextResponse.json({ data, hours, interval, route });
    } else {
      // 使用小时聚合表
      const results = await db
        .select({
          bucket: sql<string>`${usageHourlyAgg.bucketStart}::text`,
          model: usageHourlyAgg.model,
          inputTokens: sql<number>`SUM(${usageHourlyAgg.inputTokens})::bigint`,
          outputTokens: sql<number>`SUM(${usageHourlyAgg.outputTokens})::bigint`,
          cachedTokens: sql<number>`SUM(${usageHourlyAgg.cachedTokens})::bigint`,
          totalTokens: sql<number>`SUM(${usageHourlyAgg.totalTokens})::bigint`,
        })
        .from(usageHourlyAgg)
        .where(
          and(
            gte(usageHourlyAgg.bucketStart, since),
            route ? eq(usageHourlyAgg.route, route) : undefined
          )
        )
        .groupBy(usageHourlyAgg.bucketStart, usageHourlyAgg.model)
        .orderBy(usageHourlyAgg.bucketStart, usageHourlyAgg.model);

      const data: CostTrendPoint[] = results.map((row) => {
        const price = priceMap.get(row.model);
        let cost = 0;

        if (price) {
          const inputCost = (Number(row.inputTokens) / 1_000_000) * Number(price.inputPricePer1M);
          const outputCost = (Number(row.outputTokens) / 1_000_000) * Number(price.outputPricePer1M);
          const cachedCost = (Number(row.cachedTokens) / 1_000_000) * Number(price.cachedInputPricePer1M);
          cost = inputCost + outputCost + cachedCost;
        }

        return {
          bucket: row.bucket,
          model: row.model,
          cost,
          tokens: Number(row.totalTokens),
        };
      });

      return NextResponse.json({ data, hours, interval, route });
    }
  } catch (error) {
    console.error("Failed to fetch cost trend:", error);
    return NextResponse.json(
      { error: "Failed to fetch cost trend" },
      { status: 500 }
    );
  }
}
