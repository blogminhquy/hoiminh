// Giới thiệu khóa học ngay ở thư viện khóa học (chủ dự án yêu cầu ngày 23/11/2026). Mỗi thẻ khóa có một dòng chữ nhỏ
// "Nhận 99.800đ khi chia sẻ"; bấm vào mở bảng hai lựa chọn:
//   - Giới thiệu khóa học này: link trang bán lẻ của khóa, nhận một lần cho mỗi đơn.
//   - Giới thiệu vào hội: link trang giới thiệu hội, nhận mỗi lần người được mời đóng phí thành viên.
// Hai hàm tách riêng vì thư viện mở ra là gọi hàm đầu: hàm đó chỉ tính số tiền, KHÔNG tạo ví affiliate, để không đẻ ví cho
// mọi thành viên chỉ vì họ xem thư viện. Ví chỉ được tạo khi người dùng bấm mở bảng chia sẻ (hàm thứ hai), giống như lúc
// mở trang Tài khoản → Affiliate.
import type { CourseShareLinks, CourseShareOffer } from '@hoiminh/contracts';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { affiliateAccounts, affiliatePrograms, communities, communityTiers, courses, products } from '@hoiminh/db';
import type { Ctx } from '../context';
import { forbidden, invalidState } from '../errors';
import { commissionOf } from '../lib/money';
import { requireUser, resolveCommunityAccess } from '../permissions';
import { ensureAccount } from './affiliate';
import { communityHasFeature } from './plans';
import { personalCodeOf } from './referral-codes';

type Program = typeof affiliatePrograms.$inferSelect;

const OFF: CourseShareOffer = { enabled: false, programId: null, durationMonths: null, monthlyCommissionMinor: null, courses: [] };

/**
 * Chương trình của hội nếu đang tính hoa hồng được: chương trình đang bật và gói của hội có tính năng affiliate
 * (cùng hai điều kiện máy chủ xét khi ghi hoa hồng, xem createCommissionForPayment).
 */
async function liveProgram(ctx: Ctx, communityId: string): Promise<Program | null> {
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.communityId, communityId) });
  if (!program || program.status !== 'active') return null;
  if (!(await communityHasFeature(ctx, communityId, 'affiliate'))) return null;
  return program;
}

/**
 * Giá một tháng rẻ nhất trong các gói thành viên đang bán. Gói bán theo kỳ nhiều tháng thì chia đều ra tháng. Hội không
 * có gói trả phí thì null: giới thiệu vào hội không sinh hoa hồng, nên không hứa số tiền nào.
 */
export function cheapestMonthlyMinor(tiers: Array<{ monthlyMinor: number | null; terms: Array<{ months: number; amountMinor: number }> }>): number | null {
  let best: number | null = null;
  for (const t of tiers) {
    const perMonth = [t.monthlyMinor ?? 0, ...t.terms.filter((x) => x.months > 0).map((x) => Math.floor(x.amountMinor / x.months))].filter((v) => v > 0);
    for (const v of perMonth) if (best === null || v < best) best = v;
  }
  return best;
}

/** Sản phẩm bán lẻ của từng khóa trong hội (khóa có nhiều sản phẩm thì lấy cái bán chạy nhất). */
async function courseProducts(ctx: Ctx, communityId: string, courseId?: string) {
  const rows = await ctx.db
    .select({ courseId: products.courseId, slug: products.slug, priceMinor: products.priceMinor, affiliateEnabled: courses.affiliateEnabled })
    .from(products)
    .innerJoin(courses, eq(courses.id, products.courseId))
    .where(and(eq(products.communityId, communityId), eq(products.kind, 'course'), eq(products.status, 'published'), isNull(products.deletedAt), isNotNull(products.courseId), courseId ? eq(products.courseId, courseId) : undefined))
    .orderBy(desc(products.salesCount));
  const byCourse = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (r.courseId && !byCourse.has(r.courseId)) byCourse.set(r.courseId, r);
  return byCourse;
}

