// Ngữ cảnh chạy: phụ thuộc dùng chung (db, env, email, media, payments, queue, clock) + người thực hiện (actor).
import type { Env } from '@hoiminh/config';
import type { Database } from '@hoiminh/db';
import type { EmailSender } from '@hoiminh/email';
import type { MediaProvider } from '@hoiminh/media';
import type { PaymentRouter } from '@hoiminh/payments';
import type { EventBus } from './events/bus';
import type { JobQueue } from './jobs/queue';

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/** Phụ thuộc sống lâu, tạo một lần khi khởi động. */
export interface AppContext {
  db: Database;
  env: Env;
  email: EmailSender;
  media: MediaProvider;
  payments: PaymentRouter;
  events: EventBus;
  queue: JobQueue;
  log: Logger;
  now: () => Date;
}

/** Người thực hiện: người dùng đăng nhập, API key của workspace, hoặc hệ thống (cron/webhook). */
export type Actor =
  | { type: 'user'; userId: string; isSuperAdmin: boolean; email: string }
  | { type: 'api_key'; apiKeyId: string; workspaceId: string; scopes: string[]; userId: string }
  | { type: 'system' }
  | { type: 'anonymous' };

/** Ngữ cảnh theo từng request/job. */
export interface Ctx extends AppContext {
  actor: Actor;
  requestId: string;
  ipHash?: string;
}

/** Tạo Ctx hệ thống (cron, webhook, consumer). */
export function systemCtx(app: AppContext, requestId = `sys-${Date.now()}`): Ctx {
  return { ...app, actor: { type: 'system' }, requestId };
}

/** Id người dùng của actor, hoặc null với system/anonymous. */
export function actorUserId(ctx: Ctx): string | null {
  if (ctx.actor.type === 'user' || ctx.actor.type === 'api_key') return ctx.actor.userId;
  return null;
}

/** Logger console tối giản có request id. */
export function consoleLogger(level: Env['LOG_LEVEL'] = 'info'): Logger {
  const order = { debug: 0, info: 1, warn: 2, error: 3 };
  const ok = (l: keyof typeof order) => order[l] >= order[level];
  const out = (l: keyof typeof order, msg: string, meta?: Record<string, unknown>) => {
    if (!ok(l)) return;
    const line = `[${new Date().toISOString()}] ${l.toUpperCase()} ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
    if (l === 'error') console.error(line);
    else if (l === 'warn') console.warn(line);
    else console.info(line);
  };
  return { debug: (m, x) => out('debug', m, x), info: (m, x) => out('info', m, x), warn: (m, x) => out('warn', m, x), error: (m, x) => out('error', m, x) };
}
