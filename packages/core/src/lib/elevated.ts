// Chạy một đoạn với quyền hệ thống ngay trong transaction hiện tại. Tách khỏi services/automation-engine để phần xác thực
// (auth/) dùng được mà không vòng import: automation-engine lại dùng auth/service.
import { sql } from 'drizzle-orm';
import type { Ctx } from '../context';
import { raw } from './db';

/**
 * Chạy `fn` với quyền hệ thống ngay trong transaction hiện tại, xong trả lại biến phiên cũ. Dùng cho các đường
 * người lạ đi vào bằng link trong email (kích hoạt, xác minh email, tạo tài khoản sau khi mua): họ không thuộc
 * workspace nào nên policy RLS không cho đọc bảng, trong khi chính link đó là bằng chứng họ được phép.
 */
export async function elevated<T>(ctx: Ctx, fn: () => Promise<T>): Promise<T> {
  const [prev] = await raw<{ v: string | null }>(ctx.db, sql`select current_setting('app.bypass', true) as v`);
  await ctx.db.execute(sql`select set_config('app.bypass', 'on', true)`);
  try {
    return await fn();
  } finally {
    // Transaction đã hỏng (fn ném lỗi SQL) thì câu này cũng lỗi: bỏ qua để lỗi gốc đi ra ngoài.
    await ctx.db.execute(sql`select set_config('app.bypass', ${prev?.v || 'off'}, true)`).then(() => null, () => null);
  }
}
