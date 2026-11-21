// Entitlement Engine (mục 62–63, 140–145): quyền truy cập tách khỏi thanh toán.
import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { communityMembers, communityTiers, courses, entitlements, products, bundleItems } from '@hoiminh/db';
import type { Ctx } from '../context';

export interface AccessDecision {
  allowed: boolean;
  reason: 'owner' | 'all_members' | 'tier' | 'purchase' | 'manual' | 'preview' | 'not_member' | 'needs_premium' | 'needs_purchase' | 'locked';
}

/** Cấp entitlement (idempotent theo source). */
export async function grant(ctx: Ctx, input: { userId: string; workspaceId: string | null; communityId: string | null; resourceType: 'community' | 'tier' | 'course' | 'product' | 'bundle' | 'digital' | 'platform_plan'; resourceId: string; sourceType: 'purchase' | 'subscription' | 'community_bundle' | 'manual_grant' | 'coupon' | 'admin' | 'trial' | 'free_tier'; sourceId: string | null; expiresAt?: Date | null }) {
  const existing = input.sourceId ? await ctx.db.query.entitlements.findFirst({ where: and(eq(entitlements.userId, input.userId), eq(entitlements.resourceType, input.resourceType), eq(entitlements.resourceId, input.resourceId), eq(entitlements.sourceType, input.sourceType), eq(entitlements.sourceId, input.sourceId)) }) : null;
  if (existing) {
    if (existing.status !== 'active' || (input.expiresAt && existing.expiresAt?.getTime() !== input.expiresAt.getTime())) {
      const [row] = await ctx.db.update(entitlements).set({ status: 'active', revokedAt: null, expiresAt: input.expiresAt ?? existing.expiresAt, updatedAt: ctx.now() }).where(eq(entitlements.id, existing.id)).returning();
      return row!;
    }
    return existing;
  }
  const [row] = await ctx.db.insert(entitlements).values({ userId: input.userId, workspaceId: input.workspaceId, communityId: input.communityId, resourceType: input.resourceType, resourceId: input.resourceId, sourceType: input.sourceType, sourceId: input.sourceId, expiresAt: input.expiresAt ?? null }).returning();
  return row!;
}

/** Thu hồi mọi entitlement từ một nguồn (hoàn tiền, hủy gói hết kỳ). */
export async function revokeBySource(ctx: Ctx, sourceType: string, sourceId: string): Promise<number> {
  const rows = await ctx.db.update(entitlements).set({ status: 'revoked', revokedAt: ctx.now(), updatedAt: ctx.now() }).where(and(eq(entitlements.sourceType, sourceType as 'purchase'), eq(entitlements.sourceId, sourceId), eq(entitlements.status, 'active'))).returning({ id: entitlements.id });
  return rows.length;
}

/** Có entitlement còn hiệu lực với tài nguyên không. */
export async function hasEntitlement(ctx: Ctx, userId: string, resourceType: string, resourceId: string): Promise<boolean> {
  const row = await ctx.db.query.entitlements.findFirst({ where: and(eq(entitlements.userId, userId), eq(entitlements.resourceType, resourceType as 'course'), eq(entitlements.resourceId, resourceId), eq(entitlements.status, 'active'), or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, ctx.now()))) });
  return Boolean(row);
}

/** Tier hiện tại của người dùng trong hội (từ community_members). */
export async function memberTierKey(ctx: Ctx, userId: string, communityId: string): Promise<'standard' | 'premium' | 'vip' | null> {
  const r = await ctx.db.select({ key: communityTiers.key, status: communityMembers.status }).from(communityMembers).leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId)).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId))).then((x) => x[0]);
  if (!r || (r.status !== 'active' && r.status !== 'cancelling')) return null;
  return r.key ?? 'standard';
}

/** Phần của một khóa học mà Access Resolver cần đọc. */
export type CourseForAccess = Pick<typeof courses.$inferSelect, 'id' | 'ownerUserId' | 'communityId' | 'accessMode'>;

/**
 * Access Resolver cho khóa học (mục 145): chủ hội, mọi thành viên, tier, mua lẻ, combo, cấp thủ công.
 * `opts.course`: nơi gọi đã nạp sẵn khóa học thì truyền vào để khỏi truy vấn lại.
 */
export async function canAccessCourse(ctx: Ctx, userId: string | null, courseId: string, opts: { lessonIsPreview?: boolean; isStaff?: boolean; course?: CourseForAccess } = {}): Promise<AccessDecision> {
  const course = opts.course ?? (await ctx.db.query.courses.findFirst({ where: eq(courses.id, courseId) }));
  if (!course) return { allowed: false, reason: 'locked' };
  if (opts.isStaff) return { allowed: true, reason: 'owner' };
  if (opts.lessonIsPreview) return { allowed: true, reason: 'preview' };
  return (await resolveCourseAccess(ctx, userId, [course])).get(course.id)!;
}

/**
 * Access Resolver cho nhiều khóa học trong một lượt: tối đa bốn câu lệnh (ba câu gửi cùng lúc) dù danh sách dài bao nhiêu.
 * Trước đây trang danh sách khóa học gọi resolver từng khóa một, mỗi khóa năm đến bảy câu lệnh.
 * Thứ tự xét giữ nguyên: người quản lý, chủ khóa, cấp thủ công, đã mua (lẻ hoặc qua combo), rồi mới tới hạng thành viên.
 */
