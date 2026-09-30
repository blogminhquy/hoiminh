// Lịch chạy định kỳ: mỗi phút (job hẹn giờ, nhắc sự kiện, hết hạn đơn), 10 phút (xếp hạng), hằng ngày (hold, churn, gói nền tảng, tệp tải dở).
import { and, eq, gte, lte } from 'drizzle-orm';
import { events, scheduledJobs } from '@hoiminh/db';
import { systemCtx, type AppContext, type Ctx } from '../context';
import { withSystemScope } from '../lib/tenant-scope';
import { releaseDueCommissions, snapshotLeaderboards } from '../services/affiliate';
import { expireEntitlements } from '../services/entitlements';
import { sweepAbandonedUploads } from '../services/files';
import { expirePendingOrders } from '../services/payments';
import { runPlatformBillingCron } from '../services/platform-billing';
import { churnExpired } from '../services/subscriptions';
import { retryDue } from '../services/webhooks-out';
import { reminderKey, reminderRunAt } from './event-reminders';
import { runKind } from './scheduled';
import { flipEventStatuses, runSweep } from './sweep';

export type CronName = 'every_minute' | 'every_10_minutes' | 'daily';

/** Chạy một nhóm cron trong một transaction có biến phiên bypass. Trả về tóm tắt để log. */
export async function runCron(app: AppContext, name: CronName): Promise<Record<string, number>> {
  return withSystemScope(systemCtx(app, `cron-${name}`), async (ctx) => {
  const out: Record<string, number> = {};
  if (name === 'every_minute') {
    out.scheduledJobs = await runScheduledJobs(ctx);
    out.eventReminders = await scheduleEventReminders(ctx);
    out.expiredOrders = await expirePendingOrders(ctx);
    out.webhookRetries = await retryDue(ctx);
  }
  if (name === 'every_10_minutes') {
    out.leaderboard = await snapshotLeaderboards(ctx);
    // Lưới an toàn của mô hình event-driven: đẩy job hẹn giờ sắp tới hạn, cứu message bị mất, dọn cờ.
    const sweep = await runSweep(ctx);
    out.sweepPushed = sweep.pushed;
    out.sweepRequeued = sweep.requeued;
    out.sweepWebhooks = sweep.webhookRequeued;
  }
  if (name === 'daily') {
    out.commissionsReleased = await releaseDueCommissions(ctx);
    out.churned = await churnExpired(ctx);
    out.entitlementsExpired = await expireEntitlements(ctx);
    out.abandonedUploads = await sweepAbandonedUploads(ctx);
    const b = await runPlatformBillingCron(ctx);
    out.trialReminded = b.reminded;
    out.workspacesLocked = b.locked;
  }
  ctx.log.info(`cron.${name}`, out);
  return out;
  });
}

/** Job hẹn giờ trong bảng scheduled_jobs (tin nhắn chào sau N phút, xóa tệp trên R2…). */
export async function runScheduledJobs(appOrCtx: AppContext | Ctx): Promise<number> {
  const ctx = 'actor' in appOrCtx ? appOrCtx : systemCtx(appOrCtx, 'cron-scheduled');
  const due = await ctx.db.query.scheduledJobs.findMany({ where: and(eq(scheduledJobs.status, 'pending'), lte(scheduledJobs.runAt, ctx.now())), limit: 100 });
  let n = 0;
  for (const j of due) {
    const claimed = await ctx.db.update(scheduledJobs).set({ status: 'running', attempts: j.attempts + 1 }).where(and(eq(scheduledJobs.id, j.id), eq(scheduledJobs.status, 'pending'))).returning({ id: scheduledJobs.id });
    if (!claimed.length) continue;
    try {
      await runKind(ctx, j);
      await ctx.db.update(scheduledJobs).set({ status: 'done', doneAt: ctx.now() }).where(eq(scheduledJobs.id, j.id));
      n++;
    } catch (err) {
      await ctx.db.update(scheduledJobs).set({ status: j.attempts + 1 >= 3 ? 'failed' : 'pending', lastError: String(err), runAt: new Date(ctx.now().getTime() + 60_000) }).where(eq(scheduledJobs.id, j.id));
    }
  }
  return n;
}

/** Đặt job nhắc cho các sự kiện sắp diễn ra (mỗi mốc một lần, dedupe theo eventId + mốc). */
export async function scheduleEventReminders(appOrCtx: AppContext | Ctx): Promise<number> {
  const ctx = 'actor' in appOrCtx ? appOrCtx : systemCtx(appOrCtx, 'cron-event-reminders');
  const horizon = new Date(ctx.now().getTime() + 25 * 3_600_000);
  const upcoming = await ctx.db.query.events.findMany({ where: and(eq(events.status, 'scheduled'), gte(events.startsAt, ctx.now()), lte(events.startsAt, horizon)) });
  let n = 0;
  for (const e of upcoming) {
    for (const label of e.reminders) {
      const runAt = reminderRunAt(e.startsAt, label);
      if (!runAt || e.remindersSent.includes(label) || runAt < ctx.now()) continue;
      // Cùng khóa và payload với scheduleRemindersForEvent (hẹn lúc tạo/sửa) nên không sinh job trùng khi chạy song song.
      const rows = await ctx.db.insert(scheduledJobs).values({ kind: 'event.remind', payload: { eventId: e.id, label, runAt: runAt.toISOString() }, dedupeKey: reminderKey(e.id, label, e.startsAt), runAt }).onConflictDoNothing().returning({ id: scheduledJobs.id });
      if (rows.length) n++;
    }
  }
  // Buổi đang diễn ra → live, đã qua → ended.
  await flipEventStatuses(ctx);
  return n;
}
