// Link giới thiệu của một affiliate (Tài khoản → Affiliate): chương trình nền tảng (tự tạo khi chưa có), các chương
// trình của tôi kể cả hội chưa bật, những trang lấy link được trong một chương trình (trang hội, từng sản phẩm), và
// đếm lượt bấm của các link đó.
import { BUSINESS, sha256Hex } from '@hoiminh/config';
import { refCodes } from '@hoiminh/contracts';
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { affiliateAccounts, affiliateClicks, affiliateLinks, affiliatePrograms, communities, communityMembers, courses, products, workspaceMembers, type ProductKind } from '@hoiminh/db';
import type { Ctx } from '../context';
import { permissionsForRole, requireUser, type CommunityRole } from '../permissions';
import { activePartnerOf, effectiveDurationMonths } from './partner-terms';

type Program = typeof affiliatePrograms.$inferSelect;

/** Id cố định của chương trình nền tảng do hệ thống tự tạo: hai request cùng lúc ghi trùng id nên chỉ một dòng được tạo. */
const PLATFORM_PROGRAM_ID = '00000000-0000-4000-8000-00000000aff1';

/**
 * Chương trình affiliate nền tảng (giới thiệu người mở hội, mua gói Hội Mình). Cả hệ thống có đúng một chương trình.
 * Chưa có thì tạo với mức mặc định của kiến trúc: 40% trong 12 tháng đầu, giữ 30 ngày. Trước đây dòng này chỉ có
 * trong dữ liệu mẫu, nên web thật không ai lấy được link nền tảng và trang Hệ thống · Affiliate nền tảng báo lỗi.
 * Quản trị hệ thống đổi mức ở trang đó.
 */
export async function platformProgram(ctx: Ctx): Promise<Program> {
  const find = () => ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.scopeType, 'platform'), orderBy: asc(affiliatePrograms.createdAt) });
  const existing = await find();
  if (existing) return existing;
  await ctx.db.insert(affiliatePrograms).values({ id: PLATFORM_PROGRAM_ID, scopeType: 'platform', name: 'Affiliate nền tảng Hội Mình', status: 'active', commissionRateBps: 4000, commissionDurationMonths: 12, holdDays: BUSINESS.platformHoldDays, minWithdrawalMinor: BUSINESS.minWithdrawalMinor, cookieDays: BUSINESS.affiliateCookieDays }).onConflictDoNothing();
  return (await find())!;
}

/**
 * Các chương trình tôi làm affiliate được: nền tảng đứng đầu, rồi tới từng hội tôi đang tham gia.
 * Hội CHƯA BẬT affiliate vẫn nằm trong danh sách (`enabled: false`), để người dùng thấy vì sao chưa lấy được link và
 * chủ hội có lối đi bật (`canManage`); trước đây các hội này bị ẩn, người dùng chỉ thấy "Chưa có chương trình".
 * `hasAccount` cho biết tôi đã có ví trong chương trình đó chưa (chương trình tắt mà còn ví thì vẫn phải vào rút được).
 */
