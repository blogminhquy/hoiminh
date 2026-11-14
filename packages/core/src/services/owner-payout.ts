// Nhận tiền của chủ hội (kế hoạch 11/11/2026): tiền bán hàng của hội về thẳng tài khoản ngân hàng của chủ hội, không
// đi qua Hội Mình. Chủ hội cài tài khoản ở Cài đặt, Nhận tiền; hội chưa cài thì chưa bật được thanh toán. Đơn được xác
// nhận theo một trong hai cách: dịch vụ báo có của chủ hội gọi về (tự xác nhận), hoặc chủ hội bấm "Đã nhận tiền".
// Tiền mua gói Hội Mình không đi qua đây: vẫn về tài khoản của Hội Mình như trước.
import { randomToken } from '@hoiminh/config';
import { OWNER_GATEWAYS, VIETNAM_BANKS, formatMoney, type PaymentInstruction, type PayoutAccountInput } from '@hoiminh/contracts';
import type { IncomingWebhook } from '@hoiminh/payments';
import { normalizeReference } from '@hoiminh/payments';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { communities, communityPayoutAccounts, orders, paymentEvents, payments, users, webhookEvents, workspaces } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { AppError, invalidState, notFound } from '../errors';
import { isOwnerPayee } from '../lib/payee';
import { paymentsFor } from '../lib/payment-accounts';
import { requireCommunityPermission } from '../permissions';
import { audit } from './audit';
import { elevated } from './automation-engine';
import { notify } from './notifications';
import { gatewayView, ownerPaymentMethods } from './owner-gateways';
import { confirmPayment } from './payments';

type Account = typeof communityPayoutAccounts.$inferSelect;

/** Chủ hội còn xác nhận được đơn trong bao nhiêu ngày kể từ lúc đơn được tạo (người mua có thể chuyển khoản muộn). */
export const OWNER_CONFIRM_DAYS = 7;

const bankOf = (code: string) => VIETNAM_BANKS.find((b) => b.code === code);
const webhookUrl = (ctx: Ctx, token: string) => `${ctx.env.API_URL}/webhooks/bank/${token}`;

/**
 * Tài khoản nhận tiền của một hội, đọc cho người mua lúc tạo đơn. Người mua không thuộc workspace của hội nên policy
 * RLS không cho họ đọc bảng này; máy chủ đọc hộ bằng quyền bypass và chỉ dùng số tài khoản để dựng mã QR.
 */
export async function payoutAccountForCheckout(ctx: Ctx, communityId: string): Promise<Account | null> {
  return elevated(ctx, async () => (await ctx.db.query.communityPayoutAccounts.findFirst({ where: eq(communityPayoutAccounts.communityId, communityId) })) ?? null);
}

/** Hội đã mở thanh toán chưa: có ít nhất một cách nhận tiền đã cài và đang bật. Giao diện dùng để khóa nút mua. */
export async function paymentsReady(ctx: Ctx, communityId: string): Promise<boolean> {
  return (await ownerPaymentMethods(ctx, communityId)).methods.length > 0;
}

/** Hướng dẫn chuyển khoản tới tài khoản của chủ hội: mã VietQR có sẵn số tiền và nội dung chứa mã đơn. */
export function ownerBankInstruction(account: Account, amountMinor: number, reference: string): Extract<PaymentInstruction, { kind: 'bank_qr' }> {
  const bank = bankOf(account.bankCode);
  const qrImageUrl = `https://img.vietqr.io/image/${bank?.bin ?? account.bankCode}-${account.accountNumber}-compact2.png?amount=${amountMinor}&addInfo=${encodeURIComponent(reference)}&accountName=${encodeURIComponent(account.accountHolder)}`;
  return { kind: 'bank_qr', qrImageUrl, bankName: bank?.name ?? account.bankCode, bankCode: account.bankCode, accountNumber: account.accountNumber, accountHolder: account.accountHolder, amountMinor, transferContent: reference, payee: 'owner', confirmMode: account.confirmMode };
}

function view(ctx: Ctx, a: Account) {
  return {
    bankCode: a.bankCode,
    bankName: bankOf(a.bankCode)?.name ?? a.bankCode,
    accountNumber: a.accountNumber,
    accountHolder: a.accountHolder,
    confirmMode: a.confirmMode,
    /** Người mua có thấy cách chuyển khoản QR không. */
    enabled: a.enabled,
    /** Địa chỉ để dán vào dịch vụ báo có của chủ hội. Chỉ người có quyền tiền của hội mới thấy. */
    webhookUrl: webhookUrl(ctx, a.webhookToken),
    lastWebhookAt: a.lastWebhookAt,
    updatedAt: a.updatedAt,
  };
}

