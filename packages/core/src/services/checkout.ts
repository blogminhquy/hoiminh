// Checkout: tier hội (tháng/năm/một lần), sản phẩm cửa hàng, gói nền tảng. Gọi PaymentService qua adapter, không chạm cổng trực tiếp.
import type { CheckoutSession, CreateCheckoutInput } from '@hoiminh/contracts';
import { formatMoney } from '@hoiminh/contracts';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { affiliateAccounts, affiliatePrograms, communities, communityTiers, coupons, orderItems, orders, paymentAttempts, payments, plans, products, providerAccounts, users, workspaces } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { AppError, conflict, invalid, notFound } from '../errors';
import { applyCoupon, newReference } from '../lib/money';
import { requireUser, requireWorkspaceRole } from '../permissions';
import { audit } from './audit';
import { ownsProduct } from './entitlements';
import { FLAG, requireFlag } from './feature-flags';

interface Resolved {
  title: string; subtitle: string; amountMinor: number; currency: 'VND' | 'USD'; communityId: string | null; workspaceId: string | null;
  targetType: 'tier' | 'product' | 'platform'; targetId: string; metadata: Record<string, unknown>; enabledProviders: string[]; itemName: string;
}

async function resolveTarget(ctx: Ctx, userId: string, input: CreateCheckoutInput): Promise<Resolved> {
  const t = input.target;
  if (t.type === 'tier') {
    const c = await ctx.db.query.communities.findFirst({ where: and(eq(communities.id, t.communityId), isNull(communities.deletedAt)) });
    if (!c) throw notFound('Hội không tồn tại');
    if (!c.doorsOpen) throw invalid('Hội đã đóng cổng');
    const tier = await ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, c.id), eq(communityTiers.key, t.tierKey), eq(communityTiers.isActive, true)) });
    if (!tier) throw notFound('Gói không tồn tại');
    const amount = t.cycle === 'monthly' ? tier.monthlyMinor : t.cycle === 'yearly' ? tier.yearlyMinor : tier.oneTimeMinor;
    if (!amount) throw invalid('Gói này không bán theo chu kỳ đã chọn');
    const cycleLabel = t.cycle === 'monthly' ? 'tháng' : t.cycle === 'yearly' ? 'năm' : 'trọn đời';
    return { title: `Gói ${tier.name}`, subtitle: `Nâng cấp tại ${c.name}`, amountMinor: amount, currency: 'VND', communityId: c.id, workspaceId: c.workspaceId, targetType: 'tier', targetId: tier.id, metadata: { cycle: t.cycle, tierKey: tier.key, title: `${tier.name} · ${cycleLabel}`, communitySlug: c.slug }, enabledProviders: c.enabledProviders, itemName: `${tier.name} · ${cycleLabel}` };
  }
  if (t.type === 'product') {
    const p = await ctx.db.query.products.findFirst({ where: and(eq(products.id, t.productId), isNull(products.deletedAt), eq(products.status, 'published')) });
    if (!p) throw notFound('Sản phẩm không tồn tại');
    await requireFlag(ctx, FLAG.store, 'Cửa hàng đang tạm đóng trên toàn nền tảng', { workspaceId: p.workspaceId });
    if (await ownsProduct(ctx, userId, p.id)) throw conflict('Bạn đã sở hữu sản phẩm này');
    const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, p.communityId) });
    return { title: p.name, subtitle: `Mua tại ${c?.name ?? 'Cửa hàng'}`, amountMinor: p.priceMinor, currency: p.currency as 'VND', communityId: p.communityId, workspaceId: p.workspaceId, targetType: 'product', targetId: p.id, metadata: { cycle: 'one_time', title: p.name, kind: p.kind, communitySlug: c?.slug, productSlug: p.slug }, enabledProviders: c?.enabledProviders ?? ['sepay', 'momo', 'vnpay'], itemName: p.name };
  }
  await requireWorkspaceRole(ctx, t.workspaceId, ['owner']);
  const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, t.workspaceId) });
  if (!ws) throw notFound('Workspace không tồn tại');
  const plan = await ctx.db.query.plans.findFirst({ where: eq(plans.key, ws.planKey) });
  if (!plan) throw notFound('Gói nền tảng không tồn tại');
  const amount = t.cycle === 'monthly' ? plan.monthlyMinor : plan.yearlyMinor;
  return { title: `Gói ${plan.name} · ${t.cycle === 'monthly' ? 'theo tháng' : 'theo năm'}`, subtitle: 'Gói nền tảng cho chủ hội', amountMinor: amount, currency: 'VND', communityId: null, workspaceId: ws.id, targetType: 'platform', targetId: plan.key, metadata: { cycle: t.cycle, title: `Hội Mình · ${t.cycle === 'monthly' ? 'tháng' : 'năm'}` }, enabledProviders: ['sepay', 'momo', 'vnpay', 'paypal'], itemName: `Hội Mình · ${t.cycle === 'monthly' ? 'tháng' : 'năm'}` };
}

