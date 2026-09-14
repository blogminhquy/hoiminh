// Entitlement Engine (mục 62–63, 140–145): quyền truy cập tách khỏi thanh toán.
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
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

/** Access Resolver cho khóa học (mục 145): chủ hội, mọi thành viên, tier, mua lẻ, combo, cấp thủ công. */
export async function canAccessCourse(ctx: Ctx, userId: string | null, courseId: string, opts: { lessonIsPreview?: boolean; isStaff?: boolean } = {}): Promise<AccessDecision> {
  const course = await ctx.db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course) return { allowed: false, reason: 'locked' };
  if (opts.isStaff) return { allowed: true, reason: 'owner' };
  if (opts.lessonIsPreview) return { allowed: true, reason: 'preview' };
  if (!userId) return { allowed: false, reason: 'not_member' };
  if (course.ownerUserId === userId) return { allowed: true, reason: 'owner' };
  if (await hasEntitlement(ctx, userId, 'course', courseId)) return { allowed: true, reason: 'manual' };
  const productRows = await ctx.db.query.products.findMany({ where: and(eq(products.courseId, courseId), isNull(products.deletedAt)), columns: { id: true } });
  for (const p of productRows) {
    if (await hasEntitlement(ctx, userId, 'product', p.id)) return { allowed: true, reason: 'purchase' };
    const bundles = await ctx.db.query.bundleItems.findMany({ where: eq(bundleItems.itemProductId, p.id) });
    for (const b of bundles) if (await hasEntitlement(ctx, userId, 'product', b.bundleProductId)) return { allowed: true, reason: 'purchase' };
  }
  if (!course.communityId) return { allowed: false, reason: 'needs_purchase' };
  const tierKey = await memberTierKey(ctx, userId, course.communityId);
  if (!tierKey) return { allowed: false, reason: 'not_member' };
  if (course.accessMode === 'all_members') return { allowed: true, reason: 'all_members' };
  if (course.accessMode === 'premium' || course.accessMode === 'premium_and_store') {
    if (tierKey === 'premium' || tierKey === 'vip') return { allowed: true, reason: 'tier' };
    return { allowed: false, reason: course.accessMode === 'premium' ? 'needs_premium' : 'needs_premium' };
  }
  return { allowed: false, reason: 'needs_purchase' };
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
