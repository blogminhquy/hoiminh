// Bộ quét thưa (cron 10 phút): lưới an toàn của mô hình event-driven, không phải bộ lập lịch chính.
// Đẩy job hẹn giờ sắp tới hạn vào Queue, cứu message bị mất, và dọn cờ (hết hạn đơn, trạng thái sự kiện).
import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import { events, scheduledJobs, webhookDeliveries } from '@hoiminh/db';
import { systemCtx, type AppContext, type Ctx } from '../context';
import { expirePendingOrders } from '../services/payments';
import { MAX_DELAY_SECONDS } from './queue';

/** Mỗi trang 200 dòng, tối đa 5 vòng mỗi lần chạy: một lần quét không thể chiếm kết nối quá lâu. */
const PAGE = 200;
const MAX_ROUNDS = 5;
/** Dòng vừa tạo còn đang trên đường đẩy sau commit; chờ chừng này rồi mới coi là bị lọt. */
const FRESH_MS = 60_000;
/** Dòng enqueued quá hạn chừng này mà chưa chạy, và lần đẩy gần nhất cũng đã lâu, thì đẩy lại. */
const LOST_AFTER_MS = 15 * 60_000;
/** Webhook quá hạn retry chừng này mà chưa được giao thì đẩy lại. */
const WEBHOOK_LATE_MS = 5 * 60_000;

export interface SweepResult {
  pushed: number;
  requeued: number;
  webhookRequeued: number;
  ordersExpired: number;
  eventsFlipped: number;
}

/** Duyệt theo con trỏ (thời điểm, id) tối đa MAX_ROUNDS trang; `handle` trả về số dòng đã xử lý của trang. */
async function paged<T extends { id: string }>(load: (after: T | null) => Promise<T[]>, handle: (rows: T[]) => Promise<void>): Promise<number> {
  let after: T | null = null;
  let total = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const rows: T[] = await load(after);
    if (!rows.length) break;
    await handle(rows);
    total += rows.length;
    if (rows.length < PAGE) break;
    after = rows[rows.length - 1]!;
  }
  return total;
}

/** Bước 1: dòng pending sắp tới hạn (≤ 24 giờ) → đẩy vào Queue với delay còn lại. */
async function pushDueJobs(ctx: Ctx): Promise<number> {
  const now = ctx.now();
  const horizon = new Date(now.getTime() + MAX_DELAY_SECONDS * 1000);
  const fresh = new Date(now.getTime() - FRESH_MS);
  return paged(
    (after: { id: string; runAt: Date; dedupeKey: string | null } | null) =>
      ctx.db
        .select({ id: scheduledJobs.id, runAt: scheduledJobs.runAt, dedupeKey: scheduledJobs.dedupeKey })
        .from(scheduledJobs)
        .where(and(eq(scheduledJobs.status, 'pending'), lte(scheduledJobs.runAt, horizon), lt(scheduledJobs.createdAt, fresh), after ? or(gt(scheduledJobs.runAt, after.runAt), and(eq(scheduledJobs.runAt, after.runAt), gt(scheduledJobs.id, after.id))) : undefined))
        .orderBy(asc(scheduledJobs.runAt), asc(scheduledJobs.id))
        .limit(PAGE),
    async (rows) => {
      for (const r of rows) await ctx.queue.enqueue('scheduled.run', { jobId: r.id }, { delaySeconds: Math.max(0, Math.ceil((r.runAt.getTime() - now.getTime()) / 1000)), dedupeKey: r.dedupeKey ?? undefined });
    },
  );
}

