import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { webVitals } from "@/lib/db/schema";
import { sql, and, gte, eq } from "drizzle-orm";

// Web Vitals 阈值 (参考 web.dev)
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },  // ms
  CLS: { good: 0.1, poor: 0.25 },   // score
  INP: { good: 200, poor: 500 },    // ms
  FCP: { good: 1800, poor: 3000 },  // ms
  TTFB: { good: 800, poor: 1800 },  // ms
};

interface VitalSummary {
  name: string;
  p75: number;
  count: number;
  rating: "good" | "needs-improvement" | "poor";
}

interface VitalsByPage {
  pathname: string;
  metrics: VitalSummary[];
}

function getRating(name: string, value: number): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return "good";

  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pathname = searchParams.get("pathname");
    const hours = parseInt(searchParams.get("hours") || "24");
    const groupBy = searchParams.get("groupBy") || "global"; // global | page

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (groupBy === "page") {
      // 按页面分组
      const results = await db
        .select({
          pathname: webVitals.pathname,
          name: webVitals.name,
          p75: sql<number>`percentile_cont(0.75) within group (order by ${webVitals.value})`,
          count: sql<number>`count(*)::int`,
        })
        .from(webVitals)
        .where(
          and(
            gte(webVitals.createdAt, since),
            pathname ? eq(webVitals.pathname, pathname) : undefined
          )
        )
        .groupBy(webVitals.pathname, webVitals.name);

      // 转换为嵌套结构
      const byPage = new Map<string, VitalSummary[]>();

      for (const row of results) {
        const page = row.pathname || "(unknown)";
        if (!byPage.has(page)) {
          byPage.set(page, []);
        }

        byPage.get(page)!.push({
          name: row.name,
          p75: row.p75,
          count: row.count,
          rating: getRating(row.name, row.p75),
        });
      }

      const data: VitalsByPage[] = Array.from(byPage.entries()).map(([pathname, metrics]) => ({
        pathname,
        metrics,
      }));

      return NextResponse.json({ data, hours, groupBy });
    } else {
      // 全局聚合
      const results = await db
        .select({
          name: webVitals.name,
          p75: sql<number>`percentile_cont(0.75) within group (order by ${webVitals.value})`,
          count: sql<number>`count(*)::int`,
        })
        .from(webVitals)
        .where(gte(webVitals.createdAt, since))
        .groupBy(webVitals.name);

      const data: VitalSummary[] = results.map((row) => ({
        name: row.name,
        p75: row.p75,
        count: row.count,
        rating: getRating(row.name, row.p75),
      }));

      return NextResponse.json({ data, hours, groupBy });
    }
  } catch (error) {
    console.error("Failed to fetch vitals summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch vitals summary" },
      { status: 500 }
    );
  }
}
