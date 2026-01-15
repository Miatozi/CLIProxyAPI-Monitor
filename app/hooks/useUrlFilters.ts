"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface FilterState {
  days?: number;
  start?: string;
  end?: string;
  model?: string;
  route?: string;
}

export function useUrlFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: FilterState = {
    days: searchParams.get("days") ? Number(searchParams.get("days")) : undefined,
    start: searchParams.get("start") || undefined,
    end: searchParams.get("end") || undefined,
    model: searchParams.get("model") || undefined,
    route: searchParams.get("route") || undefined,
  };

  const updateFilters = useCallback(
    (updates: Partial<FilterState>) => {
      const params = new URLSearchParams(searchParams.toString());

      // 更新或删除参数
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  return {
    filters,
    updateFilters,
    clearFilters,
  };
}
