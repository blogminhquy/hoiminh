// Job hẹn giờ (scheduled_jobs) và bộ quét thưa: ghi DB làm sổ gốc, đẩy vào Queue sau commit,
// claim có điều kiện để chạy hai lần vẫn đúng một lần, và bộ quét cứu những gì bị lọt.
import { and, eq, sql } from 'drizzle-orm';
import { scheduledJobs, webhookDeliveries, webhooks } from '@hoiminh/db';
import { fakeBucket, type FakeBucket } from '@hoiminh/media/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { PermanentJobError } from '../jobs/errors';
import { MAX_DELAY_SECONDS, type EnqueueOptions, type JobMap, type JobName, type JobQueue } from '../jobs/queue';
import { runScheduledJob, scheduleJob } from '../jobs/scheduled';
import { runSweep } from '../jobs/sweep';
import { withSystemScope } from '../lib/tenant-scope';
import { createTestApp, type TestApp } from './setup';

class SpyQueue implements JobQueue {
  sent: Array<{ name: string; payload: unknown; opts?: EnqueueOptions }> = [];
  async enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void> {
    this.sent.push({ name, payload, opts });
  }
}

let app: TestApp;
let bucket: FakeBucket;
beforeAll(async () => {
  bucket = fakeBucket();
  app = await createTestApp({ r2Bucket: bucket });
}, 180_000);
afterAll(async () => {
  await app.close();
});

const row = (id: string) => app.ctx.db.query.scheduledJobs.findFirst({ where: eq(scheduledJobs.id, id) });
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);

/** Ctx dùng hàng đợi ghi lại; chạy qua withSystemScope để có DeferredQueue như production. */
function spyCtx(): { spy: SpyQueue; ctx: Ctx } {
  const spy = new SpyQueue();
  return { spy, ctx: { ...app.system(), queue: spy } };
}

beforeEach(async () => {
  await app.ctx.db.delete(scheduledJobs);
});

