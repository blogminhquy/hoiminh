// Payment Event Processor: nhận webhook đã verify, idempotent theo provider_event_id, khớp đơn, phát payment.succeeded, đối soát, hoàn tiền.
import { BUSINESS } from '@hoiminh/config';
import { formatMoney } from '@hoiminh/contracts';
import { templates } from '@hoiminh/email';
import type { IncomingWebhook, NormalizedEvent } from '@hoiminh/payments';
import { normalizeReference } from '@hoiminh/payments';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { communities, communityMembers, courseProgress, invoices, orders, paymentEvents, payments, products, reconciliationItems, refunds, users, webhookEvents } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { AppError, forbidden, invalidState, notFound } from '../errors';
import { requireCommunityPermission, requireUser } from '../permissions';
import { audit } from './audit';
import { revokeBySource } from './entitlements';

export interface WebhookOutcome {
  status: number;
  body: unknown;
  eventId: string | null;
  result: 'processed' | 'duplicate' | 'ignored' | 'invalid_signature' | 'unmatched';
}

/** Nhận webhook từ một cổng: verify chữ ký → lưu sự kiện (UNIQUE) → xử lý → phản hồi theo cổng. */
export async function handleWebhook(ctx: Ctx, provider: 'sepay' | 'momo' | 'vnpay' | 'paypal', req: IncomingWebhook): Promise<WebhookOutcome> {
  const adapter = ctx.payments.get(provider);
  const verified = await adapter.verifyWebhook(req);
  const event = adapter.parseWebhook(req);
  if (!verified || !event) {
    ctx.log.warn('webhook.invalid', { provider, verified, parsed: Boolean(event) });
    if (event) await ctx.db.insert(webhookEvents).values({ provider, providerEventId: `${event.providerEventId}-unverified-${Date.now()}`, eventType: event.type, payload: event.raw, signatureVerified: false, processingStatus: 'failed', error: 'Chữ ký không hợp lệ' }).onConflictDoNothing();
    const r = adapter.webhookResponse(false);
    return { ...r, eventId: null, result: 'invalid_signature' };
  }
  const inserted = await ctx.db.insert(webhookEvents).values({ provider, providerEventId: event.providerEventId, eventType: event.type, payload: event.raw, signatureVerified: true, processingStatus: 'received' }).onConflictDoNothing().returning();
  if (!inserted.length) {
    ctx.log.info('webhook.duplicate', { provider, id: event.providerEventId });
    const r = adapter.webhookResponse(true);
    return { ...r, eventId: null, result: 'duplicate' };
  }
  const row = inserted[0]!;
  try {
    const result = await processEvent(ctx, provider, event, row.id);
    await ctx.db.update(webhookEvents).set({ processingStatus: result === 'processed' ? 'processed' : 'ignored', processedAt: ctx.now() }).where(eq(webhookEvents.id, row.id));
    const r = adapter.webhookResponse(true);
    return { ...r, eventId: row.id, result };
  } catch (err) {
    await ctx.db.update(webhookEvents).set({ processingStatus: 'failed', error: err instanceof Error ? err.message : String(err) }).where(eq(webhookEvents.id, row.id));
    throw err;
  }
}

