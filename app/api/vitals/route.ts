import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { insertWebVitals, type VitalMetric } from "@/lib/queries/vitals";

// 请求体 Schema
const MetricSchema = z.object({
  name: z.enum(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]),
  id: z.string().min(1).max(128),
  value: z.number().finite(),
  delta: z.number().finite(),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
  navigationType: z.string().max(32).optional(),
  url: z.string().max(2048).optional(),
  pathname: z.string().max(512).optional(),
  ts: z.number().int().positive().optional(),
  appVersion: z.string().max(32).optional(),
});

const RequestBodySchema = z.object({
  metrics: z.array(MetricSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();

    // 校验
    const parseResult = RequestBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Bad Request",
          details: parseResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { metrics } = parseResult.data;

    // 获取 User-Agent
    const userAgent = request.headers.get("user-agent") || undefined;

    // 写入数据库
    const result = await insertWebVitals(metrics as VitalMetric[], userAgent);

    return NextResponse.json({
      ok: true,
      accepted: result.accepted,
      sampledOut: result.sampledOut,
    });
  } catch (error) {
    console.error("[/api/vitals] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// 不缓存
export const dynamic = "force-dynamic";
