"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, FileText, Activity, LogOut, Github, ExternalLink } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Modal } from "./Modal";
import { useTheme } from "@/app/components/ThemeProvider";

const links = [
  { href: "/", label: "仪表盘", icon: BarChart3 },
  { href: "/explore", label: "数据探索", icon: Activity },
  { href: "/logs", label: "日志", icon: FileText }
];

export default function Sidebar() {
  const { isDarkMode } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [usageStatsEnabled, setUsageStatsEnabled] = useState<boolean | null>(null);
  const [usageStatsLoading, setUsageStatsLoading] = useState(false);
  const [showUsageConfirm, setShowUsageConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [cpamcLink, setCpamcLink] = useState<string | null>(null);

  const loadToggle = useCallback(async () => {
    setUsageStatsLoading(true);
    try {
      const res = await fetch("/api/usage-statistics-enabled", { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setUsageStatsEnabled(Boolean(data["usage-statistics-enabled"]));
    } catch {
      setUsageStatsEnabled(null);
    } finally {
      setUsageStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToggle();
  }, [loadToggle]);

  useEffect(() => {
    let active = true;
    const loadCpamc = async () => {
      try {
        const res = await fetch("/api/management-url", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setCpamcLink(typeof data?.url === "string" ? data.url : null);
      } catch {
        if (!active) return;
        setCpamcLink(null);
      }
    };

    loadCpamc();
    return () => {
      active = false;
    };
  }, []);

  const applyUsageToggle = async (nextEnabled: boolean) => {
    setUsageStatsLoading(true);
    try {
      const res = await fetch("/api/usage-statistics-enabled", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: nextEnabled })
      });
      if (!res.ok) throw new Error("toggle failed");
      const data = await res.json();
      setUsageStatsEnabled(Boolean(data["usage-statistics-enabled"]));
    } catch {
      // 失败时回滚
      setUsageStatsEnabled(!nextEnabled);
    } finally {
      setUsageStatsLoading(false);
    }
  };

  const handleUsageToggle = () => {
    if (usageStatsEnabled === null) return;
    const nextEnabled = !usageStatsEnabled;
    if (!nextEnabled) {
      setShowUsageConfirm(true);
      return;
    }
    // 乐观 UI：立即更新状态
    setUsageStatsEnabled(nextEnabled);
    applyUsageToggle(nextEnabled);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-56 flex-col border-r border-slate-200 dark:border-slate-800 glass-panel py-6">
      <div className="px-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">CLIProxyAPI</h1>
        <p className="text-sm text-slate-500 dark:text-slate-500">Usage Dashboard</p>
      </div>
      <nav className="mt-8 flex-1 space-y-1 px-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        {cpamcLink ? (
          <a
            href={cpamcLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ExternalLink className="h-5 w-5" />
            前往 CPAMC
          </a>
        ) : null}
      </nav>

      <div className="mt-auto border-t border-slate-200 dark:border-slate-800 px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Activity className="h-4 w-4" />
            上游使用统计
          </div>
          <motion.button
            onClick={handleUsageToggle}
            disabled={usageStatsLoading || usageStatsEnabled === null}
            aria-pressed={usageStatsEnabled ?? false}
            aria-label={`上游使用统计 ${usageStatsEnabled ? "已开启" : "已关闭"}`}
            whileTap={{ scale: 0.95 }}
            className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
              usageStatsEnabled
                ? "bg-emerald-600 text-white"
                : "border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400"
            } ${usageStatsLoading ? "opacity-70" : ""}`}
          >
            {usageStatsLoading ? "..." : usageStatsEnabled ? "ON" : "OFF"}
          </motion.button>
        </div>
        
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/sxjeru/CLIProxyAPI-Monitor"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="在 GitHub 上查看项目"
            className="flex items-center justify-center rounded-lg border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Github className="h-4 w-4" />
          </a>
          <motion.button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="退出登录"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "退出中..." : "退出登录"}
          </motion.button>
        </div>
      </div>
      <Modal
        isOpen={showUsageConfirm}
        onClose={() => setShowUsageConfirm(false)}
        title="关闭上游使用统计？"
        darkMode={isDarkMode}
        className={isDarkMode ? "bg-slate-900 ring-1 ring-slate-700" : undefined}
        backdropClassName="bg-black/60"
      >
        <p className="mt-2 text-sm text-slate-400">关闭后将停止 CLIProxyAPI 记录使用数据，需要时可再次开启。</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setShowUsageConfirm(false)}
            className="flex-1 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              setShowUsageConfirm(false);
              applyUsageToggle(false);
            }}
            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
            disabled={usageStatsLoading}
          >
            确认关闭
          </button>
        </div>
      </Modal>
    </aside>
  );
}
