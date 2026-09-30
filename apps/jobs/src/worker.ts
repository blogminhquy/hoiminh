// Worker hoiminh-jobs: việc chạy nền, tách khỏi Worker phục vụ người dùng.
// - queue: tiêu thụ hàng đợi hoiminh-jobs (email, webhook ra ngoài, job hẹn giờ...) và hoiminh-jobs-dlq (job hết lượt retry).
// - scheduled: cron 10 phút (xếp hạng + bộ quét thưa) và 01:00 giờ Việt Nam (xem wrangler.toml). Không còn cron mỗi phút.
// Secret lấy từ hoiminh-api qua binding SHARED_ENV, nên Worker này không cần đặt secret riêng.
import { createWorkerApp, processBatch, processDeadLetters, runCron, withSharedEnv, type Job, type SharedEnvSource, type WorkerBindings } from '@hoiminh/core';

type JobsBindings = WorkerBindings & { SHARED_ENV?: SharedEnvSource };

const DLQ_NAME = 'hoiminh-jobs-dlq';

const openApp = async (env: JobsBindings) => createWorkerApp(await withSharedEnv(env, env.SHARED_ENV));

export default {
  async queue(batch: MessageBatch<Job>, env: JobsBindings): Promise<void> {
    const app = await openApp(env);
    try {
      if (batch.queue === DLQ_NAME) await processDeadLetters(app.ctx, batch.messages);
      else await processBatch(app.ctx, batch.messages);
    } finally {
      await app.close().catch(() => undefined);
    }
  },
  async scheduled(event: ScheduledEvent, env: JobsBindings, ctx: ExecutionContext): Promise<void> {
    const app = await openApp(env);
    const name = event.cron === '0 18 * * *' ? 'daily' : 'every_10_minutes';
    ctx.waitUntil(runCron(app.ctx, name).finally(() => app.close().catch(() => undefined)));
  },
};
