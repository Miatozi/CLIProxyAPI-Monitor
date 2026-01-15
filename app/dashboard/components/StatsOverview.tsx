import { Activity, DollarSign, Zap, TrendingUp, CheckCircle, XCircle, Database } from "lucide-react";
import StatsCard from "./StatsCard";
import type { UsageOverview } from "@/lib/types";

interface StatsOverviewProps {
  overview: UsageOverview;
  darkMode?: boolean;
}

export default function StatsOverview({ overview, darkMode = true }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
      <StatsCard
        title="总请求数"
        value={overview.totalRequests}
        icon={Activity}
        format="compact"
        darkMode={darkMode}
      />
      <StatsCard
        title="总 Token 数"
        value={overview.totalTokens}
        icon={Zap}
        format="compact"
        darkMode={darkMode}
      />
      <StatsCard
        title="总费用"
        value={overview.totalCost}
        icon={DollarSign}
        format="currency"
        darkMode={darkMode}
      />
      <StatsCard
        title="成功率"
        value={overview.successRate}
        icon={TrendingUp}
        format="percent"
        darkMode={darkMode}
      />
      <StatsCard
        title="成功请求"
        value={overview.successCount}
        icon={CheckCircle}
        format="compact"
        darkMode={darkMode}
      />
      <StatsCard
        title="失败请求"
        value={overview.failureCount}
        icon={XCircle}
        format="compact"
        darkMode={darkMode}
      />
      <StatsCard
        title="缓存 Token"
        value={overview.totalCachedTokens}
        icon={Database}
        format="compact"
        darkMode={darkMode}
      />
    </div>
  );
}
