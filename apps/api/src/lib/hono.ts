// Kiểu Hono dùng chung: biến ngữ cảnh (App, Ctx) và helper phản hồi.
import type { App, Ctx } from '@hoiminh/core';
import { AppError } from '@hoiminh/core';
import { Hono, type Context } from 'hono';
import type { ZodTypeAny, z } from 'zod';

export type Vars = { app: App; ctx: Ctx; sessionId?: string };
export type Env = { Variables: Vars };
export type Ctx$ = Context<Env>;

/** Tạo router con với kiểu biến chuẩn. */
export const router = () => new Hono<Env>();

/** Validate body/query bằng Zod, lỗi → 422 { code, message, details }. */
export async function parse<S extends ZodTypeAny>(schema: S, data: unknown): Promise<z.output<S>> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError('validation_error', r.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ', 422, r.error.flatten());
  return r.data;
}

/** Đọc JSON body an toàn. */
export async function body(c: Context<Env>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

/** Query string dạng object phẳng. */
export function query(c: Context<Env>): Record<string, string> {
  return Object.fromEntries(new URL(c.req.url).searchParams.entries());
}

/** Trả về CSV với BOM để Excel đọc tiếng Việt. */
export function csv(c: Context<Env>, content: string, filename: string): Response {
  return c.body(content, 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
}
