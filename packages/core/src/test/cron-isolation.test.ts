// Mỗi bước cron chạy trong transaction riêng: một bước lỗi không kéo các bước khác rollback theo,
// nhất là bộ quét (lưới an toàn) không được phụ thuộc vào việc chụp xếp hạng chạy thành công.
import { eq } from 'drizzle-orm';
import { scheduledJobs } from '@hoiminh/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnqueueOptions, JobMap, JobName, JobQueue } from '../jobs/queue';
import { runCron } from '../jobs/cron';
import type * as Affiliate from '../services/affiliate';
import type * as Sweep from '../jobs/sweep';
import { createTestApp, type TestApp } from './setup';

const control = vi.hoisted(() => ({ failLeaderboard: false, failCommissions: false, failSweep: false, leaderboardCalls: 0 }));

vi.mock('../services/affiliate', async (importOriginal) => {
  const orig = await importOriginal<typeof Affiliate>();
  return {
    ...orig,
    snapshotLeaderboards: (...args: Parameters<typeof orig.snapshotLeaderboards>) => {
      control.leaderboardCalls++;
      if (control.failLeaderboard) throw new Error('leaderboard boom');
      return orig.snapshotLeaderboards(...args);
    },
    releaseDueCommissions: (...args: Parameters<typeof orig.releaseDueCommissions>) => {
      if (control.failCommissions) throw new Error('commission boom');
      return orig.releaseDueCommissions(...args);
    },
  };
});
vi.mock('../jobs/sweep', async (importOriginal) => {
  const orig = await importOriginal<typeof Sweep>();
  return {
    ...orig,
    runSweep: (...args: Parameters<typeof orig.runSweep>) => {
      if (control.failSweep) throw new Error('sweep boom');
      return orig.runSweep(...args);
    },
  };
});

class SpyQueue implements JobQueue {
  sent: Array<{ name: string; payload: unknown; opts?: EnqueueOptions }> = [];
  async enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void> {
    this.sent.push({ name, payload, opts });
  }
}

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  control.failLeaderboard = false;
  control.failCommissions = false;
  control.failSweep = false;
  control.leaderboardCalls = 0;
  await app.ctx.db.delete(scheduledJobs);
});

const at = (ms: number) => new Date(Date.now() + ms);

describe('cron 10 phút', () => {
  it('xếp hạng lỗi không làm bộ quét bị rollback: job sắp tới hạn vẫn được đẩy và đánh dấu enqueued, còn runCron báo lỗi', async () => {
    const [j] = await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: {}, dedupeKey: 'iso-1', runAt: at(30 * 60_000), status: 'pending', createdAt: at(-10 * 60_000) }).returning();
    control.failLeaderboard = true;
    const spy = new SpyQueue();
    await expect(runCron({ ...app.ctx, queue: spy }, 'every_10_minutes')).rejects.toThrow('leaderboard boom');
    expect(spy.sent.some((m) => m.name === 'scheduled.run' && (m.payload as { jobId: string }).jobId === j!.id)).toBe(true);
    expect((await app.ctx.db.query.scheduledJobs.findFirst({ where: eq(scheduledJobs.id, j!.id) }))?.status).toBe('enqueued');
  });

  it('bộ quét lỗi không cản việc chụp xếp hạng', async () => {
    control.failSweep = true;
    await expect(runCron(app.ctx, 'every_10_minutes')).rejects.toThrow('sweep boom');
    expect(control.leaderboardCalls).toBe(1);
  });
});

describe('cron hằng ngày', () => {
  it('bước tiền (hoa hồng, billing...) lỗi không cản dọn bảng job và đối soát nhắc sự kiện', async () => {
    await app.ctx.db.insert(scheduledJobs).values({ kind: 'file.delete', payload: {}, dedupeKey: 'iso-old', runAt: at(-45 * 86_400_000), status: 'done', createdAt: at(-45 * 86_400_000), doneAt: at(-45 * 86_400_000) });
    control.failCommissions = true;
    await expect(runCron(app.ctx, 'daily')).rejects.toThrow('commission boom');
    expect(await app.ctx.db.query.scheduledJobs.findFirst({ where: eq(scheduledJobs.dedupeKey, 'iso-old') })).toBeUndefined();
  });

  it('không lỗi thì báo đủ kết quả các bước', async () => {
    const out = await runCron(app.ctx, 'daily');
    expect(out).toHaveProperty('commissionsReleased');
    expect(out).toHaveProperty('jobRecordsCleaned');
  });
});

