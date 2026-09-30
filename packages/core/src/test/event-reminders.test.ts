// Nhắc sự kiện theo hướng event-driven: hẹn ngay khi tạo/sửa sự kiện, tự vô hiệu khi sửa giờ hoặc huỷ,
// chia lô người nhận và khử trùng từng người để retry không gửi lặp.
import { and, eq, like } from 'drizzle-orm';
import { eventRegistrations, events as eventsTable, jobRecipients, notifications, scheduledJobs } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { runEventReminder, runEventReminderBatch, reminderKey } from '../jobs/event-reminders';
import type { EnqueueOptions, JobMap, JobName, JobQueue } from '../jobs/queue';
import { runCron } from '../jobs/cron';
import { runScheduledJob } from '../jobs/scheduled';
import { withSystemScope } from '../lib/tenant-scope';
import * as events from '../services/events';
import { reconcileEventReminders } from '../services/event-reminders';
import { createTestApp, type TestApp } from './setup';

class SpyQueue implements JobQueue {
  sent: Array<{ name: string; payload: unknown; opts?: EnqueueOptions }> = [];
  async enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void> {
    this.sent.push({ name, payload, opts });
  }
}

let app: TestApp;
let kd: string;
let seq = 0;
beforeAll(async () => {
  app = await createTestApp();
  kd = await app.ids('community:kd');
}, 180_000);
afterAll(async () => {
  await app.close();
});

const inMin = (m: number) => new Date(Date.now() + m * 60_000);

async function newEvent(startsInMinutes: number, reminders: Array<'1d' | '1h' | 'start' | '15m'>) {
  const mq = await app.as('minhquy');
  const start = inMin(startsInMinutes);
  const title = `Buổi nhắc số ${++seq}`;
  const r = await events.createEvent(mq, kd, { title, descriptionMd: 'md', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString(), timezone: 'Asia/Ho_Chi_Minh', recurrence: 'none', occurrences: 1, kind: 'online', meetingUrl: 'https://zoom.us/j/123', hostUserIds: [], access: 'all_members', allowQuestions: true, autoPublishRecording: true, reminders, announceOnFeed: false, broadcastEmail: false });
  return { mq, id: r.event.id, title, start };
}
const jobsOf = (eventId: string) => app.ctx.db.select().from(scheduledJobs).where(like(scheduledJobs.dedupeKey, `event-remind:${eventId}:%`));
const register = async (eventId: string, keys: string[]) => {
  for (const k of keys) await app.ctx.db.insert(eventRegistrations).values({ eventId, userId: await app.ids(`user:${k}`) }).onConflictDoNothing();
};
const remindNotes = (title: string) => app.ctx.db.select().from(notifications).where(and(eq(notifications.kind, 'event.reminder'), like(notifications.title, `%${title}%`)));
const remindEmails = (title: string) => app.emails.filter((e) => e.template === 'event_reminder' && e.subject.includes(title));
const spyCtx = (): { spy: SpyQueue; ctx: Ctx } => {
  const spy = new SpyQueue();
  return { spy, ctx: { ...app.system(), queue: spy } };
};

describe('tạo sự kiện: hẹn nhắc ngay, không chờ cron', () => {
  it('hẹn cho từng nhãn còn ở tương lai, nhãn đã qua thì bỏ, đúng giờ và có delay trong Queue', async () => {
    const { id, start } = await newEvent(180, ['1d', '1h', '15m', 'start']);
    const rows = await jobsOf(id);
    expect(rows.map((r) => (r.payload as { label: string }).label).sort()).toEqual(['15m', '1h', 'start']);
    for (const r of rows) {
      const p = r.payload as { eventId: string; label: string; runAt: string };
      const offset = { '1h': 60, '15m': 15, start: 0 }[p.label]!;
      expect(r.kind).toBe('event.remind');
      expect(r.runAt.getTime()).toBe(start.getTime() - offset * 60_000);
      expect(p.runAt).toBe(r.runAt.toISOString());
      expect(r.dedupeKey).toBe(reminderKey(id, p.label, start));
    }
    const queued = app.queue.delayed.filter((d) => d.job.name === 'scheduled.run' && rows.some((r) => r.id === (d.job.payload as { jobId: string }).jobId));
    expect(queued).toHaveLength(3);
    const delayOf = (label: string) => queued.find((d) => (d.job.payload as { jobId: string }).jobId === rows.find((r) => (r.payload as { label: string }).label === label)!.id)!.delaySeconds;
    expect(Math.abs(delayOf('1h') - 7200)).toBeLessThanOrEqual(5);
    expect(Math.abs(delayOf('start') - 10800)).toBeLessThanOrEqual(5);
  });

  it('sự kiện xa hơn 24 giờ thì chỉ ghi DB (pending), chưa vào Queue', async () => {
    const { id } = await newEvent(3 * 24 * 60, ['1d', '1h']);
    const rows = await jobsOf(id);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === 'pending')).toBe(true);
    expect(app.queue.delayed.some((d) => rows.some((r) => r.id === (d.job.payload as { jobId?: string }).jobId))).toBe(false);
  });
});