async function pendingRows(ctx: Ctx, communityId: string) {
  const since = new Date(ctx.now().getTime() - OWNER_CONFIRM_DAYS * 86_400_000);
  const rows = await ctx.db
    .select({ o: orders, p: payments, buyer: { id: users.id, name: users.name, email: users.email } })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(users, eq(users.id, orders.customerUserId))
    // Chỉ đơn chuyển khoản: đơn qua cổng (MoMo, VNPAY, PayPal, Stripe) tự xác nhận khi cổng báo về, người mua bỏ dở
    // ở trang của cổng thì không có gì để chủ hội kiểm tra.
    .where(and(eq(orders.communityId, communityId), inArray(orders.status, ['pending', 'expired']), inArray(payments.status, ['pending', 'processing', 'expired']), eq(payments.provider, 'sepay'), gte(orders.createdAt, since), sql`${payments.instruction}->>'payee' = 'owner'`))
    .orderBy(desc(orders.createdAt))
    .limit(100);
  // Người mua đã bấm "Tôi đã chuyển khoản" lên đầu: đó là các đơn chủ hội cần kiểm tra tài khoản trước.
  return rows.sort((a, b) => Number(b.p.status === 'processing') - Number(a.p.status === 'processing'));
}

/**
 * Cài đặt, Nhận tiền: tài khoản ngân hàng đã cài (nếu có), các cổng riêng của chủ hội, các cách người mua đang thấy và
 * cách chọn sẵn, các đơn chuyển khoản đang chờ chủ hội xác nhận, tiền đã thu 30 ngày.
 */
export async function payoutSetup(ctx: Ctx, communityId: string) {
  await requireCommunityPermission(ctx, communityId, 'billing.manage');
  const account = await ctx.db.query.communityPayoutAccounts.findFirst({ where: eq(communityPayoutAccounts.communityId, communityId) });
  const methods = await ownerPaymentMethods(ctx, communityId);
  const pending = account ? await pendingRows(ctx, communityId) : [];
  const [sum] = await raw<{ received: string }>(ctx.db, sql`select coalesce(sum(total_minor),0)::bigint as received from orders where community_id = ${communityId} and status = 'paid' and paid_at >= now() - interval '30 days'`);
  return {
    ready: methods.methods.length > 0,
    account: account ? view(ctx, account) : null,
    gateways: OWNER_GATEWAYS.map((p) => gatewayView(ctx, p, methods.gateways.find((g) => g.provider === p))),
    methods: methods.methods,
    defaultMethod: methods.defaultMethod,
    banks: VIETNAM_BANKS.map((b) => ({ code: b.code, name: b.name })),
    received30Minor: Number(sum?.received ?? 0),
    pending: pending.map((r) => ({
      orderId: r.o.id,
      title: String((r.o.metadata as { title?: unknown }).title ?? 'Đơn hàng'),
      amountMinor: r.o.totalMinor,
      reference: r.o.reference,
      buyerName: r.buyer.name,
      buyerEmail: r.buyer.email,
      createdAt: r.o.createdAt,
      /** Người mua đã bấm "Tôi đã chuyển khoản". */
      buyerSaysPaid: r.p.status === 'processing',
    })),
  };
}

/** Chủ hội lưu tài khoản nhận tiền. Lưu lần đầu là mở thanh toán cho hội. */
export async function savePayoutAccount(ctx: Ctx, communityId: string, input: PayoutAccountInput) {
  const access = await requireCommunityPermission(ctx, communityId, 'billing.manage');
  const existing = await ctx.db.query.communityPayoutAccounts.findFirst({ where: eq(communityPayoutAccounts.communityId, communityId) });
  const values = { bankCode: input.bankCode, accountNumber: input.accountNumber, accountHolder: input.accountHolder, confirmMode: input.confirmMode, ...(input.enabled === undefined ? {} : { enabled: input.enabled }), updatedAt: ctx.now() };
  const [row] = existing
    ? await ctx.db.update(communityPayoutAccounts).set(values).where(eq(communityPayoutAccounts.id, existing.id)).returning()
    : await ctx.db.insert(communityPayoutAccounts).values({ communityId, workspaceId: access.workspaceId, webhookToken: randomToken(20), ...values }).returning();
  await audit(ctx, { action: existing ? 'payout_account.update' : 'payout_account.create', resourceType: 'community', resourceId: communityId, communityId, workspaceId: access.workspaceId, metadata: { bankCode: input.bankCode, accountLast4: input.accountNumber.slice(-4), confirmMode: input.confirmMode } });
  return view(ctx, row!);
}