async function processEvent(ctx: Ctx, provider: string, event: NormalizedEvent, webhookEventId: string): Promise<'processed' | 'ignored' | 'unmatched'> {
  if (event.type === 'ignored') return 'ignored';
  const payment = event.reference ? await ctx.db.query.payments.findFirst({ where: and(eq(payments.reference, referenceWithSpace(event.reference)), eq(payments.provider, provider)) }) ?? await ctx.db.query.payments.findFirst({ where: eq(payments.reference, referenceWithSpace(event.reference)) }) : null;
  if (provider === 'sepay') {
    const status = !payment ? (event.reference ? 'wrong_content' : 'missing_code') : payment.status === 'succeeded' ? 'duplicate' : payment.amountMinor !== event.amountMinor ? 'amount_mismatch' : 'matched';
    await ctx.db.insert(reconciliationItems).values({ provider, providerTransactionId: event.providerEventId, bankContent: event.bankContent ?? '', bankAccount: event.bankAccount ?? null, referenceCode: event.reference ? referenceWithSpace(event.reference) : null, amountMinor: event.amountMinor, expectedMinor: payment?.amountMinor ?? null, status, paymentId: payment?.id ?? null, orderId: payment?.orderId ?? null, webhookEventId, transactionAt: event.transactionAt, matchedAt: status === 'matched' ? ctx.now() : null }).onConflictDoNothing();
    if (status !== 'matched') {
      ctx.log.warn('reconciliation.unmatched', { status, reference: event.reference, amount: event.amountMinor });
      return 'unmatched';
    }
  }
  if (!payment) return 'unmatched';
  await ctx.db.insert(paymentEvents).values({ paymentId: payment.id, eventType: event.type, payload: event.raw });
  if (event.type === 'payment.succeeded') {
    if (payment.status === 'succeeded') return 'ignored';
    if (event.amountMinor < payment.amountMinor) {
      ctx.log.warn('payment.amount_short', { paymentId: payment.id, expected: payment.amountMinor, got: event.amountMinor });
      return 'unmatched';
    }
    await confirmPayment(ctx, payment.id, { providerPaymentId: event.providerPaymentId, rawStatus: event.type, paidAt: event.transactionAt });
    return 'processed';
  }
  if (event.type === 'payment.failed') {
    await ctx.db.update(payments).set({ status: 'failed', providerRawStatus: String((event.raw as { resultCode?: unknown; vnp_ResponseCode?: unknown }).resultCode ?? (event.raw as { vnp_ResponseCode?: unknown }).vnp_ResponseCode ?? 'failed'), updatedAt: ctx.now() }).where(eq(payments.id, payment.id));
    await ctx.events.emit('payment.failed', { paymentId: payment.id, orderId: payment.orderId, userId: payment.customerUserId, reason: 'provider_failed' });
    return 'processed';
  }
  if (event.type === 'payment.refunded') {
    await applyRefund(ctx, payment.id, event.amountMinor || payment.amountMinor, 'Hoàn từ cổng thanh toán', null);
    return 'processed';
  }
  return 'ignored';
}

function referenceWithSpace(normalized: string): string {
  const n = normalizeReference(normalized);
  return `${n.slice(0, 2)} ${n.slice(2)}`;
}

