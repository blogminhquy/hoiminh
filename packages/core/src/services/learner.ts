// Khu học tập của người mua lẻ (V2, mục 153): một người có thể chỉ mua khóa/sản phẩm mà không tham gia hội nào.
// Thư viện dựng từ entitlement (thứ đã sở hữu), không phụ thuộc community_members, nên chạy được với người có 0 hội.
import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { bundleItems, communities, communityMembers, courseModules, courseProgress, courses, entitlements, lessons, products } from '@hoiminh/db';
import type { Ctx } from '../context';
import { requireUser } from '../permissions';

const communityCols = { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor, pricingMode: communities.pricingMode, doorsOpen: communities.doorsOpen };

/** Nguồn quyền: mua lẻ, nằm trong combo, gói đăng ký, hoặc chủ hội cấp tay. */
export type LibrarySource = 'purchase' | 'bundle' | 'subscription' | 'granted';

function sourceOf(sourceType: string): LibrarySource {
  if (sourceType === 'purchase') return 'purchase';
  if (sourceType === 'community_bundle') return 'bundle';
  if (sourceType === 'subscription' || sourceType === 'free_tier') return 'subscription';
  return 'granted';
}

/** Entitlement còn hiệu lực của tôi, theo loại tài nguyên. */
async function activeEntitlements(ctx: Ctx, userId: string, types: Array<'course' | 'product' | 'bundle' | 'digital'>) {
  return ctx.db.query.entitlements.findMany({
    where: and(
      eq(entitlements.userId, userId),
      inArray(entitlements.resourceType, types),
      eq(entitlements.status, 'active'),
      or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, ctx.now())),
    ),
    orderBy: desc(entitlements.startsAt),
  });
}

/**
 * Thư viện của tôi: khóa học và sản phẩm số đã sở hữu, kèm tiến độ và bài học nên vào tiếp.
 * Khóa học mở nhờ tư cách thành viên (tier) không nằm ở đây: chúng thuộc khung hội, xem `/:slug/khoa-hoc`.
 */
