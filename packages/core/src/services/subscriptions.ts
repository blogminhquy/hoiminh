// Subscription tier hội và tài khoản · Gói và thanh toán của thành viên: kích hoạt sau thanh toán, hủy gia hạn, hết kỳ → churned.
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { communities, communityMembers, communityTiers, entitlements, invoices, orders, payments, subscriptions } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { invalidState, notFound } from '../errors';
import { periodEnd } from '../lib/money';
import { requireUser } from '../permissions';
import { audit } from './audit';
import { grant } from './entitlements';

/** Sau payment.succeeded cho tier: tạo/gia hạn subscription, gán tier cho thành viên (tạo thành viên nếu chưa), cấp entitlement. */
export async function activateTierPurchase(ctx: Ctx, p: { orderId: string; userId: string; communityId: string; tierId: string; cycle: 'monthly' | 'yearly' | 'one_time'; amountMinor: number; provider: string; affiliateAccountId: string | null; paidAt: Date }) {
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, p.communityId) });
  if (!community) throw notFound();
  const tier = await ctx.db.query.communityTiers.findFirst({ where: eq(communityTiers.id, p.tierId) });
  if (!tier) throw notFound();
  const end = periodEnd(p.paidAt, p.cycle);
  let subId: string | null = null;
  if (p.cycle !== 'one_time') {
    const existing = await ctx.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.userId, p.userId), eq(subscriptions.communityId, p.communityId), inArray(subscriptions.status, ['active', 'cancelling', 'past_due'])) });
    if (existing) {
      const base = existing.currentPeriodEnd > p.paidAt ? existing.currentPeriodEnd : p.paidAt;
      const [row] = await ctx.db.update(subscriptions).set({ status: 'active', tierId: tier.id, billingCycle: p.cycle, amountMinor: p.amountMinor, currentPeriodStart: p.paidAt, currentPeriodEnd: periodEnd(base, p.cycle)!, cancelAtPeriodEnd: false, cancelledAt: null, provider: p.provider, lastOrderId: p.orderId, updatedAt: ctx.now() }).where(eq(subscriptions.id, existing.id)).returning();
      subId = row!.id;
    } else {
      const [row] = await ctx.db.insert(subscriptions).values({ workspaceId: community.workspaceId, communityId: p.communityId, userId: p.userId, tierId: tier.id, status: 'active', billingCycle: p.cycle, amountMinor: p.amountMinor, currentPeriodStart: p.paidAt, currentPeriodEnd: end!, provider: p.provider, lastOrderId: p.orderId }).returning();
      subId = row!.id;
    }
  }
  const sub = subId ? await ctx.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, subId) }) : null;
  const member = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, p.communityId), eq(communityMembers.userId, p.userId)) });
  const fromTierId = member?.tierId ?? null;
  const wasActive = member && (member.status === 'active' || member.status === 'cancelling');
  const values = { tierId: tier.id, subscriptionId: subId, status: 'active' as const, nextRenewalAt: sub?.currentPeriodEnd ?? null, lastPaymentAt: p.paidAt, churnedAt: null, referredByAffiliateId: member?.referredByAffiliateId ?? p.affiliateAccountId, source: member?.source ?? (p.affiliateAccountId ? ('affiliate' as const) : ('direct' as const)), updatedAt: ctx.now() };
  let memberId: string;
  if (member) {
    await ctx.db.update(communityMembers).set(values).where(eq(communityMembers.id, member.id));
    memberId = member.id;
  } else {
    const [m] = await ctx.db.insert(communityMembers).values({ communityId: p.communityId, userId: p.userId, role: 'member', ...values, joinedAt: p.paidAt, lastActiveAt: ctx.now() }).returning();
    memberId = m!.id;
  }
  if (!wasActive) await ctx.db.update(communities).set({ memberCount: communities.memberCount ? (community.memberCount + 1) : 1 }).where(eq(communities.id, p.communityId));
  if (!fromTierId || fromTierId !== tier.id) await ctx.db.update(communities).set({ paidMemberCount: community.paidMemberCount + 1 }).where(eq(communities.id, p.communityId));
  await ctx.db.update(entitlements).set({ status: 'revoked', revokedAt: ctx.now() }).where(and(eq(entitlements.userId, p.userId), eq(entitlements.communityId, p.communityId), eq(entitlements.resourceType, 'tier'), eq(entitlements.status, 'active')));
  await grant(ctx, { userId: p.userId, workspaceId: community.workspaceId, communityId: p.communityId, resourceType: 'tier', resourceId: tier.id, sourceType: subId ? 'subscription' : 'purchase', sourceId: subId ?? p.orderId, expiresAt: sub?.currentPeriodEnd ?? null });
  if (p.affiliateAccountId) await raw(ctx.db, and(eq(communities.id, p.communityId)) ? sql`update affiliate_accounts set paid_count = paid_count + 1 where id = ${p.affiliateAccountId}` : sql`select 1`);
  if (!wasActive) await ctx.events.emit('member.joined', { communityId: p.communityId, userId: p.userId, memberId, source: values.source, referredByAffiliateId: values.referredByAffiliateId });
  if (fromTierId !== tier.id) await ctx.events.emit('member.tier_changed', { communityId: p.communityId, userId: p.userId, memberId, fromTierId, toTierId: tier.id, reason: 'payment' });
  return { subscriptionId: subId, memberId };
}

