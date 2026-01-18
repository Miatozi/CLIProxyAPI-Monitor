import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { usageRecords } from "@/lib/db/schema";

export async function POST(request: Request) {
  // 生产环境禁止使用
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "此操作在生产环境中被禁用" },
      { status: 403 }
    );
  }

  // 需要特殊确认 header
  const confirmHeader = request.headers.get("x-confirm-reset");
  if (confirmHeader !== "yes-delete-all-data") {
    return NextResponse.json(
      {
        success: false,
        error: "需要确认 header: x-confirm-reset: yes-delete-all-data"
      },
      { status: 400 }
    );
  }

  try {
    await db.delete(usageRecords);
    return NextResponse.json({ success: true, message: "usage_records 表已清空" });
  } catch (error) {
    console.error("Failed to reset usage_records:", error);
    return NextResponse.json(
      { success: false, error: "清空表失败" },
      { status: 500 }
    );
  }
}
