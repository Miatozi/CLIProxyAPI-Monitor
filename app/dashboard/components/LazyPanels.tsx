import dynamic from "next/dynamic";

// Panel loading skeleton
function PanelSkeleton({ minHeight = 200 }: { minHeight?: number }) {
  return (
    <div 
      className="animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/50" 
      style={{ minHeight }}
    />
  );
}

// Lazy load VitalsPanel - heavy component with charts and data fetching
export const VitalsPanel = dynamic(
  () => import("@/app/dashboard/components/vitals/VitalsPanel"),
  {
    loading: () => <PanelSkeleton minHeight={280} />,
    ssr: false,
  }
);

// Lazy load TokenAnalyticsPanel - contains charts
export const TokenAnalyticsPanel = dynamic(
  () => import("@/app/dashboard/components/analytics/TokenAnalyticsPanel"),
  {
    loading: () => <PanelSkeleton minHeight={200} />,
    ssr: false,
  }
);

// Lazy load ErrorAnalyticsPanel - contains charts
export const ErrorAnalyticsPanel = dynamic(
  () => import("@/app/dashboard/components/analytics/ErrorAnalyticsPanel"),
  {
    loading: () => <PanelSkeleton minHeight={200} />,
    ssr: false,
  }
);

// Lazy load PricingConfig - complex form component
export const PricingConfig = dynamic(
  () => import("@/app/dashboard/components/PricingConfig").then((mod) => ({ default: mod.PricingConfig })),
  {
    loading: () => <PanelSkeleton minHeight={300} />,
    ssr: false,
  }
);