export async function myPrograms(ctx: Ctx) {
  const userId = requireUser(ctx);
  const isSuperAdmin = ctx.actor.type === 'user' && ctx.actor.isSuperAdmin;
  const platform = await platformProgram(ctx);
  const platformAccount = await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, userId), eq(affiliateAccounts.programId, platform.id)), columns: { id: true, commissionRateBps: true } });
  const rows = await ctx.db
    .select({ p: affiliatePrograms, c: { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor, logoUrl: communities.logoUrl }, memberRole: communityMembers.role, workspaceRole: workspaceMembers.role, accountId: affiliateAccounts.id, accountRateBps: affiliateAccounts.commissionRateBps })
    .from(communityMembers)
    .innerJoin(affiliatePrograms, eq(affiliatePrograms.communityId, communityMembers.communityId))
    .innerJoin(communities, eq(communities.id, communityMembers.communityId))
    .leftJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, communities.workspaceId), eq(workspaceMembers.userId, userId)))
    .leftJoin(affiliateAccounts, and(eq(affiliateAccounts.programId, affiliatePrograms.id), eq(affiliateAccounts.userId, userId)))
    .where(and(eq(communityMembers.userId, userId), inArray(communityMembers.status, ['active', 'cancelling'])))
    .orderBy(asc(communities.name));
  // Cùng thứ tự xét vai trò với resolveCommunityAccess: chủ không gian, rồi quản trị không gian, rồi vai trò trong hội.
  const roleOf = (r: (typeof rows)[number]): CommunityRole => (r.workspaceRole === 'owner' || isSuperAdmin ? 'owner' : r.workspaceRole ? 'admin' : r.memberRole);
  const partner = platformAccount ? await activePartnerOf(ctx, platformAccount.id) : null;
  const community = rows.map((r) => ({ id: r.p.id, name: r.c.name, scope: 'community' as const, community: r.c, rateBps: r.accountRateBps ?? r.p.commissionRateBps, durationMonths: r.p.commissionDurationMonths, enabled: r.p.status === 'active', canManage: permissionsForRole(roleOf(r)).includes('affiliates.manage'), hasAccount: Boolean(r.accountId) }));
  return [
    { id: platform.id, name: 'Nền tảng Hội Mình', scope: 'platform' as const, community: null, rateBps: platformAccount?.commissionRateBps ?? platform.commissionRateBps, durationMonths: effectiveDurationMonths(platform.commissionDurationMonths, partner), enabled: platform.status === 'active', canManage: isSuperAdmin, hasAccount: Boolean(platformAccount), isPartner: Boolean(partner) },
    ...community.filter((p) => p.enabled),
    ...community.filter((p) => !p.enabled),
  ];
}

/** Một trang lấy link được. `commission: false` là sản phẩm gắn khóa học mà chủ hội đã tắt hoa hồng bán lẻ. */
export interface LinkTarget { key: string; kind: 'platform' | 'community' | 'product'; label: string; url: string; productKind: ProductKind | null; priceMinor: number | null; commission: boolean }

/**
 * Những trang tôi lấy link được trong một chương trình. Link nào cũng chỉ là trang đó kèm `?ref=<mã của tôi>`: mã
 * được ghi nhớ ở mọi trang, nên dẫn người xem tới đúng thứ họ quan tâm mà lượt giới thiệu vẫn tính cho tôi.
 * Nền tảng: trang mở hội và trang chủ. Hội: trang giới thiệu hội, rồi từng sản phẩm đang bán (bán chạy đứng trước).
 */
export async function linkTargets(ctx: Ctx, program: Program, code: string): Promise<LinkTarget[]> {
  const ref = `?ref=${encodeURIComponent(code)}`;
  const page = (key: string, kind: 'platform' | 'community', label: string, path: string): LinkTarget => ({ key, kind, label, url: `${ctx.env.APP_URL}${path}${ref}`, productKind: null, priceMinor: null, commission: true });
  if (program.scopeType === 'platform' || !program.communityId) return [page('create', 'platform', 'Trang mở hội trên Hội Mình', '/tao-hoi'), page('home', 'platform', 'Trang chủ Hội Mình', '/')];
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, program.communityId), columns: { slug: true } });
  if (!community) return [];
  const rows = await ctx.db
    .select({ id: products.id, name: products.name, slug: products.slug, kind: products.kind, priceMinor: products.priceMinor, affiliateEnabled: courses.affiliateEnabled })
    .from(products)
    .leftJoin(courses, eq(courses.id, products.courseId))
    .where(and(eq(products.communityId, program.communityId), eq(products.status, 'published'), isNull(products.deletedAt)))
    .orderBy(desc(products.salesCount), asc(products.name))
    .limit(100);
  return [
    page('community', 'community', 'Trang giới thiệu hội', `/${community.slug}`),
    ...rows.map((p): LinkTarget => ({ key: p.id, kind: 'product', label: p.name, url: `${ctx.env.APP_URL}/${community.slug}/cua-hang/${p.slug}${ref}`, productKind: p.kind, priceMinor: p.priceMinor, commission: p.affiliateEnabled !== false })),
  ];
}

