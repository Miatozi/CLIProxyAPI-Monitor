#!/usr/bin/env node
import { drizzle } from "drizzle-orm/vercel-postgres";
import { createPool } from "@vercel/postgres";
import { sql } from "drizzle-orm";

const pool = createPool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
});

const db = drizzle(pool);

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    from: null,
    to: null,
    dryRun: false,
    granularity: "both", // hourly, daily, both
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--from":
        options.from = args[++i];
        break;
      case "--to":
        options.to = args[++i];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--granularity":
        options.granularity = args[++i];
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
使用方法: npm run db:backfill-agg [选项]

选项:
  --from <date>          起始日期 (YYYY-MM-DD)，默认为最早的记录日期
  --to <date>            结束日期 (YYYY-MM-DD)，默认为今天
  --granularity <type>   聚合粒度: hourly, daily, both (默认: both)
  --dry-run              仅显示将要执行的操作，不实际写入数据库
  --help, -h             显示此帮助信息

示例:
  npm run db:backfill-agg --from 2024-01-01 --to 2024-01-31
  npm run db:backfill-agg --granularity daily --dry-run
  npm run db:backfill-agg --from 2024-01-01
`);
}

// 获取时间范围
async function getDateRange(from, to) {
  let startDate = from;
  let endDate = to;

  // 如果没有指定起始日期，查询最早的记录
  if (!startDate) {
    const result = await db.execute(sql`
      SELECT DATE(MIN(occurred_at)) as min_date
      FROM usage_records
    `);
    startDate = result.rows[0]?.min_date;
    if (!startDate) {
      console.log("⚠️  数据库中没有记录");
      return null;
    }
  }

  // 如果没有指定结束日期，使用今天
  if (!endDate) {
    endDate = new Date().toISOString().split("T")[0];
  }

  return { startDate, endDate };
}

// 回填小时聚合数据
async function backfillHourly(startDate, endDate, dryRun) {
  console.log(`\n📊 回填小时聚合数据: ${startDate} 至 ${endDate}`);

  if (dryRun) {
    console.log("🔍 [DRY RUN] 预览将要执行的操作...");
    const preview = await db.execute(sql`
      SELECT
        DATE_TRUNC('hour', occurred_at) as bucket_start,
        route,
        model,
        COUNT(*) as record_count
      FROM usage_records
      WHERE occurred_at >= ${startDate}::date
        AND occurred_at < (${endDate}::date + INTERVAL '1 day')
      GROUP BY DATE_TRUNC('hour', occurred_at), route, model
      ORDER BY bucket_start DESC
      LIMIT 10
    `);

    console.log(`   将处理 ${preview.rowCount} 个小时桶（显示前 10 个）:`);
    preview.rows.forEach(row => {
      console.log(`   - ${row.bucket_start} | ${row.route} | ${row.model} (${row.record_count} 条记录)`);
    });
    return;
  }

  const result = await db.execute(sql`
    INSERT INTO usage_hourly_agg (
      bucket_start,
      route,
      model,
      total_tokens,
      input_tokens,
      output_tokens,
      reasoning_tokens,
      cached_tokens,
      total_requests,
      success_count,
      failure_count,
      created_at,
      updated_at
    )
    SELECT
      DATE_TRUNC('hour', occurred_at) as bucket_start,
      route,
      model,
      SUM(total_tokens)::bigint as total_tokens,
      SUM(input_tokens)::bigint as input_tokens,
      SUM(output_tokens)::bigint as output_tokens,
      SUM(reasoning_tokens)::bigint as reasoning_tokens,
      SUM(cached_tokens)::bigint as cached_tokens,
      SUM(total_requests)::bigint as total_requests,
      SUM(success_count)::bigint as success_count,
      SUM(failure_count)::bigint as failure_count,
      NOW() as created_at,
      NOW() as updated_at
    FROM usage_records
    WHERE occurred_at >= ${startDate}::date
      AND occurred_at < (${endDate}::date + INTERVAL '1 day')
    GROUP BY DATE_TRUNC('hour', occurred_at), route, model
    ON CONFLICT (bucket_start, route, model)
    DO UPDATE SET
      total_tokens = EXCLUDED.total_tokens,
      input_tokens = EXCLUDED.input_tokens,
      output_tokens = EXCLUDED.output_tokens,
      reasoning_tokens = EXCLUDED.reasoning_tokens,
      cached_tokens = EXCLUDED.cached_tokens,
      total_requests = EXCLUDED.total_requests,
      success_count = EXCLUDED.success_count,
      failure_count = EXCLUDED.failure_count,
      updated_at = NOW()
  `);

  console.log(`✓ 小时聚合完成，处理了 ${result.rowCount} 个小时桶`);
}

// 回填日聚合数据
async function backfillDaily(startDate, endDate, dryRun) {
  console.log(`\n📊 回填日聚合数据: ${startDate} 至 ${endDate}`);

  if (dryRun) {
    console.log("🔍 [DRY RUN] 预览将要执行的操作...");
    const preview = await db.execute(sql`
      SELECT
        DATE_TRUNC('day', occurred_at) as day_start,
        route,
        model,
        COUNT(*) as record_count
      FROM usage_records
      WHERE occurred_at >= ${startDate}::date
        AND occurred_at < (${endDate}::date + INTERVAL '1 day')
      GROUP BY DATE_TRUNC('day', occurred_at), route, model
      ORDER BY day_start DESC
      LIMIT 10
    `);

    console.log(`   将处理 ${preview.rowCount} 个日期桶（显示前 10 个）:`);
    preview.rows.forEach(row => {
      console.log(`   - ${row.day_start} | ${row.route} | ${row.model} (${row.record_count} 条记录)`);
    });
    return;
  }

  const result = await db.execute(sql`
    INSERT INTO usage_daily_agg (
      day_start,
      route,
      model,
      total_tokens,
      input_tokens,
      output_tokens,
      reasoning_tokens,
      cached_tokens,
      total_requests,
      success_count,
      failure_count,
      created_at,
      updated_at
    )
    SELECT
      DATE_TRUNC('day', occurred_at) as day_start,
      route,
      model,
      SUM(total_tokens)::bigint as total_tokens,
      SUM(input_tokens)::bigint as input_tokens,
      SUM(output_tokens)::bigint as output_tokens,
      SUM(reasoning_tokens)::bigint as reasoning_tokens,
      SUM(cached_tokens)::bigint as cached_tokens,
      SUM(total_requests)::bigint as total_requests,
      SUM(success_count)::bigint as success_count,
      SUM(failure_count)::bigint as failure_count,
      NOW() as created_at,
      NOW() as updated_at
    FROM usage_records
    WHERE occurred_at >= ${startDate}::date
      AND occurred_at < (${endDate}::date + INTERVAL '1 day')
    GROUP BY DATE_TRUNC('day', occurred_at), route, model
    ON CONFLICT (day_start, route, model)
    DO UPDATE SET
      total_tokens = EXCLUDED.total_tokens,
      input_tokens = EXCLUDED.input_tokens,
      output_tokens = EXCLUDED.output_tokens,
      reasoning_tokens = EXCLUDED.reasoning_tokens,
      cached_tokens = EXCLUDED.cached_tokens,
      total_requests = EXCLUDED.total_requests,
      success_count = EXCLUDED.success_count,
      failure_count = EXCLUDED.failure_count,
      updated_at = NOW()
  `);

  console.log(`✓ 日聚合完成，处理了 ${result.rowCount} 个日期桶`);
}

// 主函数
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log("🚀 开始回填预聚合数据...");
  console.log(`   粒度: ${options.granularity}`);
  console.log(`   模式: ${options.dryRun ? "DRY RUN（预览）" : "实际执行"}`);

  try {
    // 获取时间范围
    const dateRange = await getDateRange(options.from, options.to);
    if (!dateRange) {
      process.exit(0);
    }

    const { startDate, endDate } = dateRange;
    console.log(`   时间范围: ${startDate} 至 ${endDate}`);

    // 执行回填
    if (options.granularity === "hourly" || options.granularity === "both") {
      await backfillHourly(startDate, endDate, options.dryRun);
    }

    if (options.granularity === "daily" || options.granularity === "both") {
      await backfillDaily(startDate, endDate, options.dryRun);
    }

    if (options.dryRun) {
      console.log("\n✓ DRY RUN 完成，未实际修改数据库");
    } else {
      console.log("\n✓ 回填完成！");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ 回填失败:", error);
    process.exit(1);
  }
}

main();
