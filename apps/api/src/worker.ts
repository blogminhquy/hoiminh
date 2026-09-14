// Cloudflare Worker: fetch (API), queue (job consumer), scheduled (cron triggers). DB qua Supabase pooler.
import { loadEnv } from '@hoiminh/config';
import { CloudflareQueue, createApp, createJobHandler, runCron, type App, type Job } from '@hoiminh/core';
import { createHonoApp } from './app';

interface WorkerEnv extends Record<string, unknown> {
  JOBS: Queue<Job>;
}

let cached: Promise<{ app: App; hono: ReturnType<typeof createHonoApp> }> | null = null;

async function boot(env: WorkerEnv) {
  if (!cached) {
    cached = (async () => {
      const parsed = loadEnv(env as Record<string, string | undefined>);
      const app = await createApp({ env: parsed, queue: new CloudflareQueue(env.JOBS as unknown as { send(body: Job): Promise<void> }), migrate: false });
      return { app, hono: createHonoApp(app) };
    })();
  }
  return cached;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const { hono } = await boot(env);
    return hono.fetch(request, env, ctx);
  },
  async queue(batch: MessageBatch<Job>, env: WorkerEnv): Promise<void> {
    const { app } = await boot(env);
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
  },
  async scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    const { app } = await boot(env);
    const name = event.cron === '*/10 * * * *' ? 'every_10_minutes' : event.cron === '0 18 * * *' ? 'daily' : 'every_minute';
    ctx.waitUntil(runCron(app.ctx, name));
  },
};
