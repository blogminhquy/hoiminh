// Job hẹn giờ: ghi vào scheduled_jobs (sổ gốc), đẩy vào Queue sau commit nếu còn ≤ 24 giờ, chạy theo `kind` khi tới hạn.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { scheduledJobs } from '@hoiminh/db';
import type { Ctx } from '../context';
import { FILE_DELETE_JOB } from './kinds';
import { sendWelcomeDm } from '../services/messaging';
import { runPostBroadcast, runPostBroadcastBatch } from './broadcast';
import { PermanentJobError } from './errors';
import { runEventReminder, runEventReminderBatch } from './event-reminders';
import type { JobMap } from './queue';

export { scheduleJob, type ScheduleInput } from './schedule';

/** Thực thi phần việc của một dòng theo `kind`. Kind lạ là lỗi vĩnh viễn. */
export async function runKind(ctx: Ctx, job: { kind: string; payload: Record<string, unknown> }): Promise<void> {
  switch (job.kind) {
    case 'welcome_dm.send': {
      const p = job.payload as { communityId: string; userId: string };
      await sendWelcomeDm(ctx, p.communityId, p.userId);
      return;
    }
    case 'event.remind':
      await runEventReminder(ctx, job.payload as JobMap['event.remind']);
      return;
    // Các lô của job gửi hàng loạt cũng là dòng scheduled_jobs: bền vững, bộ quét cứu được nếu Queue lỗi.
    case 'event.remind.batch':
      await runEventReminderBatch(ctx, job.payload as JobMap['event.remind.batch']);
      return;
    case 'post.broadcast':
      await runPostBroadcast(ctx, job.payload as JobMap['post.broadcast']);
      return;
    case 'post.broadcast.batch':
      await runPostBroadcastBatch(ctx, job.payload as JobMap['post.broadcast.batch']);
      return;
    case FILE_DELETE_JOB:
      await ctx.media.delete((job.payload as { objectKey: string }).objectKey);
      return;
    default:
      // Kind chưa biết thường là do hoiminh-api mới hơn hoiminh-jobs (deploy lệch): coi là lỗi tạm thời để Queue retry
      // cho tới khi bản jobs mới lên, thay vì đánh dấu failed và mất job. Hết lượt retry thì DLQ đánh dấu failed.
      throw new Error(`scheduled_job.unknown_kind:${job.kind}`);
  }
}

/**
 * Chạy một dòng scheduled_jobs: claim có điều kiện (pending hoặc enqueued), chạy, đánh dấu done.
 * Chạy trong transaction của job nên claim khóa dòng: hai message trùng chạy lần lượt, lần sau thấy done và bỏ qua.
 * Lỗi tạm thời được ném ra, transaction hoàn tác nên dòng trở về trạng thái cũ và Queue retry.
 * Lỗi vĩnh viễn thì đánh dấu `failed` và trả về, không ném, để dòng không bị quét lại mãi.
 */
export async function runScheduledJob(ctx: Ctx, jobId: string): Promise<'done' | 'skipped' | 'failed'> {
  const [claimed] = await ctx.db
    .update(scheduledJobs)
    .set({ status: 'running', attempts: sql`${scheduledJobs.attempts} + 1` })
    .where(and(eq(scheduledJobs.id, jobId), inArray(scheduledJobs.status, ['pending', 'enqueued'])))
    .returning();
  if (!claimed) return 'skipped';
  try {
    await runKind(ctx, claimed);
  } catch (err) {
    if (err instanceof PermanentJobError) {
      await ctx.db.update(scheduledJobs).set({ status: 'failed', lastError: err.message }).where(eq(scheduledJobs.id, jobId));
      return 'failed';
    }
    throw err;
  }
  await ctx.db.update(scheduledJobs).set({ status: 'done', doneAt: ctx.now() }).where(eq(scheduledJobs.id, jobId));
  return 'done';
}
