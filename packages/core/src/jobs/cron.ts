// Lịch chạy định kỳ: mỗi phút (đường dự phòng của Queue: job hẹn giờ, nhắc sự kiện, hết hạn đơn, retry webhook; gỡ ở Phase 6),
// 10 phút (xếp hạng + bộ quét thưa), hằng ngày (hold, churn, gói nền tảng, tệp tải dở, dọn bảng job).
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
import { cleanupJobRecords } from './cleanup';
import { reminderKey, reminderRunAt } from './event-reminders';
import { runKind } from './scheduled';
import { flipEventStatuses, runSweep } from './sweep';

export type CronName = 'every_minute' | 'every_10_minutes' | 'daily';

/**
 * Chạy một nhóm cron. Mỗi bước một transaction riêng: bước này lỗi thì chỉ rollback bước đó, các bước khác vẫn commit.
 * Quan trọng nhất là bộ quét (lưới an toàn) không được phụ thuộc vào việc chụp xếp hạng hay bước tiền chạy thành công.
 * Có bước lỗi thì ghi log `cron.step_failed` và ném lỗi đầu tiên sau khi mọi bước đã chạy, để Cloudflare ghi nhận lần chạy lỗi.
 */
export async function runCron(app: AppContext, name: CronName): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const failures: unknown[] = [];
  const step = async (label: string, fn: (ctx: Ctx) => Promise<void>) => {
    try {
      await withSystemScope(systemCtx(app, `cron-${name}-${label}`), fn);
    } catch (err) {
      failures.push(err);
      app.log.error('cron.step_failed', { cron: name, step: label, error: err instanceof Error ? { type: err.name, message: err.message } : { message: String(err) } });
    }
  };
  if (name === 'every_minute') {
    await step('legacy', async (ctx) => {
      out.scheduledJobs = await runScheduledJobs(ctx);
      out.eventReminders = await scheduleEventReminders(ctx);
      out.expiredOrders = await expirePendingOrders(ctx);
      out.webhookRetries = await retryDue(ctx);
    });
  }
  if (name === 'every_10_minutes') {
    // Lưới an toàn của mô hình event-driven: đẩy job hẹn giờ sắp tới hạn, cứu message bị mất, dọn cờ.
    await step('sweep', async (ctx) => {
      const sweep = await runSweep(ctx);
      out.sweepPushed = sweep.pushed;
      out.sweepRequeued = sweep.requeued;
      out.sweepWebhooks = sweep.webhookRequeued;
    });
    await step('leaderboard', async (ctx) => {
      out.leaderboard = await snapshotLeaderboards(ctx);
    });
  }
  if (name === 'daily') {
    // Các bước liên quan tới tiền và quyền giữ chung một transaction như trước đây.
    await step('core', async (ctx) => {
      out.commissionsReleased = await releaseDueCommissions(ctx);
      out.churned = await churnExpired(ctx);
      out.entitlementsExpired = await expireEntitlements(ctx);
      out.abandonedUploads = await sweepAbandonedUploads(ctx);
      const b = await runPlatformBillingCron(ctx);
      out.trialReminded = b.reminded;
      out.workspacesLocked = b.locked;
    });
    await step('cleanup', async (ctx) => {
      const cleaned = await cleanupJobRecords(ctx);
      out.jobRecordsCleaned = cleaned.recipients + cleaned.jobs;
    });
  }
  app.log.info(`cron.${name}`, out);
  if (failures.length) throw failures[0];
  return out;
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
