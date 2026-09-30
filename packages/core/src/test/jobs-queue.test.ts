// Nền tảng hàng đợi: job hẹn giờ, lỗi vĩnh viễn, và đẩy vào Queue chỉ sau khi transaction commit (DeferredQueue).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Logger } from '../context';
import { PermanentJobError } from '../jobs/errors';
import { DeferredQueue, InMemoryQueue, MAX_DELAY_SECONDS, type EnqueueOptions, type JobMap, type JobName, type JobQueue } from '../jobs/queue';
import { withSystemScope } from '../lib/tenant-scope';
import { createTestApp, type TestApp } from './setup';

/** Hàng đợi ghi lại mọi message được gửi; `failOn` làm một loại job gửi lỗi. */
class SpyQueue implements JobQueue {
  readonly sent: Array<{ name: string; payload: unknown; opts?: EnqueueOptions }> = [];
  failOn: string | null = null;
  async enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void> {
    if (name === this.failOn) throw new Error('queue down');
    this.sent.push({ name, payload, opts });
  }
}

function captureLog(): { log: Logger; errors: Array<{ msg: string; meta?: Record<string, unknown> }> } {
  const errors: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
  const noop = () => undefined;
  return { errors, log: { debug: noop, info: noop, warn: noop, error: (msg, meta) => errors.push({ msg, meta }) } };
}

describe('InMemoryQueue: job hẹn giờ', () => {
  it('job có delay chỉ nằm chờ, không chạy ngay; releaseDelayed mới cho chạy', async () => {
    const q = new InMemoryQueue();
    const seen: string[] = [];
    q.setHandler(async (j) => void seen.push(j.name));
    await q.enqueue('leaderboard.snapshot', { communityId: 'c1' }, { delaySeconds: 600, dedupeKey: 'k1' });
    await q.drain(200);
    expect(seen).toEqual([]);
    expect(q.delayed).toHaveLength(1);
    expect(q.delayed[0]).toMatchObject({ delaySeconds: 600 });
    expect(q.delayed[0]!.job.dedupeKey).toBe('k1');
    expect(q.releaseDelayed()).toBe(1);
    await q.drain();
    expect(seen).toEqual(['leaderboard.snapshot']);
    expect(q.delayed).toHaveLength(0);
  });

  it('từ chối delay vượt 24 giờ, âm hoặc không nguyên', async () => {
    const q = new InMemoryQueue();
    await expect(q.enqueue('leaderboard.snapshot', { communityId: 'c' }, { delaySeconds: MAX_DELAY_SECONDS + 1 })).rejects.toThrow(/delaySeconds/);
    await expect(q.enqueue('leaderboard.snapshot', { communityId: 'c' }, { delaySeconds: -1 })).rejects.toThrow(/delaySeconds/);
    await expect(q.enqueue('leaderboard.snapshot', { communityId: 'c' }, { delaySeconds: 1.5 })).rejects.toThrow(/delaySeconds/);
    await expect(q.enqueue('leaderboard.snapshot', { communityId: 'c' }, { delaySeconds: MAX_DELAY_SECONDS })).resolves.toBeUndefined();
  });
});

describe('InMemoryQueue: phân loại lỗi', () => {
  it('lỗi vĩnh viễn không retry, vào danh sách dropped', async () => {
    const q = new InMemoryQueue();
    let calls = 0;
    q.setHandler(async () => {
      calls++;
      throw new PermanentJobError('payload sai');
    });
    await q.enqueue('leaderboard.snapshot', { communityId: 'c' });
    await q.drain();
    expect(calls).toBe(1);
    expect(q.dropped).toHaveLength(1);
    expect(q.processed).toHaveLength(0);
  });

  it('lỗi tạm thời được retry rồi thành công', async () => {
    const q = new InMemoryQueue();
    let calls = 0;
    q.setHandler(async () => {
      calls++;
      if (calls === 1) throw new Error('timeout');
    });
    await q.enqueue('leaderboard.snapshot', { communityId: 'c' });
    await q.drain();
    expect(calls).toBe(2);
    expect(q.processed).toHaveLength(1);
    expect(q.dropped).toHaveLength(0);
  });
});

