// Lắp ráp Hono app: middleware, route /v1, webhook, /r, /files, /pay/simulator, /health.
import { admin, type App } from '@hoiminh/core';
import { APP_VERSION } from '@hoiminh/config';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './lib/hono';
import { authMiddleware } from './middleware/auth';
import { errorHandler, requestLog } from './middleware/common';
import { publicCache } from './middleware/public-cache';
import { rateLimit } from './middleware/rate-limit';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { commerceRoutes } from './routes/commerce';
import { communityRoutes } from './routes/communities';
import { contentRoutes } from './routes/content';
import { eventRoutes } from './routes/events';
import { learningRoutes } from './routes/learning';
import { meRoutes } from './routes/me';
import { realtimeRoutes } from './routes/realtime';
import { memberRoutes } from './routes/members';
import { payerRoutes, refRoutes } from './routes/payer';
import { localFilesRoutes, platformRoutes } from './routes/platform';
import { simulatorRoutes, webhookRoutes } from './routes/webhooks';

/** Tạo Hono app từ App (core). Dùng chung cho Node và Cloudflare Worker. */
export function createHonoApp(app: App): Hono<Env> {
  const h = new Hono<Env>();
  h.onError(errorHandler(app.ctx.log));
  // Web gọi API cùng tên miền nên không cần CORS. Chỉ mở cho chính web (APP_URL và bản www), để trang lạ
  // không đọc được phản hồi kèm cookie của người dùng. Gọi từ máy chủ (API key, MCP) không bị CORS ảnh hưởng.
  const appOrigin = new URL(app.ctx.env.APP_URL);
  const allowed = new Set([appOrigin.origin, `${appOrigin.protocol}//www.${appOrigin.host}`]);
  h.use('*', cors({ origin: (origin) => (allowed.has(origin) ? origin : null), credentials: true, allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-HM-Auth'], exposeHeaders: ['X-Request-Id'] }));
  // Trước authMiddleware: lượt trúng cache không mở transaction database.
  h.use('/v1/*', publicCache(60));
  // Giới hạn chung, trước authMiddleware: request bị chặn không mở transaction database.
  h.use('/v1/*', rateLimit('api', { scope: 'api' }));
  h.use('*', authMiddleware(app));
  h.use('*', requestLog(app.ctx.log));

  h.get('/health', async (c) => {
    const started = Date.now();
    let db: 'ok' | 'error' = 'ok';
    try {
      // Dùng ctx của request: nó là transaction có biến phiên, không phải kết nối gốc.
      await c.get('ctx').db.execute(sql`select 1`);
    } catch {
      db = 'error';
    }
    const infra = admin.infraStatus(c.get('ctx'));
    return c.json({ status: db === 'ok' ? 'ok' : 'degraded', db, email: infra.email, media: infra.media, latencyMs: Date.now() - started, env: app.ctx.env.APP_ENV, version: APP_VERSION, time: new Date().toISOString() }, db === 'ok' ? 200 : 503);
  });

  h.route('/v1/auth', authRoutes);
  h.route('/v1/me', meRoutes);
  h.route('/v1/realtime', realtimeRoutes);
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