/** Đổi địa chỉ báo có (khi địa chỉ cũ bị lộ). Địa chỉ cũ ngừng nhận ngay. */
export async function rotatePayoutWebhook(ctx: Ctx, communityId: string) {
  const access = await requireCommunityPermission(ctx, communityId, 'billing.manage');
  const [row] = await ctx.db.update(communityPayoutAccounts).set({ webhookToken: randomToken(20), lastWebhookAt: null, updatedAt: ctx.now() }).where(eq(communityPayoutAccounts.communityId, communityId)).returning();
  if (!row) throw notFound('Hội chưa cài tài khoản nhận tiền');
  await audit(ctx, { action: 'payout_account.rotate_webhook', resourceType: 'community', resourceId: communityId, communityId, workspaceId: access.workspaceId });
  return view(ctx, row);
}

/** Chủ hội bấm "Đã nhận tiền" cho một đơn: đơn chuyển sang đã trả và người mua được mở quyền ngay. */
export async function confirmOwnerOrder(ctx: Ctx, communityId: string, orderId: string) {
  const access = await requireCommunityPermission(ctx, communityId, 'billing.manage');
  const order = await ctx.db.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.communityId, communityId)) });
  if (!order) throw notFound('Đơn không tồn tại');
  const payment = await ctx.db.query.payments.findFirst({ where: eq(payments.orderId, order.id), orderBy: (t, { desc: d }) => d(t.createdAt) });
  if (!payment || !isOwnerPayee(payment)) throw invalidState('Đơn này không trả vào tài khoản của hội');
  if (payment.status === 'succeeded' || order.status === 'paid') return { orderId: order.id, confirmed: false, alreadyPaid: true };
  if (ctx.now().getTime() - order.createdAt.getTime() > OWNER_CONFIRM_DAYS * 86_400_000) throw invalidState(`Đơn đã quá ${OWNER_CONFIRM_DAYS} ngày, nhờ người mua tạo đơn mới`);
  await ctx.db.insert(paymentEvents).values({ paymentId: payment.id, eventType: 'payment.succeeded', payload: { source: 'owner_confirmed', by: ctx.actor.type === 'user' ? ctx.actor.userId : ctx.actor.type } });
  const confirmed = await confirmPayment(ctx, payment.id, { providerPaymentId: null, rawStatus: 'owner_confirmed', paidAt: ctx.now() });
  await audit(ctx, { action: 'order.owner_confirmed', resourceType: 'order', resourceId: order.id, communityId, workspaceId: access.workspaceId, metadata: { amountMinor: order.totalMinor, reference: order.reference } });
  return { orderId: order.id, confirmed, alreadyPaid: !confirmed };
}

/** Người mua bấm "Tôi đã chuyển khoản" ở đơn trả thẳng chủ hội: báo chủ hội vào kiểm tra tài khoản và xác nhận. */
export async function notifyOwnerOfTransfer(ctx: Ctx, order: typeof orders.$inferSelect, payment: typeof payments.$inferSelect): Promise<void> {
  if (!order.communityId || !isOwnerPayee(payment)) return;
  const row = await elevated(ctx, async () => {
    const [r] = await ctx.db
      .select({ ownerUserId: workspaces.ownerUserId, slug: communities.slug, mode: communityPayoutAccounts.confirmMode })
      .from(communities)
      .innerJoin(workspaces, eq(workspaces.id, communities.workspaceId))
      .leftJoin(communityPayoutAccounts, eq(communityPayoutAccounts.communityId, communities.id))
      .where(eq(communities.id, order.communityId!));
    return r ?? null;
  });
  // Tự xác nhận thì tiền về là đơn tự chuyển trạng thái, không cần gọi chủ hội cho từng đơn.
  if (!row || row.mode === 'auto') return;
  const buyer = await ctx.db.query.users.findFirst({ where: eq(users.id, order.customerUserId), columns: { name: true } });
  await elevated(ctx, () => notify(ctx, { userId: row.ownerUserId, communityId: order.communityId, kind: 'order.buyer_transferred', category: 'payment', title: `${buyer?.name ?? 'Người mua'} báo đã chuyển ${formatMoney(order.totalMinor)} · ${order.reference}`, body: 'Kiểm tra tài khoản rồi bấm "Đã nhận tiền" để mở quyền cho người mua', actorUserId: order.customerUserId, link: `/${row.slug}/tien`, actionLabel: 'Xác nhận' }));
}