describe('DeferredQueue', () => {
  it('giữ message tới khi flush', async () => {
    const spy = new SpyQueue();
    const q = new DeferredQueue(spy);
    await q.enqueue('leaderboard.snapshot', { communityId: 'c1' }, { delaySeconds: 30 });
    expect(spy.sent).toHaveLength(0);
    expect(q.size).toBe(1);
    await q.flush(() => undefined);
    expect(spy.sent).toEqual([{ name: 'leaderboard.snapshot', payload: { communityId: 'c1' }, opts: { delaySeconds: 30 } }]);
    expect(q.size).toBe(0);
  });

  it('discard bỏ mọi message đang giữ', async () => {
    const spy = new SpyQueue();
    const q = new DeferredQueue(spy);
    await q.enqueue('leaderboard.snapshot', { communityId: 'c1' });
    await q.enqueue('leaderboard.snapshot', { communityId: 'c2' });
    expect(q.discard()).toBe(2);
    await q.flush(() => undefined);
    expect(spy.sent).toHaveLength(0);
  });

  it('một message gửi lỗi thì báo lỗi nhưng vẫn gửi tiếp các message sau', async () => {
    const spy = new SpyQueue();
    spy.failOn = 'course.recount';
    const q = new DeferredQueue(spy);
    await q.enqueue('course.recount', { courseId: 'x' });
    await q.enqueue('leaderboard.snapshot', { communityId: 'c1' });
    const failed: string[] = [];
    const sent: string[] = [];
    await q.flush((m) => failed.push(m.name), (m) => void sent.push(m.name));
    expect(failed).toEqual(['course.recount']);
    expect(sent).toEqual(['leaderboard.snapshot']);
    expect(spy.sent.map((m) => m.name)).toEqual(['leaderboard.snapshot']);
  });
});

describe('transaction và hàng đợi', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  }, 180_000);
  afterAll(async () => {
    await app.close();
  });

  it('enqueue trong transaction chỉ ra khỏi hàng đợi sau khi commit', async () => {
    const spy = new SpyQueue();
    const ctx = { ...app.system(), queue: spy };
    const out = await withSystemScope(ctx, async (c) => {
      await c.queue.enqueue('leaderboard.snapshot', { communityId: 'c1' });
      expect(spy.sent).toHaveLength(0);
      return 'ok';
    });
    expect(out).toBe('ok');
    expect(spy.sent).toHaveLength(1);
  });

  it('transaction bị hủy thì không gửi gì', async () => {
    const spy = new SpyQueue();
    const ctx = { ...app.system(), queue: spy };
    await expect(
      withSystemScope(ctx, async (c) => {
        await c.queue.enqueue('leaderboard.snapshot', { communityId: 'c1' });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(spy.sent).toHaveLength(0);
  });

  it('gửi lỗi sau commit chỉ ghi log, thao tác vẫn thành công', async () => {
    const spy = new SpyQueue();
    spy.failOn = 'leaderboard.snapshot';
    const { log, errors } = captureLog();
    const ctx = { ...app.system(), queue: spy, log };
    const out = await withSystemScope(ctx, async (c) => {
      await c.queue.enqueue('leaderboard.snapshot', { communityId: 'c1' });
      return 'ok';
    });
    expect(out).toBe('ok');
    expect(errors.map((e) => e.msg)).toContain('queue.flush_failed');
  });

  it('scope lồng nhau: message của scope trong chỉ ra khi scope ngoài commit', async () => {
    const spy = new SpyQueue();
    const ctx = { ...app.system(), queue: spy };
    await withSystemScope(ctx, async (outer) => {
      await withSystemScope(outer, async (inner) => {
        await inner.queue.enqueue('leaderboard.snapshot', { communityId: 'c1' });
      });
      expect(spy.sent).toHaveLength(0);
    });
    expect(spy.sent).toHaveLength(1);
  });
});
