// Thành viên: tham gia, bộ lọc quản trị, modal 4 tab, đổi vai trò/gói, xóa, chặn, hủy đăng ký, mời, xuất CSV.
import type { MemberStatus } from '@hoiminh/contracts';
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { affiliateAccounts, communities, communityInvites, communityJoinQuestions, communityMembers, communityTiers, courseProgress, courses, entitlements, memberJoinAnswers, orders, payments, subscriptions, users } from '@hoiminh/db';
import { randomToken } from '@hoiminh/config';
import { templates } from '@hoiminh/email';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { conflict, forbidden, invalid, invalidState, notFound } from '../errors';
import { decodeCursor, paginate } from '../lib/pagination';
import { requireCommunityPermission, requireUser, resolveCommunityAccess } from '../permissions';
import { audit } from './audit';
import { getCommunityBySlug } from './communities';

/** Tham gia hội miễn phí (free/freemium). Hội thu phí đi qua checkout. */
export async function joinCommunity(ctx: Ctx, slug: string, input: { answers?: Array<{ questionId: string; answer: string }>; ref?: string | null }) {
  const userId = requireUser(ctx);
  const c = await getCommunityBySlug(ctx, slug);
  if (c.status !== 'active') throw invalidState('Hội chưa mở');
  if (!c.doorsOpen) throw invalidState('Hội đã đóng cổng, không nhận thành viên mới');
  if (c.pricingMode === 'subscription' || c.pricingMode === 'one_time') throw invalidState('Hội này cần thanh toán để tham gia');
  const existing = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, c.id), eq(communityMembers.userId, userId)) });
  if (existing?.status === 'banned') throw forbidden('Bạn đã bị chặn khỏi hội này');
  if (existing && (existing.status === 'active' || existing.status === 'cancelling')) return { member: existing, alreadyMember: true };
  const questions = await ctx.db.query.communityJoinQuestions.findMany({ where: eq(communityJoinQuestions.communityId, c.id) });
  for (const q of questions) if (q.required && !input.answers?.find((a) => a.questionId === q.id && a.answer.trim())) throw invalid(`Cần trả lời: ${q.question}`);
  const tier = await ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, c.id), eq(communityTiers.isDefault, true)) });
  const instant = await ctx.db.query.communities.findFirst({ where: eq(communities.id, c.id), columns: { id: true } }).then(async () => {
    const p = await raw(ctx.db, sql`select enabled from community_plugins where community_id = ${c.id} and plugin_key = 'instant_approval'`);
    return (p[0] as { enabled: boolean } | undefined)?.enabled ?? true;
  });
  let affiliateId: string | null = null;
  if (input.ref) {
    const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.affiliateCode, input.ref) });
    if (acc && acc.userId !== userId) affiliateId = acc.id;
  }
  if (!affiliateId) {
    const attr = await raw(ctx.db, sql`select a.affiliate_account_id from affiliate_attributions a join affiliate_programs p on p.id = a.program_id where a.user_id = ${userId} and p.community_id = ${c.id} and a.expires_at > now() order by a.attributed_at desc limit 1`);
    affiliateId = (attr[0] as { affiliate_account_id: string } | undefined)?.affiliate_account_id ?? null;
  }
  const status: MemberStatus = instant ? 'active' : 'pending';
  const values = { communityId: c.id, userId, role: 'member' as const, status, tierId: tier?.id ?? null, referredByAffiliateId: affiliateId, source: affiliateId ? ('affiliate' as const) : ('direct' as const), joinedAt: ctx.now(), lastActiveAt: ctx.now(), churnedAt: null, updatedAt: ctx.now() };
  const [member] = existing
    ? await ctx.db.update(communityMembers).set(values).where(eq(communityMembers.id, existing.id)).returning()
    : await ctx.db.insert(communityMembers).values(values).returning();
  if (input.answers?.length) {
    await ctx.db.delete(memberJoinAnswers).where(eq(memberJoinAnswers.memberId, member!.id));
    await ctx.db.insert(memberJoinAnswers).values(input.answers.filter((a) => questions.some((q) => q.id === a.questionId)).map((a) => ({ memberId: member!.id, questionId: a.questionId, answer: a.answer })));
  }
  if (status === 'active') {
    await ctx.db.update(communities).set({ memberCount: sql`${communities.memberCount} + 1` }).where(eq(communities.id, c.id));
    if (tier) await ctx.db.insert(entitlements).values({ userId, workspaceId: c.workspaceId, communityId: c.id, resourceType: 'tier', resourceId: tier.id, sourceType: 'free_tier', sourceId: member!.id });
    if (affiliateId) await ctx.db.update(affiliateAccounts).set({ signupCount: sql`${affiliateAccounts.signupCount} + 1` }).where(eq(affiliateAccounts.id, affiliateId));
    await ctx.events.emit('member.joined', { communityId: c.id, userId, memberId: member!.id, source: values.source, referredByAffiliateId: affiliateId });
  }
  return { member: member!, alreadyMember: false };
}

