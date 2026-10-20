// Giới hạn số lần gọi, đếm chung trên toàn Cloudflare bằng Rate Limiting binding (wrangler.toml `[[ratelimits]]`).
// Bộ đếm trong bộ nhớ trước đây gần như vô dụng trên Workers: mỗi isolate một bộ đếm riêng.
// Không có binding (Node, test) thì rơi về bộ đếm trong bộ nhớ với cùng hạn mức.
//
// Khóa đếm tránh gộp nhầm người dùng: mạng di động ở Việt Nam dùng chung IP (CGNAT) cho rất nhiều máy,
// nên người đã đăng nhập được đếm theo phiên / tài khoản, chỉ khách vãng lai mới đếm theo IP.
import { AppError } from '@hoiminh/core';
import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../lib/hono';
import { ACCESS_COOKIE, readCookie } from '../lib/session-cookie';

/** Hạn mức mỗi nhóm; phải khớp `simple = { limit, period }` của binding cùng tên trong wrangler.toml. */
export const TIERS = {
  /** Toàn bộ /v1: chặn một nguồn dội request làm nghẽn database. */
  api: { binding: 'RL_API', limit: 600, period: 60 },
  /** Đăng nhập, đăng ký, 2FA, quên mật khẩu: chặn dò mật khẩu và spam email. */
  auth: { binding: 'RL_AUTH', limit: 10, period: 60 },
  /** Đăng bài, bình luận, thanh toán, đổi mật khẩu: chặn spam nội dung và đơn rác. */
  write: { binding: 'RL_WRITE', limit: 20, period: 60 },
  /** Webhook cổng thanh toán, đếm theo IP của cổng. */
  webhook: { binding: 'RL_WEBHOOK', limit: 1200, period: 60 },
} as const;
export type Tier = keyof typeof TIERS;

interface RateLimitBinding {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

/** Bộ đếm cửa sổ cố định trong bộ nhớ, chỉ dùng khi không có binding (dev, test). */
const memory = new Map<string, { start: number; count: number }>();
function memoryLimit(tier: Tier, key: string, now = Date.now()): boolean {
  const { limit, period } = TIERS[tier];
  const k = `${tier}:${key}`;
  const cur = memory.get(k);
  if (!cur || now - cur.start >= period * 1000) {
    if (memory.size > 50_000) memory.clear();
    memory.set(k, { start: now, count: 1 });
    return true;
  }
  cur.count += 1;
  return cur.count <= limit;
}

/** Xóa bộ đếm trong bộ nhớ (test). */
export function resetMemoryLimits(): void {
  memory.clear();
}

function clientIp(c: Context<Env>): string {
  // Chỉ tin cf-connecting-ip do Cloudflare đặt; x-forwarded-for thì ai cũng tự gửi được.
  return c.req.header('cf-connecting-ip') ?? 'local';
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Ai đang gọi: tài khoản (sau đăng nhập), phiên (token), hoặc IP (khách vãng lai). */
async function caller(c: Context<Env>): Promise<string> {
  const actor = c.get('ctx')?.actor;
  if (actor && (actor.type === 'user' || actor.type === 'api_key')) return `u:${actor.userId}`;
  const auth = c.req.header('authorization') || readCookie(c, ACCESS_COOKIE);
  if (auth) return `t:${await sha(auth.replace(/^Bearer\s+/i, ''))}`;
  return `ip:${clientIp(c)}`;
}

async function allowed(c: Context<Env>, tier: Tier, key: string): Promise<boolean> {
  const binding = (c.env as Record<string, unknown> | undefined)?.[TIERS[tier].binding] as RateLimitBinding | undefined;
  if (binding) {
    try {
      return (await binding.limit({ key })).success;
    } catch {
      // Binding lỗi thì cho qua còn hơn chặn nhầm cả hệ thống.
      return true;
    }
  }
  return memoryLimit(tier, key);
}

/**
 * Giới hạn theo nhóm. Nhóm `auth` đếm theo IP + đường dẫn + email trong body (nếu có), để một người
 * dò mật khẩu bị chặn mà người khác cùng IP vẫn đăng nhập được.
 */
export function rateLimit(tier: Tier, opts: { scope?: string } = {}): MiddlewareHandler<Env> {
  return async (c, next) => {
    let key = `${opts.scope ?? c.req.path}:${await caller(c)}`;
    if (tier === 'auth') {
      const email = await c.req.raw.clone().json().then((b: unknown) => { const e = (b as { email?: unknown } | null)?.email; return typeof e === 'string' ? e.trim().toLowerCase() : ''; }, () => '');
      key = `${c.req.path}:ip:${clientIp(c)}:${email ? await sha(email) : '-'}`;
    }
    if (!(await allowed(c, tier, key))) {
      c.header('Retry-After', String(TIERS[tier].period));
      throw new AppError('rate_limited', 'Bạn thao tác quá nhanh, thử lại sau ít phút');
    }
    await next();
  };
}