export async function resolveCourseAccess(ctx: Ctx, userId: string | null, list: CourseForAccess[], opts: { isStaff?: boolean } = {}): Promise<Map<string, AccessDecision>> {
  const out = new Map<string, AccessDecision>();
  const pending: CourseForAccess[] = [];
  for (const c of list) {
    if (opts.isStaff) out.set(c.id, { allowed: true, reason: 'owner' });
    else if (!userId) out.set(c.id, { allowed: false, reason: 'not_member' });
    else if (c.ownerUserId === userId) out.set(c.id, { allowed: true, reason: 'owner' });
    else pending.push(c);
  }
  if (!userId || !pending.length) return out;

  const ids = pending.map((c) => c.id);
  const communityIds = [...new Set(pending.map((c) => c.communityId).filter((x): x is string => Boolean(x)))];
  const active = and(eq(entitlements.userId, userId), eq(entitlements.status, 'active'), or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, ctx.now())));
  const [courseEnts, productRows, tierRows] = await Promise.all([
    ctx.db.select({ resourceId: entitlements.resourceId }).from(entitlements).where(and(active, eq(entitlements.resourceType, 'course'), inArray(entitlements.resourceId, ids))),
    // Sản phẩm bán khóa học, kèm các combo chứa sản phẩm đó (mỗi combo một dòng).
    ctx.db.select({ courseId: products.courseId, productId: products.id, bundleProductId: bundleItems.bundleProductId }).from(products).leftJoin(bundleItems, eq(bundleItems.itemProductId, products.id)).where(and(inArray(products.courseId, ids), isNull(products.deletedAt))),
    communityIds.length ? ctx.db.select({ communityId: communityMembers.communityId, key: communityTiers.key, status: communityMembers.status }).from(communityMembers).leftJoin(communityTiers, eq(communityTiers.id, communityMembers.tierId)).where(and(inArray(communityMembers.communityId, communityIds), eq(communityMembers.userId, userId))) : [],
  ]);
  const sellable = [...new Set(productRows.flatMap((r) => (r.bundleProductId ? [r.productId, r.bundleProductId] : [r.productId])))];
  const productEnts = sellable.length ? await ctx.db.select({ resourceId: entitlements.resourceId }).from(entitlements).where(and(active, eq(entitlements.resourceType, 'product'), inArray(entitlements.resourceId, sellable))) : [];

  const granted = new Set(courseEnts.map((e) => e.resourceId));
  const ownedProducts = new Set(productEnts.map((e) => e.resourceId));
  const purchased = new Set(productRows.filter((r) => ownedProducts.has(r.productId) || (r.bundleProductId && ownedProducts.has(r.bundleProductId))).map((r) => r.courseId));
  const tierByCommunity = new Map<string, 'standard' | 'premium' | 'vip' | null>();
  for (const t of tierRows) tierByCommunity.set(t.communityId, t.status !== 'active' && t.status !== 'cancelling' ? null : t.key ?? 'standard');

  for (const c of pending) {
    if (granted.has(c.id)) out.set(c.id, { allowed: true, reason: 'manual' });
    else if (purchased.has(c.id)) out.set(c.id, { allowed: true, reason: 'purchase' });
    else if (!c.communityId) out.set(c.id, { allowed: false, reason: 'needs_purchase' });
    else {
      const tierKey = tierByCommunity.get(c.communityId) ?? null;
      if (!tierKey) out.set(c.id, { allowed: false, reason: 'not_member' });
      else if (c.accessMode === 'all_members') out.set(c.id, { allowed: true, reason: 'all_members' });
      else if (c.accessMode === 'premium' || c.accessMode === 'premium_and_store') out.set(c.id, tierKey === 'premium' || tierKey === 'vip' ? { allowed: true, reason: 'tier' } : { allowed: false, reason: 'needs_premium' });
      else out.set(c.id, { allowed: false, reason: 'needs_purchase' });
    }
  }
  return out;
}

/** Người dùng đã sở hữu sản phẩm cửa hàng chưa. */
export async function ownsProduct(ctx: Ctx, userId: string | null, productId: string): Promise<boolean> {
  if (!userId) return false;
  if (await hasEntitlement(ctx, userId, 'product', productId)) return true;
  const p = await ctx.db.query.products.findFirst({ where: eq(products.id, productId), columns: { courseId: true, kind: true } });
  if (p?.kind === 'course' && p.courseId) {
    const d = await canAccessCourse(ctx, userId, p.courseId);
    return d.allowed && d.reason !== 'preview';
  }
  return false;
}

/** Hết hạn entitlement quá hạn (cron). */
export async function expireEntitlements(ctx: Ctx): Promise<number> {
  const rows = await ctx.db.update(entitlements).set({ status: 'expired', updatedAt: ctx.now() }).where(and(eq(entitlements.status, 'active'), sql`${entitlements.expiresAt} is not null and ${entitlements.expiresAt} < now()`)).returning({ id: entitlements.id });
  return rows.length;
}
