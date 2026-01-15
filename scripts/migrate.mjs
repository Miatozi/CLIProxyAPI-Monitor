#!/usr/bin/env node
import { drizzle } from "drizzle-orm/vercel-postgres";
import { createPool } from "@vercel/postgres";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/vercel-postgres/migrator";

const pool = createPool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
});

const db = drizzle(pool);

async function runMigrations() {
  try {
    console.log("执行数据库迁移...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✓ 迁移完成");

    // 确保索引存在
    console.log("检查并创建索引...");

    // 为 synced_at 添加索引（加速 /api/sync fallback 计数）
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_usage_records_synced_at
      ON usage_records (synced_at);
    `);

    // 为 (model, occurred_at) 添加索引（加速筛选/聚合）
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_usage_records_model_occurred
      ON usage_records (model, occurred_at);
    `);

    // 为 (route, occurred_at) 添加索引（加速筛选/聚合）
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_usage_records_route_occurred
      ON usage_records (route, occurred_at);
    `);

    console.log("✓ 索引创建完成");

    process.exit(0);
  } catch (error) {
    console.error("迁移失败:", error);
    process.exit(1);
  }
}

runMigrations();
