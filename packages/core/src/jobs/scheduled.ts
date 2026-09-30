// Job hẹn giờ: ghi vào scheduled_jobs (sổ gốc), đẩy vào Queue sau commit nếu còn ≤ 24 giờ, chạy theo `kind` khi tới hạn.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { scheduledJobs } from '@hoiminh/db';
import type { Ctx } from '../context';
import { FILE_DELETE_JOB } from '../services/files';
import { sendWelcomeDm } from '../services/messaging';
import { PermanentJobError } from './errors';
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
 * Hẹn xa hơn 24 giờ thì chỉ ghi DB, bộ quét sẽ đẩy khi còn ≤ 24 giờ. Trả về id, hoặc null nếu đã có dòng cùng dedupeKey.
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

/** Thực thi phần việc của một dòng theo `kind`. Kind lạ là lỗi vĩnh viễn. */
export async function runKind(ctx: Ctx, job: { kind: string; payload: Record<string, unknown> }): Promise<void> {
  switch (job.kind) {
    case 'welcome_dm.send': {
      const p = job.payload as { communityId: string; userId: string };
      await sendWelcomeDm(ctx, p.communityId, p.userId);
      return;
    }
    case 'event.remind': {
      const p = job.payload as { eventId: string; label: string };
      await ctx.queue.enqueue('event.remind', p);
      return;
    }
    case FILE_DELETE_JOB:
      await ctx.media.delete((job.payload as { objectKey: string }).objectKey);
      return;
    default:
      throw new PermanentJobError(`scheduled_job.unknown_kind:${job.kind}`);
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
