// Gửi hàng loạt (nhắc sự kiện, broadcast bài viết): chia lô và khử trùng từng người.
import { jobRecipients } from '@hoiminh/db';
import type { Ctx } from '../context';

/** Số người mỗi message của job gửi hàng loạt. Nhỏ để mỗi lần chạy nằm gọn trong giới hạn CPU và subrequest của Worker. */
export const FANOUT_CHUNK = 100;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/**
 * Đánh dấu những người sẽ được xử lý trong job `jobKey`, trả về đúng những người CHƯA từng được đánh dấu.
 * Gọi trong transaction của job: nếu job lỗi giữa chừng thì transaction hoàn tác, không ai bị đánh dấu và retry
 * xử lý lại đủ cả lô; nếu commit rồi thì message trùng hay retry sau đó không xử lý lại người nào.
 */
export async function claimRecipients(ctx: Ctx, jobKey: string, userIds: readonly string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const rows = await ctx.db.insert(jobRecipients).values(userIds.map((userId) => ({ jobKey, userId }))).onConflictDoNothing().returning({ userId: jobRecipients.userId });
  return rows.map((r) => r.userId);
}
