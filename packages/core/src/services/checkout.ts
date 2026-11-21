// Checkout: tier hội (tháng/năm/một lần), sản phẩm cửa hàng, gói nền tảng. Gọi PaymentService qua adapter, không chạm cổng trực tiếp.
import type { CheckoutSession, CreateCheckoutInput, PaymentInstruction, PaymentProvider } from '@hoiminh/contracts';
import type { CheckoutInput, CheckoutResult } from '@hoiminh/payments';
import { PLAN_CYCLE, applyPromo, cycleOfMonths, effectivePlanKey, formatMoney, monthsOfCycle, planQuote, termLabel, termPrice, termUnit, tierTerms } from '@hoiminh/contracts';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { communities, communityMembers, communityTiers, coupons, orderItems, orders, paymentAttempts, payments, products, users, type OrderStatus } from '@hoiminh/db';
import type { Ctx } from '../context';
import { AppError, conflict, invalid, invalidState, notFound } from '../errors';
import { applyCoupon, newReference } from '../lib/money';
import { requireUser, requireWorkspaceRole } from '../permissions';
import { resolveReferrer } from './affiliate';
import { audit } from './audit';
import { ownsProduct } from './entitlements';
import { FLAG, requireFlag } from './feature-flags';
import { gatewayWebhookUrl, ownerGatewayAdapter, type GatewayRow } from '../lib/owner-gateway';
import { paymentsFor } from '../lib/payment-accounts';
import { METHOD_NAME, ownerPaymentMethods } from './owner-gateways';
import { notifyOwnerOfTransfer, ownerBankInstruction, paymentsNotReadyError } from './owner-payout';
import { platformPaymentMethods } from './platform-methods';
import { communityPlan, planTable } from './plans';

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
    // Kỳ hạn người mua chọn. Bản cũ chỉ gửi `cycle`: monthly là 1 tháng, yearly là 12 tháng.
    const months = t.cycle === 'one_time' ? null : monthsOfCycle(t.cycle, t.months);
    const listMinor = months === null ? tier.oneTimeMinor : termPrice(tierTerms(tier), months);
    if (!listMinor) throw invalid(months === null ? 'Gói này không bán trả một lần' : `Gói này không bán kỳ ${termLabel(months)}`);
    // Khuyến mãi của chủ hội đang chạy thì trừ thẳng vào giá. Tính ở máy chủ, không tin số tiền phía trình duyệt.
    const promo = applyPromo(listMinor, c.pricingPromo, ctx.now());
    const amount = promo.payMinor;
    if (amount <= 0) throw invalid('Gói này chưa có giá');
    const cycle = months === null ? 'one_time' as const : cycleOfMonths(months);
    // Hội đã chạm trần thành viên của gói: chặn trước khi thu tiền, để không ai trả tiền rồi mà không vào được.
    // Người đang là thành viên (đổi tier, gia hạn) thì không chiếm thêm chỗ nên vẫn mua được.
    const mine = await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, c.id), eq(communityMembers.userId, userId)), columns: { status: true } });
    if (mine?.status !== 'active' && mine?.status !== 'cancelling') {
      const plan = await communityPlan(ctx, c.id);
      if (plan.full) throw plan.needsPlan ? invalidState('Hội chưa mở') : new AppError('member_cap', 'Hội đang đủ chỗ, chưa nhận thêm thành viên mới. Bạn quay lại sau nhé.', undefined, { communityId: c.id });
    }
    const cycleLabel = months === null ? 'trọn đời' : termUnit(months);
    return { title: `Gói ${tier.name}`, subtitle: `Nâng cấp tại ${c.name}`, amountMinor: amount, currency: 'VND', communityId: c.id, workspaceId: c.workspaceId, targetType: 'tier', targetId: tier.id, metadata: { cycle, ...(months === null ? {} : { months }), ...(promo.discountMinor > 0 ? { listMinor, promoPercentOff: promo.percentOff } : {}), tierKey: tier.key, title: `${tier.name} · ${cycleLabel}`, communitySlug: c.slug }, enabledProviders: c.enabledProviders, itemName: `${tier.name} · ${cycleLabel}` };
  }
  if (t.type === 'product') {
    const p = await ctx.db.query.products.findFirst({ where: and(eq(products.id, t.productId), isNull(products.deletedAt), eq(products.status, 'published')) });
    if (!p) throw notFound('Sản phẩm không tồn tại');
    await requireFlag(ctx, FLAG.store, 'Cửa hàng đang tạm đóng trên toàn nền tảng', { workspaceId: p.workspaceId });
    if (await ownsProduct(ctx, userId, p.id)) throw conflict('Bạn đã sở hữu sản phẩm này');
    const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, p.communityId) });
    return { title: p.name, subtitle: `Mua tại ${c?.name ?? 'Cửa hàng'}`, amountMinor: p.priceMinor, currency: p.currency as 'VND', communityId: p.communityId, workspaceId: p.workspaceId, targetType: 'product', targetId: p.id, metadata: { cycle: 'one_time', title: p.name, kind: p.kind, communitySlug: c?.slug, productSlug: p.slug }, enabledProviders: c?.enabledProviders ?? ['sepay', 'momo', 'vnpay'], itemName: p.name };
  }
  // Gói Hội Mình cho một hội: chỉ chủ workspace mua được. Tiền gói về tài khoản của Hội Mình.
  const c = await ctx.db.query.communities.findFirst({ where: and(eq(communities.id, t.communityId), isNull(communities.deletedAt)) });
  if (!c) throw notFound('Hội không tồn tại');
  await requireWorkspaceRole(ctx, c.workspaceId, ['owner']);
  const table = await planTable(ctx);
  const plan = table.find((p) => p.key === t.planKey);
  if (!plan || plan.key === 'free') throw notFound('Gói không tồn tại');
  const now = ctx.now();
  const current = table.find((p) => p.key === effectivePlanKey(c.planKey, c.planEndsAt, now))!;
  const q = planQuote({ now, current: { key: current.key, endsAt: c.planEndsAt }, target: plan, cycle: t.cycle, members: c.memberCount });
  if (q.blocked === 'cap') throw invalidState(`Hội đang có ${c.memberCount.toLocaleString('vi-VN')} thành viên, nhiều hơn trần ${plan.memberCap?.toLocaleString('vi-VN')} của gói ${plan.name}, nên chưa mua được gói này.`);
  if (q.blocked === 'lower') throw invalidState(`Hội đang ở gói ${current.name} và còn hạn. Chỉ mua được gói thấp hơn khi hết kỳ đang trả.`);
  if (q.amountMinor <= 0) throw invalid('Gói này chưa có giá');
  const label = PLAN_CYCLE[t.cycle].label;
  const title = `Gói ${plan.name} · ${label}`;
  return { title, subtitle: `Gói Hội Mình cho ${c.name}`, amountMinor: q.amountMinor, currency: 'VND', communityId: null, workspaceId: c.workspaceId, targetType: 'platform', targetId: plan.key, metadata: { cycle: t.cycle, planKey: plan.key, planCommunityId: c.id, communitySlug: c.slug, title: `${title} · ${c.name}` }, enabledProviders: ['sepay', 'momo', 'vnpay', 'paypal'], itemName: `${title} · ${c.name}` };
}