describe('scheduleJob', () => {
  it('ghi dòng pending và đẩy scheduled.run kèm delay sau commit, rồi đánh dấu enqueued', async () => {
    const { spy, ctx } = spyCtx();
    const id = await withSystemScope(ctx, (c) => scheduleJob(c, { kind: 'welcome_dm.send', payload: { communityId: 'x', userId: 'y' }, dedupeKey: 'sj-1', runAt: inMinutes(5) }));
    expect(id).toBeTruthy();
    expect(spy.sent).toHaveLength(1);
    expect(spy.sent[0]!.name).toBe('scheduled.run');
    expect(spy.sent[0]!.payload).toEqual({ jobId: id });
    const delay = spy.sent[0]!.opts?.delaySeconds ?? -1;
    expect(delay).toBeGreaterThanOrEqual(295);
    expect(delay).toBeLessThanOrEqual(300);
    expect(spy.sent[0]!.opts?.dedupeKey).toBe('sj-1');
    const r = await row(id!);
    expect(r?.status).toBe('enqueued');
    expect(r?.enqueuedAt).toBeTruthy();
  });

  it('cùng dedupeKey lần hai thì không ghi thêm, không đẩy thêm', async () => {
    const { spy, ctx } = spyCtx();
    const input = { kind: 'welcome_dm.send', payload: {}, dedupeKey: 'sj-dup', runAt: inMinutes(5) };
    const a = await withSystemScope(ctx, (c) => scheduleJob(c, input));
    const b = await withSystemScope(ctx, (c) => scheduleJob(c, input));
    expect(a).toBeTruthy();
    expect(b).toBeNull();
    expect(spy.sent).toHaveLength(1);
  });

  it('hẹn xa hơn 24 giờ thì chỉ ghi DB (pending), chưa đẩy vào Queue', async () => {
    const { spy, ctx } = spyCtx();
    const id = await withSystemScope(ctx, (c) => scheduleJob(c, { kind: 'welcome_dm.send', payload: {}, dedupeKey: 'sj-far', runAt: new Date(Date.now() + (MAX_DELAY_SECONDS + 3600) * 1000) }));
    expect(spy.sent).toHaveLength(0);
    expect((await row(id!))?.status).toBe('pending');
  });

  it('runAt đã qua thì đẩy ngay với delay 0', async () => {
    const { spy, ctx } = spyCtx();
    await withSystemScope(ctx, (c) => scheduleJob(c, { kind: 'welcome_dm.send', payload: {}, dedupeKey: 'sj-now', runAt: new Date(Date.now() - 60_000) }));
    expect(spy.sent[0]!.opts?.delaySeconds).toBe(0);
  });

  it('transaction hủy thì không còn dòng và không đẩy gì', async () => {
    const { spy, ctx } = spyCtx();
    await expect(
      withSystemScope(ctx, async (c) => {
        await scheduleJob(c, { kind: 'welcome_dm.send', payload: {}, dedupeKey: 'sj-rb', runAt: inMinutes(5) });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(spy.sent).toHaveLength(0);
    expect(await app.ctx.db.query.scheduledJobs.findFirst({ where: eq(scheduledJobs.dedupeKey, 'sj-rb') })).toBeUndefined();
  });

  it('DeferredQueue gửi lỗi thì dòng vẫn pending để bộ quét đẩy lại', async () => {
    const failing: JobQueue = {
      async enqueue() {
        throw new Error('queue down');
      },
    };
    const ctx: Ctx = { ...app.system(), queue: failing };
    const id = await withSystemScope(ctx, (c) => scheduleJob(c, { kind: 'welcome_dm.send', payload: {}, dedupeKey: 'sj-fail', runAt: inMinutes(5) }));
    expect((await row(id!))?.status).toBe('pending');
  });
});

describe('runScheduledJob', () => {
  const put = async (key: string) => bucket.put(key, new Uint8Array([1]), { httpMetadata: { contentType: 'image/jpeg' } });

  it('claim rồi chạy theo kind, đánh dấu done; chạy lần hai là bỏ qua', async () => {
    await put('k/a.jpg');
    const [j] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: { objectKey: 'k/a.jpg' }, dedupeKey: 'rj-1', runAt: new Date(), status: 'enqueued' }).returning();
    expect(await runScheduledJob(app.system(), j!.id)).toBe('done');
    expect(bucket.objects.has('k/a.jpg')).toBe(false);
    const r = await row(j!.id);
    expect(r?.status).toBe('done');
    expect(r?.doneAt).toBeTruthy();
    expect(r?.attempts).toBe(1);
    expect(await runScheduledJob(app.system(), j!.id)).toBe('skipped');
  });

  it('nhận cả dòng pending (đường cron dự phòng) và bỏ qua dòng failed/done', async () => {
    await put('k/b.jpg');
    const [pending] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: { objectKey: 'k/b.jpg' }, dedupeKey: 'rj-2', runAt: new Date(), status: 'pending' }).returning();
    const [failed] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: { objectKey: 'k/c.jpg' }, dedupeKey: 'rj-3', runAt: new Date(), status: 'failed' }).returning();
    expect(await runScheduledJob(app.system(), pending!.id)).toBe('done');
    expect(await runScheduledJob(app.system(), failed!.id)).toBe('skipped');
    expect((await row(failed!.id))?.status).toBe('failed');
  });

  it('id không tồn tại thì bỏ qua', async () => {
    expect(await runScheduledJob(app.system(), '00000000-0000-4000-8000-000000000000')).toBe('skipped');
  });

  it('kind chưa biết là lỗi tạm thời (deploy lệch phiên bản không làm mất job): ném ra, dòng trở về như cũ để retry', async () => {
    const [j] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'khong.co', payload: {}, dedupeKey: 'rj-4', runAt: new Date(), status: 'enqueued' }).returning();
    await expect(withSystemScope(app.system(), (c) => runScheduledJob(c, j!.id))).rejects.toThrow(/khong\.co/);
    const r = await row(j!.id);
    expect(r?.status).toBe('enqueued');
    expect(r?.doneAt).toBeNull();
  });

  it('handler ném PermanentJobError thì đánh dấu failed và trả failed, không ném (để không quét lại mãi)', async () => {
    const [j] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'event.remind', payload: { eventId: 'khong-phai-uuid', label: '1h' }, dedupeKey: 'rj-perm', runAt: new Date(), status: 'enqueued' }).returning();
    // event.remind với payload hỏng: kiểu handler đánh dấu stale chứ không ném, nên dùng PermanentJobError trực tiếp qua ctx.
    const ctx: Ctx = { ...app.system(), media: { ...app.ctx.media, delete: async () => { throw new PermanentJobError('payload hỏng'); } } as typeof app.ctx.media };
    await app.ctx.db.update(scheduledJobs).set({ kind: 'file.delete', payload: { objectKey: 'x' } }).where(eq(scheduledJobs.id, j!.id));
    expect(await withSystemScope(ctx, (c) => runScheduledJob(c, j!.id))).toBe('failed');
    const r = await row(j!.id);
    expect(r?.status).toBe('failed');
    expect(r?.lastError).toMatch(/payload hỏng/);
  });

  it('lỗi tạm thời được ném ra và transaction hoàn tác: dòng trở lại như cũ để retry', async () => {
    const [j] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: { objectKey: 'k/d.jpg' }, dedupeKey: 'rj-5', runAt: new Date(), status: 'enqueued' }).returning();
    const failingMedia = { ...app.ctx.media, delete: async () => { throw new Error('R2 lỗi'); } } as typeof app.ctx.media;
    const ctx: Ctx = { ...app.system(), media: failingMedia };
    await expect(withSystemScope(ctx, (c) => runScheduledJob(c, j!.id))).rejects.toThrow('R2 lỗi');
    const r = await row(j!.id);
    expect(r?.status).toBe('enqueued');
    expect(r?.doneAt).toBeNull();
  });
});