/** Xác nhận thanh toán thành công: cập nhật payment/order, hóa đơn, LTV, phát payment.succeeded (entitlement, hoa hồng, email, webhook nghe theo). */
export async function confirmPayment(ctx: Ctx, paymentId: string, info: { providerPaymentId: string | null; rawStatus: string; paidAt: Date }): Promise<void> {
  const payment = await ctx.db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment || payment.status === 'succeeded') return;
  const order = await ctx.db.query.orders.findFirst({ where: eq(orders.id, payment.orderId) });
  if (!order) throw notFound('Đơn không tồn tại');
  await ctx.db.transaction(async (tx) => {
    await tx.update(payments).set({ status: 'succeeded', providerPaymentId: info.providerPaymentId ?? payment.providerPaymentId, providerRawStatus: info.rawStatus, paidAt: info.paidAt, updatedAt: ctx.now() }).where(eq(payments.id, paymentId));
    await tx.update(orders).set({ status: 'paid', paidAt: info.paidAt, updatedAt: ctx.now() }).where(eq(orders.id, order.id));
    if (order.couponId) await raw(tx, sql`update coupons set redemption_count = redemption_count + 1 where id = ${order.couponId}`);
    const maxRows = await raw<{ m: number | null }>(tx, sql`select max(nullif(regexp_replace(number, '^.*-', ''), '')::int) as m from invoices`);
    const nextNumber = Number(maxRows[0]?.m ?? 1000) + 1;
    await tx.insert(invoices).values({ workspaceId: order.workspaceId, orderId: order.id, userId: order.customerUserId, number: `HM-${info.paidAt.getFullYear()}-${nextNumber}`, amountMinor: order.totalMinor, currency: order.currency, description: String((order.metadata as { title?: string }).title ?? order.targetType), issuedAt: info.paidAt });
    if (order.communityId) await tx.update(communityMembers).set({ lifetimeValueCents: sql`${communityMembers.lifetimeValueCents} + ${order.totalMinor}`, lastPaymentAt: info.paidAt }).where(and(eq(communityMembers.communityId, order.communityId), eq(communityMembers.userId, order.customerUserId)));
    if (order.targetType === 'product') await tx.update(products).set({ salesCount: sql`${products.salesCount} + 1` }).where(eq(products.id, order.targetId));
  });
  await ctx.events.emit('payment.succeeded', { paymentId, orderId: order.id, userId: order.customerUserId, workspaceId: order.workspaceId, communityId: order.communityId, amountMinor: order.totalMinor, currency: order.currency, provider: payment.provider, targetType: order.targetType, targetId: order.targetId, affiliateAccountId: order.affiliateAccountId });
  await audit(ctx, { action: 'payment.succeeded', resourceType: 'payment', resourceId: paymentId, communityId: order.communityId, workspaceId: order.workspaceId, metadata: { amountMinor: order.totalMinor, provider: payment.provider } });
}

/** Thành viên yêu cầu hoàn tiền khóa học mua lẻ: trong 7 ngày, xem chưa quá 20%. */
export async function requestRefund(ctx: Ctx, orderId: string, reason: string) {
  const userId = requireUser(ctx);
  const order = await ctx.db.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.customerUserId, userId)) });
  if (!order || order.status !== 'paid' || !order.paidAt) throw invalidState('Đơn không ở trạng thái đã thanh toán');
  if (order.targetType !== 'product') throw invalidState('Chỉ hoàn tiền cho sản phẩm mua lẻ trong Cửa hàng');
  if (ctx.now().getTime() - order.paidAt.getTime() > BUSINESS.courseRefundDays * 86_400_000) throw invalidState(`Đã quá ${BUSINESS.courseRefundDays} ngày kể từ khi thanh toán`);
  const product = await ctx.db.query.products.findFirst({ where: eq(products.id, order.targetId) });
  if (product?.courseId) {
    const p = await ctx.db.query.courseProgress.findFirst({ where: and(eq(courseProgress.courseId, product.courseId), eq(courseProgress.userId, userId)) });
    if ((p?.percent ?? 0) > BUSINESS.courseRefundMaxProgressPercent) throw invalidState(`Bạn đã xem quá ${BUSINESS.courseRefundMaxProgressPercent}% nội dung nên không hoàn tiền được`);
  }
  const payment = await ctx.db.query.payments.findFirst({ where: and(eq(payments.orderId, orderId), eq(payments.status, 'succeeded')) });
  if (!payment) throw invalidState('Không tìm thấy thanh toán');
  return applyRefund(ctx, payment.id, payment.amountMinor, reason || 'Thành viên yêu cầu trong 7 ngày', userId);
}

/** Chủ hội/admin hoàn tiền một đơn. */
export async function adminRefund(ctx: Ctx, orderId: string, reason: string) {
  const order = await ctx.db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.status !== 'paid') throw invalidState('Đơn không ở trạng thái đã thanh toán');
  if (order.communityId) await requireCommunityPermission(ctx, order.communityId, 'billing.manage');
  else if (ctx.actor.type === 'user' && !ctx.actor.isSuperAdmin) throw forbidden();
  const payment = await ctx.db.query.payments.findFirst({ where: and(eq(payments.orderId, orderId), eq(payments.status, 'succeeded')) });
  if (!payment) throw invalidState('Không tìm thấy thanh toán');
  return applyRefund(ctx, payment.id, payment.amountMinor, reason, ctx.actor.type === 'user' ? ctx.actor.userId : null);
}

