// Xác thực: Bearer JWT phiên (web) hoặc API key hm_… (tích hợp, MCP). Không có token → anonymous.
import { apiKeys as apiKeySvc, auth as authSvc, unauthorized, type App, type Ctx } from '@hoiminh/core';
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/hono';

/** Gắn ctx vào mỗi request; xác thực nếu có Authorization. */
export function authMiddleware(app: App): MiddlewareHandler<Env> {
  return async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const base: Ctx = { ...app.ctx, actor: { type: 'anonymous' }, requestId, ipHash: ip ? await hashIp(ip) : undefined };
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    let ctx = base;
    if (token.startsWith('hm_')) {
      const actor = await apiKeySvc.authenticateApiKey(base, token);
      if (!actor) throw unauthorized('API key không hợp lệ hoặc đã thu hồi');
      ctx = { ...base, actor };
    } else if (token) {
      const session = await authSvc.authenticate(base, app.auth, token);
      if (session) {
        ctx = { ...base, actor: { type: 'user', userId: session.userId, isSuperAdmin: session.user.isSuperAdmin, email: session.user.email } };
        c.set('sessionId', session.sessionId);
      }
    }
    c.set('app', app);
    c.set('ctx', ctx);
    c.header('x-request-id', requestId);
    await next();
    if (ctx.actor.type === 'api_key') await apiKeySvc.logApiKeyUse(ctx, ctx.actor.apiKeyId, c.req.method, new URL(c.req.url).pathname, c.res.status).catch(() => null);
  };
}

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Bắt buộc đăng nhập. */
export const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  const ctx = c.get('ctx');
  if (ctx.actor.type === 'anonymous') throw unauthorized();
  await next();
};
