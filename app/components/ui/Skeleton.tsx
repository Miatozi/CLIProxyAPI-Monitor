import { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-skeleton-pulse rounded-lg bg-slate-800/50 ${className}`}
      {...props}
    />
  );
}
