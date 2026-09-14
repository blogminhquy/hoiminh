// API key theo workspace: hiện raw một lần, lưu hash, scope, revoke, log.
import { randomToken, sha256Hex } from '@hoiminh/config';
import { and, desc, eq, isNull, or, gt } from 'drizzle-orm';
import { apiKeyLogs, apiKeys, workspaces } from '@hoiminh/db';
import type { Actor, Ctx } from '../context';
import { notFound } from '../errors';
import { requireWorkspaceRole } from '../permissions';
import { audit } from './audit';

/** Tạo key: trả về raw đúng một lần. Định dạng hm_live_<prefix>_<secret>. */
export async function createApiKey(ctx: Ctx, workspaceId: string, input: { name: string; scopes: string[]; expiresAt?: string | null }) {
  await requireWorkspaceRole(ctx, workspaceId, ['owner']);
  const prefix = randomToken(4);
  const secret = randomToken(24);
  const raw = `hm_${ctx.env.APP_ENV === 'production' ? 'live' : 'test'}_${prefix}_${secret}`;
  const [row] = await ctx.db.insert(apiKeys).values({ workspaceId, createdByUserId: ctx.actor.type === 'user' ? ctx.actor.userId : (await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) }))!.ownerUserId, name: input.name, keyPrefix: prefix, keyHash: await sha256Hex(raw), scopes: input.scopes, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }).returning();
  await audit(ctx, { action: 'api_key.create', resourceType: 'api_key', resourceId: row!.id, workspaceId, metadata: { name: input.name, scopes: input.scopes } });
  return { id: row!.id, name: row!.name, prefix, scopes: row!.scopes, expiresAt: row!.expiresAt, raw };
}

export async function listApiKeys(ctx: Ctx, workspaceId: string) {
  await requireWorkspaceRole(ctx, workspaceId, ['owner', 'admin']);
  const rows = await ctx.db.query.apiKeys.findMany({ where: eq(apiKeys.workspaceId, workspaceId), orderBy: desc(apiKeys.createdAt) });
  return rows.map((r) => ({ id: r.id, name: r.name, prefix: r.keyPrefix, scopes: r.scopes, status: r.status, expiresAt: r.expiresAt, lastUsedAt: r.lastUsedAt, createdAt: r.createdAt }));
}

export async function revokeApiKey(ctx: Ctx, workspaceId: string, id: string) {
  await requireWorkspaceRole(ctx, workspaceId, ['owner']);
  const [row] = await ctx.db.update(apiKeys).set({ status: 'revoked', revokedAt: ctx.now() }).where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId))).returning();
  if (!row) throw notFound();
  await audit(ctx, { action: 'api_key.revoke', resourceType: 'api_key', resourceId: id, workspaceId });
}

/** Xác thực API key → actor api_key. */
export async function authenticateApiKey(ctx: Ctx, raw: string): Promise<Actor | null> {
  if (!raw.startsWith('hm_')) return null;
  const row = await ctx.db.query.apiKeys.findFirst({ where: and(eq(apiKeys.keyHash, await sha256Hex(raw)), eq(apiKeys.status, 'active'), or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, ctx.now()))!) });
  if (!row) return null;
  await ctx.db.update(apiKeys).set({ lastUsedAt: ctx.now() }).where(eq(apiKeys.id, row.id));
  const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, row.workspaceId), columns: { ownerUserId: true } });
  return { type: 'api_key', apiKeyId: row.id, workspaceId: row.workspaceId, scopes: row.scopes, userId: ws?.ownerUserId ?? row.createdByUserId };
}

/** Ghi log một request dùng API key. */
export async function logApiKeyUse(ctx: Ctx, apiKeyId: string, method: string, path: string, status: number): Promise<void> {
  await ctx.db.insert(apiKeyLogs).values({ apiKeyId, method, path, status, requestId: ctx.requestId });
}
