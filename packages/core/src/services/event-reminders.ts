// Hẹn nhắc cho một sự kiện: gọi khi tạo hoặc sửa giờ / danh sách nhắc / trạng thái, thay cho việc cron quét cả bảng mỗi phút.
import { and, asc, eq, gt, gte, lte, or } from 'drizzle-orm';
import { events } from '@hoiminh/db';
import type { Ctx } from '../context';
import { reminderKey, reminderRunAt } from '../jobs/event-reminders';
import { scheduleJob } from '../jobs/scheduled';

/**
 * Mỗi nhãn còn ở tương lai thành một job `event.remind` (khử trùng theo sự kiện + nhãn + phút bắt đầu).
 * Còn ≤ 24 giờ thì vào Queue với delay ngay sau commit; xa hơn thì nằm ở DB chờ bộ quét. Trả về số job mới.
 * Sửa giờ thì khóa đổi nên sinh job mới; job cũ tự vô hiệu ở bước kiểm tra khi chạy (reminderStale).
 */
export async function scheduleRemindersForEvent(ctx: Ctx, e: Pick<typeof events.$inferSelect, 'id' | 'startsAt' | 'reminders' | 'status'>): Promise<number> {
  if (e.status !== 'scheduled') return 0;
  const now = ctx.now();
  let n = 0;
  for (const label of e.reminders) {
    const runAt = reminderRunAt(e.startsAt, label);
    if (!runAt || runAt < now) continue;
    const id = await scheduleJob(ctx, { kind: 'event.remind', payload: { eventId: e.id, label, runAt: runAt.toISOString() }, dedupeKey: reminderKey(e.id, label, e.startsAt), runAt });
    if (id) n++;
  }
  return n;
}

const RECONCILE_PAGE = 500;
const RECONCILE_MAX_ROUNDS = 20;

/**
 * Đối soát hằng ngày: sự kiện `scheduled` bắt đầu trong `horizonDays` ngày tới mà thiếu job nhắc thì hẹn bổ sung.
 * Cần cho sự kiện tạo trước khi có cơ chế hẹn lúc tạo, và là lưới an toàn nếu một lần hẹn bị lỡ. Idempotent (khóa khử trùng),
 * chỉ đụng một khoảng thời gian có index (`events_scheduled_start_idx`), không quét cả bảng. Trả về số job mới.
 */
export async function reconcileEventReminders(ctx: Ctx, opts: { horizonDays?: number } = {}): Promise<number> {
  const now = ctx.now();
  const horizon = new Date(now.getTime() + (opts.horizonDays ?? 3) * 86_400_000);
  let total = 0;
  let after: { id: string; startsAt: Date } | null = null;
  for (let round = 0; round < RECONCILE_MAX_ROUNDS; round++) {
    const rows: Array<typeof events.$inferSelect> = await ctx.db
      .select()
      .from(events)
      .where(and(eq(events.status, 'scheduled'), gte(events.startsAt, now), lte(events.startsAt, horizon), after ? or(gt(events.startsAt, after.startsAt), and(eq(events.startsAt, after.startsAt), gt(events.id, after.id))) : undefined))
      .orderBy(asc(events.startsAt), asc(events.id))
      .limit(RECONCILE_PAGE);
    for (const e of rows) total += await scheduleRemindersForEvent(ctx, e);
    if (rows.length < RECONCILE_PAGE) break;
    const last = rows[rows.length - 1]!;
    after = { id: last.id, startsAt: last.startsAt };
  }
  if (total) ctx.log.info('reminders.reconciled', { scheduled: total });
  return total;
}
