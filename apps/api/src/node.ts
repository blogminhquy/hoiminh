// Chạy API trên Node cho local dev: PGlite, hàng đợi in-memory, cron bằng setInterval, lưu tệp .data/files.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { config as loadDotenv } from 'dotenv';
import { loadEnv } from '@hoiminh/config';
import { createApp, runCron } from '@hoiminh/core';
import { createHonoApp } from './app';

const root = resolve(process.cwd(), '..', '..');
const envFile = resolve(root, '.env');
if (existsSync(envFile)) loadDotenv({ path: envFile });
const env = loadEnv(process.env);
if (env.DATABASE_URL.startsWith('pglite://./')) env.DATABASE_URL = 'pglite://' + resolve(root, env.DATABASE_URL.slice('pglite://'.length));

const app = await createApp({ env, migrate: true });
const hono = createHonoApp(app);

const timers = [
  setInterval(() => void runCron(app.ctx, 'every_minute').catch((e) => app.ctx.log.error('cron.minute', { e: String(e) })), 60_000),
  setInterval(() => void runCron(app.ctx, 'every_10_minutes').catch((e) => app.ctx.log.error('cron.10m', { e: String(e) })), 10 * 60_000),
  setInterval(() => void runCron(app.ctx, 'daily').catch((e) => app.ctx.log.error('cron.daily', { e: String(e) })), 24 * 3_600_000),
];
setTimeout(() => void runCron(app.ctx, 'every_minute').catch(() => null), 5_000);
setTimeout(() => void runCron(app.ctx, 'every_10_minutes').catch(() => null), 8_000);
setTimeout(() => void runCron(app.ctx, 'daily').catch(() => null), 12_000);

const server = serve({ fetch: hono.fetch, port: env.API_PORT }, (info) => {
  app.ctx.log.info(`API Hội Mình chạy tại http://localhost:${info.port} · DB ${env.DATABASE_URL.startsWith('pglite') ? 'PGlite' : 'PostgreSQL'} · auth ${env.AUTH_PROVIDER} · email ${env.RESEND_API_KEY ? 'Resend' : 'log'}`);
});

const shutdown = async () => {
  for (const t of timers) clearInterval(t);
  server.close();
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
