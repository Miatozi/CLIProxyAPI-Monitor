"use client";

import { useRouter } from "next/navigation";

interface TopFailureEntry {
  model?: string;
  route?: string;
  failureCount: number;
  totalRequests: number;
  errorRate: number;
}

interface TopFailuresListProps {
  data: TopFailureEntry[];
  groupBy: "model" | "route";
}

export default function TopFailuresList({ data, groupBy }: TopFailuresListProps) {
  const router = useRouter();

  const handleClick = (entry: TopFailureEntry) => {
    // 跳转到 Explore 页面并筛选错误
    const params = new URLSearchParams({
      isError: "true",
    });

    if (entry.model) {
      params.set("model", entry.model);
    }

    if (entry.route) {
      params.set("route", entry.route);
    }

    router.push(`/explore?${params.toString()}`);
  };

  return (
    <div className="space-y-2">
      {data.map((entry, idx) => {
        const label = entry.model || entry.route || "未知";
        const errorRatePercent = (entry.errorRate * 100).toFixed(2);

        return (
          <div
            key={idx}
            onClick={() => handleClick(entry)}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    entry.errorRate > 0.1
                      ? "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                      : entry.errorRate > 0.05
                      ? "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {errorRatePercent}% 错误率
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {entry.failureCount.toLocaleString()} 次失败 / {entry.totalRequests.toLocaleString()} 总请求
              </div>
            </div>

            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        );
      })}

      {data.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          无失败记录
        </div>
      )}
    </div>
  );
}
