"use client";

import { useCallback, useEffect, useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RangeMode = "preset" | "custom";

export type RangeSelection = {
  mode: RangeMode;
  days: number;
  start: string;
  end: string;
};

export type SelectionSource = "global" | "local";

function formatDateInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseSelection(raw: string | null, fallback: RangeSelection): RangeSelection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RangeSelection>;
    if (!parsed) return null;
    const mode = parsed.mode === "custom" ? "custom" : "preset";
    const days = Number.isFinite(parsed.days) ? Math.max(1, Number(parsed.days)) : fallback.days;
    const start = parsed.start || fallback.start;
    const end = parsed.end || fallback.end;
    return { mode, days, start, end };
  } catch {
    return null;
  }
}

export type UseRangeSelectionOptions = {
  /** localStorage key for page-local selection */
  localStorageKey?: string;
  /** Default days for preset mode */
  defaultDays?: number;
};

export type UseRangeSelectionReturn = {
  rangeMode: RangeMode;
  rangeDays: number;
  customStart: string;
  customEnd: string;
  appliedDays: number;
  selectionSource: SelectionSource;
  globalSelection: RangeSelection;
  customPickerOpen: boolean;
  customDraftStart: string;
  customDraftEnd: string;
  customError: string | null;
  
  setRangeMode: (mode: RangeMode) => void;
  setRangeDays: (days: number) => void;
  setCustomStart: (start: string) => void;
  setCustomEnd: (end: string) => void;
  setAppliedDays: (days: number) => void;
  setCustomPickerOpen: (open: boolean) => void;
  setCustomDraftStart: (start: string) => void;
  setCustomDraftEnd: (end: string) => void;
  setCustomError: (error: string | null) => void;
  
  applyPresetRange: (days: number) => void;
  applyCustomRange: () => void;
  applyDashboardRange: () => void;
  openCustomPicker: () => void;
  closeCustomPicker: () => void;
  
  isUsingGlobalRange: boolean;
  rangeSubtitle: string;
  presetDateLabel: string;
};

