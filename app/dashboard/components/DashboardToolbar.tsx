"use client";

import { useState, useRef, useEffect } from "react";
import { CalendarRange, RefreshCw } from "lucide-react";
import { useUrlFilters } from "@/app/hooks/useUrlFilters";
import { ComboBox } from "@/app/dashboard/components/ui/ComboBox";
import { useTheme } from "@/app/components/ThemeProvider";

interface DashboardToolbarProps {
  modelOptions: string[];
  routeOptions: string[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DashboardToolbar({
  modelOptions,
  routeOptions,
  onRefresh,
  isRefreshing = false,
}: DashboardToolbarProps) {
  const { filters, updateFilters } = useUrlFilters();
  const { isDarkMode: darkMode } = useTheme();

  // 日期范围状态
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customDraftStart, setCustomDraftStart] = useState(filters.start || "");
  const [customDraftEnd, setCustomDraftEnd] = useState(filters.end || "");
  const [customError, setCustomError] = useState<string | null>(null);
  const customPickerRef = useRef<HTMLDivElement | null>(null);

  // 筛选器状态
  const [filterModelInput, setFilterModelInput] = useState(filters.model || "");
  const [filterRouteInput, setFilterRouteInput] = useState(filters.route || "");

  const rangeMode = filters.start && filters.end ? "custom" : "preset";
  const rangeDays = filters.days || 14;

  // 点击外部关闭自定义日期选择器
  useEffect(() => {
    if (!customPickerOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (customPickerRef.current && !customPickerRef.current.contains(e.target as Node)) {
        setCustomPickerOpen(false);
        setCustomError(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [customPickerOpen]);

  const handlePresetDays = (days: number) => {
    updateFilters({ days, start: undefined, end: undefined });
    setCustomPickerOpen(false);
  };

  const handleCustomApply = () => {
    if (!customDraftStart || !customDraftEnd) {
      setCustomError("请选择开始和结束日期");
      return;
    }
    const startDate = new Date(customDraftStart);
    const endDate = new Date(customDraftEnd);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      setCustomError("日期无效");
      return;
    }
    if (endDate < startDate) {
      setCustomError("结束日期需不早于开始日期");
      return;
    }
    setCustomError(null);
    updateFilters({ start: customDraftStart, end: customDraftEnd, days: undefined });
    setCustomPickerOpen(false);
  };

  const applyModelFilter = (model: string) => {
    setFilterModelInput(model);
    updateFilters({ model });
  };

  const applyRouteFilter = (route: string) => {
    setFilterRouteInput(route);
    updateFilters({ route });
  };

  const rangeSubtitle =
    rangeMode === "custom" && filters.start && filters.end
      ? `${filters.start} ~ ${filters.end}`
      : `最近 ${rangeDays} 天`;

  return (
    <div className="glass-panel rounded-lg p-6 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm uppercase tracking-wide text-slate-500">时间范围</span>
        {[7, 14, 30].map((days) => (
          <button
            key={days}
            onClick={() => handlePresetDays(days)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              rangeMode === "preset" && rangeDays === days
                ? "border-indigo-500 bg-indigo-600 text-white"
                : darkMode
                ? "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            最近 {days} 天
          </button>
        ))}
        <div className="relative" ref={customPickerRef}>
          <button
            onClick={() => {
              setCustomPickerOpen((open) => !open);
              setCustomDraftStart(filters.start || "");
              setCustomDraftEnd(filters.end || "");
            }}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              rangeMode === "custom"
                ? "border-indigo-500 bg-indigo-600 text-white"
                : darkMode
                ? "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            自定义
          </button>
          {customPickerOpen && (
            <div
              className={`absolute z-30 mt-2 w-72 rounded-xl border p-4 shadow-2xl ${
                darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
              }`}
            >
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 gap-2">
                  <label className={darkMode ? "text-slate-300" : "text-slate-700"}>
                    开始日期
                    <input
                      type="date"
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${
                        darkMode ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-900"
                      }`}
                      value={customDraftStart}
                      max={customDraftEnd || undefined}
                      onChange={(e) => setCustomDraftStart(e.target.value)}
                    />
                  </label>
                  <label className={darkMode ? "text-slate-300" : "text-slate-700"}>
                    结束日期
                    <input
                      type="date"
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${
                        darkMode ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-900"
                      }`}
                      value={customDraftEnd}
                      min={customDraftStart || undefined}
                      onChange={(e) => setCustomDraftEnd(e.target.value)}
                    />
                  </label>
                </div>
                {customError && <p className="text-xs text-red-400">{customError}</p>}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPickerOpen(false);
                      setCustomError(null);
                      setCustomDraftStart(filters.start || "");
                      setCustomDraftEnd(filters.end || "");
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      darkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleCustomApply}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    应用
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {rangeMode === "custom" && (
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
              darkMode
                ? "border-slate-700 bg-slate-800 text-slate-200 shadow-[0_4px_20px_rgba(15,23,42,0.35)]"
                : "border-slate-200 bg-white text-slate-700 shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
            }`}
          >
            <CalendarRange className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <span className="whitespace-nowrap">{rangeSubtitle}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ComboBox
          value={filterModelInput}
          onChange={setFilterModelInput}
          options={modelOptions}
          placeholder="按模型过滤"
          darkMode={darkMode}
          onSelectOption={applyModelFilter}
          onClear={() => {
            setFilterModelInput("");
            updateFilters({ model: undefined });
          }}
        />
        <ComboBox
          value={filterRouteInput}
          onChange={setFilterRouteInput}
          options={routeOptions}
          placeholder="按 Key 过滤"
          darkMode={darkMode}
          onSelectOption={applyRouteFilter}
          onClear={() => {
            setFilterRouteInput("");
            updateFilters({ route: undefined });
          }}
        />
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              darkMode
                ? "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            } ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}