describe('sửa hoặc huỷ sự kiện: job cũ tự vô hiệu', () => {
  it('sửa giờ: job cũ không gửi gì, job mới đúng giờ gửi đúng một lần', async () => {
    const { mq, id, title } = await newEvent(180, ['1h']);
    await register(id, ['duy']);
    const [oldJob] = await jobsOf(id);
    const newStart = inMin(300);
    await events.updateEvent(mq, id, { startsAt: newStart.toISOString(), endsAt: new Date(newStart.getTime() + 3_600_000).toISOString() });
    const all = await jobsOf(id);
    expect(all).toHaveLength(2);
    const fresh = all.find((r) => r.id !== oldJob!.id)!;
    expect(fresh.runAt.getTime()).toBe(newStart.getTime() - 3_600_000);

    await runScheduledJob(app.system(), oldJob!.id);
    await app.queue.drain();
    expect(await remindNotes(title)).toHaveLength(0);
    expect(remindEmails(title)).toHaveLength(0);

    await runScheduledJob(app.system(), fresh.id);
    await app.queue.drain();
    expect(await remindNotes(title)).toHaveLength(1);
    expect(remindEmails(title)).toHaveLength(1);
  });

  it('huỷ sự kiện: job chạy là no-op', async () => {
    const { mq, id, title } = await newEvent(180, ['1h']);
    await register(id, ['duy']);
    await events.updateEvent(mq, id, { status: 'cancelled' });
    const [job] = await jobsOf(id);
    await runScheduledJob(app.system(), job!.id);
    await app.queue.drain();
    expect(await remindNotes(title)).toHaveLength(0);
    expect(remindEmails(title)).toHaveLength(0);
  });

  it('gỡ nhãn khỏi danh sách nhắc: job của nhãn đó là no-op', async () => {
    const { mq, id, title } = await newEvent(180, ['1h', 'start']);
    await register(id, ['duy']);
    await events.updateEvent(mq, id, { reminders: ['start'] });
    const oneHour = (await jobsOf(id)).find((r) => (r.payload as { label: string }).label === '1h')!;
    await runScheduledJob(app.system(), oneHour.id);
    await app.queue.drain();
    expect(await remindNotes(title)).toHaveLength(0);
  });

  it('sự kiện không còn tồn tại: no-op', async () => {
    const { spy, ctx } = spyCtx();
    expect(await runEventReminder(ctx, { eventId: '00000000-0000-4000-8000-000000000000', label: '1h' })).toBe('stale');
    expect(spy.sent).toHaveLength(0);
  });

  it('nhắc "bắt đầu" vẫn chạy khi cron đã đổi trạng thái sang live', async () => {
    const { id, title } = await newEvent(180, ['start']);
    await register(id, ['duy']);
    await app.ctx.db.update(eventsTable).set({ status: 'live' }).where(eq(eventsTable.id, id));
    const [job] = await jobsOf(id);
    await runScheduledJob(app.system(), job!.id);
    await app.queue.drain();
    expect(await remindNotes(title)).toHaveLength(1);
  });
});