/** Tôi có được giới thiệu trong hội này không: là thành viên (hoặc người quản lý) và ví của tôi, nếu đã có, không bị khóa. */
async function canShare(ctx: Ctx, communityId: string, program: Program, userId: string): Promise<boolean> {
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has('community.read')) return false;
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, userId), eq(affiliateAccounts.programId, program.id)), columns: { status: true } });
  return !acc || acc.status === 'active';
}

/**
 * Số tiền tôi nhận khi chia sẻ, cho thư viện khóa học của một hội. Không tạo ví. `enabled: false` khi hội chưa bật
 * affiliate, gói hội không có affiliate, tôi không phải thành viên, hoặc ví của tôi đang bị khóa: thẻ khóa không hiện dòng chia sẻ.
 * Mức hoa hồng là mức riêng của tôi nếu chủ hội đã đặt, không thì mức chung; làm tròn xuống như lúc ghi hoa hồng thật.
 */
export async function shareOffer(ctx: Ctx, communityId: string): Promise<CourseShareOffer> {
  const userId = requireUser(ctx);
  const program = await liveProgram(ctx, communityId);
  if (!program || !(await canShare(ctx, communityId, program, userId))) return OFF;
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, userId), eq(affiliateAccounts.programId, program.id)), columns: { commissionRateBps: true } });
  const rate = acc?.commissionRateBps ?? program.commissionRateBps;
  if (rate <= 0) return OFF;
  const tiers = await ctx.db.query.communityTiers.findMany({ where: and(eq(communityTiers.communityId, communityId), eq(communityTiers.isActive, true)), columns: { monthlyMinor: true, terms: true } });
  const monthly = cheapestMonthlyMinor(tiers);
  const byCourse = await courseProducts(ctx, communityId);
  const items = [...byCourse.values()]
    .filter((p) => p.affiliateEnabled && p.priceMinor > 0)
    .map((p) => ({ courseId: p.courseId!, priceMinor: p.priceMinor, commissionMinor: commissionOf(p.priceMinor, rate) }))
    .filter((p) => p.commissionMinor > 0);
  const monthlyCommission = monthly ? commissionOf(monthly, rate) : 0;
  return { enabled: true, programId: program.id, durationMonths: program.commissionDurationMonths, monthlyCommissionMinor: monthlyCommission > 0 ? monthlyCommission : null, courses: items };
}

/**
 * Link chia sẻ thật, kèm mã của tôi (mã chung nếu tôi đã đặt, không thì mã riêng của ví trong hội này). Tạo ví nếu chưa có.
 * `courseUrl`: trang bán lẻ của khóa, null khi khóa không bán lẻ hoặc bán lẻ không tính hoa hồng. `communityUrl`: trang
 * giới thiệu hội. Mã đi theo link được ghi nhớ ở mọi trang, nên người xem đi tiếp sang trang khác vẫn tính cho tôi.
 */
export async function shareLinks(ctx: Ctx, communityId: string, courseId: string | null): Promise<CourseShareLinks> {
  const userId = requireUser(ctx);
  const program = await liveProgram(ctx, communityId);
  if (!program) throw invalidState('Hội chưa bật chương trình giới thiệu');
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has('community.read')) throw forbidden('Tham gia hội để giới thiệu khóa học');
  const acc = await ensureAccount(ctx, userId, program.id);
  if (acc.status !== 'active') throw invalidState('Tài khoản giới thiệu của bạn trong hội này đang tạm khóa');
  const code = (await personalCodeOf(ctx, userId)) ?? acc.affiliateCode;
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId), columns: { slug: true } });
  const ref = `?ref=${encodeURIComponent(code)}`;
  const base = `${ctx.env.APP_URL}/${community!.slug}`;
  let courseUrl: string | null = null;
  if (courseId) {
    const p = (await courseProducts(ctx, communityId, courseId)).get(courseId);
    if (p && p.affiliateEnabled && p.priceMinor > 0) courseUrl = `${base}/cua-hang/${p.slug}${ref}`;
  }
  return { code, communityUrl: `${base}${ref}`, courseUrl };
}
