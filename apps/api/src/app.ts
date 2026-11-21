// Lắp ráp Hono app: middleware, route /v1, /mcp, webhook, /r, /files, /pay/simulator, /health.
import { admin, type App } from '@hoiminh/core';
import { APP_VERSION } from '@hoiminh/config';
import { sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './lib/hono';
import { authMiddleware } from './middleware/auth';
import { errorHandler, requestLog } from './middleware/common';
import { publicCache } from './middleware/public-cache';
import { rateLimit } from './middleware/rate-limit';
import { adminRoutes } from './routes/admin';
import { activationRoutes, automationRoutes, inboundRoutes } from './routes/automation';
import { authRoutes } from './routes/auth';
import { commerceRoutes } from './routes/commerce';
import { communityRoutes } from './routes/communities';
import { contentRoutes } from './routes/content';
import { eventRoutes } from './routes/events';
import { learningRoutes } from './routes/learning';
import { mountMcp } from './routes/mcp';
import { meRoutes } from './routes/me';
import { realtimeRoutes } from './routes/realtime';
import { memberRoutes } from './routes/members';
import { payerRoutes, refRoutes } from './routes/payer';
import { localFilesRoutes, platformRoutes } from './routes/platform';
import { simulatorRoutes, webhookRoutes } from './routes/webhooks';

/** App của một request: một App cố định (Node, test), hoặc hàm lấy App theo request (Worker). */
export type AppSource = App | ((c: Context<Env>) => App);

/** Tên miền được phép gọi kèm cookie, theo APP_URL. Tính một lần cho mỗi APP_URL thay vì mỗi request. */
const originsByAppUrl = new Map<string, Set<string>>();
function allowedOrigins(appUrl: string): Set<string> {
  let set = originsByAppUrl.get(appUrl);
  if (!set) {
    const appOrigin = new URL(appUrl);
    set = new Set([appOrigin.origin, `${appOrigin.protocol}//www.${appOrigin.host}`]);
    originsByAppUrl.set(appUrl, set);
  }
  return set;
}

/**
 * Tạo Hono app. Dùng chung cho Node và Cloudflare Worker.
 * Hono app không giữ App nào bên trong: mỗi request lấy App của mình qua `source`, nên dựng một lần là dùng mãi.
 */
export function createHonoApp(source: AppSource): Hono<Env> {
  const appOf = typeof source === 'function' ? source : () => source;
  const h = new Hono<Env>();
  h.onError(errorHandler((c) => appOf(c).ctx.log));
  // Web gọi API cùng tên miền nên không cần CORS. Chỉ mở cho chính web (APP_URL và bản www), để trang lạ
  // không đọc được phản hồi kèm cookie của người dùng. Gọi từ máy chủ (API key, MCP) không bị CORS ảnh hưởng.
  h.use('*', cors({ origin: (origin, c) => (allowedOrigins(appOf(c).ctx.env.APP_URL).has(origin) ? origin : null), credentials: true, allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-HM-Auth'], exposeHeaders: ['X-Request-Id'] }));
  // Trước authMiddleware: lượt trúng cache không mở transaction database.
  h.use('/v1/*', publicCache(60));
  // Giới hạn chung, trước authMiddleware: request bị chặn không mở transaction database.
  h.use('/v1/*', rateLimit('api', { scope: 'api' }));
  h.use('/mcp', rateLimit('api', { scope: 'mcp' }));
  h.use('*', authMiddleware(appOf));
  h.use('*', requestLog());

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
    return c.json({ status: db === 'ok' ? 'ok' : 'degraded', db, email: infra.email, media: infra.media, latencyMs: Date.now() - started, env: c.get('app').ctx.env.APP_ENV, version: APP_VERSION, time: new Date().toISOString() }, db === 'ok' ? 200 : 503);
  });

  h.route('/v1/auth', authRoutes);
  h.route('/v1/me', meRoutes);
  h.route('/v1/realtime', realtimeRoutes);
  h.route('/v1/communities', communityRoutes);
  h.route('/v1/communities', memberRoutes);
  h.route('/v1/communities', automationRoutes);
  h.route('/v1/activation', activationRoutes);
  h.route('/v1', contentRoutes);
  h.route('/v1', learningRoutes);
  h.route('/v1', eventRoutes);
  h.route('/v1', commerceRoutes);
  h.route('/v1', payerRoutes);
  h.route('/v1', platformRoutes);
  h.route('/v1/admin', adminRoutes);
  // MCP từ xa cho trợ lý AI: một URL và một API key, mỗi lệnh gọi lại REST /v1 ở trên.
  mountMcp(h);
  // Trước webhookRoutes: địa chỉ nhận của chủ hội có hạn mức riêng, không dùng chung bộ đếm với cổng thanh toán.
  h.route('/webhooks', inboundRoutes);
  h.route('/webhooks', webhookRoutes);
  h.route('/pay/simulator', simulatorRoutes);
  h.route('/r', refRoutes);
  h.route('/files', localFilesRoutes);
  h.notFound((c) => c.json({ code: 'not_found', message: `Không có đường dẫn ${c.req.method} ${c.req.path}` }, 404));
  return h;
}

/** Chỗ giấu App của request trong `env` đưa cho Hono. Lệnh MCP gọi lại `h.fetch` với cùng `c.env` nên vẫn thấy đúng App. */
const REQUEST_APP = Symbol('hoiminh.requestApp');
let sharedHono: Hono<Env> | undefined;

/**
 * Xử lý một request của Worker bằng Hono app dùng chung cho cả isolate.
 *
 * Trước đây mỗi request dựng lại Hono app: đăng ký hơn 350 route rồi biên dịch bộ định tuyến, tốn CPU ở mọi request
 * trong khi gói Workers miễn phí chỉ cho 10 ms. Route không đổi giữa các request, chỉ App là đổi (App giữ kết nối
 * Postgres, mà Workers cấm dùng socket của request này cho request khác), nên Hono app dựng một lần còn App đi theo `env`.
 */
export async function fetchWithSharedHono(app: App, request: Request, env: object, executionCtx?: unknown): Promise<Response> {
  sharedHono ??= createHonoApp((c) => (c.env as Record<symbol, App>)[REQUEST_APP]!);
  return sharedHono.fetch(request, { ...env, [REQUEST_APP]: app }, executionCtx as never);
}
