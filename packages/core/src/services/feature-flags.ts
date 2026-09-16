// Feature flags trong DB: bật toàn platform, theo workspace, theo gói, theo phần trăm.
import { eq } from 'drizzle-orm';
import { featureFlags } from '@hoiminh/db';
import type { Ctx } from '../context';
import { AppError } from '../errors';
import { requireSuperAdmin } from '../permissions';
import { audit } from './audit';

/** Khóa cờ đang được nối vào đường chạy thật. Thêm khóa mới thì khai báo ở đây để không gõ nhầm chuỗi. */
export const FLAG = {
  store: 'store',
  affiliateLeaderboard: 'affiliate_leaderboard',
  mcp: 'mcp',
  paypal: 'paypal',
  realtimeChat: 'realtime_chat',
  goLive: 'go_live',
  gamification: 'gamification',
} as const;
export type FlagKey = (typeof FLAG)[keyof typeof FLAG];

type FlagRow = { key: string; enabled: boolean; rules: { workspaceIds?: string[]; planKeys?: string[]; percent?: number } };
type Scope = { workspaceId?: string | null; planKey?: string | null };

/**
 * Cache toàn tiến trình, sống ngắn: bảng cờ rất nhỏ và đổi hiếm, nhưng `communityShell`
 * và checkout đều hỏi nên không để mỗi lần hỏi là một vòng truy vấn.
 * `setFlag` xóa cache ngay để super admin bật/tắt thấy tác dụng tức thì.
 */
let cache: { at: number; rows: FlagRow[] } | null = null;
const CACHE_MS = 30_000;

async function allFlags(ctx: Ctx): Promise<FlagRow[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = (await ctx.db.query.featureFlags.findMany({ columns: { key: true, enabled: true, rules: true } })) as FlagRow[];
  cache = { at: Date.now(), rows };
  return rows;
}

/** Xóa cache cờ (gọi sau khi ghi, và trong test). */
export function clearFlagCache(): void {
  cache = null;
}

function evaluate(f: FlagRow | undefined, scope: Scope): boolean {
  if (!f) return false;
  if (f.enabled) return true;
  const r = f.rules;
  if (scope.workspaceId && r.workspaceIds?.includes(scope.workspaceId)) return true;
  if (scope.planKey && r.planKeys?.includes(scope.planKey)) return true;
  if (r.percent && scope.workspaceId) {
    let h = 0;
    for (const ch of scope.workspaceId) h = (h * 31 + ch.charCodeAt(0)) % 100;
    return h < r.percent;
  }
  return false;
}

/** Cờ có bật cho workspace này không. */
export async function isEnabled(ctx: Ctx, key: string, scope: Scope = {}): Promise<boolean> {
  return evaluate((await allFlags(ctx)).find((f) => f.key === key), scope);
}

/** Bảng cờ đã tính sẵn cho một workspace: dùng cho shell và những chỗ hỏi nhiều cờ một lúc. */
export async function flagsFor(ctx: Ctx, scope: Scope = {}): Promise<Record<string, boolean>> {
  const rows = await allFlags(ctx);
  const out: Record<string, boolean> = {};
  for (const f of rows) out[f.key] = evaluate(f, scope);
  return out;
}

/** Chặn đường chạy khi cờ đang tắt. Dùng ở service, không chỉ ở giao diện. */
export async function requireFlag(ctx: Ctx, key: FlagKey, message: string, scope: Scope = {}): Promise<void> {
  if (!(await isEnabled(ctx, key, scope))) throw new AppError('feature_disabled', message, 403);
}

export async function listFlags(ctx: Ctx) {
  requireSuperAdmin(ctx);
  return ctx.db.query.featureFlags.findMany({ orderBy: (t, { asc }) => asc(t.key) });
}

export async function setFlag(ctx: Ctx, key: string, input: { enabled?: boolean; description?: string; rules?: { workspaceIds?: string[]; planKeys?: string[]; percent?: number } }) {
  requireSuperAdmin(ctx);
  const existing = await ctx.db.query.featureFlags.findFirst({ where: eq(featureFlags.key, key) });
  const values = { key, enabled: input.enabled ?? existing?.enabled ?? false, description: input.description ?? existing?.description ?? '', rules: input.rules ?? existing?.rules ?? {}, updatedAt: ctx.now() };
  const [row] = await ctx.db.insert(featureFlags).values(values).onConflictDoUpdate({ target: featureFlags.key, set: values }).returning();
  clearFlagCache();
  await audit(ctx, { action: 'feature_flag.set', resourceType: 'feature_flag', resourceId: key, metadata: { enabled: values.enabled } });
  return row!;
}
