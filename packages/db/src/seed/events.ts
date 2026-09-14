// 6 sự kiện (1 đang diễn ra, 4 sắp tới, 1 đã qua có bản ghi), đăng ký, câu hỏi gửi trước.
import type { Database } from '../client';
import { eventQuestionVotes, eventQuestions, eventRecordings, eventRegistrations, eventSeries, events } from '../schema';
import type { SeedCommunity } from './community';
import { daysFrom, sid } from './ids';
import type { SeedUser } from './users';

/** Tạo chuỗi Q&A hằng tuần và các buổi khớp màn Sự kiện. */
export async function seedEvents(db: Database, base: Date, U: Record<string, SeedUser>, c: SeedCommunity): Promise<Record<string, string>> {
  const seriesId = await sid('series:kd:qa');
  await db.insert(eventSeries).values({ id: seriesId, communityId: c.id, title: 'Q&A hằng tuần', recurrence: 'weekly', coverColor: '#0E8E96' }).onConflictDoNothing();
  const now = new Date();
  const specs = [
    { key: 'onboarding', title: 'Onboarding cho thành viên mới tuần này', start: new Date(now.getTime() - 20 * 60_000), end: new Date(now.getTime() + 40 * 60_000), kind: 'online' as const, host: U.minhquy!, going: 38, status: 'live' as const, access: 'all_members' as const, url: 'https://zoom.us/j/8812349901' },
    { key: 'qa12', title: 'Q&A tuần: Funnel Money Model', start: daysFrom(base, 3, 20), end: daysFrom(base, 3, 21, 30), kind: 'online' as const, host: U.minhquy!, going: 64, series: seriesId, index: 12, access: 'premium' as const, url: 'https://zoom.us/j/8812349901', md: 'Gỡ trực tiếp offer của 3 thành viên đã gửi trước, rồi trả lời câu hỏi theo thứ tự bình chọn bên dưới. Ai đang ở module 2 nên có mặt.\n\n- **20:00** · Tổng kết tuần: 41 câu hỏi ở Hỏi đáp, 3 chủ đề lặp lại nhiều nhất\n- **20:15** · Gỡ offer: *shop phụ kiện*, *khóa tiếng Anh online*, *dịch vụ kế toán*\n- **21:00** · Hỏi đáp mở theo bình chọn\n\nChuẩn bị: mở sẵn Offer Canvas của bạn, có gì hỏi thì gửi trước ở dưới để mình sắp thứ tự.' },
    { key: 'workshop', title: 'Workshop: AI Agent cho người bán hàng', start: daysFrom(base, 6, 9), end: daysFrom(base, 6, 11, 30), kind: 'offline' as const, host: U.hoangvu!, going: 21, access: 'all_members' as const, location: 'Trực tiếp · TP.HCM' },
    { key: 'qa13', title: 'Q&A tuần: Lead magnet và Tripwire', start: daysFrom(base, 10, 20), end: daysFrom(base, 10, 21, 30), kind: 'online' as const, host: U.minhquy!, going: 12, series: seriesId, index: 13, access: 'premium' as const, url: 'https://zoom.us/j/8812349901' },
    { key: 'coffee', title: 'Cà phê cộng sự: chia sẻ cách kéo 100 đăng ký đầu tiên', start: daysFrom(base, 13, 9, 30), end: daysFrom(base, 13, 11), kind: 'online' as const, host: U.hongkim!, going: 9, access: 'all_members' as const, url: 'https://www.youtube.com/watch?v=live12345ab', provider: 'youtube' },
    { key: 'qa11', title: 'Q&A tuần: Thiết kế Offer', start: daysFrom(base, -4, 20), end: daysFrom(base, -4, 21, 30), kind: 'online' as const, host: U.minhquy!, going: 58, series: seriesId, index: 11, access: 'premium' as const, status: 'ended' as const, url: 'https://zoom.us/j/8812349901' },
    { key: 'onb1', title: 'Onboarding tuần 1 tháng 9', start: daysFrom(base, -7, 20), end: daysFrom(base, -7, 21), kind: 'online' as const, host: U.minhquy!, going: 30, access: 'all_members' as const, status: 'ended' as const, url: 'https://zoom.us/j/8812349901' },
  ];
  const ids: Record<string, string> = {};
  for (const s of specs) {
    const id = await sid(`event:${s.key}`);
    ids[s.key] = id;
    await db
      .insert(events)
      .values({
        id, communityId: c.id, seriesId: s.series ?? null, seriesIndex: s.index ?? null, createdByUserId: U.minhquy!.id, title: s.title, descriptionMd: s.md ?? 'Buổi gặp hằng tuần của hội.',
        coverColor: '#0E8E96', kind: s.kind, recurrence: s.series ? 'weekly' : 'none', startsAt: s.start, endsAt: s.end, meetingUrl: s.url ?? null,
        meetingProvider: s.url ? (s.provider ?? 'zoom') : null, location: s.location ?? null, hostUserIds: s.key === 'qa12' ? [s.host.id, U.hoangvu!.id] : [s.host.id],
        access: s.access, status: s.status ?? 'scheduled', registrationCount: s.going, createdAt: daysFrom(base, -20),
      })
      .onConflictDoNothing();
  }
  for (const k of ['minhquy', 'hoangvu', 'hongkim', 'dien', 'kienbui', 'cong', 'duy', 'thulan']) {
    await db.insert(eventRegistrations).values({ id: await sid(`reg:qa12:${k}`), eventId: ids.qa12!, userId: U[k]!.id }).onConflictDoNothing();
    await db.insert(eventRegistrations).values({ id: await sid(`reg:onboarding:${k}`), eventId: ids.onboarding!, userId: U[k]!.id }).onConflictDoNothing();
  }
  const qs: Array<[string, string, string, number]> = [
    ['hongkim', 'q1', 'Offer bảo hành hoàn tiền 30 ngày có làm giảm giá trị cảm nhận không? Em sợ khách nghĩ khóa học không chắc chắn.', 21],
    ['cong', 'q2', 'Mình bán dịch vụ, không bán khóa học. Công thức giá trị áp thế nào khi kết quả phụ thuộc vào khách?', 14],
    ['kienbui', 'q3', 'Nên đặt giá lẻ 249k hay tròn 250k? Có số liệu nào trong hội chưa ạ?', 8],
  ];
  for (const [who, key, q, votes] of qs) {
    const qid = await sid(`eq:qa12:${key}`);
    await db.insert(eventQuestions).values({ id: qid, eventId: ids.qa12!, userId: U[who]!.id, question: q, voteCount: votes }).onConflictDoNothing();
    if (key === 'q1') await db.insert(eventQuestionVotes).values({ id: await sid('eqv:q1:mq'), questionId: qid, userId: U.minhquy!.id }).onConflictDoNothing();
  }
  await db
    .insert(eventRecordings)
    .values([
      { id: await sid('rec:qa11'), eventId: ids.qa11!, communityId: c.id, title: 'Q&A tuần: Thiết kế Offer', videoUrl: 'https://www.youtube.com/watch?v=recqa11xxxx', videoProvider: 'youtube', videoExternalId: 'recqa11xxxx', durationSeconds: 5040, publishedAt: daysFrom(base, -3) },
      { id: await sid('rec:onb1'), eventId: ids.onb1!, communityId: c.id, title: 'Onboarding tuần 1 tháng 9', videoUrl: 'https://www.youtube.com/watch?v=reconb1xxxx', videoProvider: 'youtube', videoExternalId: 'reconb1xxxx', durationSeconds: 3120, publishedAt: daysFrom(base, -6) },
    ])
    .onConflictDoNothing();
  return ids;
}