/** Danh sách thành viên với bộ lọc (mục 189). */
export async function listMembers(ctx: Ctx, communityId: string, q: { status?: MemberStatus; q?: string; tierKey?: string; role?: string; source?: string; cursor?: string; limit?: number }) {
  await requireCommunityPermission(ctx, communityId, 'member.read');
  const limit = q.limit ?? 30;
  const conds = [eq(communityMembers.communityId, communityId), eq(communityMembers.status, q.status ?? 'active')];
  if (q.q) conds.push(or(ilike(users.name, `%${q.q}%`), ilike(users.email, `%${q.q}%`), ilike(users.handle, `%${q.q.replace(/^@/, '')}%`))!);
  if (q.tierKey) conds.push(eq(communityTiers.key, q.tierKey as 'standard'));
  if (q.role) conds.push(eq(communityMembers.role, q.role as 'member'));
  if (q.source) conds.push(eq(communityMembers.source, q.source as 'direct'));
  const c = decodeCursor(q.cursor);
  if (c) conds.push(or(lt(communityMembers.joinedAt, new Date(c.at)), and(eq(communityMembers.joinedAt, new Date(c.at)), lt(communityMembers.id, c.id)))!);
  const rows = await ctx.db
    .select({ m: communityMembers, u: { id: users.id, name: users.name, handle: users.handle, email: users.email, avatarUrl: users.avatarUrl, coverColor: users.coverColor }, tier: { key: communityTiers.key, name: communityTiers.name } })
    .from(communityMembers)
    .innerJoin(users, eq(users.id, communityMembers.userId))
    .leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId))
    .where(and(...conds))
    .orderBy(desc(communityMembers.joinedAt), desc(communityMembers.id))
    .limit(limit + 1);
  const counts = await ctx.db.select({ status: communityMembers.status, c: sql<number>`count(*)::int` }).from(communityMembers).where(eq(communityMembers.communityId, communityId)).groupBy(communityMembers.status);
  const page = paginate(rows.map((r) => ({ ...r.m, createdAt: r.m.joinedAt, user: r.u, tier: r.tier })), limit);
  return { ...page, counts: Object.fromEntries(counts.map((r) => [r.status, r.c])) as Record<string, number> };
}

