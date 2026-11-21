// Xử lý lỗi chuẩn { code, message } và log có request id. Giới hạn số lần gọi ở rate-limit.ts.
import { AppError, type Logger } from '@hoiminh/core';
import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../lib/hono';

/** Map mọi lỗi về JSON chuẩn. `logOf` lấy logger theo request: lỗi có thể nổ trước khi authMiddleware gắn App vào context. */
export function errorHandler(logOf: (c: Context<Env>) => Logger) {
  return (err: Error, c: Context<Env>): Response => {
    const log = logOf(c);
    if (err instanceof AppError) {
      if (err.status >= 500) log.error('request.error', { code: err.code, message: err.message, requestId: c.get('ctx')?.requestId });
      return c.json({ code: err.code, message: err.message, details: err.details ?? undefined }, err.status as 400);
    }
    log.error('request.unhandled', { message: err.message, stack: err.stack?.split('\n').slice(0, 4).join(' | '), requestId: c.get('ctx')?.requestId, path: c.req.path });
    return c.json({ code: 'internal_error', message: 'Có lỗi xảy ra, thử lại sau' }, 500);
  };
}

/** Log một dòng mỗi request. Đặt sau authMiddleware: logger lấy từ App mà middleware đó đã gắn vào context. */
export function requestLog(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const ctx = c.get('ctx');
    const log = c.get('app').ctx.log;
    log.debug('request', { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start, requestId: ctx?.requestId, actor: ctx?.actor.type });
  };
}