/** Tạo đơn + thanh toán + hướng dẫn (QR hoặc redirect). Đơn chờ hết hạn sau 30 phút (24 giờ với đơn chủ hội tự bấm xác nhận). */
export async function createCheckout(ctx: Ctx, input: CreateCheckoutInput): Promise<CheckoutSession> {
  const userId = requireUser(ctx);
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound();
  const r = await resolveTarget(ctx, userId, input);
  // Đơn của hội (gói thành viên, sản phẩm): tiền về thẳng chủ hội, bằng chuyển khoản QR tới tài khoản ngân hàng của chủ
  // hội hoặc qua cổng riêng của chủ hội (MoMo, VNPAY, PayPal, Stripe). Người mua chỉ chọn được cách chủ hội đã cài và
  // đang bật. Các cổng của Hội Mình chỉ dùng cho đơn gói Hội Mình, vì tiền qua các cổng đó về tài khoản của Hội Mình.
  const owner = r.targetType !== 'platform' && r.communityId ? await ownerPaymentMethods(ctx, r.communityId) : null;
  let provider: PaymentProvider;
  if (r.targetType !== 'platform') {
    if (!owner?.methods.length || !owner.defaultMethod) throw paymentsNotReadyError();
    provider = input.provider ?? owner.defaultMethod;
    if (!owner.methods.includes(provider)) throw new AppError('payment_error', `Hội này chưa nhận thanh toán qua ${METHOD_NAME[provider]}. Bạn chọn cách khác nhé: ${owner.methods.map((m) => METHOD_NAME[m]).join(', ')}.`, undefined, { reason: 'method_unavailable', methods: owner.methods });
  } else {
    // Gói Hội Mình: chỉ cổng quản trị đang bật và đã có khóa thật (máy dev thì đi qua trang mô phỏng).
    const platform = await platformPaymentMethods(ctx, r.workspaceId);
    provider = input.provider ?? platform.defaultMethod ?? 'sepay';
    if (!platform.methods.includes(provider)) throw new AppError('payment_error', `${METHOD_NAME[provider]} đang tạm tắt, bạn chọn cách khác nhé`, undefined, { reason: 'method_unavailable', methods: platform.methods });
  }
  const ownerAccount = owner && provider === 'sepay' ? owner.bank : null;
  const ownerGateway = owner && provider !== 'sepay' ? owner.gateways.find((g) => g.provider === provider) ?? null : null;

  let coupon: typeof coupons.$inferSelect | null = null;
  if (input.couponCode) {
    coupon = (await ctx.db.query.coupons.findFirst({ where: and(eq(coupons.code, input.couponCode.toUpperCase()), eq(coupons.isActive, true), r.communityId ? eq(coupons.communityId, r.communityId) : sql`true`) })) ?? null;
    if (!coupon || (coupon.expiresAt && coupon.expiresAt < ctx.now()) || (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions)) throw invalid('Mã giảm giá không hợp lệ hoặc đã hết hạn');
    if (coupon.appliesTo !== 'all' && coupon.appliesTo !== r.targetType) throw invalid('Mã giảm giá không áp dụng cho sản phẩm này');
  }
  const discount = applyCoupon(r.amountMinor, coupon);
  const total = r.amountMinor - discount;

  // Affiliate của hội: người giới thiệu cố định của thành viên; người chưa ở trong hội thì tính lượt bấm cuối (mã của
  // hội này họ đang mang theo, không có thì lượt bấm lúc đăng ký còn hạn), xem resolveReferrer. Thành viên đang ở
  // trong hội thì mã trên link lúc thanh toán không được tính: link không tính cho từng đơn hàng. Không tự giới thiệu.
  let affiliateId: string | null = null;
  let referredBy: string | null = null;
  if (r.communityId) {
    const referrer = await resolveReferrer(ctx, { communityId: r.communityId, userId, ref: input.ref });
    if (referrer.program?.status === 'active' && referrer.account) {
      affiliateId = referrer.account.id;
      const ref = await ctx.db.query.users.findFirst({ where: eq(users.id, referrer.account.userId), columns: { name: true } });
      referredBy = ref?.name ?? null;
    }
  }

  const reference = newReference();
  // Đơn chủ hội tự bấm xác nhận thì giữ 24 giờ, vì chủ hội không ngồi chờ từng đơn; các đơn khác giữ 30 phút.
  const holdMinutes = ownerAccount?.confirmMode === 'manual' ? 24 * 60 : 30;
  const order = await ctx.db.transaction(async (tx) => {
    const [o] = await tx.insert(orders).values({ workspaceId: r.workspaceId, communityId: r.communityId, customerUserId: userId, targetType: r.targetType, targetId: r.targetId, couponId: coupon?.id ?? null, subtotalMinor: r.amountMinor, discountMinor: discount, totalMinor: total, currency: r.currency, status: 'pending', reference, affiliateAccountId: affiliateId, metadata: { ...r.metadata, provider, returnUrl: input.returnUrl ?? null }, expiresAt: new Date(ctx.now().getTime() + holdMinutes * 60_000) }).returning();
    await tx.insert(orderItems).values({ orderId: o!.id, resourceType: r.targetType, resourceId: r.targetId, name: r.itemName, unitMinor: r.amountMinor, totalMinor: total });
    return o!;
  });
  const returnUrl = input.returnUrl ?? `${ctx.env.APP_URL}/thanh-toan/${order.id}`;
  const gatewayInput = { reference, orderId: order.id, amountMinor: total, currency: r.currency, description: `${r.itemName} - Hoi Minh`, customerEmail: user.email, returnUrl };
  // Đơn của hội trả bằng chuyển khoản: không gọi cổng nào, chỉ dựng mã QR chuyển khoản tới tài khoản của chủ hội.
  // Đơn của hội trả qua cổng: gọi cổng bằng khóa của chủ hội, cổng báo về địa chỉ riêng của cổng đó.
  const checkout = ownerAccount
    ? { providerPaymentId: null, instruction: ownerBankInstruction(ownerAccount, total, reference) as PaymentInstruction, settlement: undefined, raw: { payee: 'owner', bankCode: ownerAccount.bankCode } as Record<string, unknown> }
    : ownerGateway
      ? await ownerGatewayCheckout(ctx, ownerGateway, gatewayInput)
      : await (await paymentsFor(ctx)).get(provider).createCheckout({ ...gatewayInput, ipnUrl: `${ctx.env.API_URL}/webhooks/${provider}` });
  const [payment] = await ctx.db.insert(payments).values({ workspaceId: r.workspaceId, communityId: r.communityId, orderId: order.id, customerUserId: userId, provider, providerPaymentId: checkout.providerPaymentId, amountMinor: total, currency: r.currency, status: 'pending', paymentMethod: provider === 'sepay' ? 'bank_transfer' : provider, reference, instruction: { ...(checkout.instruction as unknown as Record<string, unknown>), ...(checkout.settlement ? { settlement: checkout.settlement } : {}) } }).returning();
  await ctx.db.insert(paymentAttempts).values({ paymentId: payment!.id, provider, status: 'created', request: { reference, amountMinor: total }, response: checkout.raw });
  await audit(ctx, { action: 'checkout.create', resourceType: 'order', resourceId: order.id, communityId: r.communityId, workspaceId: r.workspaceId, metadata: { provider, amountMinor: total, ...(owner ? { payee: 'owner' } : {}) } });
  return { orderId: order.id, paymentId: payment!.id, reference, provider, status: 'pending', amountMinor: total, discountMinor: discount, currency: r.currency, instruction: checkout.instruction, summary: { title: r.title, subtitle: r.subtitle, lines: [{ label: r.itemName, amountMinor: r.amountMinor }, { label: 'Giảm giá', amountMinor: -discount }] }, referredBy };
}