/** Dữ liệu modal thành viên 4 tab (mục 188). */
export async function memberDetail(ctx: Ctx, communityId: string, memberId: string) {
  await requireCommunityPermission(ctx, communityId, 'member.manage');
  const m = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.id, memberId), eq(communityMembers.communityId, communityId)) });
  if (!m) throw notFound('Thành viên không tồn tại');
  const [user, tier, sub, referrer, progress, paymentRows, answers] = await Promise.all([
    ctx.db.query.users.findFirst({ where: eq(users.id, m.userId) }),
    m.tierId ? ctx.db.query.communityTiers.findFirst({ where: eq(communityTiers.id, m.tierId) }) : null,
    ctx.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.userId, m.userId), eq(subscriptions.communityId, communityId), inArray(subscriptions.status, ['active', 'cancelling', 'past_due'])), orderBy: desc(subscriptions.createdAt) }),
    m.referredByAffiliateId ? ctx.db.select({ name: users.name, handle: users.handle }).from(affiliateAccounts).innerJoin(users, eq(users.id, affiliateAccounts.userId)).where(eq(affiliateAccounts.id, m.referredByAffiliateId)).then((r) => r[0] ?? null) : null,
    ctx.db.select({ p: courseProgress, course: { id: courses.id, title: courses.title, accessMode: courses.accessMode } }).from(courses).leftJoin(courseProgress, and(eq(courseProgress.courseId, courses.id), eq(courseProgress.userId, m.userId))).where(and(eq(courses.communityId, communityId), isNull(courses.deletedAt), eq(courses.status, 'published'))),
    ctx.db.select({ o: orders, p: payments }).from(orders).leftJoin(payments, eq(payments.orderId, orders.id)).where(and(eq(orders.customerUserId, m.userId), eq(orders.communityId, communityId))).orderBy(desc(orders.createdAt)).limit(30),
    ctx.db.select({ a: memberJoinAnswers, q: communityJoinQuestions }).from(memberJoinAnswers).innerJoin(communityJoinQuestions, eq(communityJoinQuestions.id, memberJoinAnswers.questionId)).where(eq(memberJoinAnswers.memberId, memberId)),
  ]);
  const manualGrants = await ctx.db.query.entitlements.findMany({ where: and(eq(entitlements.userId, m.userId), eq(entitlements.resourceType, 'course'), eq(entitlements.status, 'active')) });
  return {
    member: m, user: user ? { id: user.id, name: user.name, handle: user.handle, email: user.email, avatarUrl: user.avatarUrl, coverColor: user.coverColor } : null, tier, subscription: sub, referrer,
    courses: progress.map((r) => ({ ...r.course, percent: r.p?.percent ?? 0, completedLessons: r.p?.completedLessons ?? 0, totalLessons: r.p?.totalLessons ?? 0, manuallyUnlocked: manualGrants.some((g) => g.resourceId === r.course.id) })),
    payments: paymentRows.map((r) => ({ orderId: r.o.id, at: r.o.createdAt, amountMinor: r.o.totalMinor, status: r.o.status, method: r.p?.paymentMethod ?? '', provider: r.p?.provider ?? '', title: (r.o.metadata as { title?: string }).title ?? r.o.targetType })),
    answers: answers.map((r) => ({ question: r.q.question, answer: r.a.answer })),
  };
}

/** Đổi vai trò hoặc gói của thành viên. Đổi gói → tính lại entitlement, phát member.tier_changed. */
export async function updateMember(ctx: Ctx, communityId: string, memberId: string, input: { role?: 'admin' | 'moderator' | 'member'; tierKey?: 'standard' | 'premium' | 'vip' }) {
  const access = await requireCommunityPermission(ctx, communityId, 'member.manage');
  const m = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.id, memberId), eq(communityMembers.communityId, communityId)) });
  if (!m) throw notFound();
  if (m.role === 'owner') throw forbidden('Không thể đổi chủ hội');
  const patch: Partial<typeof communityMembers.$inferInsert> = { updatedAt: ctx.now() };
  if (input.role) patch.role = input.role;
  let toTierId: string | null = m.tierId;
  if (input.tierKey) {
    const tier = await ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, communityId), eq(communityTiers.key, input.tierKey)) });
    if (!tier) throw notFound('Gói không tồn tại');
    toTierId = tier.id;
    patch.tierId = tier.id;
  }
  const [row] = await ctx.db.update(communityMembers).set(patch).where(eq(communityMembers.id, memberId)).returning();
  if (input.tierKey && toTierId !== m.tierId) {
    await ctx.db.update(entitlements).set({ status: 'revoked', revokedAt: ctx.now() }).where(and(eq(entitlements.userId, m.userId), eq(entitlements.communityId, communityId), eq(entitlements.resourceType, 'tier'), eq(entitlements.status, 'active')));
    await ctx.db.insert(entitlements).values({ userId: m.userId, workspaceId: access.workspaceId, communityId, resourceType: 'tier', resourceId: toTierId!, sourceType: 'manual_grant', sourceId: memberId, grantedByUserId: ctx.actor.type === 'user' ? ctx.actor.userId : null });
    await ctx.events.emit('member.tier_changed', { communityId, userId: m.userId, memberId, fromTierId: m.tierId, toTierId, reason: 'manual' });
  }
  await audit(ctx, { action: 'member.update', resourceType: 'community_member', resourceId: memberId, communityId, metadata: input });
  return row!;
}

