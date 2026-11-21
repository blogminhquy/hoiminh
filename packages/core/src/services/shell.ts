// Dữ liệu khung ứng dụng: thanh bên hội (tab, số liệu, tiến độ), switcher các hội của tôi, khối sự kiện sắp tới.
import { promoActive, tierTerms } from '@hoiminh/contracts';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { affiliateAccounts, affiliatePrograms, communities, communityMembers, communityTiers, courseProgress, courses, events, userCommunityPrefs } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { resolveCommunityAccess } from '../permissions';
import { getCommunityBySlug } from './communities';
import { FLAG, flagsFor } from './feature-flags';
import { ownerPaymentMethods } from './owner-gateways';
import { planOfCommunity, planTable } from './plans';

/** Khung hội theo slug: thông tin hội, vai trò người xem, tab hiển thị, số liệu, % khóa học, sự kiện sắp tới, gói Premium, affiliate của hội với người xem. */
export async function communityShell(ctx: Ctx, slug: string) {
  const c = await getCommunityBySlug(ctx, slug);
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  // Các phần dưới đây không phụ thuộc nhau nên gửi đi cùng lúc: database nhận một loạt câu lệnh và trả về một lần,
  // thay vì khung hội phải chờ từng câu một. Ba con số của thanh bên (đang online, quản trị, sự kiện 7 ngày tới) gộp vào một câu lệnh.
  const [access, stats, premium, upcoming, progressRows, flags, plans, program, myAffiliate] = await Promise.all([
    resolveCommunityAccess(ctx, c.id),
    raw<{ online: number; admins: number; events: number }>(ctx.db, sql`select
      (select count(*)::int from community_members where community_id = ${c.id} and status = 'active' and last_active_at > now() - interval '15 minutes') as online,
      (select count(*)::int from community_members where community_id = ${c.id} and role in ('owner','admin') and status = 'active') as admins,
      (select count(*)::int from events where community_id = ${c.id} and status <> 'cancelled' and starts_at between now() and now() + interval '7 days') as events`),
    ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, c.id), eq(communityTiers.key, 'premium'), eq(communityTiers.isActive, true)) }),
    ctx.db.query.events.findMany({ where: and(eq(events.communityId, c.id), gte(events.endsAt, ctx.now()), sql`${events.status} <> 'cancelled'`), orderBy: asc(events.startsAt), limit: 2, columns: { id: true, title: true, startsAt: true, endsAt: true, kind: true, meetingProvider: true, location: true } }),
    userId ? ctx.db.select({ percent: courseProgress.percent }).from(courseProgress).innerJoin(courses, eq(courses.id, courseProgress.courseId)).where(and(eq(courseProgress.userId, userId), eq(courses.communityId, c.id))) : [],
    // Cờ tính năng của platform đè lên lựa chọn của chủ hội: super admin tắt cờ thì tab biến mất ở mọi hội.
    flagsFor(ctx, { workspaceId: c.workspaceId }),
    planTable(ctx),
    // Chương trình affiliate của hội, và tài khoản affiliate của người xem trong chương trình đó nếu đã có (chỉ đọc, không mở tài khoản).
    ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.communityId, c.id), columns: { id: true, status: true, commissionRateBps: true, commissionDurationMonths: true, leaderboardVisibility: true } }),
    userId ? ctx.db.select({ rateBps: affiliateAccounts.commissionRateBps }).from(affiliateAccounts).innerJoin(affiliatePrograms, eq(affiliatePrograms.id, affiliateAccounts.programId)).where(and(eq(affiliateAccounts.userId, userId), eq(affiliatePrograms.communityId, c.id))).limit(1) : [],
  ]);
  const coursePercent = progressRows.length ? Math.round(progressRows.reduce((n, r) => n + r.percent, 0) / progressRows.length) : null;
  const tierKey = access.tierId ? (await ctx.db.query.communityTiers.findFirst({ where: eq(communityTiers.id, access.tierId), columns: { key: true, name: true } })) : null;
  const tabs = { ...c.tabs };
  if (!flags[FLAG.store]) tabs.store = false;
  // `tabs.affiliate` là bảng xếp hạng affiliate (tab "Xếp hạng" trong trang Affiliate của hội), không phải cả mục Affiliate.
  if (!flags[FLAG.affiliateLeaderboard]) tabs.affiliate = false;
  // Gói của hội: bảng xếp hạng chỉ hiện khi gói có affiliate; người quản lý nhận thêm số liệu gói để giao diện khóa nút và mời nâng gói.
  const plan = planOfCommunity(c, plans, ctx.now());
  if (!plan.features.includes('affiliate')) tabs.affiliate = false;
  const manages = access.permissions.has('settings.manage');
  const isMember = access.memberStatus === 'active' || access.memberStatus === 'cancelling' || access.role === 'owner' || access.role === 'admin';
  // Affiliate của hội với người xem, cho mục "Affiliate" trên thanh bên và trang Affiliate của thành viên. Chỉ thành viên
  // mới nhận; khách và hội chưa có chương trình là null. `enabled`: chương trình đang bật và gói của hội có affiliate
  // (thiếu một trong hai thì đơn không sinh hoa hồng). Mục này không phụ thuộc cờ bảng xếp hạng: cờ đó chỉ ẩn bảng xếp
  // hạng (tabs.affiliate), không ẩn link giới thiệu. `rateBps`: mức riêng của tài khoản affiliate người xem nếu có,
  // không thì mức chung của chương trình.
  const affiliate = isMember && program
    ? { programId: program.id, enabled: program.status === 'active' && plan.features.includes('affiliate'), rateBps: myAffiliate[0]?.rateBps ?? program.commissionRateBps, durationMonths: program.commissionDurationMonths, hasAccount: myAffiliate.length > 0, leaderboardVisibility: program.leaderboardVisibility }
    : null;
  return {
    community: { id: c.id, workspaceId: c.workspaceId, name: c.name, slug: c.slug, shortDescription: c.shortDescription, logoMark: c.logoMark, logoColor: c.logoColor, logoUrl: c.logoUrl, coverColor: c.coverColor, coverUrl: c.coverUrl, coverTagline: c.coverTagline, tabs, status: c.status, visibility: c.visibility, pricingMode: c.pricingMode, doorsOpen: c.doorsOpen, ...(await buyerMethods(ctx, c.id)), customDomain: c.customDomain, memberCount: c.memberCount, requireSpace: c.requireSpace, enabledProviders: c.enabledProviders },
    flags,
    plan: manages ? { key: plan.key, name: plan.name, memberCap: plan.memberCap, features: plan.features, endsAt: plan.endsAt, needsPlan: plan.needsPlan, full: plan.full, isFreeSlot: plan.isFreeSlot } : null,
    // `canView`: người xem vào được bên trong hội (thành viên, hoặc bất kỳ ai khi hội mở). Web dựa vào đó để mở khung hội ở chế độ chỉ xem.
    viewer: { role: access.role, memberId: access.memberId, memberStatus: access.memberStatus, tier: tierKey, permissions: [...access.permissions], canView: access.canView, isMember },
    affiliate,
    stats: { members: c.memberCount, online: stats[0]?.online ?? 0, admins: stats[0]?.admins ?? 0, upcomingEvents: stats[0]?.events ?? 0 },
    coursePercent,
    upcomingEvents: upcoming,
    // `terms`: các kỳ hạn đang bán. `promo`: khuyến mãi đang chạy của chủ hội (hết hạn thì null), giao diện tính giá sau giảm bằng applyPromo.
    premium: premium ? { tierId: premium.id, monthlyMinor: premium.monthlyMinor, yearlyMinor: premium.yearlyMinor, oneTimeMinor: premium.oneTimeMinor, terms: tierTerms(premium), promo: promoActive(c.pricingPromo, ctx.now()) ? c.pricingPromo : null, benefits: premium.benefits } : null,
  };
}