/** Tạo phiên thanh toán qua cổng riêng của chủ hội. Cổng từ chối (khóa sai, tài khoản cổng bị khóa) thì báo rõ cho người mua. */
async function ownerGatewayCheckout(ctx: Ctx, g: GatewayRow, input: Omit<CheckoutInput, 'ipnUrl'>): Promise<{ providerPaymentId: string | null; instruction: PaymentInstruction; settlement?: CheckoutResult['settlement']; raw: Record<string, unknown> }> {
  const adapter = await ownerGatewayAdapter(ctx, g);
  try {
    const res = await adapter.createCheckout({ ...input, ipnUrl: gatewayWebhookUrl(ctx, g.webhookToken) });
    // Đánh dấu tiền về chủ hội: webhook của cổng Hội Mình và việc ghép tay ở đối soát không xác nhận được đơn này.
    return { providerPaymentId: res.providerPaymentId, instruction: { ...res.instruction, payee: 'owner' }, settlement: res.settlement, raw: { ...res.raw, payee: 'owner', gatewayId: g.id } };
  } catch (err) {
    ctx.log.warn('owner_gateway.checkout_failed', { provider: g.provider, gatewayId: g.id, err: String(err) });
    throw new AppError('payment_error', `Chưa mở được ${METHOD_NAME[g.provider]} của hội lúc này. Bạn chọn cách thanh toán khác, hoặc báo chủ hội kiểm tra cổng.`, undefined, { reason: 'gateway_failed', provider: g.provider });
  }
}

