// Lịch chạy định kỳ, chỉ là lưới an toàn của mô hình event-driven (việc chạy nền đi theo sự kiện qua Queue, không quét):
// 10 phút (xếp hạng + bộ quét thưa), hằng ngày (hold, churn, gói nền tảng, tệp tải dở, dọn bảng job, đối soát nhắc sự kiện).
import { systemCtx, type AppContext, type Ctx } from '../context';
import { withSystemScope } from '../lib/tenant-scope';
import { releaseDueCommissions, snapshotLeaderboards } from '../services/affiliate';
import { expireEntitlements } from '../services/entitlements';
import { reconcileEventReminders } from '../services/event-reminders';
import { sweepAbandonedUploads } from '../services/files';
import { runPlatformBillingCron } from '../services/platform-billing';
import { churnExpired } from '../services/subscriptions';
import { cleanupJobRecords } from './cleanup';
import { runSweep } from './sweep';

export type CronName = 'every_10_minutes' | 'daily';

/** Lịch trong `apps/jobs/wrangler.toml` → nhóm việc. Đổi một bên thì phải đổi bên kia (test cron-config kiểm tra). */
const SCHEDULES: Record<string, CronName> = { '*/10 * * * *': 'every_10_minutes', '0 18 * * *': 'daily' };

/**
 * Lịch cron của sự kiện `scheduled` → nhóm việc, hoặc null nếu lạ. Lịch lạ là trigger cũ còn sót ở phía Cloudflare sau khi
 * đã gỡ khỏi wrangler.toml (cập nhật lịch có thể chậm vài phút): phải bỏ qua, không được chạy nhầm bộ quét và xếp hạng mỗi phút.
 */
export function cronNameFor(expr: string): CronName | null {
  return SCHEDULES[expr] ?? null;
}

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
  if (name === 'every_10_minutes') {
    // Lưới an toàn của mô hình event-driven: đẩy job hẹn giờ sắp tới hạn, cứu message bị mất, dọn cờ hết hạn đơn và trạng thái sự kiện.
    await step('sweep', async (ctx) => {
      const sweep = await runSweep(ctx);
      out.sweepPushed = sweep.pushed;
      out.sweepRequeued = sweep.requeued;
      out.sweepWebhooks = sweep.webhookRequeued;
      out.ordersExpired = sweep.ordersExpired;
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
    // Đối soát: sự kiện sắp diễn ra mà chưa có job nhắc (tạo trước khi có cơ chế hẹn lúc tạo, hoặc hẹn bị lỡ).
    await step('reconcile', async (ctx) => {
      out.remindersReconciled = await reconcileEventReminders(ctx);
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
