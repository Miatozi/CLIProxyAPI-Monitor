import { Skeleton } from "./Skeleton";

interface ChartSkeletonProps {
  height?: number;
  className?: string;
  showHeader?: boolean;
}

export function ChartSkeleton({
  height = 400,
  className = "",
  showHeader = true
}: ChartSkeletonProps) {
  return (
    <div className={`glass-panel rounded-2xl p-6 ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
      <Skeleton className="w-full" style={{ height: `${height}px` }} />
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <ChartSkeleton height={400} />
      </div>
      <div className="lg:col-span-2">
        <ChartSkeleton height={400} />
      </div>
    </div>
  );
}
