import { pgTable, serial, text, integer, timestamp, boolean, numeric, uniqueIndex, bigint, primaryKey } from "drizzle-orm/pg-core";

export const modelPrices = pgTable("model_prices", {
  id: serial("id").primaryKey(),
  model: text("model").notNull().unique(),
  inputPricePer1M: numeric("input_price_per_1m", { precision: 10, scale: 4 }).notNull(),
  cachedInputPricePer1M: numeric("cached_input_price_per_1m", { precision: 10, scale: 4 }).default("0").notNull(),
  outputPricePer1M: numeric("output_price_per_1m", { precision: 10, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const usageRecords = pgTable(
  "usage_records",
  {
    id: serial("id").primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
    route: text("route").notNull(),
    model: text("model").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    reasoningTokens: integer("reasoning_tokens").default(0).notNull(),
    cachedTokens: integer("cached_tokens").default(0).notNull(),
    totalRequests: integer("total_requests").notNull(),
    successCount: integer("success_count").notNull(),
    failureCount: integer("failure_count").notNull(),
    isError: boolean("is_error").notNull().default(false),
    raw: text("raw").notNull()
  },
  (table) => ({
    uniq: uniqueIndex("usage_records_occurred_route_model_idx").on(table.occurredAt, table.route, table.model)
  })
);

// 小时聚合表
export const usageHourlyAgg = pgTable(
  "usage_hourly_agg",
  {
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    route: text("route").notNull(),
    model: text("model").notNull(),
    totalTokens: bigint("total_tokens", { mode: "number" }).notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    reasoningTokens: bigint("reasoning_tokens", { mode: "number" }).notNull().default(0),
    cachedTokens: bigint("cached_tokens", { mode: "number" }).notNull().default(0),
    totalRequests: bigint("total_requests", { mode: "number" }).notNull().default(0),
    successCount: bigint("success_count", { mode: "number" }).notNull().default(0),
    failureCount: bigint("failure_count", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bucketStart, table.route, table.model] })
  })
);

// 日聚合表
export const usageDailyAgg = pgTable(
  "usage_daily_agg",
  {
    dayStart: timestamp("day_start", { withTimezone: true }).notNull(),
    route: text("route").notNull(),
    model: text("model").notNull(),
    totalTokens: bigint("total_tokens", { mode: "number" }).notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    reasoningTokens: bigint("reasoning_tokens", { mode: "number" }).notNull().default(0),
    cachedTokens: bigint("cached_tokens", { mode: "number" }).notNull().default(0),
    totalRequests: bigint("total_requests", { mode: "number" }).notNull().default(0),
    successCount: bigint("success_count", { mode: "number" }).notNull().default(0),
    failureCount: bigint("failure_count", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.dayStart, table.route, table.model] })
  })
);