/** Bước 2: dòng enqueued đã quá hạn từ lâu mà chưa chạy (Queue mất tin) → đẩy lại ngay. Handler khử trùng bằng claim. */
async function requeueLostJobs(ctx: Ctx): Promise<number> {
  const now = ctx.now();
  const cutoff = new Date(now.getTime() - LOST_AFTER_MS);
  return paged(
    (after: { id: string; runAt: Date; dedupeKey: string | null } | null) =>
      ctx.db
        .select({ id: scheduledJobs.id, runAt: scheduledJobs.runAt, dedupeKey: scheduledJobs.dedupeKey })
        .from(scheduledJobs)
        .where(and(eq(scheduledJobs.status, 'enqueued'), lt(scheduledJobs.runAt, cutoff), or(isNull(scheduledJobs.enqueuedAt), lt(scheduledJobs.enqueuedAt, cutoff)), after ? or(gt(scheduledJobs.runAt, after.runAt), and(eq(scheduledJobs.runAt, after.runAt), gt(scheduledJobs.id, after.id))) : undefined))
        .orderBy(asc(scheduledJobs.runAt), asc(scheduledJobs.id))
        .limit(PAGE),
    async (rows) => {
      for (const r of rows) {
        ctx.log.warn('sweep.requeue', { jobId: r.id, dedupeKey: r.dedupeKey });
        await ctx.queue.enqueue('scheduled.run', { jobId: r.id }, { delaySeconds: 0, dedupeKey: r.dedupeKey ?? undefined });
      }
    },
  );
}

/** Bước 4: webhook đã quá hạn retry mà chưa được giao (enqueue lọt hoặc consumer chết) → đẩy lại. */
async function requeueWebhooks(ctx: Ctx): Promise<number> {
  const cutoff = new Date(ctx.now().getTime() - WEBHOOK_LATE_MS);
  return paged(
    (after: { id: string; nextAttemptAt: Date | null } | null) =>
      ctx.db
        .select({ id: webhookDeliveries.id, nextAttemptAt: webhookDeliveries.nextAttemptAt })
        .from(webhookDeliveries)
        .where(and(inArray(webhookDeliveries.status, ['pending', 'failed']), lt(webhookDeliveries.nextAttemptAt, cutoff), after && after.nextAttemptAt ? or(gt(webhookDeliveries.nextAttemptAt, after.nextAttemptAt), and(eq(webhookDeliveries.nextAttemptAt, after.nextAttemptAt), gt(webhookDeliveries.id, after.id))) : undefined))
        .orderBy(asc(webhookDeliveries.nextAttemptAt), asc(webhookDeliveries.id))
        .limit(PAGE),
    async (rows) => {
      for (const r of rows) await ctx.queue.enqueue('webhook.deliver', { deliveryId: r.id });
    },
  );
}

/** Buổi đang diễn ra → live, đã qua → ended. Cột status chỉ để lọc và báo cáo; nơi hiển thị nên tính từ giờ. */
export async function flipEventStatuses(ctx: Ctx): Promise<number> {
  const now = ctx.now();
  const live = await ctx.db.update(events).set({ status: 'live' }).where(and(eq(events.status, 'scheduled'), lte(events.startsAt, now), gte(events.endsAt, now))).returning({ id: events.id });
  const ended = await ctx.db.update(events).set({ status: 'ended' }).where(and(inArray(events.status, ['scheduled', 'live']), lt(events.endsAt, now))).returning({ id: events.id });
  return live.length + ended.length;
}

/** Chạy toàn bộ bộ quét. Gọi trong withSystemScope (cron 10 phút) để message chỉ đi sau commit. */
export async function runSweep(appOrCtx: AppContext | Ctx): Promise<SweepResult> {
  const ctx = 'actor' in appOrCtx ? appOrCtx : systemCtx(appOrCtx, 'sweep');
  const started = Date.now();
  const result: SweepResult = { pushed: 0, requeued: 0, webhookRequeued: 0, ordersExpired: 0, eventsFlipped: 0 };
  result.pushed = await pushDueJobs(ctx);
  result.requeued = await requeueLostJobs(ctx);
  result.webhookRequeued = await requeueWebhooks(ctx);
  result.ordersExpired = await expirePendingOrders(ctx);
  result.eventsFlipped = await flipEventStatuses(ctx);
  ctx.log.info('sweep.done', { ...result, durationMs: Date.now() - started });
  return result;
}
