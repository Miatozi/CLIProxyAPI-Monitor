"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";

const APP_VERSION = "1.3.0";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const body = {
      metrics: [
        {
          name: metric.name,
          id: metric.id,
          value: metric.value,
          delta: metric.delta,
          rating: metric.rating,
          navigationType: metric.navigationType,
          url: window.location.href,
          pathname: window.location.pathname,
          ts: Date.now(),
          appVersion: APP_VERSION,
        },
      ],
    };

    // 使用 sendBeacon 发送（不阻塞页面卸载）
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
      navigator.sendBeacon("/api/vitals", blob);
    } else {
      // Fallback to fetch with keepalive
      fetch("/api/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch((error) => {
        console.error("[WebVitals] Failed to report:", error);
      });
    }
  });

  return null;
}