/**
 * Đơn chờ thanh toán đã quá hạn giữ chỗ thì coi là hết hạn ngay khi đọc, không chờ bộ quét cập nhật cột `status`.
 * Nhờ vậy đúng/sai nghiệp vụ không phụ thuộc cron. Chỉ áp cho hành động của khách và hiển thị:
 * webhook thanh toán đến muộn vẫn được nhận (payments.confirmPayment), vì tiền đã vào thì phải cấp quyền.
 */
export function effectiveOrderStatus(o: { status: OrderStatus; expiresAt: Date | null }, now: Date): OrderStatus {
  return o.status === 'pending' && o.expiresAt !== null && o.expiresAt.getTime() < now.getTime() ? 'expired' : o.status;
}

/** Trạng thái đơn (client poll sau khi "Tôi đã chuyển khoản"). */
export async function orderStatus(ctx: Ctx, orderId: string) {
  const userId = requireUser(ctx);
  const o = await ctx.db.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.customerUserId, userId)) });
  if (!o) throw notFound('Đơn không tồn tại');
  const p = await ctx.db.query.payments.findFirst({ where: eq(payments.orderId, orderId), orderBy: (t, { desc }) => desc(t.createdAt) });
  const meta = o.metadata as { communitySlug?: string; productSlug?: string; cycle?: string; title?: string; kind?: string };
  // Người mua lẻ không phải thành viên: đưa về Khu học tập, vì khung hội sẽ chặn họ ở cửa (mục 153).
  const isMember = o.communityId
    ? Boolean(await ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, o.communityId), eq(communityMembers.userId, userId), inArray(communityMembers.status, ['active', 'cancelling'])) }))
    : false;
  const nextUrl = o.targetType === 'platform'
    ? (meta.communitySlug ? `/admin/goi?hoi=${meta.communitySlug}` : '/admin')
    : o.targetType === 'product'
      ? (isMember ? `/${meta.communitySlug}/cua-hang/${meta.productSlug ?? ''}` : '/hoc')
      : `/${meta.communitySlug}/khoa-hoc`;
  const status = effectiveOrderStatus(o, ctx.now());
  // Đơn đã hết hạn thì thanh toán chưa xong của nó cũng hết hạn (giao diện dựa vào paymentStatus để bật/tắt nút).
  const paymentStatus = status === 'expired' && (p?.status === 'pending' || p?.status === 'processing') ? 'expired' : p?.status ?? null;
  return { orderId: o.id, status, paidAt: o.paidAt, reference: o.reference, amountMinor: o.totalMinor, currency: o.currency, provider: p?.provider ?? null, paymentStatus, instruction: p?.instruction ?? null, title: meta.title ?? '', nextUrl, expiresAt: o.expiresAt };
}

/** Khách bấm "Tôi đã chuyển khoản": ghi nhận đang xử lý (không xác nhận tiền). */
export async function markProcessing(ctx: Ctx, orderId: string) {
  const userId = requireUser(ctx);
  const o = await ctx.db.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.customerUserId, userId)) });
  if (!o) throw notFound();
  // Đơn đã quá hạn: không ghi nhận gì, trả về trạng thái hết hạn để giao diện báo ngay (chuyển khoản muộn vẫn tự xác nhận khi tiền về).
  if (effectiveOrderStatus(o, ctx.now()) === 'expired') return orderStatus(ctx, orderId);
  const p = await ctx.db.query.payments.findFirst({ where: and(eq(payments.orderId, orderId), eq(payments.customerUserId, userId)) });
  if (!p) throw notFound();
  if (p.status === 'pending') {
    await ctx.db.update(payments).set({ status: 'processing', updatedAt: ctx.now() }).where(eq(payments.id, p.id));
    // Đơn trả thẳng chủ hội, chủ hội tự bấm xác nhận: báo cho chủ hội biết có người vừa chuyển khoản.
    await notifyOwnerOfTransfer(ctx, o, p);
  }
  return orderStatus(ctx, orderId);
}

export const money = formatMoney;
