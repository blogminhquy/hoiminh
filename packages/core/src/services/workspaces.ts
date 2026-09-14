// Workspace chủ hội: tạo khi bắt đầu dùng thử, danh sách "Hội của tôi", đội ngũ.
import { BUSINESS } from '@hoiminh/config';
import { toSlug } from '@hoiminh/contracts';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { communities, communityMembers, communityTiers, orders, platformSubscriptions, users, workspaceMembers, workspaces } from '@hoiminh/db';
import type { Ctx } from '../context';
import { addDays } from '../lib/money';
import { requireUser, requireWorkspaceRole } from '../permissions';
import { audit } from './audit';

/** Lấy hoặc tạo workspace mặc định của người dùng (bắt đầu dùng thử 14 ngày, không cần thẻ). */
export async function ensureWorkspace(ctx: Ctx, userId?: string): Promise<typeof workspaces.$inferSelect> {
  const uid = userId ?? requireUser(ctx);
  const existing = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.ownerUserId, uid), orderBy: desc(workspaces.createdAt) });
  if (existing) return existing;
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, uid) });
  const trialEndsAt = addDays(ctx.now(), BUSINESS.platformTrialDays);
  const slug = `${toSlug(user?.handle ?? 'ws')}-${Date.now().toString(36).slice(-4)}`;
  const [ws] = await ctx.db.insert(workspaces).values({ ownerUserId: uid, name: `Workspace của ${user?.name ?? 'bạn'}`, slug, status: 'trial', trialEndsAt }).returning();
  await ctx.db.insert(workspaceMembers).values({ workspaceId: ws!.id, userId: uid, role: 'owner' }).onConflictDoNothing();
  await ctx.db.insert(platformSubscriptions).values({ workspaceId: ws!.id, planKey: 'hoiminh', status: 'trialing', billingCycle: 'monthly', currentPeriodStart: ctx.now(), currentPeriodEnd: trialEndsAt }).onConflictDoNothing();
  await ctx.events.emit('platform.trial_started', { workspaceId: ws!.id, ownerUserId: uid, trialEndsAt: trialEndsAt.toISOString() });
  await audit(ctx, { action: 'workspace.create', resourceType: 'workspace', resourceId: ws!.id, workspaceId: ws!.id });
  return ws!;
}

/** Màn "Hội của tôi": hội mình làm chủ (kèm số liệu 30 ngày), hội tham gia, gói nền tảng, đội ngũ. */
export async function myWorkspaceHome(ctx: Ctx) {
  const userId = requireUser(ctx);
  const owned = await ctx.db.select({ ws: workspaces }).from(workspaces).where(eq(workspaces.ownerUserId, userId));
  const teamOf = await ctx.db.select({ wsId: workspaceMembers.workspaceId }).from(workspaceMembers).where(and(eq(workspaceMembers.userId, userId), sql`${workspaceMembers.role} <> 'owner'`));
  const wsIds = [...owned.map((o) => o.ws.id), ...teamOf.map((t) => t.wsId)];
  const since = addDays(ctx.now(), -30);
  const ownedCommunities = wsIds.length
    ? await ctx.db.select({ c: communities, revenue30: sql<number>`coalesce((select sum(total_minor) from ${orders} o where o.community_id = ${communities.id} and o.status = 'paid' and o.paid_at >= ${since}),0)::bigint` }).from(communities).where(and(inArray(communities.workspaceId, wsIds), isNull(communities.deletedAt))).orderBy(desc(communities.createdAt))
    : [];
  const joined = await ctx.db
    .select({ m: communityMembers, c: { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor, workspaceId: communities.workspaceId }, tier: { key: communityTiers.key, name: communityTiers.name } })
    .from(communityMembers)
    .innerJoin(communities, eq(communities.id, communityMembers.communityId))
    .leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId))
    .where(and(eq(communityMembers.userId, userId), inArray(communityMembers.status, ['active', 'cancelling'])));
  const primaryWs = owned[0]?.ws ?? null;
  const platformSub = primaryWs ? await ctx.db.query.platformSubscriptions.findFirst({ where: eq(platformSubscriptions.workspaceId, primaryWs.id) }) : null;
  const team = primaryWs
    ? await ctx.db.select({ m: workspaceMembers, u: { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor } }).from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId)).where(eq(workspaceMembers.workspaceId, primaryWs.id))
    : [];
  const totalMembers = ownedCommunities.reduce((n, c) => n + c.c.memberCount, 0);
  return {
    workspace: primaryWs,
    platformSubscription: platformSub,
    owned: ownedCommunities.map((r) => ({ ...r.c, revenue30Minor: Number(r.revenue30) })),
    joined: joined.filter((j) => !wsIds.includes(j.c.workspaceId)).map((j) => ({ ...j.c, role: j.m.role, tier: j.tier, nextRenewalAt: j.m.nextRenewalAt })),
    team: team.map((t) => ({ ...t.u, role: t.m.role })),
    totals: { communities: ownedCommunities.length, members: totalMembers },
  };
}

/** Mời người quản trị vào workspace (dùng chung cho mọi hội). */
export async function inviteTeamMember(ctx: Ctx, workspaceId: string, email: string, role: 'admin' | 'editor') {
  await requireWorkspaceRole(ctx, workspaceId, ['owner']);
  const user = await ctx.db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (!user) return { invited: false, reason: 'Người này chưa có tài khoản Hội Mình' };
  await ctx.db.insert(workspaceMembers).values({ workspaceId, userId: user.id, role }).onConflictDoUpdate({ target: [workspaceMembers.workspaceId, workspaceMembers.userId], set: { role } });
  await audit(ctx, { action: 'workspace.team_invite', resourceType: 'workspace', resourceId: workspaceId, workspaceId, metadata: { email, role } });
  return { invited: true };
}

/** Workspace còn được tạo nội dung không (hết dùng thử/hết hạn thì khóa, mục 202). */
export async function assertWorkspaceUnlocked(ctx: Ctx, workspaceId: string): Promise<void> {
  const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId), columns: { contentLockedAt: true, status: true } });
  if (ws?.contentLockedAt || ws?.status === 'locked') {
    const { AppError } = await import('../errors');
    throw new AppError('plan_locked', 'Gói nền tảng đã hết hạn. Thanh toán để tiếp tục tạo nội dung, dữ liệu vẫn được giữ.');
  }
}

export const trialWindow = (now: Date) => ({ from: now, to: addDays(now, BUSINESS.platformTrialDays) });
export { gte };
