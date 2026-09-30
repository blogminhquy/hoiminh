// Dọn bảng job hằng ngày: bản ghi đã xong không phình mãi. Việc còn chờ (pending, enqueued) không bao giờ bị xóa.
import { sql } from 'drizzle-orm';
import { systemCtx, type AppContext, type Ctx } from '../context';
import { raw } from '../lib/db';

/** job_recipients chỉ cần sống đủ lâu để retry và message trùng còn được khử: 30 ngày là dư. */
const RECIPIENTS_DAYS = 30;
/** scheduled_jobs đã done: giữ 30 ngày để tra cứu. */
const DONE_DAYS = 30;
/** scheduled_jobs failed: giữ lâu hơn để còn điều tra. */
const FAILED_DAYS = 90;

export interface CleanupResult {
  recipients: number;
  jobs: number;
}

/** Mỗi lần xóa tối đa `batchSize` dòng mỗi bảng để không giữ transaction lâu; phần còn lại để lần sau (mỗi ngày). */
export async function cleanupJobRecords(appOrCtx: AppContext | Ctx, opts: { batchSize?: number } = {}): Promise<CleanupResult> {
  const ctx = 'actor' in appOrCtx ? appOrCtx : systemCtx(appOrCtx, 'cleanup-jobs');
  const limit = opts.batchSize ?? 5000;
  const recipients = await raw<{ n: number }>(ctx.db, sql`
    with gone as (
      delete from job_recipients where ctid in (select ctid from job_recipients where created_at < now() - make_interval(days => ${RECIPIENTS_DAYS}) limit ${limit}) returning 1
    ) select count(*)::int as n from gone`);
  const jobs = await raw<{ n: number }>(ctx.db, sql`
    with gone as (
      delete from scheduled_jobs where id in (
        select id from scheduled_jobs
        where (status = 'done' and coalesce(done_at, created_at) < now() - make_interval(days => ${DONE_DAYS}))
           or (status = 'failed' and created_at < now() - make_interval(days => ${FAILED_DAYS}))
        limit ${limit}
      ) returning 1
    ) select count(*)::int as n from gone`);
  return { recipients: Number(recipients[0]?.n ?? 0), jobs: Number(jobs[0]?.n ?? 0) };
}