/** Tạo đơn + thanh toán + hướng dẫn (QR hoặc redirect). Đơn chờ hết hạn sau 30 phút. */
export async function createCheckout(ctx: Ctx, input: CreateCheckoutInput): Promise<CheckoutSession> {
  const userId = requireUser(ctx);
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound();
  const r = await resolveTarget(ctx, userId, input);
  const providerAccount = await ctx.db.query.providerAccounts.findFirst({ where: and(eq(providerAccounts.provider, input.provider), eq(providerAccounts.scopeType, 'platform')) });
  if (providerAccount && !providerAccount.enabled) throw new AppError('payment_error', 'Cổng thanh toán này đang tạm tắt, chọn cách khác');
  if (input.provider === 'paypal') await requireFlag(ctx, FLAG.paypal, 'PayPal chưa mở trên nền tảng này', { workspaceId: r.workspaceId });
  if (!r.enabledProviders.includes(input.provider) && r.targetType !== 'platform') throw new AppError('payment_error', 'Hội này không nhận thanh toán qua cổng đã chọn');

  let coupon: typeof coupons.$inferSelect | null = null;
  if (input.couponCode) {
    coupon = (await ctx.db.query.coupons.findFirst({ where: and(eq(coupons.code, input.couponCode.toUpperCase()), eq(coupons.isActive, true), r.communityId ? eq(coupons.communityId, r.communityId) : sql`true`) })) ?? null;
    if (!coupon || (coupon.expiresAt && coupon.expiresAt < ctx.now()) || (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions)) throw invalid('Mã giảm giá không hợp lệ hoặc đã hết hạn');
    if (coupon.appliesTo !== 'all' && coupon.appliesTo !== r.targetType) throw invalid('Mã giảm giá không áp dụng cho sản phẩm này');
  }
  const discount = applyCoupon(r.amountMinor, coupon);
  const total = r.amountMinor - discount;

  // Cộng sự: ưu tiên ref truyền vào, sau đó attribution còn hạn (last click wins), không tự giới thiệu.
  let affiliateId: string | null = null;
  let referredBy: string | null = null;
  if (r.communityId) {
    const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.communityId, r.communityId) });
    if (program && program.status === 'active') {
      let acc = input.ref ? await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.affiliateCode, input.ref), eq(affiliateAccounts.programId, program.id)) }) : null;
      if (!acc) {
        const attr = await raw(ctx.db, sql`select affiliate_account_id from affiliate_attributions where user_id = ${userId} and program_id = ${program.id} and expires_at > now() order by attributed_at desc limit 1`);
        const id = (attr[0] as { affiliate_account_id: string } | undefined)?.affiliate_account_id;
        acc = id ? await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, id) }) : null;
      }
      if (!acc) {
        const m = await raw(ctx.db, sql`select referred_by_affiliate_id from community_members where community_id = ${r.communityId} and user_id = ${userId}`);
        const id = (m[0] as { referred_by_affiliate_id: string | null } | undefined)?.referred_by_affiliate_id;
        acc = id ? await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, id) }) : null;
      }
      if (acc && acc.status === 'active' && (acc.userId !== userId || program.allowSelfReferral)) {
        affiliateId = acc.id;
        const ref = await ctx.db.query.users.findFirst({ where: eq(users.id, acc.userId), columns: { name: true } });
        referredBy = ref?.name ?? null;
      }
    }
  }

  const reference = newReference();
  const adapter = ctx.payments.get(input.provider);
  const order = await ctx.db.transaction(async (tx) => {
    const [o] = await tx.insert(orders).values({ workspaceId: r.workspaceId, communityId: r.communityId, customerUserId: userId, targetType: r.targetType, targetId: r.targetId, couponId: coupon?.id ?? null, subtotalMinor: r.amountMinor, discountMinor: discount, totalMinor: total, currency: r.currency, status: 'pending', reference, affiliateAccountId: affiliateId, metadata: { ...r.metadata, provider: input.provider, returnUrl: input.returnUrl ?? null }, expiresAt: new Date(ctx.now().getTime() + 30 * 60_000) }).returning();
    await tx.insert(orderItems).values({ orderId: o!.id, resourceType: r.targetType, resourceId: r.targetId, name: r.itemName, unitMinor: r.amountMinor, totalMinor: total });
    return o!;
  });
  const checkout = await adapter.createCheckout({ reference, orderId: order.id, amountMinor: total, currency: r.currency, description: `${r.itemName} - Hoi Minh`, customerEmail: user.email, returnUrl: input.returnUrl ?? `${ctx.env.APP_URL}/thanh-toan/${order.id}`, ipnUrl: `${ctx.env.API_URL}/webhooks/${input.provider}` });
  const [payment] = await ctx.db.insert(payments).values({ workspaceId: r.workspaceId, communityId: r.communityId, orderId: order.id, customerUserId: userId, provider: input.provider, providerPaymentId: checkout.providerPaymentId, amountMinor: total, currency: r.currency, status: 'pending', paymentMethod: input.provider === 'sepay' ? 'bank_transfer' : input.provider, reference, instruction: checkout.instruction as unknown as Record<string, unknown> }).returning();
  await ctx.db.insert(paymentAttempts).values({ paymentId: payment!.id, provider: input.provider, status: 'created', request: { reference, amountMinor: total }, response: checkout.raw });
  await audit(ctx, { action: 'checkout.create', resourceType: 'order', resourceId: order.id, communityId: r.communityId, workspaceId: r.workspaceId, metadata: { provider: input.provider, amountMinor: total } });
  return { orderId: order.id, paymentId: payment!.id, reference, provider: input.provider, status: 'pending', amountMinor: total, discountMinor: discount, currency: r.currency, instruction: checkout.instruction, summary: { title: r.title, subtitle: r.subtitle, lines: [{ label: r.itemName, amountMinor: r.amountMinor }, { label: 'Giảm giá', amountMinor: -discount }] }, referredBy };
}