/** Mở khóa khóa học thủ công cho thành viên (entitlement.granted, source = manual). */
export async function grantCourse(ctx: Ctx, communityId: string, memberId: string, courseId: string) {
  const access = await requireCommunityPermission(ctx, communityId, 'member.manage');
  const m = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.id, memberId), eq(communityMembers.communityId, communityId)) });
  if (!m) throw notFound();
  await ctx.db.insert(entitlements).values({ userId: m.userId, workspaceId: access.workspaceId, communityId, resourceType: 'course', resourceId: courseId, sourceType: 'manual_grant', sourceId: memberId, grantedByUserId: ctx.actor.type === 'user' ? ctx.actor.userId : null });
  await audit(ctx, { action: 'entitlement.grant_manual', resourceType: 'course', resourceId: courseId, communityId, metadata: { memberId } });
}

/** Xóa khỏi nhóm (giữ lịch sử thanh toán), chặn, hoặc hủy đăng ký. */
export async function memberAction(ctx: Ctx, communityId: string, memberId: string, action: 'remove' | 'ban' | 'cancel_subscription' | 'approve' | 'unban') {
  await requireCommunityPermission(ctx, communityId, 'member.manage');
  const m = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.id, memberId), eq(communityMembers.communityId, communityId)) });
  if (!m) throw notFound();
  if (m.role === 'owner') throw forbidden('Không thể thao tác với chủ hội');
  if (action === 'remove' || action === 'ban') {
    const wasActive = m.status === 'active' || m.status === 'cancelling';
    await ctx.db.update(communityMembers).set({ status: action === 'ban' ? 'banned' : 'churned', bannedAt: action === 'ban' ? ctx.now() : m.bannedAt, churnedAt: ctx.now(), updatedAt: ctx.now() }).where(eq(communityMembers.id, memberId));
    await ctx.db.update(entitlements).set({ status: 'revoked', revokedAt: ctx.now() }).where(and(eq(entitlements.userId, m.userId), eq(entitlements.communityId, communityId), eq(entitlements.resourceType, 'tier'), eq(entitlements.status, 'active')));
    if (wasActive) await ctx.db.update(communities).set({ memberCount: sql`greatest(${communities.memberCount} - 1, 0)` }).where(eq(communities.id, communityId));
    await ctx.events.emit(action === 'ban' ? 'member.banned' : 'member.removed', { communityId, userId: m.userId, memberId });
  } else if (action === 'unban') {
    await ctx.db.update(communityMembers).set({ status: 'churned', bannedAt: null, updatedAt: ctx.now() }).where(eq(communityMembers.id, memberId));
  } else if (action === 'approve') {
    if (m.status !== 'pending') throw invalidState('Thành viên không ở trạng thái chờ duyệt');
    await ctx.db.update(communityMembers).set({ status: 'active', updatedAt: ctx.now() }).where(eq(communityMembers.id, memberId));
    await ctx.db.update(communities).set({ memberCount: sql`${communities.memberCount} + 1` }).where(eq(communities.id, communityId));
    await ctx.events.emit('member.joined', { communityId, userId: m.userId, memberId, source: m.source, referredByAffiliateId: m.referredByAffiliateId });
  } else {
    const sub = await ctx.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.userId, m.userId), eq(subscriptions.communityId, communityId), eq(subscriptions.status, 'active')) });
    if (!sub) throw invalidState('Thành viên không có gói đang gia hạn');
    await ctx.db.update(subscriptions).set({ status: 'cancelling', cancelAtPeriodEnd: true, cancelledAt: ctx.now(), updatedAt: ctx.now() }).where(eq(subscriptions.id, sub.id));
    await ctx.db.update(communityMembers).set({ status: 'cancelling', updatedAt: ctx.now() }).where(eq(communityMembers.id, memberId));
    await ctx.events.emit('subscription.cancelled', { subscriptionId: sub.id, userId: m.userId, communityId, periodEnd: sub.currentPeriodEnd.toISOString() });
  }
  await audit(ctx, { action: `member.${action}`, resourceType: 'community_member', resourceId: memberId, communityId });
}

