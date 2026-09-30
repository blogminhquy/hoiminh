// Lịch chạy định kỳ, chỉ là lưới an toàn của mô hình event-driven (việc chạy nền đi theo sự kiện qua Queue, không quét):
// 10 phút (xếp hạng + bộ quét thưa), hằng ngày (hold, churn, gói nền tảng, tệp tải dở, dọn bảng job, đối soát nhắc sự kiện).
import { systemCtx, type AppContext } from '../context';
import { withSystemScope } from '../lib/tenant-scope';
import { releaseDueCommissions, snapshotLeaderboards } from '../services/affiliate';
import { expireEntitlements } from '../services/entitlements';
import { sweepAbandonedUploads } from '../services/files';
import { runPlatformBillingCron } from '../services/platform-billing';
import { reconcileEventReminders } from '../services/event-reminders';
import { churnExpired } from '../services/subscriptions';
import { cleanupJobRecords } from './cleanup';
import { runSweep } from './sweep';

export type CronName = 'every_10_minutes' | 'daily';

/** Chạy một nhóm cron trong một transaction có biến phiên bypass. Trả về tóm tắt để log. */
export async function runCron(app: AppContext, name: CronName): Promise<Record<string, number>> {
  return withSystemScope(systemCtx(app, `cron-${name}`), async (ctx) => {
  const out: Record<string, number> = {};
  if (name === 'every_10_minutes') {
    out.leaderboard = await snapshotLeaderboards(ctx);
    // Lưới an toàn của mô hình event-driven: đẩy job hẹn giờ sắp tới hạn, cứu message bị mất, dọn cờ.
    const sweep = await runSweep(ctx);
    out.sweepPushed = sweep.pushed;
    out.sweepRequeued = sweep.requeued;
    out.sweepWebhooks = sweep.webhookRequeued;
    out.ordersExpired = sweep.ordersExpired;
  }
  if (name === 'daily') {
    out.commissionsReleased = await releaseDueCommissions(ctx);
    out.churned = await churnExpired(ctx);
    out.entitlementsExpired = await expireEntitlements(ctx);
    out.abandonedUploads = await sweepAbandonedUploads(ctx);
    // Đối soát: sự kiện sắp diễn ra mà chưa có job nhắc (tạo trước khi có cơ chế hẹn lúc tạo, hoặc hẹn bị lỡ).
    out.remindersReconciled = await reconcileEventReminders(ctx);
    const cleaned = await cleanupJobRecords(ctx);
    out.jobRecordsCleaned = cleaned.recipients + cleaned.jobs;
    const b = await runPlatformBillingCron(ctx);
    out.trialReminded = b.reminded;
    out.workspacesLocked = b.locked;
  }
  ctx.log.info(`cron.${name}`, out);
  return out;
  });
}
