import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { config } from "@/lib/config";
import { db } from "@/lib/db/client";
import { modelPrices } from "@/lib/db/schema";

type ModelPriceRow = typeof modelPrices.$inferSelect;

const priceSchema = z.object({
  model: z.string().min(1),
  inputPricePer1M: z.number().nonnegative(),
  cachedInputPricePer1M: z.number().nonnegative().optional().default(0),
  outputPricePer1M: z.number().nonnegative()
});

export const runtime = "nodejs";

const PASSWORD = process.env.PASSWORD || process.env.CLIPROXY_SECRET_KEY || "";
const COOKIE_NAME = "dashboard_auth";

function ensureDbEnv() {
  if (!config.postgresUrl) {
    throw new Error("DATABASE_URL is missing");
  }
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function hashPassword(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function isAuthorized(request: Request) {
  // 检查 Bearer token（用于 API 调用）
  const allowed = [config.password, config.cronSecret].filter(Boolean).map((v) => `Bearer ${v}`);
  if (allowed.length > 0) {
    const auth = request.headers.get("authorization") || "";
    if (allowed.includes(auth)) return true;
  }

  // 检查用户的 dashboard cookie（用于前端调用）
  if (PASSWORD) {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(COOKIE_NAME);
    if (authCookie) {
      const expectedToken = await hashPassword(PASSWORD);
      if (authCookie.value === expectedToken) return true;
    }
  }

  return false;
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  try {
    ensureDbEnv();
    const rows = await db.select().from(modelPrices).orderBy(modelPrices.model);
    const normalized = rows.map((row: ModelPriceRow) => ({
      model: row.model,
      inputPricePer1M: Number(row.inputPricePer1M),
      cachedInputPricePer1M: Number(row.cachedInputPricePer1M),
      outputPricePer1M: Number(row.outputPricePer1M)
    }));
    return NextResponse.json({ prices: normalized }, { status: 200 });
  } catch (error) {
    console.error("/api/prices GET failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  try {
    ensureDbEnv();
    const body = await request.json();
    const parsed = priceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;
    await db
      .insert(modelPrices)
      .values({
        model: data.model,
        inputPricePer1M: String(data.inputPricePer1M),
        cachedInputPricePer1M: String(data.cachedInputPricePer1M ?? 0),
        outputPricePer1M: String(data.outputPricePer1M)
      })
      .onConflictDoUpdate({
        target: modelPrices.model,
        set: {
          inputPricePer1M: String(data.inputPricePer1M),
          cachedInputPricePer1M: String(data.cachedInputPricePer1M ?? 0),
          outputPricePer1M: String(data.outputPricePer1M)
        }
      });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("/api/prices POST failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { eq } from "drizzle-orm";

const deleteSchema = z.object({
  model: z.string().min(1)
});

export async function DELETE(request: Request) {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  try {
    ensureDbEnv();
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    await db.delete(modelPrices).where(eq(modelPrices.model, parsed.data.model));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("/api/prices DELETE failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
