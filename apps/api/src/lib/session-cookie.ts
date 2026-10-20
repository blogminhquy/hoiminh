// Phiên đăng nhập của web nằm trong cookie httpOnly: JavaScript (kể cả mã độc lọt vào trang) không đọc được.
// Web gửi header `X-HM-Auth: cookie` thì nhận cookie và không thấy token trong JSON; ứng dụng khác
// (API key, MCP, e2e, app di động sau này) không gửi header đó nên vẫn nhận token trong body như cũ.
import type { AuthSession } from '@hoiminh/contracts';
import type { Context } from 'hono';
import type { Env } from './hono';

/** Token truy cập. Path=/ để mọi request của web đều mang theo. */
export const ACCESS_COOKIE = 'hm_at';
/** Token làm mới, chỉ gửi kèm các đường dẫn /v1/auth (làm mới, đăng xuất). */
export const REFRESH_COOKIE = 'hm_rt';
/** Cờ "đang đăng nhập" không chứa bí mật, để web biết có nên hỏi /v1/me hay không. */
export const HINT_COOKIE = 'hm_li';
const REFRESH_MAX_AGE = 30 * 86_400;

export function wantsCookie(c: Context<Env>): boolean {
  return c.req.header('x-hm-auth') === 'cookie';
}

export function readCookie(c: Context<Env>, name: string): string | null {
  const header = c.req.header('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function cookie(c: Context<Env>, name: string, value: string, opts: { maxAge: number; path: string; httpOnly: boolean }): string {
  const secure = c.get('app').ctx.env.APP_URL.startsWith('https://') ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=${opts.path}; Max-Age=${opts.maxAge}; SameSite=Lax${opts.httpOnly ? '; HttpOnly' : ''}${secure}`;
}

/** Đặt cookie phiên (khi web xin) và trả JSON; web không nhận token trong body. */
export function respondSession(c: Context<Env>, session: AuthSession, status: 200 | 201 = 200): Response {
  if (!wantsCookie(c)) return c.json(session, status);
  const accessAge = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
  c.header('Set-Cookie', cookie(c, ACCESS_COOKIE, session.accessToken, { maxAge: accessAge, path: '/', httpOnly: true }), { append: true });
  if (session.refreshToken) {
    c.header('Set-Cookie', cookie(c, REFRESH_COOKIE, session.refreshToken, { maxAge: REFRESH_MAX_AGE, path: '/v1/auth', httpOnly: true }), { append: true });
  }
  c.header('Set-Cookie', cookie(c, HINT_COOKIE, '1', { maxAge: session.refreshToken ? REFRESH_MAX_AGE : accessAge, path: '/', httpOnly: false }), { append: true });
  return c.json({ ...session, accessToken: '', refreshToken: null }, status);
}

/** Xóa cookie phiên (đăng xuất, phiên hết hạn). */
export function clearSessionCookies(c: Context<Env>): void {
  c.header('Set-Cookie', cookie(c, ACCESS_COOKIE, '', { maxAge: 0, path: '/', httpOnly: true }), { append: true });
  c.header('Set-Cookie', cookie(c, REFRESH_COOKIE, '', { maxAge: 0, path: '/v1/auth', httpOnly: true }), { append: true });
  c.header('Set-Cookie', cookie(c, HINT_COOKIE, '', { maxAge: 0, path: '/', httpOnly: false }), { append: true });
}

/** Trang được phép gửi request ghi kèm cookie phiên: chính web và tên miền API. */
export function trustedOrigins(c: Context<Env>): Set<string> {
  const env = c.get('app').ctx.env;
  const app = new URL(env.APP_URL);
  return new Set([app.origin, `${app.protocol}//www.${app.host}`, new URL(env.API_URL).origin]);
}

/**
 * Chống CSRF cho request ghi dùng cookie: trình duyệt luôn gửi Origin với POST/PUT/PATCH/DELETE, nên chỉ
 * nhận khi Origin (hoặc Referer, với trình duyệt cũ) là chính web. SameSite=Lax đã chặn phần lớn; đây là lớp thứ hai.
 */
export function sameOriginWrite(c: Context<Env>): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) return true;
  const allowed = trustedOrigins(c);
  const origin = c.req.header('origin');
  if (origin) return allowed.has(origin);
  const referer = c.req.header('referer');
  if (!referer) return false;
  try {
    return allowed.has(new URL(referer).origin);
  } catch {
    return false;
  }
}