describe('runSweep', () => {
  const old = (col: 'created_at' | 'enqueued_at', id: string, minutes: number) => app.ctx.db.execute(sql`update scheduled_jobs set ${sql.raw(col)} = now() - (${minutes} || ' minutes')::interval where id = ${id}`);

  it('bước 1: đẩy dòng pending sắp tới hạn (≤ 24 giờ) với delay còn lại; dòng xa hơn thì không', async () => {
    const { spy, ctx } = spyCtx();
    const [near] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: {}, dedupeKey: 'sw-near', runAt: inMinutes(90), status: 'pending' }).returning();
    const [far] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: {}, dedupeKey: 'sw-far', runAt: new Date(Date.now() + 30 * 3_600_000), status: 'pending' }).returning();
    await old('created_at', near!.id, 10);
    await old('created_at', far!.id, 10);
    const res = await withSystemScope(ctx, (c) => runSweep(c));
    expect(res.pushed).toBe(1);
    const pushed = spy.sent.filter((m) => m.name === 'scheduled.run');
    expect(pushed).toHaveLength(1);
    expect(pushed[0]!.payload).toEqual({ jobId: near!.id });
    expect(pushed[0]!.opts?.delaySeconds).toBeGreaterThan(5300);
    expect(pushed[0]!.opts?.delaySeconds).toBeLessThanOrEqual(5400);
    expect((await row(near!.id))?.status).toBe('enqueued');
    expect((await row(far!.id))?.status).toBe('pending');
  });

  it('bước 1: bỏ qua dòng vừa tạo (còn đang trên đường đẩy sau commit)', async () => {
    const { spy, ctx } = spyCtx();
    await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: {}, dedupeKey: 'sw-fresh', runAt: inMinutes(5), status: 'pending' });
    const res = await withSystemScope(ctx, (c) => runSweep(c));
    expect(res.pushed).toBe(0);
    expect(spy.sent.filter((m) => m.name === 'scheduled.run')).toHaveLength(0);
  });

  it('bước 2: dòng enqueued đã quá hạn mà chưa chạy thì đẩy lại ngay', async () => {
    const { spy, ctx } = spyCtx();
    const [lost] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: {}, dedupeKey: 'sw-lost', runAt: inMinutes(-60), status: 'enqueued', enqueuedAt: inMinutes(-60) }).returning();
    const [fresh] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: {}, dedupeKey: 'sw-slow', runAt: inMinutes(-60), status: 'enqueued', enqueuedAt: inMinutes(-20) }).returning();
    const [notYet] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: {}, dedupeKey: 'sw-notyet', runAt: inMinutes(-20), status: 'enqueued', enqueuedAt: inMinutes(-60) }).returning();
    const res = await withSystemScope(ctx, (c) => runSweep(c));
    expect(res.requeued).toBe(1);
    const jobs = spy.sent.filter((m) => m.name === 'scheduled.run').map((m) => (m.payload as { jobId: string }).jobId);
    expect(jobs).toEqual([lost!.id]);
    expect(jobs).not.toContain(fresh!.id); // vừa được đẩy lại 20 phút trước: chưa đến lượt
    expect(jobs).not.toContain(notYet!.id); // mới quá hạn 20 phút: còn trong chuỗi retry của Queue
    expect(spy.sent.find((m) => m.name === 'scheduled.run')!.opts?.delaySeconds).toBe(0);
  });

  it('bước 4: webhook delivery đã quá hạn retry mà chưa được giao thì đẩy lại', async () => {
    const { spy, ctx } = spyCtx();
    const ws = await app.ctx.db.query.workspaces.findFirst();
    const [w] = await app.ctx.db.insert(webhooks).values({ workspaceId: ws!.id, url: 'https://example.com/h', events: [], secretEncrypted: 'x' }).returning();
    const [lost] = await app.ctx.db.insert(webhookDeliveries).values({ webhookId: w!.id, eventName: 'member.joined', eventId: 'e1', payload: {}, status: 'failed', attempt: 1, nextAttemptAt: inMinutes(-30) }).returning();
    const [future] = await app.ctx.db.insert(webhookDeliveries).values({ webhookId: w!.id, eventName: 'member.joined', eventId: 'e2', payload: {}, status: 'failed', attempt: 1, nextAttemptAt: inMinutes(30) }).returning();
    const [done] = await app.ctx.db.insert(webhookDeliveries).values({ webhookId: w!.id, eventName: 'member.joined', eventId: 'e3', payload: {}, status: 'delivered', attempt: 1, nextAttemptAt: inMinutes(-30) }).returning();
    const res = await withSystemScope(ctx, (c) => runSweep(c));
    expect(res.webhookRequeued).toBe(1);
    const ids = spy.sent.filter((m) => m.name === 'webhook.deliver').map((m) => (m.payload as { deliveryId: string }).deliveryId);
    expect(ids).toEqual([lost!.id]);
    expect(ids).not.toContain(future!.id);
    expect(ids).not.toContain(done!.id);
    await app.ctx.db.delete(webhookDeliveries).where(and(eq(webhookDeliveries.webhookId, w!.id)));
    await app.ctx.db.delete(webhooks).where(eq(webhooks.id, w!.id));
  });

  it('trả tóm tắt đủ các bước và ghi log sweep.done', async () => {
    const { ctx } = spyCtx();
    const logs: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
    const noop = () => undefined;
    const withLog: Ctx = { ...ctx, log: { debug: noop, warn: noop, error: noop, info: (msg, meta) => logs.push({ msg, meta }) } };
    const res = await withSystemScope(withLog, (c) => runSweep(c));
    expect(Object.keys(res).sort()).toEqual(['eventsFlipped', 'ordersExpired', 'pushed', 'requeued', 'webhookRequeued']);
    const done = logs.find((l) => l.msg === 'sweep.done');
    expect(done?.meta).toMatchObject({ pushed: 0, requeued: 0 });
    expect(typeof done?.meta?.durationMs).toBe('number');
  });

  it('quét nhiều vòng theo con trỏ, tối đa 1000 dòng mỗi lần chạy; phần còn lại để lần sau', async () => {
    const { spy, ctx } = spyCtx();
    const values = Array.from({ length: 1005 }, (_, i) => ({ kind: 'file.delete', payload: {}, dedupeKey: `sw-many-${i}`, runAt: inMinutes(30 + i / 100), status: 'pending' as const, createdAt: inMinutes(-10) }));
    await app.ctx.db.insert(scheduledJobs).values(values);
    const first = await withSystemScope(ctx, (c) => runSweep(c));
    expect(first.pushed).toBe(1000);
    const ids = spy.sent.filter((m) => m.name === 'scheduled.run').map((m) => (m.payload as { jobId: string }).jobId);
    expect(new Set(ids).size).toBe(1000);
    // Lần sau chỉ còn 5 dòng chưa được đẩy: 1000 dòng kia đã thành enqueued sau commit.
    const second = await withSystemScope(ctx, (c) => runSweep(c));
    expect(second.pushed).toBe(5);
  });
});
