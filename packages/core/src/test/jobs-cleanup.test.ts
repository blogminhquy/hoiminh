// Dọn bảng job hằng ngày: job_recipients và scheduled_jobs đã xong không phình mãi, việc còn chờ thì không bao giờ bị xóa.
import { eq, sql } from 'drizzle-orm';
import { jobRecipients, scheduledJobs } from '@hoiminh/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runCron } from '../jobs/cron';
import { cleanupJobRecords } from '../jobs/cleanup';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let userId: string;
beforeAll(async () => {
  app = await createTestApp();
  userId = await app.ids('user:duy');
}, 180_000);
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await app.ctx.db.delete(scheduledJobs);
  await app.ctx.db.delete(jobRecipients);
});

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const job = (key: string, status: 'pending' | 'enqueued' | 'done' | 'failed', ageDays: number) =>
  app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: {}, dedupeKey: key, runAt: daysAgo(ageDays), status, createdAt: daysAgo(ageDays), doneAt: status === 'done' ? daysAgo(ageDays) : null });

describe('cleanupJobRecords', () => {
  it('xóa job_recipients cũ hơn 30 ngày, giữ bản ghi mới', async () => {
    await app.ctx.db.insert(jobRecipients).values([{ jobKey: 'k-old', userId, createdAt: daysAgo(31) }, { jobKey: 'k-new', userId, createdAt: daysAgo(2) }]);
    const r = await cleanupJobRecords(app.system());
    expect(r.recipients).toBe(1);
    const left = await app.ctx.db.select().from(jobRecipients);
    expect(left.map((x) => x.jobKey)).toEqual(['k-new']);
  });

  it('xóa scheduled_jobs đã done quá 30 ngày; failed giữ 90 ngày; pending và enqueued không bao giờ bị xóa', async () => {
    await job('done-old', 'done', 31);
    await job('done-new', 'done', 5);
    await job('failed-60', 'failed', 60);
    await job('failed-100', 'failed', 100);
    await job('pending-old', 'pending', 200);
    await job('enqueued-old', 'enqueued', 200);
    const r = await cleanupJobRecords(app.system());
    expect(r.jobs).toBe(2);
    const keys = (await app.ctx.db.select().from(scheduledJobs)).map((x) => x.dedupeKey).sort();
    expect(keys).toEqual(['done-new', 'enqueued-old', 'failed-60', 'pending-old']);
  });

  it('mỗi lần chạy có trần số dòng xóa; phần còn lại để lần sau', async () => {
    await app.ctx.db.insert(jobRecipients).values(Array.from({ length: 12 }, (_, i) => ({ jobKey: `old-${i}`, userId, createdAt: daysAgo(40) })));
    const first = await cleanupJobRecords(app.system(), { batchSize: 5 });
    expect(first.recipients).toBe(5);
    const second = await cleanupJobRecords(app.system(), { batchSize: 100 });
    expect(second.recipients).toBe(7);
    expect(await app.ctx.db.select().from(jobRecipients).where(eq(jobRecipients.userId, userId))).toHaveLength(0);
  });

  it('cron hằng ngày gọi bước dọn và báo số dòng đã xóa', async () => {
    await job('done-old-2', 'done', 45);
    await app.ctx.db.execute(sql`select 1`);
    const out = await runCron(app.ctx, 'daily');
    expect(out.jobRecordsCleaned).toBeGreaterThanOrEqual(1);
    expect(await app.ctx.db.query.scheduledJobs.findFirst({ where: eq(scheduledJobs.dedupeKey, 'done-old-2') })).toBeUndefined();
  });
});
