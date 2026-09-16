// Dữ liệu khung ứng dụng: thanh bên hội (tab, số liệu, tiến độ), switcher các hội của tôi, khối sự kiện sắp tới.
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { communities, communityMembers, communityTiers, courseProgress, courses, events, userCommunityPrefs } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { resolveCommunityAccess } from '../permissions';
import { getCommunityBySlug } from './communities';
import { FLAG, flagsFor } from './feature-flags';

/** Khung hội theo slug: thông tin hội, vai trò người xem, tab hiển thị, số liệu, % khóa học, sự kiện sắp tới, gói Premium. */
export async function communityShell(ctx: Ctx, slug: string) {
  const c = await getCommunityBySlug(ctx, slug);
  const access = await resolveCommunityAccess(ctx, c.id);
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const online = await raw<{ c: number }>(ctx.db, sql`select count(*)::int as c from community_members where community_id = ${c.id} and status = 'active' and last_active_at > now() - interval '15 minutes'`);
  const admins = await raw<{ c: number }>(ctx.db, sql`select count(*)::int as c from community_members where community_id = ${c.id} and role in ('owner','admin') and status = 'active'`);
  const [premium, upcoming, eventCount] = await Promise.all([
    ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, c.id), eq(communityTiers.key, 'premium'), eq(communityTiers.isActive, true)) }),
    ctx.db.query.events.findMany({ where: and(eq(events.communityId, c.id), gte(events.endsAt, ctx.now()), sql`${events.status} <> 'cancelled'`), orderBy: asc(events.startsAt), limit: 2, columns: { id: true, title: true, startsAt: true, endsAt: true, kind: true, meetingProvider: true, location: true } }),
    raw<{ c: number }>(ctx.db, sql`select count(*)::int as c from events where community_id = ${c.id} and status <> 'cancelled' and starts_at between now() and now() + interval '7 days'`),
  ]);
  let coursePercent: number | null = null;
  if (userId) {
    const rows = await ctx.db.select({ percent: courseProgress.percent }).from(courseProgress).innerJoin(courses, eq(courses.id, courseProgress.courseId)).where(and(eq(courseProgress.userId, userId), eq(courses.communityId, c.id)));
    if (rows.length) coursePercent = Math.round(rows.reduce((n, r) => n + r.percent, 0) / rows.length);
  }
  const tierKey = access.tierId ? (await ctx.db.query.communityTiers.findFirst({ where: eq(communityTiers.id, access.tierId), columns: { key: true, name: true } })) : null;
  // Cờ tính năng của platform đè lên lựa chọn của chủ hội: super admin tắt cờ thì tab biến mất ở mọi hội.
  const flags = await flagsFor(ctx, { workspaceId: c.workspaceId });
  const tabs = { ...c.tabs };
  if (!flags[FLAG.store]) tabs.store = false;
  if (!flags[FLAG.affiliateLeaderboard]) tabs.affiliate = false;
  return {
    community: { id: c.id, workspaceId: c.workspaceId, name: c.name, slug: c.slug, shortDescription: c.shortDescription, logoMark: c.logoMark, logoColor: c.logoColor, logoUrl: c.logoUrl, coverColor: c.coverColor, coverUrl: c.coverUrl, coverTagline: c.coverTagline, tabs, status: c.status, pricingMode: c.pricingMode, doorsOpen: c.doorsOpen, customDomain: c.customDomain, memberCount: c.memberCount, requireSpace: c.requireSpace, enabledProviders: c.enabledProviders },
    flags,
    viewer: { role: access.role, memberId: access.memberId, memberStatus: access.memberStatus, tier: tierKey, permissions: [...access.permissions], isMember: access.memberStatus === 'active' || access.memberStatus === 'cancelling' || access.role === 'owner' || access.role === 'admin' },
    stats: { members: c.memberCount, online: online[0]?.c ?? 0, admins: admins[0]?.c ?? 0, upcomingEvents: eventCount[0]?.c ?? 0 },
    coursePercent,
    upcomingEvents: upcoming,
    premium: premium ? { tierId: premium.id, monthlyMinor: premium.monthlyMinor, yearlyMinor: premium.yearlyMinor, oneTimeMinor: premium.oneTimeMinor, benefits: premium.benefits } : null,
  };
}

/** Các hội tôi tham gia hoặc làm chủ (switcher), theo thứ tự ghim/sắp xếp của người dùng. */
export async function myCommunities(ctx: Ctx) {
  if (ctx.actor.type !== 'user') return [];
  const userId = ctx.actor.userId;
  const rows = await ctx.db
    .select({ c: { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor, memberCount: communities.memberCount, status: communities.status }, m: { role: communityMembers.role, status: communityMembers.status }, pref: userCommunityPrefs })
    .from(communityMembers)
    .innerJoin(communities, eq(communities.id, communityMembers.communityId))
    .leftJoin(userCommunityPrefs, and(eq(userCommunityPrefs.communityId, communities.id), eq(userCommunityPrefs.userId, userId)))
    .where(and(eq(communityMembers.userId, userId), inArray(communityMembers.status, ['active', 'cancelling']), isNull(communities.deletedAt)))
    .orderBy(desc(sql`coalesce(${userCommunityPrefs.pinned}, false)`), asc(sql`coalesce(${userCommunityPrefs.sortOrder}, 0)`), asc(communities.name));
  return rows.filter((r) => !r.pref?.hidden).map((r) => ({ ...r.c, role: r.m.role, memberStatus: r.m.status, pinned: r.pref?.pinned ?? false }));
}