export interface OwnerWebhookOutcome { status: number; body: unknown; result: 'processed' | 'duplicate' | 'ignored' | 'unmatched' | 'not_found' }

/**
 * Dịch vụ báo có của chủ hội gọi về `/webhooks/bank/<token>` mỗi khi tài khoản có tiền vào. Mã bí mật trong địa chỉ
 * xác định hội; giao dịch chỉ khớp với đơn của đúng hội đó, đúng mã đơn và đủ tiền. Nhận theo định dạng của SePay.
 */
export async function handleOwnerBankWebhook(ctx: Ctx, token: string, req: IncomingWebhook): Promise<OwnerWebhookOutcome> {
  // Bên gọi là dịch vụ ngân hàng, không phải người dùng nào của hội: mã bí mật trong địa chỉ là bằng chứng được phép.
  return elevated(ctx, () => processOwnerBankWebhook(ctx, token, req));
}

async function processOwnerBankWebhook(ctx: Ctx, token: string, req: IncomingWebhook): Promise<OwnerWebhookOutcome> {
  const ok = { status: 200, body: { success: true } };
  const account = /^[a-f0-9]{40}$/.test(token) ? await ctx.db.query.communityPayoutAccounts.findFirst({ where: eq(communityPayoutAccounts.webhookToken, token) }) : null;
  if (!account) return { status: 404, body: { success: false, message: 'Địa chỉ báo có không đúng' }, result: 'not_found' };
  const event = (await paymentsFor(ctx)).get('sepay').parseWebhook(req);
  if (!event) return { status: 400, body: { success: false, message: 'Dữ liệu không đúng định dạng' }, result: 'ignored' };
  await ctx.db.update(communityPayoutAccounts).set({ lastWebhookAt: ctx.now() }).where(eq(communityPayoutAccounts.id, account.id));
  // Mã giao dịch của mỗi tài khoản báo có là riêng, nên gắn thêm id tài khoản để hai chủ hội không đụng nhau.
  const inserted = await ctx.db.insert(webhookEvents).values({ provider: 'sepay', providerEventId: `owner:${account.id}:${event.providerEventId}`, eventType: event.type, payload: event.raw, signatureVerified: true, processingStatus: 'received' }).onConflictDoNothing().returning();
  if (!inserted.length) return { ...ok, result: 'duplicate' };
  const done = async (result: OwnerWebhookOutcome['result']) => {
    await ctx.db.update(webhookEvents).set({ processingStatus: result === 'processed' ? 'processed' : 'ignored', processedAt: ctx.now() }).where(eq(webhookEvents.id, inserted[0]!.id));
    return { ...ok, result };
  };
  if (event.type !== 'payment.succeeded' || !event.reference) return done('ignored');
  const n = normalizeReference(event.reference);
  const reference = `${n.slice(0, 2)} ${n.slice(2)}`;
  const [row] = await ctx.db.select({ p: payments }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(and(eq(payments.reference, reference), eq(orders.communityId, account.communityId)));
  const payment = row?.p;
  if (!payment || !isOwnerPayee(payment)) return done('unmatched');
  if (payment.status === 'succeeded' || payment.status === 'refunded' || payment.status === 'partially_refunded') return done('ignored');
  if (event.currency !== payment.currency || event.amountMinor < payment.amountMinor) {
    ctx.log.warn('owner_payout.amount_mismatch', { paymentId: payment.id, expected: payment.amountMinor, got: event.amountMinor });
    return done('unmatched');
  }
  await ctx.db.insert(paymentEvents).values({ paymentId: payment.id, eventType: event.type, payload: event.raw });
  // Mốc trả tiền là lúc ghi nhận, không lấy giờ do bên gọi tự khai.
  await confirmPayment(ctx, payment.id, { providerPaymentId: event.providerPaymentId, rawStatus: 'owner_bank_webhook', paidAt: ctx.now() });
  return done('processed');
}

/** Lỗi dùng chung khi hội chưa cài nhận tiền. */
export function paymentsNotReadyError(): AppError {
  return new AppError('payment_error', 'Hội này chưa mở thanh toán. Chủ hội cần cài tài khoản nhận tiền trước.', undefined, { reason: 'payout_not_ready' });
}
