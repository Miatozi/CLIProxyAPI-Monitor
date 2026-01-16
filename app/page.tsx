import { getOverview } from "@/lib/queries/overview";
import { getOverviewAgg } from "@/lib/queries/overviewAgg";
import { DashboardClient } from "@/app/dashboard/components/DashboardClient";

// 禁用静态生成,使用动态渲染(需要数据库连接)
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    days?: string;
    start?: string;
    end?: string;
    model?: string;
    route?: string;
    page?: string;
    pageSize?: string;
    preagg?: string;
  };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  // 解析参数
  const days = searchParams.days ? Number(searchParams.days) : undefined;
  const start = searchParams.start;
  const end = searchParams.end;
  const model = searchParams.model;
  const route = searchParams.route;
  const page = searchParams.page ? Number(searchParams.page) : undefined;
  const pageSize = searchParams.pageSize ? Number(searchParams.pageSize) : undefined;
  const preaggParam = searchParams.preagg;

  // 预聚合开关逻辑
  const enablePreaggRead = process.env.ENABLE_PREAGG_READ !== "false";
  const forceAgg = preaggParam === "1";
  const forceRaw = preaggParam === "0";
  const useAgg = forceRaw ? false : (forceAgg ? true : enablePreaggRead);

  // 服务端预取数据
  let data;
  try {
    if (useAgg) {
      try {
        data = await getOverviewAgg(days, {
          model: model || undefined,
          route: route || undefined,
          page,
          pageSize,
          start,
          end,
        });
      } catch (error) {
        console.warn("[Dashboard] Agg query failed, falling back to raw:", error);
        data = await getOverview(days, {
          model: model || undefined,
          route: route || undefined,
          page,
          pageSize,
          start,
          end,
        });
      }
    } else {
      data = await getOverview(days, {
        model: model || undefined,
        route: route || undefined,
        page,
        pageSize,
        start,
        end,
      });
    }
  } catch (error) {
    console.error("[Dashboard] Failed to fetch data:", error);
    // 返回空数据
    data = {
      overview: {
        totalRequests: 0,
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalReasoningTokens: 0,
        totalCachedTokens: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 1,
        totalCost: 0,
        models: [],
        byDay: [],
        byHour: [],
      },
      empty: true,
      days: days || 14,
      meta: { page: 1, pageSize: 10, totalModels: 0, totalPages: 1 },
      filters: { models: [], routes: [] },
    };
  }

  return (
    <DashboardClient
      initialData={data}
      initialFilters={{
        days,
        start,
        end,
        model,
        route,
      }}
    />
  );
}
