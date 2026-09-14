// Xử lý lỗi chuẩn { code, message }, CORS, rate limit cơ bản (edge Cloudflare xử lý phần chính), log có request id.
import { AppError, type Logger } from '@hoiminh/core';
import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../lib/hono';

/** Map mọi lỗi về JSON chuẩn. */
export function errorHandler(log: Logger) {
  return (err: Error, c: Context<Env>): Response => {
    if (err instanceof AppError) {
      if (err.status >= 500) log.error('request.error', { code: err.code, message: err.message, requestId: c.get('ctx')?.requestId });
      return c.json({ code: err.code, message: err.message, details: err.details ?? undefined }, err.status as 400);
    }
    log.error('request.unhandled', { message: err.message, stack: err.stack?.split('\n').slice(0, 4).join(' | '), requestId: c.get('ctx')?.requestId, path: c.req.path });
    return c.json({ code: 'internal_error', message: 'Có lỗi xảy ra, thử lại sau' }, 500);
  };
}

/** Rate limit cửa sổ trượt trong bộ nhớ theo IP + nhóm route (đăng nhập, đăng ký, webhook, viết nội dung). */
export function rateLimit(opts: { windowMs: number; max: number; key?: (c: Context<Env>) => string }): MiddlewareHandler<Env> {
  const hits = new Map<string, number[]>();
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'local';
    const key = `${opts.key ? opts.key(c) : c.req.path}:${ip}`;
    const now = Date.now();
    const list = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
    if (list.length >= opts.max) throw new AppError('rate_limited', 'Bạn thao tác quá nhanh, thử lại sau ít phút');
    list.push(now);
    hits.set(key, list);
    if (hits.size > 10_000) hits.clear();
    await next();
  };
}

/** Log một dòng mỗi request. */
export function requestLog(log: Logger): MiddlewareHandler<Env> {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const ctx = c.get('ctx');
    log.debug('request', { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start, requestId: ctx?.requestId, actor: ctx?.actor.type });
  };
}