/** Mời qua email (gửi link tham gia) hoặc tạo link mời dùng nhiều lần. */
export async function invite(ctx: Ctx, communityId: string, input: { emails?: string[]; role?: 'member' | 'admin' }) {
  await requireCommunityPermission(ctx, communityId, 'member.manage');
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId) });
  if (!c) throw notFound();
  const inviter = ctx.actor.type === 'user' ? await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.actor.userId) }) : null;
  const results: Array<{ email: string | null; url: string }> = [];
  for (const email of input.emails?.length ? input.emails : [null]) {
    const token = randomToken(16);
    await ctx.db.insert(communityInvites).values({ communityId, email, token, role: input.role ?? 'member', invitedByUserId: inviter?.id ?? null, expiresAt: new Date(Date.now() + 14 * 86_400_000) });
    const url = `${ctx.env.APP_URL}/${c.slug}?invite=${token}`;
    if (email) await ctx.email.send(templates.invite(email, c.name, inviter?.name ?? 'Chủ hội', url));
    results.push({ email, url });
  }
  await audit(ctx, { action: 'member.invite', resourceType: 'community', resourceId: communityId, communityId, metadata: { count: results.length } });
  return results;
}

/** Xuất CSV theo bộ lọc hiện tại. */
export async function exportMembersCsv(ctx: Ctx, communityId: string, q: { status?: MemberStatus }): Promise<string> {
  await requireCommunityPermission(ctx, communityId, 'member.manage');
  const rows = await ctx.db.select({ m: communityMembers, u: users, tier: communityTiers }).from(communityMembers).innerJoin(users, eq(users.id, communityMembers.userId)).leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId)).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.status, q.status ?? 'active'))).orderBy(asc(communityMembers.joinedAt));
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['ten,email,handle,vai_tro,goi,trang_thai,tham_gia,hoat_dong_gan_nhat,gia_tri_tron_doi'];
  for (const r of rows) lines.push([r.u.name, r.u.email, r.u.handle, r.m.role, r.tier?.name ?? '', r.m.status, r.m.joinedAt.toISOString(), r.m.lastActiveAt?.toISOString() ?? '', r.m.lifetimeValueCents].map(esc).join(','));
  return '﻿' + lines.join('\n');
}

/** Danh sách thành viên công khai (tab Thành viên cho thành viên thường). */
export async function memberDirectory(ctx: Ctx, communityId: string, q: { q?: string; limit?: number }) {
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has('member.read')) throw forbidden();
  const conds = [eq(communityMembers.communityId, communityId), eq(communityMembers.status, 'active')];
  if (q.q) conds.push(or(ilike(users.name, `%${q.q}%`), ilike(users.handle, `%${q.q}%`))!);
  return ctx.db.select({ id: communityMembers.id, role: communityMembers.role, level: communityMembers.level, joinedAt: communityMembers.joinedAt, lastActiveAt: communityMembers.lastActiveAt, user: { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor, bio: users.bio }, tier: { key: communityTiers.key, name: communityTiers.name } }).from(communityMembers).innerJoin(users, eq(users.id, communityMembers.userId)).leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId)).where(and(...conds)).orderBy(desc(communityMembers.lastActiveAt)).limit(q.limit ?? 60);
}

/** Cập nhật hoạt động gần nhất theo lô (không update mỗi request): chỉ khi cách lần trước > 10 phút. */
export async function touchActivity(ctx: Ctx, communityId: string, userId: string): Promise<void> {
  await ctx.db.update(communityMembers).set({ lastActiveAt: ctx.now() }).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId), or(isNull(communityMembers.lastActiveAt), lt(communityMembers.lastActiveAt, new Date(ctx.now().getTime() - 10 * 60_000)))!));
  await ctx.db.update(users).set({ lastSeenAt: ctx.now() }).where(and(eq(users.id, userId), or(isNull(users.lastSeenAt), lt(users.lastSeenAt, new Date(ctx.now().getTime() - 10 * 60_000)))!));
}

export { conflict };
