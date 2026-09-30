// Consumer hàng đợi: ack / retry theo loại lỗi, lịch lùi theo số lần thử, tên job lạ không bị mất, xử lý DLQ.
import { eq } from 'drizzle-orm';
import { scheduledJobs } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Logger } from '../context';
import { processBatch, processDeadLetters, retryDelay, type QueueMessageLike } from '../jobs/consumer';
import { createJobHandler } from '../jobs/handlers';
import { PermanentJobError } from '../jobs/errors';
import type { Job } from '../jobs/queue';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

interface FakeMsg extends QueueMessageLike {
  acked: number;
  retried: Array<number | undefined>;
}
function msg(body: Job, attempts = 1): FakeMsg {
  const m: FakeMsg = {
    id: `m-${Math.random().toString(36).slice(2)}`,
    body,
    attempts,
    acked: 0,
    retried: [],
    ack() {
      m.acked++;
    },
    retry(opts) {
      m.retried.push(opts?.delaySeconds);
    },
  };
  return m;
}
const job = (name: string, payload: unknown = {}): Job => ({ name, payload, attempt: 0 }) as unknown as Job;

/** App có logger ghi lại, để kiểm tra sự kiện log. */
function withLogs() {
  const events: Array<{ level: string; msg: string; meta?: Record<string, unknown> }> = [];
  const log: Logger = {
    debug: () => undefined,
    info: (msg, meta) => events.push({ level: 'info', msg, meta }),
    warn: (msg, meta) => events.push({ level: 'warn', msg, meta }),
    error: (msg, meta) => events.push({ level: 'error', msg, meta }),
  };
  return { ctx: { ...app.ctx, log }, events };
}

describe('lịch retry', () => {
  it('lùi dần theo msg.attempts: 1, 5, 15, 60 phút rồi giữ 60 phút', () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelay)).toEqual([60, 300, 900, 3600, 3600, 3600]);
  });
  it('attempts thiếu hoặc bằng 0 coi như lần đầu', () => {
    expect(retryDelay(0)).toBe(60);
    expect(retryDelay(undefined)).toBe(60);
  });
});

describe('processBatch', () => {
  it('job thành công thì ack và ghi log job.done', async () => {
    const { ctx, events } = withLogs();
    const m = msg(job('email.send', { to: 'a@b.vn', template: '__khong_co__', args: [] }));
    await processBatch(ctx, [m]);
    expect(m.acked).toBe(1);
    expect(m.retried).toEqual([]);
    const done = events.find((e) => e.msg === 'job.done');
    expect(done?.meta).toMatchObject({ job: { name: 'email.send', status: 'ok', attempt: 1 } });
    expect(typeof (done?.meta as { job: { durationMs: unknown } }).job.durationMs).toBe('number');
  });

  it('lỗi tạm thời thì retry với delay theo số lần thử', async () => {
    const { ctx, events } = withLogs();
    const boom = async () => {
      throw new Error('timeout');
    };
    const m1 = msg(job('email.send'), 1);
    const m3 = msg(job('email.send'), 3);
    await processBatch(ctx, [m1, m3], boom);
    expect(m1.acked).toBe(0);
    expect(m1.retried).toEqual([60]);
    expect(m3.retried).toEqual([900]);
    expect(events.filter((e) => e.msg === 'job.retry')).toHaveLength(2);
  });

  it('lỗi vĩnh viễn thì ack, không retry, ghi log job.dropped', async () => {
    const { ctx, events } = withLogs();
    const m = msg(job('email.send'));
    await processBatch(ctx, [m], async () => {
      throw new PermanentJobError('payload sai');
    });
    expect(m.acked).toBe(1);
    expect(m.retried).toEqual([]);
    expect(events.find((e) => e.msg === 'job.dropped')?.meta).toMatchObject({ job: { status: 'dropped' }, error: { type: 'PermanentJobError' } });
  });

  it('tên job lạ thì retry, không ack (deploy lệch phiên bản không làm mất tin)', async () => {
    const { ctx } = withLogs();
    const m = msg(job('job.tuong.lai', { x: 1 }));
    await processBatch(ctx, [m]);
    expect(m.acked).toBe(0);
    expect(m.retried).toEqual([60]);
  });

  it('một message lỗi không ảnh hưởng message sau', async () => {
    const { ctx } = withLogs();
    const bad = msg(job('bad'));
    const good = msg(job('good'));
    await processBatch(ctx, [bad, good], async (j) => {
      if (j.name === ('bad' as string)) throw new Error('x');
    });
    expect(bad.retried).toHaveLength(1);
    expect(good.acked).toBe(1);
  });

  it('dùng handler thật của hệ thống khi không truyền handler', async () => {
    const { ctx } = withLogs();
    const m = msg(job('email.send', { to: 'a@b.vn', template: '__khong_co__', args: [] }));
    await processBatch(ctx, [m]);
    expect(m.acked).toBe(1);
    expect(typeof createJobHandler(ctx)).toBe('function');
  });
});

describe('processDeadLetters', () => {
  it('ghi log job.dead_letter, đánh dấu scheduled_jobs tương ứng là failed rồi ack', async () => {
    const { ctx, events } = withLogs();
    const [row] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'welcome_dm.send', payload: {}, dedupeKey: 'dlq-test-1', runAt: new Date(), status: 'enqueued' }).returning();
    const m = msg(job('scheduled.run', { jobId: row!.id }), 6);
    const other = msg(job('email.send', {}), 6);
    await processDeadLetters(ctx, [m, other]);
    expect(m.acked).toBe(1);
    expect(other.acked).toBe(1);
    const after = await app.ctx.db.query.scheduledJobs.findFirst({ where: eq(scheduledJobs.id, row!.id) });
    expect(after?.status).toBe('failed');
    expect(after?.lastError).toMatch(/dead/i);
    const dead = events.filter((e) => e.msg === 'job.dead_letter');
    expect(dead).toHaveLength(2);
    expect(dead[0]!.level).toBe('error');
  });

  it('không đè job đã hoàn thành', async () => {
    const { ctx } = withLogs();
    const [row] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'welcome_dm.send', payload: {}, dedupeKey: 'dlq-test-2', runAt: new Date(), status: 'done' }).returning();
    await processDeadLetters(ctx, [msg(job('scheduled.run', { jobId: row!.id }), 6)]);
    const after = await app.ctx.db.query.scheduledJobs.findFirst({ where: eq(scheduledJobs.id, row!.id) });
    expect(after?.status).toBe('done');
  });
});
