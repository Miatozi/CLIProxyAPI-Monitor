import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { webVitals } from "@/lib/db/schema";
import { sql, and, gte, eq } from "drizzle-orm";

interface TimeseriesDataPoint {
  bucket: string;
  name: string;
  p75: number;
  count: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pathname = searchParams.get("pathname");
    const hours = parseInt(searchParams.get("hours") || "24");
    const interval = searchParams.get("interval") || "hour"; // hour | day
    const metrics = searchParams.get("metrics")?.split(",") || ["LCP", "CLS", "INP"];

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // 选择时间桶函数
    const bucketSql = interval === "day"
      ? sql`date_trunc('day', ${webVitals.createdAt})`
      : sql`date_trunc('hour', ${webVitals.createdAt})`;

    const results = await db
      .select({
        bucket: sql<string>`${bucketSql}::text`,
        name: webVitals.name,
        p75: sql<number>`percentile_cont(0.75) within group (order by ${webVitals.value})`,
        count: sql<number>`count(*)::int`,
      })
      .from(webVitals)
      .where(
        and(
          gte(webVitals.createdAt, since),
          pathname ? eq(webVitals.pathname, pathname) : undefined,
          sql`${webVitals.name} = ANY(${metrics})`
        )
      )
      .groupBy(bucketSql, webVitals.name)
      .orderBy(bucketSql);

    const data: TimeseriesDataPoint[] = results.map((row) => ({
      bucket: row.bucket,
      name: row.name,
      p75: row.p75,
      count: row.count,
    }));

    return NextResponse.json({ data, hours, interval, metrics });
  } catch (error) {
    console.error("Failed to fetch vitals timeseries:", error);
    return NextResponse.json(
      { error: "Failed to fetch vitals timeseries" },
      { status: 500 }
    );
  }
}
