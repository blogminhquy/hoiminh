// Xác thực: cookie httpOnly hm_at (web), Bearer JWT (ứng dụng ngoài) hoặc API key hm_… (tích hợp, MCP). Không có → anonymous.
import { apiKeys as apiKeySvc, auth as authSvc, forbidden, unauthorized, withSystemScope, withTenantScope, type App, type Ctx } from '@hoiminh/core';
import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../lib/hono';
import { ACCESS_COOKIE, readCookie, sameOriginWrite } from '../lib/session-cookie';
import { apiKeyAccess } from './api-key-access';

/** Đường dẫn máy-với-máy: chạy dưới quyền hệ thống thay vì theo actor. */
const SYSTEM_PATHS = ['/webhooks', '/pay/simulator', '/r', '/files', '/health'];
/**
 * Đường dẫn chỉ gọi dịch vụ ngoài và không đụng database: vẫn xác thực như thường nhưng không mở transaction,
 * để không giữ một kết nối database trong lúc chờ bên ngoài trả lời. Handler ở đây không được truy vấn database.
 * `/mcp` nằm ở đây vì mỗi lệnh của nó gọi lại chính API này (mỗi lượt gọi tự mở transaction của mình).
 */
const NO_DB_PATHS = ['/v1/video/meta', '/mcp'];

/**
 * Gắn ctx vào mỗi request; xác thực nếu có Authorization hoặc cookie phiên.
 * Nhận hàm lấy App theo request (không phải một App cố định), vì trên Worker một Hono app phục vụ mọi request
 * còn App thì mỗi request một cái (xem `fetchWithSharedHono` ở app.ts).
 */
export function authMiddleware(appOf: (c: Context<Env>) => App): MiddlewareHandler<Env> {
  return async (c, next) => {
    const app = appOf(c);
    const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const base: Ctx = { ...app.ctx, actor: { type: 'anonymous' }, requestId, ipHash: ip ? await hashIp(ip) : undefined };
    c.set('app', app);
    const path = new URL(c.req.url).pathname;
    const machine = SYSTEM_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
    const header = c.req.header('authorization') ?? '';
    // Bearer (API key, ứng dụng ngoài) được ưu tiên; web dùng cookie httpOnly. Đường máy-với-máy
    // không cần biết người dùng nên bỏ qua cookie (trang mô phỏng thanh toán gửi form từ chính API).
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const fromCookie = !bearer && !machine ? readCookie(c, ACCESS_COOKIE) ?? '' : '';
    const token = bearer || fromCookie;
    if (fromCookie && !sameOriginWrite(c)) throw forbidden('Yêu cầu không đến từ trang Hội Mình');
    let ctx = base;
    if (token.startsWith('hm_')) {
      const actor = await apiKeySvc.authenticateApiKey(base, token);
      if (!actor) throw unauthorized('API key không hợp lệ hoặc đã thu hồi');
      ctx = { ...base, actor };
      // Key chỉ vào được đường dẫn có trong bảng và đúng phạm vi (mặc định chặn). Lượt bị chặn vẫn ghi nhật ký để chủ hội thấy.
      const access = actor.type === 'api_key' ? apiKeyAccess(c.req.method, path, actor.scopes) : { ok: true as const };
      if (!access.ok) {
        if (actor.type === 'api_key') await apiKeySvc.logApiKeyUse(base, actor.apiKeyId, c.req.method, path, 403).catch(() => null);
        throw forbidden(access.message);
      }
    } else if (token) {
      const session = await authSvc.authenticate(base, app.auth, token);
      if (session) {
        ctx = { ...base, actor: { type: 'user', userId: session.userId, isSuperAdmin: session.user.isSuperAdmin, email: session.user.email } };
        c.set('sessionId', session.sessionId);
      }
    }
    c.header('x-request-id', requestId);
    // Mọi truy vấn của request chạy trong một transaction có biến phiên của actor (RLS).
    // Điểm vào máy-với-máy không có actor mà vẫn phải ghi xuyên tenant: webhook cổng
    // thanh toán, trang mô phỏng sandbox, đếm lượt bấm link affiliate, phát tệp theo URL ký.
    if (NO_DB_PATHS.includes(path)) {
      c.set('ctx', ctx);
      await next();
    } else {
      const run = machine ? withSystemScope : withTenantScope;
      await run(ctx, async (scoped) => {
        c.set('ctx', scoped);
        await next();
      });
    }
    // Ghi nhật ký dùng API key sau khi transaction đã đóng, nên dùng ctx gốc.
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
