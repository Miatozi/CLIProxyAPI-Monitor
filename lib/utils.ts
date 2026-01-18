export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

// 带千位分隔的数字格式
export function formatNumberWithCommas(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

// 简化大数：1000 -> 1k, 1000000 -> 1M
export function formatCompactNumber(value: number) {
  if (value >= 1_000_000) {
    const scaledTimesTen = Math.floor((value * 10) / 1_000_000);
    const scaled = scaledTimesTen / 10;
    const formatted = Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1);
    return formatted + 'M';
  }
  if (value >= 1_000) {
    const scaledTimesTen = Math.floor((value * 10) / 1_000);
    const scaled = scaledTimesTen / 10;
    const formatted = Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1);
    return formatted + 'k';
  }
  return value.toString();
}

// 格式化小时标签：MM-DD HH -> MM/DD HH:00
export function formatHourLabel(label: string) {
  // 新格式: "12-15 08" -> "12/15 08:00"
  const parts = label.split(' ');
  if (parts.length === 2) {
    const [monthDay, hour] = parts;
    return `${monthDay.replace('-', '/')} ${hour}:00`;
  }
  // 兼容旧格式: "00" -> "00:00"
  return `${label}:00`;
}

// ============ 日期时间格式化工具 ============

export const DAY_MS = 24 * 60 * 60 * 1000;

// 时间格式化器（Asia/Shanghai 时区）
const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

// 格式化日期为 input[type=date] 格式：YYYY-MM-DD
export function formatDateInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 格式化时间戳为 MM/DD HH:mm 格式（Asia/Shanghai 时区）
export function formatTs(ms: number) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return "";
  return timeFormatter.format(d);
}

// 获取日期的开始时间 (00:00:00.000)
export function withDayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 获取日期的结束时间 (23:59:59.999)
export function withDayEnd(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
