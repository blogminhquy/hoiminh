// Cache ở Cloudflare cho vài trang công khai mà khách chưa đăng nhập xem nhiều (khám phá hội,
// trang giới thiệu hội, bảng giá, hồ sơ công khai). Lượt trúng cache trả ngay, không mở transaction,
// không chạm database. Người đã đăng nhập (header Bearer hoặc cookie phiên) luôn đi thẳng, vì dữ liệu của họ khác nhau.
// Dữ liệu có thể cũ tối đa `seconds` giây với khách vãng lai; chủ hội sửa xong thấy ngay vì đã đăng nhập.
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/hono';
import { ACCESS_COOKIE, readCookie } from '../lib/session-cookie';

const PUBLIC_PATHS = [/^\/v1\/communities\/discover$/, /^\/v1\/communities\/by-slug\/[^/]+$/, /^\/v1\/plans$/, /^\/v1\/users\/[^/]+$/];

/** `caches.default` của Workers; không có ở Node và trong test (khi đó chỉ gắn header). */
function edgeCache(): Cache | null {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default ?? null;
}

export function publicCache(seconds = 60): MiddlewareHandler<Env> {
  return async (c, next) => {
    const url = new URL(c.req.url);
    // `ref` ghi nhận lượt giới thiệu của cộng sự, nên không được trả từ cache.
    if (c.req.method !== 'GET' || c.req.header('authorization') || readCookie(c, ACCESS_COOKIE) || url.searchParams.has('ref') || !PUBLIC_PATHS.some((r) => r.test(url.pathname))) return next();
    const cache = edgeCache();
    const key = new Request(url.toString(), { method: 'GET' });
    if (cache) {
      const hit = await cache.match(key);
      if (hit) {
        const res = new Response(hit.body, hit);
        res.headers.set('x-hm-cache', 'HIT');
        return res;
      }
    }
    await next();
    if (c.res.status !== 200 || c.res.headers.has('set-cookie')) return;
    c.res.headers.set('Cache-Control', `public, max-age=${seconds}`);
    c.res.headers.set('x-hm-cache', 'MISS');
    if (!cache) return;
    const copy = c.res.clone();
    // Header CORS là của người gọi lần đầu, không được lưu cho người khác.
    for (const h of ['access-control-allow-origin', 'access-control-allow-credentials', 'x-request-id']) copy.headers.delete(h);
    const put = cache.put(key, copy);
    try {
      c.executionCtx.waitUntil(put);
    } catch {
      await put;
    }
  };
}