/** Thành viên hủy gia hạn: giữ quyền đến hết kỳ. */
export async function cancelSubscription(ctx: Ctx, subscriptionId: string) {
  const userId = requireUser(ctx);
  const sub = await ctx.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)) });
  if (!sub) throw notFound();
  if (sub.status !== 'active') throw invalidState('Gói không ở trạng thái đang gia hạn');
  await ctx.db.update(subscriptions).set({ status: 'cancelling', cancelAtPeriodEnd: true, cancelledAt: ctx.now(), updatedAt: ctx.now() }).where(eq(subscriptions.id, subscriptionId));
  if (sub.communityId) await ctx.db.update(communityMembers).set({ status: 'cancelling', updatedAt: ctx.now() }).where(and(eq(communityMembers.communityId, sub.communityId), eq(communityMembers.userId, userId)));
  await ctx.events.emit('subscription.cancelled', { subscriptionId, userId, communityId: sub.communityId, periodEnd: sub.currentPeriodEnd.toISOString() });
  await audit(ctx, { action: 'subscription.cancel', resourceType: 'subscription', resourceId: subscriptionId, communityId: sub.communityId });
}

/** Bật lại gia hạn trước khi hết kỳ. */
export async function resumeSubscription(ctx: Ctx, subscriptionId: string) {
  const userId = requireUser(ctx);
  const sub = await ctx.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)) });
  if (!sub || sub.status !== 'cancelling') throw invalidState('Gói không ở trạng thái đang hủy');
  await ctx.db.update(subscriptions).set({ status: 'active', cancelAtPeriodEnd: false, cancelledAt: null, updatedAt: ctx.now() }).where(eq(subscriptions.id, subscriptionId));
  if (sub.communityId) await ctx.db.update(communityMembers).set({ status: 'active', updatedAt: ctx.now() }).where(and(eq(communityMembers.communityId, sub.communityId), eq(communityMembers.userId, userId)));
}

