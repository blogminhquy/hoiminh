// Link phòng họp của sự kiện: Zoom, Google Meet hoặc link tùy chọn; ai thấy link và ai không.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as events from '../services/events';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

/** Tạo một buổi trực tuyến bắt đầu sau `minutesFromNow` phút. */
async function onlineEvent(meetingUrl: string, minutesFromNow = 240) {
  const owner = await app.as('minhquy');
  const communityId = await app.ids('community:kd');
  const startsAt = new Date(Date.now() + minutesFromNow * 60_000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  const r = await events.createEvent(owner, communityId, {
    title: `Buổi ${meetingUrl.slice(8, 28)}`, descriptionMd: '', startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
    timezone: 'Asia/Ho_Chi_Minh', recurrence: 'none', occurrences: 1, kind: 'online', meetingUrl, hostUserIds: [],
    access: 'all_members', allowQuestions: true, autoPublishRecording: true, reminders: [], announceOnFeed: false, broadcastEmail: false,
  });
  return r.event;
}

describe('link phòng họp của sự kiện', () => {
  it('nhận Zoom, Google Meet và link tùy chọn, gắn đúng nhà cung cấp', async () => {
    const owner = await app.as('minhquy');
    const cases: Array<[string, string]> = [
      ['https://zoom.us/j/123456789', 'zoom'],
      ['https://meet.google.com/abc-defg-hij', 'google_meet'],
      ['https://phonghop.congty.vn/room/kinh-doanh', 'link'],
    ];
    for (const [url, provider] of cases) {
      const e = await onlineEvent(url);
      const detail = await events.getEvent(owner, e.id);
      expect(detail.meetingProvider, url).toBe(provider);
      expect(detail.meetingUrl, url).toBe(url);
    }
  });

  it('thành viên thấy link ngay sau khi đăng ký, dù buổi còn xa', async () => {
    const e = await onlineEvent('https://meet.google.com/xyz-week-away', 60 * 24 * 7);
    const member = await app.as('cong');
    expect((await events.getEvent(member, e.id)).meetingUrl, 'chưa đăng ký thì chưa thấy').toBeNull();

    await events.registerEvent(member, e.id, true);
    expect((await events.getEvent(member, e.id)).meetingUrl).toBe('https://meet.google.com/xyz-week-away');
    // Danh sách sự kiện phải nói cùng một điều với trang chi tiết.
    const list = await events.listEvents(member, await app.ids('community:kd'), { filter: 'upcoming' });
    expect(list.items.find((x) => x.id === e.id)?.meetingUrl).toBe('https://meet.google.com/xyz-week-away');
  });

  it('hủy đăng ký thì mất link ở cả trang chi tiết lẫn danh sách', async () => {
    const e = await onlineEvent('https://zoom.us/j/huy-dang-ky');
    const member = await app.as('cong');
    await events.registerEvent(member, e.id, true);
    expect((await events.getEvent(member, e.id)).meetingUrl).toBeTruthy();

    await events.registerEvent(member, e.id, false);
    expect((await events.getEvent(member, e.id)).meetingUrl).toBeNull();
    const list = await events.listEvents(member, await app.ids('community:kd'), { filter: 'upcoming' });
    expect(list.items.find((x) => x.id === e.id)?.meetingUrl, 'danh sách cũng phải giấu link').toBeNull();
  });

  it('chủ hội luôn thấy link kể cả khi không đăng ký', async () => {
    const e = await onlineEvent('https://zoom.us/j/chu-hoi');
    const owner = await app.as('minhquy');
    const detail = await events.getEvent(owner, e.id);
    expect(detail.registered).toBe(false);
    expect(detail.meetingUrl).toBe('https://zoom.us/j/chu-hoi');
  });

  it('đổi link thì nhà cung cấp cập nhật theo', async () => {
    const e = await onlineEvent('https://zoom.us/j/ban-dau');
    const owner = await app.as('minhquy');
    await events.updateEvent(owner, e.id, { meetingUrl: 'https://meet.google.com/doi-sang-meet' });
    const detail = await events.getEvent(owner, e.id);
    expect(detail.meetingProvider).toBe('google_meet');
    expect(detail.meetingUrl).toBe('https://meet.google.com/doi-sang-meet');
  });
});
