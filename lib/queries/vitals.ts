import { db } from "@/lib/db/client";
import { webVitals } from "@/lib/db/schema";

export interface VitalMetric {
  name: string;
  id: string;
  value: number;
  delta: number;
  rating?: string;
  navigationType?: string;
  url?: string;
  pathname?: string;
  ts?: number;
  appVersion?: string;
}

export interface InsertVitalsResult {
  accepted: number;
  sampledOut: number;
}

// 采样率配置
const SAMPLE_RATES: Record<string, number> = {
  LCP: 1.0,    // 100% 采样
  CLS: 1.0,    // 100% 采样
  INP: 1.0,    // 100% 采样
  FCP: 0.2,    // 20% 采样
  FID: 0.2,    // 20% 采样
  TTFB: 0.2,   // 20% 采样
};

// 默认采样率
const DEFAULT_SAMPLE_RATE = parseFloat(process.env.VITALS_SAMPLE_RATE || "0.2");

/**
 * 基于 metric ID 的确定性采样
 * 使用简单哈希确保同一 ID 的采样结果一致
 */
function shouldSample(metricId: string, rate: number): boolean {
  if (rate >= 1.0) return true;
  if (rate <= 0) return false;

  // 简单哈希：将 metricId 转为数值
  let hash = 0;
  for (let i = 0; i < metricId.length; i++) {
    hash = ((hash << 5) - hash) + metricId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // 取模 100，判断是否在采样范围内
  const bucket = Math.abs(hash) % 100;
  return bucket < rate * 100;
}

/**
 * 截断字符串到指定长度
 */
function truncate(str: string | undefined, maxLen: number): string | undefined {
  if (!str) return undefined;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

/**
 * 批量插入 Web Vitals 指标
 */
export async function insertWebVitals(
  metrics: VitalMetric[],
  userAgent?: string
): Promise<InsertVitalsResult> {
  let accepted = 0;
  let sampledOut = 0;

  const toInsert: (typeof webVitals.$inferInsert)[] = [];

  for (const metric of metrics) {
    const rate = SAMPLE_RATES[metric.name] ?? DEFAULT_SAMPLE_RATE;

    if (!shouldSample(metric.id, rate)) {
      sampledOut++;
      continue;
    }

    toInsert.push({
      name: metric.name,
      metricId: metric.id,
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating,
      navigationType: metric.navigationType,
      url: truncate(metric.url, 1024),
      pathname: truncate(metric.pathname, 256),
      userAgent: truncate(userAgent, 512),
      clientTs: metric.ts,
      appVersion: truncate(metric.appVersion, 32),
    });
    accepted++;
  }

  if (toInsert.length > 0) {
    await db.insert(webVitals).values(toInsert);
  }

  return { accepted, sampledOut };
}
