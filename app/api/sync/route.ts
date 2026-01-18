import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { config, assertEnv } from "@/lib/config";
import { db } from "@/lib/db/client";
import { usageRecords, usageHourlyAgg, usageDailyAgg } from "@/lib/db/schema";
import { parseUsagePayload, toUsageRecords } from "@/lib/usage";

export const runtime = "nodejs";

const PASSWORD = process.env.PASSWORD || process.env.CLIPROXY_SECRET_KEY || "";
const COOKIE_NAME = "dashboard_auth";
const ENABLE_PREAGG = process.env.ENABLE_PREAGG !== "false";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function missingPassword() {
  return NextResponse.json({ error: "PASSWORD is missing" }, { status: 501 });
}

async function hashPassword(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function isAuthorized(request: Request) {
  // 检查 Bearer token（用于 cron job 等外部调用）
  const allowed = [config.password, config.cronSecret].filter(Boolean).map((v) => `Bearer ${v}`);
  if (allowed.length > 0) {
    const auth = request.headers.get("authorization") || "";
    if (allowed.includes(auth)) return true;
  }
  
  // 检查用户的 dashboard cookie（用于前端调用）
  if (PASSWORD) {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(COOKIE_NAME);
    if (authCookie) {
      const expectedToken = await hashPassword(PASSWORD);
      if (authCookie.value === expectedToken) return true;
    }
  }
  
  return false;
}

async function performSync(request: Request) {
  if (!config.password && !config.cronSecret && !PASSWORD) return missingPassword();
  if (!(await isAuthorized(request))) return unauthorized();

  try {
    assertEnv();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 501 });
  }

  const usageUrl = `${config.cliproxy.baseUrl.replace(/\/$/, "")}/usage`;
  const pulledAt = new Date();

  const response = await fetch(usageUrl, {
    headers: {
      Authorization: `Bearer ${config.cliproxy.apiKey}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch usage", statusText: response.statusText },
      { status: response.status }
    );
  }

  let payload;
  try {
    const json = await response.json();
    payload = parseUsagePayload(json);
  } catch (parseError) {
    console.error("/api/sync parse upstream usage failed:", parseError);
    return NextResponse.json(
      { error: "Bad Gateway" },
      { status: 502 }
    );
  }

  const rows = toUsageRecords(payload, pulledAt);

  if (rows.length === 0) {
    return NextResponse.json({ status: "ok", inserted: 0, message: "No usage data" });
  }

  // 使用事务确保原始数据插入和预聚合更新的原子性
  let inserted = 0;
  try {
    await db.transaction(async (tx) => {
      // 1. 插入原始数据
      const insertedRows = await tx
        .insert(usageRecords)
        .values(rows)
        .onConflictDoNothing({ target: [usageRecords.occurredAt, usageRecords.route, usageRecords.model] })
        .returning({ id: usageRecords.id });

      // Vercel Postgres may return an empty array even when rows are inserted with RETURNING + ON CONFLICT DO NOTHING.
      // Fall back to counting rows synced in this run (identified by the shared pulledAt timestamp) to avoid reporting 0.
      inserted = insertedRows.length;
      if (inserted === 0 && rows.length > 0) {
        const fallback = await tx
          .select({ count: sql<number>`count(*)` })
          .from(usageRecords)
          .where(eq(usageRecords.syncedAt, pulledAt));
        inserted = Number(fallback?.[0]?.count ?? 0);
      }

      // 2. 如果有数据插入且启用预聚合，则更新聚合表
      if (ENABLE_PREAGG && inserted > 0) {
        const hourBucketExpr = sql`date_trunc('hour', occurred_at at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai'`;
        const dayBucketExpr = sql`date_trunc('day', occurred_at at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai'`;

        // Upsert hourly aggregates
        await tx.execute(sql`
          INSERT INTO usage_hourly_agg (
            bucket_start, route, model,
            total_tokens, input_tokens, output_tokens, reasoning_tokens, cached_tokens,
            total_requests, success_count, failure_count,
            created_at, updated_at
          )
          SELECT
            ${hourBucketExpr} as bucket_start,
            route,
            model,
            coalesce(sum(total_tokens), 0)::bigint as total_tokens,
            coalesce(sum(input_tokens), 0)::bigint as input_tokens,
            coalesce(sum(output_tokens), 0)::bigint as output_tokens,
            coalesce(sum(reasoning_tokens), 0)::bigint as reasoning_tokens,
            coalesce(sum(cached_tokens), 0)::bigint as cached_tokens,
            coalesce(sum(total_requests), 0)::bigint as total_requests,
            coalesce(sum(success_count), 0)::bigint as success_count,
            coalesce(sum(failure_count), 0)::bigint as failure_count,
            now() as created_at,
            now() as updated_at
          FROM ${usageRecords}
          WHERE synced_at = ${pulledAt}
          GROUP BY 1, route, model
          ON CONFLICT (bucket_start, route, model) DO UPDATE SET
            total_tokens = usage_hourly_agg.total_tokens + EXCLUDED.total_tokens,
            input_tokens = usage_hourly_agg.input_tokens + EXCLUDED.input_tokens,
            output_tokens = usage_hourly_agg.output_tokens + EXCLUDED.output_tokens,
            reasoning_tokens = usage_hourly_agg.reasoning_tokens + EXCLUDED.reasoning_tokens,
            cached_tokens = usage_hourly_agg.cached_tokens + EXCLUDED.cached_tokens,
            total_requests = usage_hourly_agg.total_requests + EXCLUDED.total_requests,
            success_count = usage_hourly_agg.success_count + EXCLUDED.success_count,
            failure_count = usage_hourly_agg.failure_count + EXCLUDED.failure_count,
            updated_at = now();
        `);

        // Upsert daily aggregates
        await tx.execute(sql`
          INSERT INTO usage_daily_agg (
            day_start, route, model,
            total_tokens, input_tokens, output_tokens, reasoning_tokens, cached_tokens,
            total_requests, success_count, failure_count,
            created_at, updated_at
          )
          SELECT
            ${dayBucketExpr} as day_start,
            route,
            model,
            coalesce(sum(total_tokens), 0)::bigint as total_tokens,
            coalesce(sum(input_tokens), 0)::bigint as input_tokens,
            coalesce(sum(output_tokens), 0)::bigint as output_tokens,
            coalesce(sum(reasoning_tokens), 0)::bigint as reasoning_tokens,
            coalesce(sum(cached_tokens), 0)::bigint as cached_tokens,
            coalesce(sum(total_requests), 0)::bigint as total_requests,
            coalesce(sum(success_count), 0)::bigint as success_count,
            coalesce(sum(failure_count), 0)::bigint as failure_count,
            now() as created_at,
            now() as updated_at
          FROM ${usageRecords}
          WHERE synced_at = ${pulledAt}
          GROUP BY 1, route, model
          ON CONFLICT (day_start, route, model) DO UPDATE SET
            total_tokens = usage_daily_agg.total_tokens + EXCLUDED.total_tokens,
            input_tokens = usage_daily_agg.input_tokens + EXCLUDED.input_tokens,
            output_tokens = usage_daily_agg.output_tokens + EXCLUDED.output_tokens,
            reasoning_tokens = usage_daily_agg.reasoning_tokens + EXCLUDED.reasoning_tokens,
            cached_tokens = usage_daily_agg.cached_tokens + EXCLUDED.cached_tokens,
            total_requests = usage_daily_agg.total_requests + EXCLUDED.total_requests,
            success_count = usage_daily_agg.success_count + EXCLUDED.success_count,
            failure_count = usage_daily_agg.failure_count + EXCLUDED.failure_count,
            updated_at = now();
        `);
      }
    });
  } catch (dbError) {
    console.error("/api/sync transaction failed:", dbError);
    return NextResponse.json(
      { error: "Database transaction failed", details: (dbError as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "ok", inserted, attempted: rows.length });
}

export async function POST(request: Request) {
  return performSync(request);
}

export async function GET(request: Request) {
  return performSync(request);
}