/** Cùng một người xem mở lại cùng một mã trong khoảng này (tải lại trang, mở lại link) thì không đếm thêm. */
export const CLICK_REPEAT_MINUTES = 30;

/**
 * Đếm một lượt bấm cho link dạng `?ref=<mã>`: trang hội, trang sản phẩm, trang mở hội, tức mọi link trang Affiliate
 * đưa ra. Trước đây chỉ link `/r/<mã>` mới ghi lượt bấm (trackClick), nên ô "Lượt bấm" của affiliate gần như luôn là 0.
 * Hàm này CHỈ ĐẾM, không ghi người giới thiệu: người giới thiệu vẫn tính theo các mã người xem mang theo lúc đăng ký
 * hoặc lúc vào hội (attachAttribution, resolveReferrer), nên luật tính hoa hồng không đổi.
 * Không đếm khi: mã không tồn tại, tài khoản affiliate hoặc chương trình đang tắt; chính affiliate tự mở link của
 * mình; cùng một người xem (cùng mã khách, hoặc cùng địa chỉ mạng và trình duyệt) đã được đếm trong 30 phút gần đây.
 * Trả về true khi lượt bấm được đếm.
 */
export async function recordLandingClick(ctx: Ctx, ref: string, meta: { visitorId: string; ip?: string; userAgent?: string; landingUrl?: string; referrer?: string }): Promise<boolean> {
  const first = refCodes(ref)[0];
  if (!first) return false;
  // Mã chung đi kèm phạm vi (trang mà link được mở) được đổi thành mã riêng của đúng chương trình. Nạp muộn để tránh
  // vòng import: referral-codes.ts dùng platformProgram của tệp này.
  const { canonicalRefs } = await import('./referral-codes');
  const [code] = await canonicalRefs(ctx, first);
  if (!code) return false;
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.affiliateCode, code), eq(affiliateAccounts.status, 'active')) });
  if (!acc) return false;
  if (ctx.actor.type === 'user' && ctx.actor.userId === acc.userId) return false;
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, acc.programId), columns: { status: true } });
  if (program?.status !== 'active') return false;
  const ipHash = meta.ip ? await sha256Hex(meta.ip) : null;
  const userAgentHash = meta.userAgent ? await sha256Hex(meta.userAgent) : null;
  const now = ctx.now();
  const sameViewer = ipHash && userAgentHash ? or(eq(affiliateClicks.visitorId, meta.visitorId), and(eq(affiliateClicks.ipHash, ipHash), eq(affiliateClicks.userAgentHash, userAgentHash))) : eq(affiliateClicks.visitorId, meta.visitorId);
  const recent = await ctx.db.query.affiliateClicks.findFirst({ where: and(eq(affiliateClicks.affiliateAccountId, acc.id), gt(affiliateClicks.clickedAt, new Date(now.getTime() - CLICK_REPEAT_MINUTES * 60_000)), sameViewer), columns: { id: true } });
  if (recent) return false;
  const link = await ctx.db.query.affiliateLinks.findFirst({ where: eq(affiliateLinks.affiliateAccountId, acc.id), columns: { id: true } });
  await ctx.db.insert(affiliateClicks).values({ affiliateAccountId: acc.id, linkId: link?.id ?? null, visitorId: meta.visitorId, ipHash, userAgentHash, landingUrl: meta.landingUrl?.slice(0, 500) ?? null, referrer: meta.referrer?.slice(0, 500) ?? null, clickedAt: now });
  await ctx.db.update(affiliateAccounts).set({ clickCount: sql`${affiliateAccounts.clickCount} + 1` }).where(eq(affiliateAccounts.id, acc.id));
  await ctx.events.emit('affiliate.clicked', { affiliateAccountId: acc.id, visitorId: meta.visitorId });
  return true;
}
