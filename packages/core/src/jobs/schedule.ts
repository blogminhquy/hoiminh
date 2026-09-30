// Hẹn một job: ghi scheduled_jobs (sổ gốc) rồi đăng ký đẩy vào Queue nếu còn ≤ 24 giờ. Tách khỏi scheduled.ts
// để các job cha (nhắc sự kiện, broadcast) hẹn được job con mà không tạo vòng import.
import { scheduledJobs } from '@hoiminh/db';
import type { Ctx } from '../context';
import { MAX_DELAY_SECONDS } from './queue';

export interface ScheduleInput {
  kind: string;
  payload: Record<string, unknown>;
  /** Khóa duy nhất: cùng khóa thì chỉ ghi một dòng và chỉ đẩy một lần. */
  dedupeKey: string;
  runAt: Date;
}

/**
 * Hẹn một job. Ghi dòng `pending` trong transaction hiện tại, rồi đăng ký đẩy `scheduled.run` với delay còn lại.
 * `ctx.queue` trong transaction là DeferredQueue: message chỉ đi sau commit, rồi dòng mới thành `enqueued`.
 * Hẹn xa hơn 24 giờ thì chỉ ghi DB, bộ quét sẽ đẩy khi còn ≤ 24 giờ. Đẩy lỗi thì dòng vẫn `pending` và bộ quét đẩy lại.
 * Trả về id, hoặc null nếu đã có dòng cùng dedupeKey.
 */
export async function scheduleJob(ctx: Ctx, input: ScheduleInput): Promise<string | null> {
  const [row] = await ctx.db.insert(scheduledJobs).values({ ...input, status: 'pending' }).onConflictDoNothing().returning({ id: scheduledJobs.id });
  if (!row) return null;
  const delayMs = input.runAt.getTime() - ctx.now().getTime();
  if (delayMs <= MAX_DELAY_SECONDS * 1000) {
    await ctx.queue.enqueue('scheduled.run', { jobId: row.id }, { delaySeconds: Math.max(0, Math.ceil(delayMs / 1000)), dedupeKey: input.dedupeKey });
  }
  return row.id;
}
