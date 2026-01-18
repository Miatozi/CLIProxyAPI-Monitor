import { NextResponse } from "next/server";
import { assertEnv } from "@/lib/config";
import { getOverview } from "@/lib/queries/overview";
import { getOverviewAgg } from "@/lib/queries/overviewAgg";

export const runtime = "nodejs";

type CachedOverview = {
  expiresAt: number;
  value: {
    overview: Awaited<ReturnType<typeof getOverview>>["overview"] | null;
    empty: boolean;
    days: number;
    meta?: Awaited<ReturnType<typeof getOverview>>["meta"];
    filters?: Awaited<ReturnType<typeof getOverview>>["filters"];
  };
};

const OVERVIEW_CACHE_TTL_MS = 30_000;
const OVERVIEW_CACHE_MAX_ENTRIES = 100;
const CDN_CACHE_CONTROL = "private, max-age=30, stale-while-revalidate=60";
const overviewCache = new Map<string, CachedOverview>();

function makeCacheKey(input: { days?: number; model?: string | null; route?: string | null; page?: number; pageSize?: number; start?: string | null; end?: string | null; mode?: string }) {
  return JSON.stringify({
    days: input.days ?? null,
    model: input.model ?? null,
    route: input.route ?? null,
    page: input.page ?? null,
    pageSize: input.pageSize ?? null,
    start: input.start ?? null,
    end: input.end ?? null,
    mode: input.mode ?? "raw"
  });
}

function getCached(key: string) {
  const entry = overviewCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    overviewCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key: string, value: CachedOverview["value"]) {
  if (overviewCache.size >= OVERVIEW_CACHE_MAX_ENTRIES) {
    const oldestKey = overviewCache.keys().next().value as string | undefined;
    if (oldestKey) overviewCache.delete(oldestKey);
  }
  overviewCache.set(key, { expiresAt: Date.now() + OVERVIEW_CACHE_TTL_MS, value });
}

export async function GET(request: Request) {
  try {
    assertEnv();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 501 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? Number.parseInt(daysParam, 10) : undefined;
    const model = searchParams.get("model");
    const route = searchParams.get("route");
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const preaggParam = searchParams.get("preagg");

    // 预聚合开关逻辑
    const enablePreaggRead = process.env.ENABLE_PREAGG_READ !== "false";
    const forceAgg = preaggParam === "1";
    const forceRaw = preaggParam === "0";
    const useAgg = forceRaw ? false : (forceAgg ? true : enablePreaggRead);
    const mode = useAgg ? "agg" : "raw";

    const page = pageParam ? Number.parseInt(pageParam, 10) : undefined;
    const pageSize = pageSizeParam ? Number.parseInt(pageSizeParam, 10) : undefined;
    const cacheKey = makeCacheKey({ days, model, route, page, pageSize, start, end, mode });
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: { "Cache-Control": CDN_CACHE_CONTROL }
      });
    }

    let result;
    if (useAgg) {
      try {
        result = await getOverviewAgg(days, {
          model: model || undefined,
          route: route || undefined,
          page,
          pageSize,
          start,
          end
        });
      } catch (error) {
        console.warn("[/api/overview] Agg query failed, falling back to raw:", error);
        result = await getOverview(days, {
          model: model || undefined,
          route: route || undefined,
          page,
          pageSize,
          start,
          end
        });
      }
    } else {
      result = await getOverview(days, {
        model: model || undefined,
        route: route || undefined,
        page,
        pageSize,
        start,
        end
      });
    }

    const { overview, empty, days: appliedDays, meta, filters } = result;
    const payload = { overview, empty, days: appliedDays, meta, filters };
    setCached(cacheKey, payload);
    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": CDN_CACHE_CONTROL }
    });
  } catch (error) {
    console.error("/api/overview failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
