// Feature flags trong DB: bật toàn platform, theo workspace, theo gói, theo phần trăm.
import { eq } from 'drizzle-orm';
import { featureFlags } from '@hoiminh/db';
import type { Ctx } from '../context';
import { requireSuperAdmin } from '../permissions';
import { audit } from './audit';

/** Cờ có bật cho workspace này không. */
export async function isEnabled(ctx: Ctx, key: string, scope: { workspaceId?: string | null; planKey?: string | null } = {}): Promise<boolean> {
  const f = await ctx.db.query.featureFlags.findFirst({ where: eq(featureFlags.key, key) });
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

export async function listFlags(ctx: Ctx) {
  requireSuperAdmin(ctx);
  return ctx.db.query.featureFlags.findMany({ orderBy: (t, { asc }) => asc(t.key) });
}

export async function setFlag(ctx: Ctx, key: string, input: { enabled?: boolean; description?: string; rules?: { workspaceIds?: string[]; planKeys?: string[]; percent?: number } }) {
  requireSuperAdmin(ctx);
  const existing = await ctx.db.query.featureFlags.findFirst({ where: eq(featureFlags.key, key) });
  const values = { key, enabled: input.enabled ?? existing?.enabled ?? false, description: input.description ?? existing?.description ?? '', rules: input.rules ?? existing?.rules ?? {}, updatedAt: ctx.now() };
  const [row] = await ctx.db.insert(featureFlags).values(values).onConflictDoUpdate({ target: featureFlags.key, set: values }).returning();
  await audit(ctx, { action: 'feature_flag.set', resourceType: 'feature_flag', resourceId: key, metadata: { enabled: values.enabled } });
  return row!;
}
