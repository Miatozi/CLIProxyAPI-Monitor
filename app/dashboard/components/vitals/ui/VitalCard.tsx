interface VitalCardProps {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  count: number;
}

const METRIC_INFO: Record<string, {
  label: string;
  unit: string;
  description: string;
  thresholds: { good: number; poor: number };
  precision?: number;
}> = {
  LCP: {
    label: "Largest Contentful Paint",
    unit: "ms",
    description: "最大内容绘制时间",
    thresholds: { good: 2500, poor: 4000 },
  },
  CLS: {
    label: "Cumulative Layout Shift",
    unit: "",
    description: "累积布局偏移",
    thresholds: { good: 0.1, poor: 0.25 },
    precision: 3,
  },
  INP: {
    label: "Interaction to Next Paint",
    unit: "ms",
    description: "交互响应时间",
    thresholds: { good: 200, poor: 500 },
  },
  FCP: {
    label: "First Contentful Paint",
    unit: "ms",
    description: "首次内容绘制",
    thresholds: { good: 1800, poor: 3000 },
  },
  TTFB: {
    label: "Time to First Byte",
    unit: "ms",
    description: "首字节时间",
    thresholds: { good: 800, poor: 1800 },
  },
};

function getRagColor(rating: string) {
  switch (rating) {
    case "good":
      return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30";
    case "needs-improvement":
      return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30";
    case "poor":
      return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30";
    default:
      return "text-muted-foreground bg-muted";
  }
}

function getRatingLabel(rating: string) {
  switch (rating) {
    case "good":
      return "优秀";
    case "needs-improvement":
      return "需改进";
    case "poor":
      return "较差";
    default:
      return "未知";
  }
}

export default function VitalCard({ name, value, rating, count }: VitalCardProps) {
  const info = METRIC_INFO[name];
  if (!info) return null;

  const displayValue = info.precision
    ? value.toFixed(info.precision)
    : Math.round(value).toString();

  const colorClass = getRagColor(rating);

  return (
    <div className={`border rounded-lg p-5 ${colorClass} transition-colors`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium opacity-70">{info.description}</p>
          <h3 className="text-sm font-semibold mt-0.5">{name}</h3>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-background/50 font-medium">
          {getRatingLabel(rating)}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-3xl font-bold">
          {displayValue}
        </span>
        {info.unit && <span className="text-sm opacity-70">{info.unit}</span>}
      </div>

      <div className="flex items-center justify-between text-xs opacity-60">
        <span>P75 值</span>
        <span>{count.toLocaleString()} 样本</span>
      </div>

      {/* 阈值参考 */}
      <div className="mt-3 pt-3 border-t border-current/10 text-xs opacity-50 space-y-0.5">
        <div>✓ 优秀: ≤ {info.thresholds.good}{info.unit}</div>
        <div>⚠ 较差: &gt; {info.thresholds.poor}{info.unit}</div>
      </div>
    </div>
  );
}
