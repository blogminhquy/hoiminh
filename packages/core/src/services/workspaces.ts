// Workspace chủ hội: tạo khi chủ hội bắt đầu, danh sách "Hội của tôi" (kèm gói của từng hội), đội ngũ.
import { toSlug } from '@hoiminh/contracts';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { communities, communityMembers, communityTiers, orders, users, workspaceMembers, workspaces } from '@hoiminh/db';
import type { Ctx } from '../context';
import { addDays } from '../lib/money';
import { requireUser, requireWorkspaceRole } from '../permissions';
import { planDaysLeft } from '@hoiminh/contracts';
import { audit } from './audit';
import { ownerHasUnlimitedFree, planOfCommunity, planTable } from './plans';

/** Lấy hoặc tạo workspace mặc định của người dùng. Không còn dùng thử: workspace hoạt động ngay, gói tính theo từng hội. */
export async function ensureWorkspace(ctx: Ctx, userId?: string): Promise<typeof workspaces.$inferSelect> {
  const uid = userId ?? requireUser(ctx);
  const existing = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.ownerUserId, uid), orderBy: desc(workspaces.createdAt) });
  if (existing) return existing;
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, uid) });
  const slug = `${toSlug(user?.handle ?? 'ws')}-${Date.now().toString(36).slice(-4)}`;
  const [ws] = await ctx.db.insert(workspaces).values({ ownerUserId: uid, name: `Workspace của ${user?.name ?? 'bạn'}`, slug, status: 'active' }).returning();
  await ctx.db.insert(workspaceMembers).values({ workspaceId: ws!.id, userId: uid, role: 'owner' }).onConflictDoNothing();
  await audit(ctx, { action: 'workspace.create', resourceType: 'workspace', resourceId: ws!.id, workspaceId: ws!.id });
  return ws!;
}

/** Màn "Hội của tôi": hội mình làm chủ (kèm số liệu 30 ngày và gói của từng hội), hội tham gia, đội ngũ. */
export async function myWorkspaceHome(ctx: Ctx) {
  const userId = requireUser(ctx);
  const owned = await ctx.db.select({ ws: workspaces }).from(workspaces).where(eq(workspaces.ownerUserId, userId));
  const teamOf = await ctx.db.select({ wsId: workspaceMembers.workspaceId }).from(workspaceMembers).where(and(eq(workspaceMembers.userId, userId), sql`${workspaceMembers.role} <> 'owner'`));
  const wsIds = [...owned.map((o) => o.ws.id), ...teamOf.map((t) => t.wsId)];
  const since = addDays(ctx.now(), -30);
  const ownedRows = wsIds.length
    ? await ctx.db.select({ c: communities }).from(communities).where(and(inArray(communities.workspaceId, wsIds), isNull(communities.deletedAt))).orderBy(desc(communities.createdAt))
    : [];
  // Doanh thu 30 ngày tính bằng một truy vấn gom nhóm riêng. Bản cũ dùng truy vấn con trong sql``: Drizzle bỏ tên
  // bảng khi chỉ select một bảng, nên `o.community_id = "id"` so với chính orders.id và luôn ra 0.
  const revenueRows = ownedRows.length
    ? await ctx.db.select({ communityId: orders.communityId, total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::bigint` }).from(orders)
      .where(and(inArray(orders.communityId, ownedRows.map((r) => r.c.id)), eq(orders.status, 'paid'), gte(orders.paidAt, since))).groupBy(orders.communityId)
    : [];
  const revenue30 = new Map(revenueRows.map((r) => [r.communityId, Number(r.total)]));
  const ownedCommunities = ownedRows.map((r) => ({ c: r.c, revenue30: revenue30.get(r.c.id) ?? 0 }));
  const joined = await ctx.db
    .select({ m: communityMembers, c: { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor, logoUrl: communities.logoUrl, workspaceId: communities.workspaceId }, tier: { key: communityTiers.key, name: communityTiers.name } })
    .from(communityMembers)
    .innerJoin(communities, eq(communities.id, communityMembers.communityId))
    .leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId))
    .where(and(eq(communityMembers.userId, userId), inArray(communityMembers.status, ['active', 'cancelling'])));
  const primaryWs = owned[0]?.ws ?? null;
  const table = await planTable(ctx);
  const now = ctx.now();
  const planOf = (c: typeof communities.$inferSelect) => {
    const p = planOfCommunity(c, table, now);
    return { key: p.key, name: p.name, memberCap: p.memberCap, features: p.features, endsAt: p.endsAt, daysLeft: planDaysLeft(p.endsAt, now), boughtKey: p.boughtKey, boughtEndsAt: p.boughtEndsAt, isFreeSlot: p.isFreeSlot, needsPlan: p.needsPlan, full: p.full };
  };
  // Hội miễn phí của tài khoản chỉ tính trên các hội mình làm chủ (không tính hội mình chỉ là quản trị viên). Khớp với
  // ownerHasFreeCommunity ở máy chủ: hội đã lưu trữ thì trả lại suất. Tài khoản quản trị hệ thống thì không bao giờ hết suất.
  const ownWsIds = new Set(owned.map((o) => o.ws.id));
  const freeSlotUsed = !(await ownerHasUnlimitedFree(ctx, userId)) && ownedCommunities.some((r) => r.c.isFreeSlot && r.c.status !== 'archived' && ownWsIds.has(r.c.workspaceId));
  const team = primaryWs
    ? await ctx.db.select({ m: workspaceMembers, u: { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor } }).from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId)).where(eq(workspaceMembers.workspaceId, primaryWs.id))
    : [];
  const totalMembers = ownedCommunities.reduce((n, c) => n + c.c.memberCount, 0);
  return {
    workspace: primaryWs,
    /** Tài khoản đã dùng hội miễn phí chưa: rồi thì hội tạo thêm phải có gói trả phí. */
    freeSlotUsed,
    owned: ownedCommunities.map((r) => ({ ...r.c, revenue30Minor: Number(r.revenue30), plan: planOf(r.c) })),
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