/** Ghi hoàn tiền: gọi adapter (thủ công với chuyển khoản), thu hồi entitlement, phát payment.refunded. */
export async function applyRefund(ctx: Ctx, paymentId: string, amountMinor: number, reason: string, requestedBy: string | null) {
  const payment = await ctx.db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment) throw notFound();
  if (payment.status === 'refunded') return { refundId: null, manual: false, alreadyRefunded: true };
  const adapter = ctx.payments.get(payment.provider as 'sepay');
  const r = await adapter.refund({ providerPaymentId: payment.providerPaymentId, reference: payment.reference, amountMinor, reason });
  if (!r.ok) throw new AppError('payment_error', 'Cổng thanh toán từ chối hoàn tiền');
  const [refund] = await ctx.db.insert(refunds).values({ paymentId, orderId: payment.orderId, amountMinor, reason, status: 'succeeded', providerRefundId: r.providerRefundId, requestedByUserId: requestedBy }).returning();
  const full = amountMinor >= payment.amountMinor;
  await ctx.db.update(payments).set({ status: full ? 'refunded' : 'partially_refunded', refundedMinor: sql`${payments.refundedMinor} + ${amountMinor}`, updatedAt: ctx.now() }).where(eq(payments.id, paymentId));
  await ctx.db.update(orders).set({ status: full ? 'refunded' : 'paid', refundedAt: ctx.now(), updatedAt: ctx.now() }).where(eq(orders.id, payment.orderId));
  if (full) await revokeBySource(ctx, 'purchase', payment.orderId);
  if (full) await revokeBySource(ctx, 'community_bundle', payment.orderId);
  if (payment.communityId) await ctx.db.update(communityMembers).set({ lifetimeValueCents: sql`greatest(${communityMembers.lifetimeValueCents} - ${amountMinor}, 0)` }).where(and(eq(communityMembers.communityId, payment.communityId), eq(communityMembers.userId, payment.customerUserId)));
  await ctx.events.emit('payment.refunded', { paymentId, orderId: payment.orderId, userId: payment.customerUserId, communityId: payment.communityId, amountMinor, refundId: refund!.id });
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, payment.customerUserId) });
  const order = await ctx.db.query.orders.findFirst({ where: eq(orders.id, payment.orderId) });
  if (user) await ctx.email.send(templates.paymentRefunded(user.email, user.name, String((order?.metadata as { title?: string })?.title ?? 'đơn hàng'), formatMoney(amountMinor, payment.currency as 'VND')));
  await audit(ctx, { action: 'payment.refund', resourceType: 'payment', resourceId: paymentId, communityId: payment.communityId, metadata: { amountMinor, reason, manual: r.manual } });
  return { refundId: refund!.id, manual: r.manual, alreadyRefunded: false };
}

/** Hết hạn đơn chờ quá 30 phút (cron). */
export async function expirePendingOrders(ctx: Ctx): Promise<number> {
  const rows = await ctx.db.update(orders).set({ status: 'expired', updatedAt: ctx.now() }).where(and(eq(orders.status, 'pending'), lt(orders.expiresAt, ctx.now()))).returning({ id: orders.id });
  if (rows.length) await ctx.db.update(payments).set({ status: 'expired', updatedAt: ctx.now() }).where(and(inArray(payments.orderId, rows.map((r) => r.id)), inArray(payments.status, ['pending', 'processing'])));
  return rows.length;
}

/** Danh sách hội có thể chuyển khoản sai nội dung: lấy tên hội cho màn đối soát. */
export async function communityNameOf(ctx: Ctx, communityId: string | null): Promise<string | null> {
  if (!communityId) return null;
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId), columns: { name: true } });
  return c?.name ?? null;
}