describe('chia lô và khử trùng từng người', () => {
  const FIVE = ['duy', 'cong', 'thulan', 'hoangvu', 'hongkim'];

  it('chia người đăng ký thành các lô theo kích thước, mỗi lô một message', async () => {
    const { id, title } = await newEvent(180, ['1h']);
    await register(id, FIVE);
    const { spy, ctx } = spyCtx();
    expect(await runEventReminder(ctx, { eventId: id, label: '1h' }, { chunkSize: 2 })).toBe('sent');
    const batches = spy.sent.filter((m) => m.name === 'event.remind.batch');
    expect(batches.map((b) => (b.payload as { userIds: string[] }).userIds.length)).toEqual([2, 2, 1]);
    const all = batches.flatMap((b) => (b.payload as { userIds: string[] }).userIds);
    expect(new Set(all).size).toBe(5);
    expect(new Set(batches.map((b) => (b.payload as { jobKey: string }).jobKey)).size).toBe(1);
    expect(await remindNotes(title)).toHaveLength(0);
  });

  it('người đã huỷ đăng ký không nhận nhắc', async () => {
    const { id } = await newEvent(180, ['1h']);
    await register(id, ['duy', 'cong']);
    await app.ctx.db.update(eventRegistrations).set({ status: 'cancelled' }).where(and(eq(eventRegistrations.eventId, id), eq(eventRegistrations.userId, await app.ids('user:cong'))));
    const { spy, ctx } = spyCtx();
    await runEventReminder(ctx, { eventId: id, label: '1h' });
    const ids = spy.sent.flatMap((m) => (m.payload as { userIds: string[] }).userIds);
    expect(ids).toEqual([await app.ids('user:duy')]);
  });

  it('cùng một lô chạy hai lần thì mỗi người chỉ nhận một lần', async () => {
    const { id, title } = await newEvent(180, ['1h']);
    await register(id, FIVE);
    const { spy, ctx } = spyCtx();
    await runEventReminder(ctx, { eventId: id, label: '1h' });
    const batch = spy.sent[0]!.payload as JobMap['event.remind.batch'];
    await withSystemScope(app.system(), (c) => runEventReminderBatch(c, batch));
    await withSystemScope(app.system(), (c) => runEventReminderBatch(c, batch));
    expect(await remindNotes(title)).toHaveLength(5);
    expect(remindEmails(title)).toHaveLength(5);
  });

  it('lô lỗi giữa chừng: transaction hoàn tác nên không ai bị đánh dấu đã gửi, retry gửi đủ và không lặp', async () => {
    const { id, title } = await newEvent(180, ['1h']);
    await register(id, FIVE);
    const { spy, ctx } = spyCtx();
    await runEventReminder(ctx, { eventId: id, label: '1h' });
    const batch = spy.sent[0]!.payload as JobMap['event.remind.batch'];
    await expect(
      withSystemScope(app.system(), async (c) => {
        await runEventReminderBatch(c, batch);
        throw new Error('hỏng sau khi đã xử lý cả lô');
      }),
    ).rejects.toThrow('hỏng sau khi');
    expect(await remindNotes(title)).toHaveLength(0);
    expect(remindEmails(title)).toHaveLength(0);
    expect(await app.ctx.db.select().from(jobRecipients).where(eq(jobRecipients.jobKey, batch.jobKey))).toHaveLength(0);
    await withSystemScope(app.system(), (c) => runEventReminderBatch(c, batch));
    expect(await remindNotes(title)).toHaveLength(5);
    expect(remindEmails(title)).toHaveLength(5);
  });

  it('lô tới sau khi sự kiện đã huỷ thì bỏ qua', async () => {
    const { mq, id, title } = await newEvent(180, ['1h']);
    await register(id, ['duy']);
    const { spy, ctx } = spyCtx();
    await runEventReminder(ctx, { eventId: id, label: '1h' });
    await events.updateEvent(mq, id, { status: 'cancelled' });
    await withSystemScope(app.system(), (c) => runEventReminderBatch(c, spy.sent[0]!.payload as JobMap['event.remind.batch']));
    expect(await remindNotes(title)).toHaveLength(0);
  });
});

describe('đối soát hằng ngày: sự kiện tạo trước khi có cơ chế hẹn lúc tạo', () => {
  /** Mô phỏng sự kiện cũ: có sự kiện nhưng chưa có job nhắc nào. */
  async function legacyEvent(startsInMinutes: number, reminders: Array<'1d' | '1h' | 'start' | '15m'>, status?: 'cancelled') {
    const e = await newEvent(startsInMinutes, reminders);
    await app.ctx.db.delete(scheduledJobs).where(like(scheduledJobs.dedupeKey, `event-remind:${e.id}:%`));
    if (status) await app.ctx.db.update(eventsTable).set({ status }).where(eq(eventsTable.id, e.id));
    return e;
  }

  it('hẹn nhắc cho sự kiện trong 3 ngày tới mà chưa có job; chạy lại không tạo thêm', async () => {
    const e = await legacyEvent(2 * 24 * 60, ['1d', '1h']);
    expect(await jobsOf(e.id)).toHaveLength(0);
    const first = await reconcileEventReminders(app.system());
    expect(first).toBeGreaterThanOrEqual(2);
    expect((await jobsOf(e.id)).map((r) => (r.payload as { label: string }).label).sort()).toEqual(['1d', '1h']);
    expect(await reconcileEventReminders(app.system())).toBe(0);
    expect(await jobsOf(e.id)).toHaveLength(2);
  });

  it('bỏ qua sự kiện xa hơn 3 ngày và sự kiện đã huỷ', async () => {
    const far = await legacyEvent(10 * 24 * 60, ['1d']);
    const cancelled = await legacyEvent(2 * 24 * 60, ['1d'], 'cancelled');
    await reconcileEventReminders(app.system());
    expect(await jobsOf(far.id)).toHaveLength(0);
    expect(await jobsOf(cancelled.id)).toHaveLength(0);
  });

  it('cron hằng ngày chạy bước đối soát', async () => {
    const e = await legacyEvent(2 * 24 * 60, ['1d']);
    const out = await runCron(app.ctx, 'daily');
    expect(out.remindersReconciled).toBeGreaterThanOrEqual(1);
    expect(await jobsOf(e.id)).toHaveLength(1);
  });
});
