// Hồ sơ người dùng: xem công khai, chỉnh sửa, tìm theo handle.
import { eq, and, desc, sql } from 'drizzle-orm';
import { affiliateLeaderboardSnapshots, affiliateAccounts, comments, communities, communityMembers, communityTiers, courseProgress, courses, posts, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { conflict, notFound } from '../errors';
import { requireUser } from '../permissions';
import { audit } from './audit';

export interface ProfileUpdate {
  name?: string; handle?: string; bio?: string; location?: string; occupation?: string; avatarUrl?: string | null; coverColor?: string;
  links?: Array<{ kind: string; label: string; url: string }>; privacy?: Partial<{ publicProfile: boolean; showProgress: boolean; showCommunities: boolean; allowMessages: boolean }>;
  timezone?: string; locale?: string;
}

/** Cập nhật hồ sơ của chính mình. */
export async function updateProfile(ctx: Ctx, input: ProfileUpdate) {
  const userId = requireUser(ctx);
  const current = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!current) throw notFound();
  if (input.handle && input.handle !== current.handle) {
    const taken = await ctx.db.query.users.findFirst({ where: eq(users.handle, input.handle), columns: { id: true } });
    if (taken) throw conflict('Tên người dùng đã có người dùng');
  }
  const [row] = await ctx.db
    .update(users)
    .set({
      name: input.name ?? current.name, handle: input.handle ?? current.handle, bio: input.bio ?? current.bio, location: input.location ?? current.location, occupation: input.occupation ?? current.occupation,
      avatarUrl: input.avatarUrl === undefined ? current.avatarUrl : input.avatarUrl, coverColor: input.coverColor ?? current.coverColor, links: input.links ?? current.links,
      privacy: { ...current.privacy, ...(input.privacy ?? {}) }, timezone: input.timezone ?? current.timezone, locale: input.locale ?? current.locale, updatedAt: ctx.now(),
    })
    .where(eq(users.id, userId))
    .returning();
  await audit(ctx, { action: 'profile.update', resourceType: 'user', resourceId: userId });
  return row!;
}

/** Hồ sơ công khai theo handle: thống kê, bài viết, tiến độ, hội cùng tham gia, hạng cộng sự. */
export async function publicProfile(ctx: Ctx, handle: string) {
  const user = await ctx.db.query.users.findFirst({ where: eq(users.handle, handle) });
  if (!user || user.status === 'deleted') throw notFound('Không tìm thấy thành viên');
  const viewerId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const isSelf = viewerId === user.id;
  const [[postStats], [commentStats], memberships, progress, ranks] = await Promise.all([
    ctx.db.select({ c: sql<number>`count(*)::int` }).from(posts).where(and(eq(posts.authorUserId, user.id), sql`${posts.deletedAt} is null`)),
    ctx.db.select({ c: sql<number>`count(*)::int` }).from(comments).where(and(eq(comments.authorUserId, user.id), sql`${comments.deletedAt} is null`)),
    ctx.db.select({ m: communityMembers, community: { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor }, tier: { key: communityTiers.key, name: communityTiers.name } }).from(communityMembers).innerJoin(communities, eq(communities.id, communityMembers.communityId)).leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId)).where(and(eq(communityMembers.userId, user.id), eq(communityMembers.status, 'active'))),
    ctx.db.select({ p: courseProgress, course: { id: courses.id, title: courses.title } }).from(courseProgress).innerJoin(courses, eq(courses.id, courseProgress.courseId)).where(eq(courseProgress.userId, user.id)),
    ctx.db.select({ s: affiliateLeaderboardSnapshots, communityId: affiliateLeaderboardSnapshots.communityId }).from(affiliateLeaderboardSnapshots).innerJoin(affiliateAccounts, eq(affiliateAccounts.id, affiliateLeaderboardSnapshots.affiliateAccountId)).where(and(eq(affiliateAccounts.userId, user.id), eq(affiliateLeaderboardSnapshots.periodType, 'month'))).orderBy(desc(affiliateLeaderboardSnapshots.computedAt)).limit(1),
  ]);
  const recentPosts = await ctx.db.query.posts.findMany({ where: and(eq(posts.authorUserId, user.id), sql`${posts.deletedAt} is null`), orderBy: desc(posts.createdAt), limit: 10, with: {} });
  const privacy = user.privacy;
  return {
    user: { id: user.id, name: user.name, handle: user.handle, avatarUrl: user.avatarUrl, coverColor: user.coverColor, bio: user.bio, location: user.location, occupation: user.occupation, links: user.links, createdAt: user.createdAt, lastSeenAt: user.lastSeenAt, privacy, isSelf },
    stats: { posts: postStats?.c ?? 0, comments: commentStats?.c ?? 0, coursesCompleted: progress.filter((p) => p.p.percent === 100).length, coursesTotal: progress.length, communities: memberships.length, referrals: ranks[0]?.s.referralsCount ?? 0 },
    memberships: privacy.showCommunities || isSelf ? memberships.map((m) => ({ ...m.community, role: m.m.role, tier: m.tier, level: m.m.level, joinedAt: m.m.joinedAt })) : [],
    progress: privacy.showProgress || isSelf ? progress.map((p) => ({ courseId: p.course.id, title: p.course.title, percent: p.p.percent, completedAt: p.p.completedAt })) : [],
    leaderboard: ranks[0] ? { rank: ranks[0].s.rank, referrals: ranks[0].s.referralsCount, paid: ranks[0].s.paidCount, communityId: ranks[0].communityId } : null,
    recentPosts,
  };
}

/** Tài khoản của chính mình (đầy đủ). */
export async function me(ctx: Ctx) {
  const userId = requireUser(ctx);
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound();
  return user;
}