export function useRangeSelection(options: UseRangeSelectionOptions = {}): UseRangeSelectionReturn {
  const { localStorageKey = "rangeSelectionExplore", defaultDays = 14 } = options;

  // Initialize from localStorage
  const [rangeInit] = useState(() => {
    const now = new Date();
    const defaultEnd = now;
    const defaultStart = new Date(now.getTime() - 6 * DAY_MS);
    const fallback: RangeSelection & { source: SelectionSource } = {
      mode: "preset",
      days: defaultDays,
      start: formatDateInputValue(defaultStart),
      end: formatDateInputValue(defaultEnd),
      source: "global"
    };

    if (typeof window === "undefined") return fallback;

    const globalSel = parseSelection(window.localStorage.getItem("rangeSelection"), fallback);
    const localSel = parseSelection(window.localStorage.getItem(localStorageKey), fallback);

    if (globalSel) return { ...globalSel, source: "global" as const };
    if (localSel) return { ...localSel, source: "local" as const };
    return fallback;
  });

  const [rangeMode, setRangeMode] = useState<RangeMode>(rangeInit.mode);
  const [rangeDays, setRangeDays] = useState(rangeInit.days);
  const [customStart, setCustomStart] = useState(rangeInit.start);
  const [customEnd, setCustomEnd] = useState(rangeInit.end);
  const [appliedDays, setAppliedDays] = useState(rangeInit.days);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customDraftStart, setCustomDraftStart] = useState(rangeInit.start);
  const [customDraftEnd, setCustomDraftEnd] = useState(rangeInit.end);
  const [customError, setCustomError] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] = useState<SelectionSource>(rangeInit.source);
  const [globalSelection, setGlobalSelection] = useState<RangeSelection>({
    mode: rangeInit.mode,
    days: rangeInit.days,
    start: rangeInit.start,
    end: rangeInit.end
  });

  // Persist local selection to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectionSource !== "local") return;
    const payload: RangeSelection = { mode: rangeMode, days: rangeDays, start: customStart, end: customEnd };
    window.localStorage.setItem(localStorageKey, JSON.stringify(payload));
  }, [selectionSource, rangeMode, rangeDays, customStart, customEnd, localStorageKey]);

  // Load global selection on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("rangeSelection");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<RangeSelection>;
      if (!parsed) return;
      const next: RangeSelection = {
        mode: parsed.mode === "custom" ? "custom" : "preset",
        days: Number.isFinite(parsed.days) ? Math.max(1, Number(parsed.days)) : rangeDays,
        start: parsed.start || customStart,
        end: parsed.end || customEnd
      };
      setGlobalSelection(next);
      if (selectionSource === "global") {
        setRangeMode(next.mode);
        setRangeDays(next.days);
        setCustomStart(next.start);
        setCustomEnd(next.end);
        setAppliedDays(next.days);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync with global selection on storage event
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "rangeSelection") return;
      const raw = e.newValue;
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as Partial<RangeSelection>;
        if (!parsed) return;
        const next: RangeSelection = {
          mode: parsed.mode === "custom" ? "custom" : "preset",
          days: Number.isFinite(parsed.days) ? Math.max(1, Number(parsed.days)) : rangeDays,
          start: parsed.start || customStart,
          end: parsed.end || customEnd
        };
        setGlobalSelection(next);
        if (selectionSource === "global") {
          setRangeMode(next.mode);
          setRangeDays(next.days);
          setCustomStart(next.start);
          setCustomEnd(next.end);
          setAppliedDays(next.days);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [selectionSource, rangeDays, customStart, customEnd]);

  const isUsingGlobalRange = selectionSource === "global";

  const presetDateLabel = (() => {
    const end = new Date();
    const start = new Date(end.getTime() - Math.max(0, appliedDays - 1) * DAY_MS);
    return `${formatDateInputValue(start)} ~ ${formatDateInputValue(end)}`;
  })();

  const rangeSubtitle = (() => {
    if (rangeMode === "custom" && customStart && customEnd) {
      return `${customStart} ~ ${customEnd}${isUsingGlobalRange ? "（跟随仪表盘）" : ""}`;
    }
    return `${presetDateLabel}${isUsingGlobalRange ? "（跟随仪表盘）" : ""}`;
  })();

  const applyPresetRange = useCallback((days: number) => {
    setSelectionSource("local");
    setRangeMode("preset");
    setRangeDays(days);
    setAppliedDays(days);
    setCustomPickerOpen(false);
    setCustomError(null);
  }, []);

  const applyCustomRange = useCallback(() => {
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
    setSelectionSource("local");
    setRangeMode("custom");
    setCustomStart(customDraftStart);
    setCustomEnd(customDraftEnd);
    const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1);
    setRangeDays(days);
    setAppliedDays(days);
    setCustomPickerOpen(false);
  }, [customDraftStart, customDraftEnd]);

  const applyDashboardRange = useCallback(() => {
    const next = globalSelection;
    setSelectionSource("global");
    setRangeMode(next.mode);
    setRangeDays(next.days);
    setCustomStart(next.start);
    setCustomEnd(next.end);
    setAppliedDays(next.days);
    setCustomPickerOpen(false);
    setCustomError(null);
  }, [globalSelection]);

  const openCustomPicker = useCallback(() => {
    setCustomPickerOpen(true);
    setCustomDraftStart(customStart);
    setCustomDraftEnd(customEnd);
  }, [customStart, customEnd]);

  const closeCustomPicker = useCallback(() => {
    setCustomPickerOpen(false);
    setCustomError(null);
    setCustomDraftStart(customStart);
    setCustomDraftEnd(customEnd);
  }, [customStart, customEnd]);

  return {
    rangeMode,
    rangeDays,
    customStart,
    customEnd,
    appliedDays,
    selectionSource,
    globalSelection,
    customPickerOpen,
    customDraftStart,
    customDraftEnd,
    customError,
    
    setRangeMode,
    setRangeDays,
    setCustomStart,
    setCustomEnd,
    setAppliedDays,
    setCustomPickerOpen,
    setCustomDraftStart,
    setCustomDraftEnd,
    setCustomError,
    
    applyPresetRange,
    applyCustomRange,
    applyDashboardRange,
    openCustomPicker,
    closeCustomPicker,
    
    isUsingGlobalRange,
    rangeSubtitle,
    presetDateLabel
  };
}
