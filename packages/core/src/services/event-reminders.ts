// Hẹn nhắc cho một sự kiện: gọi khi tạo hoặc sửa giờ / danh sách nhắc / trạng thái, thay cho việc cron quét cả bảng mỗi phút.
import type { events } from '@hoiminh/db';
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
