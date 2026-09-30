// Nhắc sự kiện: job cha kiểm tra còn hợp lệ rồi chia người đăng ký thành lô; mỗi lô khử trùng từng người rồi mới thông báo và gửi email.
import { templates } from '@hoiminh/email';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { communities, eventRegistrations, events, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { notify } from '../services/notifications';
import { chunk, claimRecipients, FANOUT_CHUNK } from './fanout';

/** Mốc nhắc theo phút trước giờ bắt đầu. */
export const REMINDER_OFFSETS_MINUTES: Record<string, number> = { '1d': 24 * 60, '1h': 60, '15m': 15, start: 0 };

/** Lệch tối đa giữa giờ nhắc trong job và giờ tính lại từ sự kiện; quá mức này là sự kiện đã đổi giờ. */
const RUN_AT_TOLERANCE_MS = 60_000;

export function reminderRunAt(startsAt: Date, label: string): Date | null {
  const minutes = REMINDER_OFFSETS_MINUTES[label];
  return minutes === undefined ? null : new Date(startsAt.getTime() - minutes * 60_000);
}

/** Khóa khử trùng của một lời nhắc. Gắn phút bắt đầu nên sửa giờ sinh job mới thay vì đụng job cũ. */
export function reminderKey(eventId: string, label: string, startsAt: Date): string {
  return `event-remind:${eventId}:${label}:${Math.floor(startsAt.getTime() / 60_000)}`;
}

type EventRow = typeof events.$inferSelect;

/**
 * Lời nhắc còn hợp lệ không? Trả về lý do nếu đã cũ, null nếu hợp lệ. Job cũ không bị huỷ vật lý:
 * chạy tới nơi thì tự kiểm tra và bỏ qua, nên sửa hay huỷ sự kiện không phải dò tìm job đã đẩy vào Queue.
 * Trạng thái `live` vẫn hợp lệ: nhắc "bắt đầu" chạy đúng lúc bộ quét có thể vừa đổi sự kiện sang live.
 */
export function reminderStale(e: Pick<EventRow, 'status' | 'reminders' | 'startsAt'> | null | undefined, label: string, runAt?: string): string | null {
  if (!e) return 'event_missing';
  if (e.status === 'cancelled' || e.status === 'draft' || e.status === 'ended') return `event_${e.status}`;
  if (!e.reminders.includes(label)) return 'label_removed';
  const expected = reminderRunAt(e.startsAt, label);
  if (!expected) return 'label_unknown';
  if (runAt && Math.abs(expected.getTime() - new Date(runAt).getTime()) > RUN_AT_TOLERANCE_MS) return 'rescheduled';
  return null;
}

/** Job cha: chia người đăng ký (chưa huỷ) thành lô, mỗi lô một message `event.remind.batch`. */
export async function runEventReminder(ctx: Ctx, p: { eventId: string; label: string; runAt?: string }, opts: { chunkSize?: number } = {}): Promise<'sent' | 'stale'> {
  const e = await ctx.db.query.events.findFirst({ where: eq(events.id, p.eventId) });
  const stale = reminderStale(e, p.label, p.runAt);
  if (stale || !e) {
    ctx.log.info('job.stale', { job: { name: 'event.remind', status: 'stale' }, reason: stale, eventId: p.eventId, label: p.label });
    return 'stale';
  }
  const regs = await ctx.db.select({ userId: eventRegistrations.userId }).from(eventRegistrations).where(and(eq(eventRegistrations.eventId, e.id), sql`${eventRegistrations.status} <> 'cancelled'`)).orderBy(asc(eventRegistrations.userId));
  const jobKey = reminderKey(e.id, p.label, e.startsAt);
  for (const userIds of chunk(regs.map((r) => r.userId), opts.chunkSize ?? FANOUT_CHUNK)) {
    await ctx.queue.enqueue('event.remind.batch', { eventId: e.id, label: p.label, jobKey, userIds }, { dedupeKey: `${jobKey}:${userIds[0]}` });
  }
  return 'sent';
}

const whenOf = (label: string) => (label === 'start' ? 'ngay bây giờ' : label === '1h' ? 'sau 1 giờ' : label === '15m' ? 'sau 15 phút' : 'vào ngày mai');

/** Một lô: claim từng người rồi thông báo và gửi email. Chạy trong transaction của job (xem claimRecipients). */
export async function runEventReminderBatch(ctx: Ctx, p: { eventId: string; label: string; jobKey: string; userIds: string[] }): Promise<'sent' | 'stale'> {
  const e = await ctx.db.query.events.findFirst({ where: eq(events.id, p.eventId) });
  const stale = reminderStale(e, p.label);
  if (stale || !e) {
    ctx.log.info('job.stale', { job: { name: 'event.remind.batch', status: 'stale' }, reason: stale, eventId: p.eventId, label: p.label });
    return 'stale';
  }
  const claimed = await claimRecipients(ctx, p.jobKey, p.userIds);
  if (!claimed.length) return 'sent';
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, e.communityId) });
  const recipients = await ctx.db.select().from(users).where(inArray(users.id, claimed));
  const when = whenOf(p.label);
  for (const u of recipients) {
    await notify(ctx, { userId: u.id, communityId: e.communityId, kind: 'event.reminder', category: 'event', title: `Sự kiện ${e.title} bắt đầu ${when}`, link: `/${community?.slug}/su-kien/${e.id}`, actionLabel: 'Vào phòng' });
    await ctx.email.send(templates.eventReminder(u.email, u.name, e.title, when, `${ctx.env.APP_URL}/${community?.slug}/su-kien/${e.id}`));
  }
  return 'sent';
}
