// Lắp ráp Hono app: middleware, route /v1, webhook, /r, /files, /pay/simulator, /health.
import type { App } from '@hoiminh/core';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './lib/hono';
import { authMiddleware } from './middleware/auth';
import { errorHandler, requestLog } from './middleware/common';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { commerceRoutes } from './routes/commerce';
import { communityRoutes } from './routes/communities';
import { contentRoutes } from './routes/content';
import { eventRoutes } from './routes/events';
import { learningRoutes } from './routes/learning';
import { meRoutes } from './routes/me';
import { memberRoutes } from './routes/members';
import { payerRoutes, refRoutes } from './routes/payer';
import { localFilesRoutes, platformRoutes } from './routes/platform';
import { streamRoutes } from './routes/stream';
import { simulatorRoutes, webhookRoutes } from './routes/webhooks';

/** Tạo Hono app từ App (core). Dùng chung cho Node và Cloudflare Worker. */
export function createHonoApp(app: App): Hono<Env> {
  const h = new Hono<Env>();
  h.onError(errorHandler(app.ctx.log));
  h.use('*', cors({ origin: (origin) => origin || app.ctx.env.APP_URL, credentials: true, allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'], exposeHeaders: ['X-Request-Id'] }));
  h.use('*', authMiddleware(app));
  h.use('*', requestLog(app.ctx.log));

  h.get('/health', async (c) => {
    const started = Date.now();
    let db: 'ok' | 'error' = 'ok';
    try {
      await app.ctx.db.execute(sql`select 1`);
    } catch {
      db = 'error';
    }
    return c.json({ status: db === 'ok' ? 'ok' : 'degraded', db, realtimeConnections: app.ctx.realtime.connectionCount(), latencyMs: Date.now() - started, env: app.ctx.env.APP_ENV, version: '1.0.0', time: new Date().toISOString() }, db === 'ok' ? 200 : 503);
  });

  h.route('/v1/auth', authRoutes);
  h.route('/v1/me', meRoutes);
  h.route('/v1/me', streamRoutes);
  h.route('/v1/communities', communityRoutes);
  h.route('/v1/communities', memberRoutes);
  h.route('/v1', contentRoutes);
  h.route('/v1', learningRoutes);
  h.route('/v1', eventRoutes);
  h.route('/v1', commerceRoutes);
  h.route('/v1', payerRoutes);
  h.route('/v1', platformRoutes);
  h.route('/v1/admin', adminRoutes);
  h.route('/webhooks', webhookRoutes);
  h.route('/pay/simulator', simulatorRoutes);
  h.route('/r', refRoutes);
  h.route('/files', localFilesRoutes);
  h.notFound((c) => c.json({ code: 'not_found', message: `Không có đường dẫn ${c.req.method} ${c.req.path}` }, 404));
  return h;
}
