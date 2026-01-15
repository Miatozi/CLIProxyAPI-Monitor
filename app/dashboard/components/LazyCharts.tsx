import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/app/components/ui/ChartSkeleton";

export const TrendChart = dynamic(
  () => import("@/app/dashboard/components/charts/TrendChart").then((mod) => ({ default: mod.TrendChart })),
  {
    loading: () => <ChartSkeleton height={300} />,
    ssr: false,
  }
);

export const HourlyChart = dynamic(
  () => import("@/app/dashboard/components/charts/HourlyChart").then((mod) => ({ default: mod.HourlyChart })),
  {
    loading: () => <ChartSkeleton height={300} />,
    ssr: false,
  }
);

export const ModelPieChart = dynamic(
  () => import("@/app/dashboard/components/charts/ModelPieChart").then((mod) => ({ default: mod.ModelPieChart })),
  {
    loading: () => <ChartSkeleton height={300} />,
    ssr: false,
  }
);

export const CostTable = dynamic(
  () => import("@/app/dashboard/components/tables/CostTable").then((mod) => ({ default: mod.CostTable })),
  {
    loading: () => <div className="glass-panel rounded-lg p-6 animate-pulse h-64" />,
    ssr: false,
  }
);