/** Trạng thái đơn (client poll sau khi "Tôi đã chuyển khoản"). */
export async function orderStatus(ctx: Ctx, orderId: string) {
  const userId = requireUser(ctx);
  const o = await ctx.db.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.customerUserId, userId)) });
  if (!o) throw notFound('Đơn không tồn tại');
  const p = await ctx.db.query.payments.findFirst({ where: eq(payments.orderId, orderId), orderBy: (t, { desc }) => desc(t.createdAt) });
  const meta = o.metadata as { communitySlug?: string; productSlug?: string; cycle?: string; title?: string; kind?: string };
  const nextUrl = o.targetType === 'platform' ? '/admin' : o.targetType === 'product' ? `/${meta.communitySlug}/cua-hang/${meta.productSlug ?? ''}` : `/${meta.communitySlug}/khoa-hoc`;
  return { orderId: o.id, status: o.status, paidAt: o.paidAt, reference: o.reference, amountMinor: o.totalMinor, currency: o.currency, provider: p?.provider ?? null, paymentStatus: p?.status ?? null, instruction: p?.instruction ?? null, title: meta.title ?? '', nextUrl, expiresAt: o.expiresAt };
}

/** Khách bấm "Tôi đã chuyển khoản": ghi nhận đang xử lý (không xác nhận tiền). */
export async function markProcessing(ctx: Ctx, orderId: string) {
  const userId = requireUser(ctx);
  const p = await ctx.db.query.payments.findFirst({ where: and(eq(payments.orderId, orderId), eq(payments.customerUserId, userId)) });
  if (!p) throw notFound();
  if (p.status === 'pending') await ctx.db.update(payments).set({ status: 'processing', updatedAt: ctx.now() }).where(eq(payments.id, p.id));
  return orderStatus(ctx, orderId);
}

export const money = formatMoney;
