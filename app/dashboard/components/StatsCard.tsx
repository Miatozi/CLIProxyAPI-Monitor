"use client";

import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency, formatNumber, formatCompactNumber } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  format?: "number" | "currency" | "compact" | "percent";
  darkMode?: boolean;
  index?: number;
}

export default function StatsCard({ title, value, icon: Icon, format = "number", darkMode = true, index = 0 }: StatsCardProps) {
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1]
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={`rounded-xl border p-4 glass-panel hover:border-slate-600 ${
        darkMode ? "" : "bg-white border-slate-300 hover:border-slate-400"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            {title}
          </p>
          <motion.p
            className={`mt-1 text-2xl font-bold tabular-nums ${darkMode ? "text-white" : "text-slate-900"}`}
            key={formattedValue}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {formattedValue}
          </motion.p>
        </div>
        <motion.div
          whileHover={{ rotate: 5, scale: 1.1 }}
          transition={{ duration: 0.2 }}
          className={`rounded-lg p-3 ${
            darkMode ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-100 text-indigo-600"
          }`}
        >
          <Icon className="h-6 w-6" />
        </motion.div>
      </div>
    </motion.div>
  );
}
