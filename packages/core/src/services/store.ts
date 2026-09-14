// Cửa hàng trong hội: sản phẩm course/bundle/digital, trang bán chuẩn theo trường cố định, tải tệp số bằng signed URL.
import { toSlug, type CreateProductInput } from '@hoiminh/contracts';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { bundleItems, courseModules, courses, files, lessons, productPages, products, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { forbidden, invalid, notFound } from '../errors';
import { requireCommunityPermission, requireUser, resolveCommunityAccess } from '../permissions';
import { audit } from './audit';
import { hasEntitlement, ownsProduct } from './entitlements';
import { assertWorkspaceUnlocked } from './workspaces';

function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Danh sách sản phẩm với bộ lọc loại, tìm kiếm, sắp xếp, trạng thái sở hữu. */
export async function listProducts(ctx: Ctx, communityId: string, q: { kind?: 'course' | 'bundle' | 'digital'; q?: string; sort?: 'newest' | 'bestselling' | 'price_asc' | 'price_desc' }) {
  const access = await resolveCommunityAccess(ctx, communityId);
  const staff = access.permissions.has('store.manage');
  const conds = [eq(products.communityId, communityId), isNull(products.deletedAt)];
  if (!staff) conds.push(eq(products.status, 'published'));
  if (q.kind) conds.push(eq(products.kind, q.kind));
  if (q.q) conds.push(or(ilike(products.name, `%${q.q}%`), ilike(products.shortDescription, `%${q.q}%`))!);
  const order = q.sort === 'bestselling' ? desc(products.salesCount) : q.sort === 'price_asc' ? asc(products.priceMinor) : q.sort === 'price_desc' ? desc(products.priceMinor) : desc(products.createdAt);
  const rows = await ctx.db.select({ p: products, course: { lessonCount: courses.lessonCount, totalDurationSeconds: courses.totalDurationSeconds } }).from(products).leftJoin(courses, eq(courses.id, products.courseId)).where(and(...conds)).orderBy(order);
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const counts = await ctx.db.select({ kind: products.kind, c: sql<number>`count(*)::int` }).from(products).where(and(eq(products.communityId, communityId), isNull(products.deletedAt), eq(products.status, 'published'))).groupBy(products.kind);
  const items = [];
  for (const r of rows) {
    const bundleCount = r.p.kind === 'bundle' ? (await ctx.db.select({ c: sql<number>`count(*)::int` }).from(bundleItems).where(eq(bundleItems.bundleProductId, r.p.id)))[0]?.c ?? 0 : 0;
    items.push({ ...r.p, lessonCount: r.course?.lessonCount ?? null, totalDurationSeconds: r.course?.totalDurationSeconds ?? null, bundleCount, discountPercent: discountPercent(r.p.priceMinor, r.p.compareAtMinor), owned: await ownsProduct(ctx, userId, r.p.id) });
  }
  return { items, counts: Object.fromEntries(counts.map((c) => [c.kind, c.c])) as Record<string, number>, canManage: staff };
}

/** Trang bán chuẩn: trường cố định + curriculum + giảng viên + FAQ + combo chứa + link cộng sự (mục 163). */
export async function getProduct(ctx: Ctx, productId: string) {
  const p = await ctx.db.query.products.findFirst({ where: and(eq(products.id, productId), isNull(products.deletedAt)) });
  if (!p) throw notFound('Sản phẩm không tồn tại');
  const access = await resolveCommunityAccess(ctx, p.communityId);
  if (p.status !== 'published' && !access.permissions.has('store.manage')) throw notFound('Sản phẩm không tồn tại');
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const [page, course, items, inBundles, instructor] = await Promise.all([
    ctx.db.query.productPages.findFirst({ where: eq(productPages.productId, productId) }),
    p.courseId ? ctx.db.query.courses.findFirst({ where: eq(courses.id, p.courseId) }) : null,
    p.kind === 'bundle' ? ctx.db.select({ item: products }).from(bundleItems).innerJoin(products, eq(products.id, bundleItems.itemProductId)).where(eq(bundleItems.bundleProductId, productId)).orderBy(asc(bundleItems.sortOrder)) : [],
    ctx.db.select({ b: products, count: sql<number>`(select count(*)::int from bundle_items bi where bi.bundle_product_id = ${products.id})` }).from(bundleItems).innerJoin(products, eq(products.id, bundleItems.bundleProductId)).where(and(eq(bundleItems.itemProductId, productId), eq(products.status, 'published'))),
    ctx.db.select({ u: users }).from(users).innerJoin(courses, eq(courses.ownerUserId, users.id)).where(p.courseId ? eq(courses.id, p.courseId) : sql`false`).then((r) => r[0]?.u ?? null),
  ]);
  const curriculum = course ? await (async () => {
    const mods = await ctx.db.query.courseModules.findMany({ where: eq(courseModules.courseId, course.id), orderBy: asc(courseModules.sortOrder) });
    const ls = mods.length ? await ctx.db.query.lessons.findMany({ where: inArray(lessons.moduleId, mods.map((m) => m.id)), orderBy: asc(lessons.sortOrder) }) : [];
    return mods.map((m, i) => ({ ...m, lessons: ls.filter((l) => l.moduleId === m.id).map((l) => ({ id: l.id, title: l.title, durationSeconds: l.durationSeconds, isPreview: l.isPreview || (course.previewFirstModule && i === 0), kind: l.kind })) }));
  })() : [];
  const affiliate = userId ? await raw(ctx.db, sql`select a.affiliate_code from affiliate_accounts a join affiliate_programs pr on pr.id = a.program_id where a.user_id = ${userId} and pr.community_id = ${p.communityId} and a.status = 'active' and pr.status = 'active' limit 1`) : null;
  const code = (affiliate?.[0] as { affiliate_code: string } | undefined)?.affiliate_code ?? null;
  const community = await raw(ctx.db, sql`select slug, name from communities where id = ${p.communityId}`);
  const slug = (community[0] as { slug: string; name: string }).slug;
  const tierKey = access.tierId ? ((await raw(ctx.db, sql`select key from community_tiers where id = ${access.tierId}`))[0] as { key: string } | undefined)?.key ?? null : null;
  return {
    ...p, page, course: course ? { id: course.id, lessonCount: course.lessonCount, totalDurationSeconds: course.totalDurationSeconds, accessMode: course.accessMode, updatedAt: course.updatedAt } : null, curriculum,
    bundleItems: items.map((i) => i.item), inBundles: inBundles.map((b) => ({ ...b.b, count: b.count, discountPercent: discountPercent(b.b.priceMinor, b.b.compareAtMinor) })),
    instructor: instructor ? { id: instructor.id, name: instructor.name, handle: instructor.handle, avatarUrl: instructor.avatarUrl, coverColor: instructor.coverColor, bio: instructor.bio } : null,
    discountPercent: discountPercent(p.priceMinor, p.compareAtMinor), owned: await ownsProduct(ctx, userId, p.id), viewerTier: tierKey,
    affiliateLink: code ? `${ctx.env.APP_URL}/${slug}/cua-hang/${p.slug}?ref=${code}` : null, communitySlug: slug, communityName: (community[0] as { name: string }).name, canManage: access.permissions.has('store.manage'),
  };
}

/** Tạo sản phẩm + trang bán. */
export async function createProduct(ctx: Ctx, communityId: string, input: CreateProductInput) {
  const access = await requireCommunityPermission(ctx, communityId, 'store.manage');
  await assertWorkspaceUnlocked(ctx, access.workspaceId);
  if (input.kind === 'course' && !input.courseId) throw invalid('Sản phẩm khóa học cần chọn khóa học');
  if (input.kind === 'bundle' && input.bundleItemProductIds.length < 2) throw invalid('Combo cần ít nhất 2 sản phẩm');
  if (input.kind === 'digital' && input.digitalFileIds.length === 0) throw invalid('Sản phẩm số cần ít nhất 1 tệp');
  const cover = input.coverFileId ? await ctx.db.query.files.findFirst({ where: eq(files.id, input.coverFileId) }) : null;
  const slug = input.slug ?? `${toSlug(input.name)}-${Date.now().toString(36).slice(-3)}`;
  const created = await ctx.db.transaction(async (tx) => {
    const [p] = await tx.insert(products).values({ workspaceId: access.workspaceId, communityId, kind: input.kind, name: input.name, slug, shortDescription: input.shortDescription, coverUrl: cover?.url ?? null, coverColor: input.coverColor ?? '#D4593A', courseId: input.courseId ?? null, digitalFileIds: input.digitalFileIds, priceMinor: input.priceMinor, compareAtMinor: input.compareAtMinor ?? null, currency: input.currency, status: input.status, launchDiscountEndsAt: input.launchDiscountEndsAt ? new Date(input.launchDiscountEndsAt) : null }).returning();
    await tx.insert(productPages).values({ workspaceId: access.workspaceId, productId: p!.id, headline: input.page.headline || input.name, subheadline: input.page.subheadline, shortDescription: input.shortDescription, coverImageUrl: cover?.url ?? null, introVideoUrl: input.page.introVideoUrl ?? null, benefits: input.page.benefits, faq: input.page.faq, instructor: input.page.instructor ?? null, ctaText: input.page.ctaText, guarantee: input.page.guarantee, salesMode: input.page.salesMode, externalLandingUrl: input.page.externalLandingUrl ?? null });
    if (input.kind === 'bundle') await tx.insert(bundleItems).values(input.bundleItemProductIds.map((id, i) => ({ bundleProductId: p!.id, itemProductId: id, sortOrder: i })));
    return p!;
  });
  await audit(ctx, { action: 'product.create', resourceType: 'product', resourceId: created.id, communityId });
  return created;
}

/** Sửa sản phẩm và trang bán. */
export async function updateProduct(ctx: Ctx, productId: string, input: Partial<CreateProductInput>) {
  const p = await ctx.db.query.products.findFirst({ where: and(eq(products.id, productId), isNull(products.deletedAt)) });
  if (!p) throw notFound();
  await requireCommunityPermission(ctx, p.communityId, 'store.manage');
  const patch: Partial<typeof products.$inferInsert> = { updatedAt: ctx.now() };
  for (const k of ['name', 'shortDescription', 'coverColor', 'priceMinor', 'compareAtMinor', 'currency', 'status', 'digitalFileIds'] as const) if (input[k] !== undefined) (patch as Record<string, unknown>)[k] = input[k];
  if (input.launchDiscountEndsAt !== undefined) patch.launchDiscountEndsAt = input.launchDiscountEndsAt ? new Date(input.launchDiscountEndsAt) : null;
  const [row] = await ctx.db.update(products).set(patch).where(eq(products.id, productId)).returning();
  if (input.page) await ctx.db.update(productPages).set({ ...input.page, introVideoUrl: input.page.introVideoUrl ?? null, externalLandingUrl: input.page.externalLandingUrl ?? null, instructor: input.page.instructor ?? null, updatedAt: ctx.now() }).where(eq(productPages.productId, productId));
  if (input.bundleItemProductIds && p.kind === 'bundle') {
    await ctx.db.delete(bundleItems).where(eq(bundleItems.bundleProductId, productId));
    await ctx.db.insert(bundleItems).values(input.bundleItemProductIds.map((id, i) => ({ bundleProductId: productId, itemProductId: id, sortOrder: i })));
  }
  await audit(ctx, { action: 'product.update', resourceType: 'product', resourceId: productId, communityId: p.communityId });
  return row!;
}

/** Xóa mềm sản phẩm. */
export async function deleteProduct(ctx: Ctx, productId: string) {
  const p = await ctx.db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!p) throw notFound();
  await requireCommunityPermission(ctx, p.communityId, 'store.manage');
  await ctx.db.update(products).set({ deletedAt: ctx.now(), status: 'archived' }).where(eq(products.id, productId));
}

/** Link tải tệp số (signed URL, chỉ người sở hữu). */
export async function digitalDownloads(ctx: Ctx, productId: string) {
  const userId = requireUser(ctx);
  const p = await ctx.db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!p || p.kind !== 'digital') throw notFound();
  const access = await resolveCommunityAccess(ctx, p.communityId);
  if (!access.permissions.has('store.manage') && !(await hasEntitlement(ctx, userId, 'product', productId))) throw forbidden('Bạn chưa sở hữu tài liệu này');
  const rows = p.digitalFileIds.length ? await ctx.db.query.files.findMany({ where: inArray(files.id, p.digitalFileIds) }) : [];
  return Promise.all(rows.map(async (f) => ({ id: f.id, name: f.originalName, sizeBytes: f.sizeBytes, url: await ctx.media.getSignedUrl(f.objectKey, 900) })));
}