/** Cron: hết kỳ → churned (đang hủy) hoặc past_due (chưa trả kỳ mới), thu hồi entitlement. */
export async function churnExpired(ctx: Ctx): Promise<number> {
  const due = await ctx.db.query.subscriptions.findMany({ where: and(inArray(subscriptions.status, ['active', 'cancelling', 'past_due']), lt(subscriptions.currentPeriodEnd, ctx.now())) });
  let n = 0;
  for (const sub of due) {
    const grace = sub.status === 'active' ? 3 : 0;
    if (sub.status === 'active' && ctx.now().getTime() - sub.currentPeriodEnd.getTime() < grace * 86_400_000) {
      await ctx.db.update(subscriptions).set({ status: 'past_due', updatedAt: ctx.now() }).where(eq(subscriptions.id, sub.id));
      continue;
    }
    if (sub.status === 'past_due' && ctx.now().getTime() - sub.currentPeriodEnd.getTime() < grace * 86_400_000) continue;
    await ctx.db.update(subscriptions).set({ status: 'expired', updatedAt: ctx.now() }).where(eq(subscriptions.id, sub.id));
    await ctx.db.update(entitlements).set({ status: 'expired', updatedAt: ctx.now() }).where(and(eq(entitlements.sourceType, 'subscription'), eq(entitlements.sourceId, sub.id), eq(entitlements.status, 'active')));
    if (sub.communityId) {
      const std = await ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, sub.communityId), eq(communityTiers.key, 'standard'), eq(communityTiers.isActive, true)) });
      const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, sub.communityId) });
      const keepMember = c?.pricingMode === 'free' || c?.pricingMode === 'freemium';
      await ctx.db.update(communityMembers).set({ status: keepMember ? 'active' : 'churned', tierId: keepMember ? (std?.id ?? null) : null, subscriptionId: null, nextRenewalAt: null, churnedAt: keepMember ? null : ctx.now(), updatedAt: ctx.now() }).where(and(eq(communityMembers.communityId, sub.communityId), eq(communityMembers.userId, sub.userId)));
      if (c) await ctx.db.update(communities).set({ paidMemberCount: Math.max(0, c.paidMemberCount - 1), memberCount: keepMember ? c.memberCount : Math.max(0, c.memberCount - 1) }).where(eq(communities.id, c.id));
    }
    await ctx.events.emit('subscription.expired', { subscriptionId: sub.id, userId: sub.userId, communityId: sub.communityId });
    n++;
  }
  return n;
}

/** Màn Tài khoản · Gói và thanh toán. */
export async function myBilling(ctx: Ctx) {
  const userId = requireUser(ctx);
  const subs = await ctx.db.select({ s: subscriptions, c: { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor }, tier: { name: communityTiers.name, key: communityTiers.key } }).from(subscriptions).leftJoin(communities, eq(communities.id, subscriptions.communityId)).leftJoin(communityTiers, eq(communityTiers.id, subscriptions.tierId)).where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ['active', 'cancelling', 'past_due']))).orderBy(desc(subscriptions.createdAt));
  const lifetime = await ctx.db.select({ o: orders, c: { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor } }).from(orders).leftJoin(communities, eq(communities.id, orders.communityId)).where(and(eq(orders.customerUserId, userId), eq(orders.status, 'paid'), eq(orders.targetType, 'tier'))).orderBy(desc(orders.paidAt));
  const history = await ctx.db.select({ o: orders, p: payments, inv: invoices }).from(orders).leftJoin(payments, eq(payments.orderId, orders.id)).leftJoin(invoices, eq(invoices.orderId, orders.id)).where(and(eq(orders.customerUserId, userId), inArray(orders.status, ['paid', 'refunded']))).orderBy(desc(orders.createdAt)).limit(50);
  return {
    subscriptions: subs.map((r) => ({ ...r.s, community: r.c, tier: r.tier })),
    lifetime: lifetime.filter((r) => (r.o.metadata as { cycle?: string }).cycle === 'one_time').map((r) => ({ orderId: r.o.id, community: r.c, amountMinor: r.o.totalMinor, paidAt: r.o.paidAt })),
    history: history.map((r) => ({ orderId: r.o.id, at: r.o.paidAt ?? r.o.createdAt, title: (r.o.metadata as { title?: string }).title ?? '', method: r.p?.paymentMethod ?? '', provider: r.p?.provider ?? '', amountMinor: r.o.totalMinor, status: r.o.status, invoiceNumber: r.inv?.number ?? null, targetType: r.o.targetType, refundable: r.o.status === 'paid' && r.o.targetType === 'product' && r.o.paidAt !== null && ctx.now().getTime() - r.o.paidAt.getTime() < 7 * 86_400_000 })),
  };
}