export async function myLibrary(ctx: Ctx) {
  const userId = requireUser(ctx);
  const owned = await activeEntitlements(ctx, userId, ['course', 'product', 'bundle', 'digital']);

  // Gom id khóa học: entitlement thẳng vào khóa, qua sản phẩm khóa học, hoặc qua combo chứa sản phẩm khóa học.
  const courseSource = new Map<string, LibrarySource>();
  const digitalProductIds = new Map<string, LibrarySource>();
  const productIds = owned.filter((e) => e.resourceType === 'product' || e.resourceType === 'bundle').map((e) => e.resourceId);
  const productRows = productIds.length ? await ctx.db.query.products.findMany({ where: and(inArray(products.id, productIds), isNull(products.deletedAt)) }) : [];
  const byProductId = new Map(productRows.map((p) => [p.id, p]));

  for (const e of owned) {
    const src = sourceOf(e.sourceType);
    if (e.resourceType === 'course') {
      if (!courseSource.has(e.resourceId)) courseSource.set(e.resourceId, src);
      continue;
    }
    const p = byProductId.get(e.resourceId);
    if (!p) continue;
    if (p.kind === 'digital') { if (!digitalProductIds.has(p.id)) digitalProductIds.set(p.id, src); continue; }
    if (p.courseId && !courseSource.has(p.courseId)) courseSource.set(p.courseId, src);
  }

  // Combo: mở thêm các sản phẩm con mà entitlement con chưa kịp ghi (mua combo trước khi có sản phẩm con).
  const bundleIds = productRows.filter((p) => p.kind === 'bundle').map((p) => p.id);
  if (bundleIds.length) {
    const items = await ctx.db.query.bundleItems.findMany({ where: inArray(bundleItems.bundleProductId, bundleIds) });
    const itemIds = items.map((i) => i.itemProductId).filter((id) => !byProductId.has(id));
    const itemRows = itemIds.length ? await ctx.db.query.products.findMany({ where: and(inArray(products.id, itemIds), isNull(products.deletedAt)) }) : [];
    for (const p of itemRows) {
      if (p.kind === 'digital') { if (!digitalProductIds.has(p.id)) digitalProductIds.set(p.id, 'bundle'); continue; }
      if (p.courseId && !courseSource.has(p.courseId)) courseSource.set(p.courseId, 'bundle');
    }
  }

  const courseIds = [...courseSource.keys()];
  const courseRows = courseIds.length
    ? await ctx.db.select({ c: courses, community: communityCols }).from(courses).leftJoin(communities, eq(communities.id, courses.communityId)).where(and(inArray(courses.id, courseIds), isNull(courses.deletedAt)))
    : [];
  const progressRows = courseIds.length ? await ctx.db.query.courseProgress.findMany({ where: and(eq(courseProgress.userId, userId), inArray(courseProgress.courseId, courseIds)) }) : [];
  const progressByCourse = new Map(progressRows.map((p) => [p.courseId, p]));

  const items = await Promise.all(courseRows.map(async (r) => {
    const progress = progressByCourse.get(r.c.id) ?? null;
    return {
      id: r.c.id,
      title: r.c.title,
      coverUrl: r.c.coverUrl,
      coverColor: r.c.coverColor,
      lessonCount: r.c.lessonCount,
      community: r.community,
      source: courseSource.get(r.c.id)!,
      progress: progress ? { completedLessons: progress.completedLessons, totalLessons: progress.totalLessons, percent: progress.percent, completedAt: progress.completedAt } : null,
      lastAccessedAt: progress?.lastAccessedAt ?? null,
      resumeLessonId: progress?.lastLessonId ?? (await firstLessonId(ctx, r.c.id)),
    };
  }));
  // Đang học trước (gần đây nhất), rồi chưa bắt đầu, rồi đã xong.
  items.sort((a, b) => rank(a) - rank(b) || (b.lastAccessedAt?.getTime() ?? 0) - (a.lastAccessedAt?.getTime() ?? 0) || a.title.localeCompare(b.title, 'vi'));

  const digitalRows = digitalProductIds.size
    ? await ctx.db.select({ p: products, community: communityCols }).from(products).leftJoin(communities, eq(communities.id, products.communityId)).where(and(inArray(products.id, [...digitalProductIds.keys()]), isNull(products.deletedAt)))
    : [];
  const digital = digitalRows.map((r) => ({ id: r.p.id, title: r.p.name, slug: r.p.slug, coverUrl: r.p.coverUrl, fileCount: r.p.digitalFileIds.length, community: r.community, source: digitalProductIds.get(r.p.id)! }));

  const memberCommunityIds = new Set(
    (await ctx.db.query.communityMembers.findMany({ where: and(eq(communityMembers.userId, userId), inArray(communityMembers.status, ['active', 'cancelling'])), columns: { communityId: true } })).map((m) => m.communityId),
  );

  // Hội miễn phí mà tôi đã mua đồ nhưng chưa tham gia: gợi ý vào, không tự ép vào (mục 153).
  const suggested = new Map<string, NonNullable<(typeof items)[number]['community']>>();
  for (const it of [...items, ...digital]) {
    const c = it.community;
    if (!c || memberCommunityIds.has(c.id)) continue;
    if (c.pricingMode !== 'free' && c.pricingMode !== 'freemium') continue;
    if (!c.doorsOpen) continue;
    suggested.set(c.id, c);
  }

  return {
    courses: items,
    digital,
    suggestedCommunities: [...suggested.values()],
    memberCommunityIds: [...memberCommunityIds],
    counts: {
      courses: items.length,
      inProgress: items.filter((i) => (i.progress?.percent ?? 0) > 0 && !i.progress?.completedAt).length,
      completed: items.filter((i) => i.progress?.completedAt).length,
      digital: digital.length,
    },
  };
}

/** Thứ tự hiển thị: đang học (0) → chưa bắt đầu (1) → đã hoàn thành (2). */
function rank(i: { progress: { percent: number; completedAt: Date | null } | null }): number {
  if (i.progress?.completedAt) return 2;
  return (i.progress?.percent ?? 0) > 0 ? 0 : 1;
}

/** Bài đầu tiên của khóa, để người chưa học có nút "Bắt đầu học". */
async function firstLessonId(ctx: Ctx, courseId: string): Promise<string | null> {
  const row = await ctx.db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .where(and(eq(lessons.courseId, courseId), eq(lessons.status, 'published')))
    .orderBy(sql`${courseModules.sortOrder} asc, ${lessons.sortOrder} asc`)
    .limit(1);
  return row[0]?.id ?? null;
}
