// Xử lý lỗi chuẩn { code, message } và log có request id. Giới hạn số lần gọi ở rate-limit.ts.
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

/** Log một dòng mỗi request. */
export function requestLog(log: Logger): MiddlewareHandler<Env> {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const ctx = c.get('ctx');
    log.debug('request', { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start, requestId: ctx?.requestId, actor: ctx?.actor.type });
  };
}
