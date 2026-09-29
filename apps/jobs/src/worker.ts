// Worker hoiminh-jobs: việc chạy nền, tách khỏi Worker phục vụ người dùng.
// - queue: tiêu thụ hàng đợi hoiminh-jobs (email, webhook ra ngoài, job hẹn giờ...).
// - scheduled: cron mỗi phút, 10 phút, và 01:00 giờ Việt Nam (xem wrangler.toml).
// Secret lấy từ hoiminh-api qua binding SHARED_ENV, nên Worker này không cần đặt secret riêng.
import { createJobHandler, createWorkerApp, runCron, withSharedEnv, type Job, type SharedEnvSource, type WorkerBindings } from '@hoiminh/core';

type JobsBindings = WorkerBindings & { SHARED_ENV?: SharedEnvSource };

const openApp = async (env: JobsBindings) => createWorkerApp(await withSharedEnv(env, env.SHARED_ENV));

export default {
  async queue(batch: MessageBatch<Job>, env: JobsBindings): Promise<void> {
    const app = await openApp(env);
    const handle = createJobHandler(app.ctx);
    for (const msg of batch.messages) {
      try {
        await handle(msg.body);
        msg.ack();
      } catch (err) {
        app.ctx.log.error('queue.job_failed', { name: msg.body.name, err: String(err) });
        msg.retry({ delaySeconds: 60 });
      }
    }
    await app.close().catch(() => undefined);
  },
  async scheduled(event: ScheduledEvent, env: JobsBindings, ctx: ExecutionContext): Promise<void> {
    const app = await openApp(env);
    const name = event.cron === '*/10 * * * *' ? 'every_10_minutes' : event.cron === '0 18 * * *' ? 'daily' : 'every_minute';
    ctx.waitUntil(runCron(app.ctx, name).finally(() => app.close().catch(() => undefined)));
  },
};
