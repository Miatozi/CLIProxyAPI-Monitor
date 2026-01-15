import { LucideIcon } from "lucide-react";
import { formatCurrency, formatNumber, formatCompactNumber } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  format?: "number" | "currency" | "compact" | "percent";
  darkMode?: boolean;
}

export default function StatsCard({ title, value, icon: Icon, format = "number", darkMode = true }: StatsCardProps) {
  const formattedValue = (() => {
    if (typeof value === "string") return value;
    switch (format) {
      case "currency":
        return formatCurrency(value);
      case "compact":
        return formatCompactNumber(value);
      case "percent":
        return `${(value * 100).toFixed(1)}%`;
      default:
        return formatNumber(value);
    }
  })();

  return (
    <div
      className={`rounded-xl border p-4 transition-all glass-panel hover:border-slate-600 ${
        darkMode ? "" : "bg-white border-slate-300 hover:border-slate-400"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            {title}
          </p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${darkMode ? "text-white" : "text-slate-900"}`}>
            {formattedValue}
          </p>
        </div>
        <div
          className={`rounded-lg p-3 ${
            darkMode ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-100 text-indigo-600"
          }`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
