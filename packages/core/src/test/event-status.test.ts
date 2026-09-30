// Trạng thái sự kiện tính từ giờ khi đọc (live / ended) nên đúng ngay cả khi bộ quét chưa cập nhật cột status.
import { eq } from 'drizzle-orm';
import { events as eventsTable } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSweep } from '../jobs/sweep';
import { withSystemScope } from '../lib/tenant-scope';
import * as events from '../services/events';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let kd: string;
beforeAll(async () => {
  app = await createTestApp();
  kd = await app.ids('community:kd');
}, 180_000);
afterAll(async () => {
  await app.close();
});

const at = (ms: number) => new Date(Date.now() + ms);

describe('effectiveEventStatus', () => {
  // Giờ tính lúc chạy test, không phải lúc nạp file: beforeAll dựng DB mất vài giây.
  const now = () => new Date();
  const e = (status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled', startsAt: Date, endsAt: Date) => ({ status, startsAt, endsAt });
  it('scheduled: chưa tới giờ thì scheduled, đang diễn ra thì live, đã qua thì ended', () => {
    expect(events.effectiveEventStatus(e('scheduled', at(60_000), at(3_600_000)), now())).toBe('scheduled');
    expect(events.effectiveEventStatus(e('scheduled', at(-60_000), at(3_600_000)), now())).toBe('live');
    expect(events.effectiveEventStatus(e('scheduled', at(-7_200_000), at(-3_600_000)), now())).toBe('ended');
  });
  it('live mà đã quá giờ kết thúc thì ended; còn trong giờ thì live', () => {
    expect(events.effectiveEventStatus(e('live', at(-7_200_000), at(-1_000)), now())).toBe('ended');
    expect(events.effectiveEventStatus(e('live', at(-60_000), at(3_600_000)), now())).toBe('live');
  });
  it('cancelled, draft, ended giữ nguyên dù giờ thế nào', () => {
    for (const s of ['cancelled', 'draft', 'ended'] as const) expect(events.effectiveEventStatus(e(s, at(-60_000), at(3_600_000)), now())).toBe(s);
  });
});

describe('đọc sự kiện khi cột status còn cũ', () => {
  async function makeEvent(startOffsetMs: number, durationMs: number) {
    const mq = await app.as('minhquy');
    const start = at(startOffsetMs);
    const r = await events.createEvent(mq, kd, { title: `Trạng thái ${Math.random().toString(36).slice(2, 7)}`, descriptionMd: 'md', startsAt: at(60 * 60_000).toISOString(), endsAt: at(2 * 60 * 60_000).toISOString(), timezone: 'Asia/Ho_Chi_Minh', recurrence: 'none', occurrences: 1, kind: 'online', meetingUrl: 'https://zoom.us/j/123', hostUserIds: [], access: 'all_members', allowQuestions: true, autoPublishRecording: true, reminders: [], announceOnFeed: false, broadcastEmail: false });
    // Đẩy giờ về quá khứ bằng SQL để mô phỏng thời gian trôi qua mà cột status chưa ai cập nhật.
    await app.ctx.db.update(eventsTable).set({ startsAt: start, endsAt: new Date(start.getTime() + durationMs), status: 'scheduled' }).where(eq(eventsTable.id, r.event.id));
    return { mq, id: r.event.id };
  }

  it('getEvent trả live khi đang diễn ra, dù cột status vẫn scheduled', async () => {
    const { mq, id } = await makeEvent(-10 * 60_000, 60 * 60_000);
    const row = await app.ctx.db.query.events.findFirst({ where: eq(eventsTable.id, id) });
    expect(row?.status).toBe('scheduled');
    const d = await events.getEvent(mq, id);
    expect(d.status).toBe('live');
    expect(d.live).toBe(true);
  });

  it('getEvent trả ended khi đã qua giờ kết thúc', async () => {
    const { mq, id } = await makeEvent(-3 * 60 * 60_000, 60 * 60_000);
    expect((await events.getEvent(mq, id)).status).toBe('ended');
  });

  it('listEvents trả cùng trạng thái hiệu lực', async () => {
    const { mq, id } = await makeEvent(-10 * 60_000, 60 * 60_000);
    const list = await events.listEvents(mq, kd, { filter: 'upcoming' });
    expect(list.items.find((i) => i.id === id)?.status).toBe('live');
  });

  it('bộ quét cập nhật cột status: scheduled → live, và → ended khi đã qua giờ', async () => {
    const running = await makeEvent(-10 * 60_000, 60 * 60_000);
    const over = await makeEvent(-3 * 60 * 60_000, 60 * 60_000);
    const res = await withSystemScope(app.system(), (c) => runSweep(c));
    expect(res.eventsFlipped).toBeGreaterThanOrEqual(2);
    const statusOf = async (id: string) => (await app.ctx.db.query.events.findFirst({ where: eq(eventsTable.id, id) }))?.status;
    expect(await statusOf(running.id)).toBe('live');
    expect(await statusOf(over.id)).toBe('ended');
    const again = await withSystemScope(app.system(), (c) => runSweep(c));
    expect(again.eventsFlipped).toBe(0);
  });
});
