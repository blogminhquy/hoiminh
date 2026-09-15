// Cloudflare Worker: fetch (API), queue (job consumer), scheduled (cron triggers). DB qua Hyperdrive.
//
// Không cache App giữa các request: kết nối Postgres là một socket, mà Workers cấm dùng socket mở ở
// request này cho request khác ("Cannot perform I/O on behalf of a different request"). Vì vậy mỗi
// lần gọi dựng App mới — phần ngoài DB chỉ là tạo object, còn postgres-js kết nối lười và Hyperdrive
// giữ sẵn pool ở phía Cloudflare nên bắt tay gần như không tốn gì.
import { loadEnv } from '@hoiminh/config';
import { CloudflareQueue, createApp, createJobHandler, runCron, type App, type Job } from '@hoiminh/core';
import { createHonoApp } from './app';

interface WorkerEnv extends Record<string, unknown> {
  JOBS: Queue<Job>;
  HYPERDRIVE?: { connectionString: string };
}

async function build(env: WorkerEnv): Promise<{ app: App; hono: ReturnType<typeof createHonoApp> }> {
  const raw = { ...(env as Record<string, string | undefined>) };
  // Hyperdrive gộp kết nối phía Cloudflare; không có binding thì dùng thẳng DATABASE_URL (pooler Supabase).
  if (env.HYPERDRIVE?.connectionString) raw.DATABASE_URL = env.HYPERDRIVE.connectionString;
  const parsed = loadEnv(raw);
  const app = await createApp({ env: parsed, queue: new CloudflareQueue(env.JOBS as unknown as { send(body: Job): Promise<void> }), migrate: false });
  return { app, hono: createHonoApp(app) };
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const { app, hono } = await build(env);
    const res = await hono.fetch(request, env, ctx);
    ctx.waitUntil(app.close().catch(() => undefined));
    return res;
  },
  async queue(batch: MessageBatch<Job>, env: WorkerEnv): Promise<void> {
    const { app } = await build(env);
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
  async scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    const { app } = await build(env);
    const name = event.cron === '*/10 * * * *' ? 'every_10_minutes' : event.cron === '0 18 * * *' ? 'daily' : 'every_minute';
    ctx.waitUntil(runCron(app.ctx, name).finally(() => app.close().catch(() => undefined)));
  },
};