/** Các hội tôi tham gia hoặc làm chủ (switcher), theo thứ tự ghim/sắp xếp của người dùng. */
export async function myCommunities(ctx: Ctx) {
  // API key gắn với một workspace: "hội của tôi" là mọi hội của workspace đó. Trước đây nhánh này trả mảng rỗng,
  // nên tool `list_communities` của MCP không bao giờ thấy hội nào và trợ lý không có id để gọi các lệnh khác.
  if (ctx.actor.type === 'api_key') {
    const rows = await ctx.db.query.communities.findMany({ where: and(eq(communities.workspaceId, ctx.actor.workspaceId), isNull(communities.deletedAt)), orderBy: asc(communities.name), columns: { id: true, name: true, slug: true, logoMark: true, logoColor: true, logoUrl: true, memberCount: true, status: true, workspaceId: true, pricingMode: true, shortDescription: true } });
    return rows.map((c) => ({ ...c, role: 'owner' as const, memberStatus: 'active' as const, pinned: false }));
  }
  if (ctx.actor.type !== 'user') return [];
  const userId = ctx.actor.userId;
  const rows = await ctx.db
    .select({ c: { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor, logoUrl: communities.logoUrl, memberCount: communities.memberCount, status: communities.status }, m: { role: communityMembers.role, status: communityMembers.status }, pref: userCommunityPrefs })
    .from(communityMembers)
    .innerJoin(communities, eq(communities.id, communityMembers.communityId))
    .leftJoin(userCommunityPrefs, and(eq(userCommunityPrefs.communityId, communities.id), eq(userCommunityPrefs.userId, userId)))
    .where(and(eq(communityMembers.userId, userId), inArray(communityMembers.status, ['active', 'cancelling']), isNull(communities.deletedAt)))
    .orderBy(desc(sql`coalesce(${userCommunityPrefs.pinned}, false)`), asc(sql`coalesce(${userCommunityPrefs.sortOrder}, 0)`), asc(communities.name));
  return rows.filter((r) => !r.pref?.hidden).map((r) => ({ ...r.c, role: r.m.role, memberStatus: r.m.status, pinned: r.pref?.pinned ?? false }));
}

/**
 * Cách thanh toán người mua thấy ở bước thanh toán của hội: chỉ cách chủ hội đã cài và đang bật, cách mặc định chọn sẵn.
 * `paymentsReady` = có ít nhất một cách; chưa có thì các nút mua bị khóa.
 */
async function buyerMethods(ctx: Ctx, communityId: string) {
  const m = await ownerPaymentMethods(ctx, communityId);
  return { paymentsReady: m.methods.length > 0, paymentMethods: m.methods, defaultPaymentMethod: m.defaultMethod, bankConfirmMode: m.bank?.enabled ? m.bank.confirmMode : null };
}
