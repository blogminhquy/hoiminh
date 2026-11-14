// Cổng thanh toán riêng của chủ hội (chủ dự án yêu cầu 14/11/2026). Ngoài chuyển khoản QR (owner-payout.ts), chủ hội
// cài được MoMo, VNPAY, PayPal và Stripe bằng khóa của chính mình: người mua trả qua cổng của chủ hội, tiền về tài khoản
// cổng của chủ hội, không qua Hội Mình. Người mua chỉ thấy cách đã cài và đang bật; cách chủ hội đặt làm mặc định được
// chọn sẵn. Cổng gọi về `/webhooks/hoi/<mã>`: mã xác định hội và cổng, chữ ký được kiểm bằng khóa của chủ hội.
import { encryptJson, isLocalEnv, randomToken, hmacHex } from '@hoiminh/config';
import { OWNER_GATEWAYS, OWNER_GATEWAY_FIELDS, gatewayComplete, type OwnerGateway, type OwnerGatewayInput, type PaymentMethodsUpdate, type PaymentProvider } from '@hoiminh/contracts';
import { communities, communityPaymentGateways, communityPayoutAccounts, paymentEvents, payments, orders, webhookEvents } from '@hoiminh/db';
import { MomoAdapter, normalizeReference, StripeAdapter, vnpQueryString, type IncomingWebhook, type NormalizedEvent, type PaymentAdapter } from '@hoiminh/payments';
import { and, eq, inArray } from 'drizzle-orm';
import type { Ctx } from '../context';
import { AppError, invalid, invalidState, notFound } from '../errors';
import { gatewayCredentials, gatewayWebhookUrl, isSimulatorCredentials, ownerGatewayAdapter, type GatewayRow } from '../lib/owner-gateway';
import { isOwnerPayee } from '../lib/payee';
import { requireCommunityPermission } from '../permissions';
import { audit } from './audit';
import { elevated } from './automation-engine';
import { applyRefund, confirmPayment, settlementOf } from './payments';

/** Tên cổng hiện cho người dùng. */
export const METHOD_NAME: Record<PaymentProvider, string> = { sepay: 'Chuyển khoản QR', momo: 'MoMo', vnpay: 'VNPAY', paypal: 'PayPal', stripe: 'Thẻ Visa, Mastercard (Stripe)' };

export interface OwnerMethods {
  /** Các cách người mua thấy, theo thứ tự cố định: chuyển khoản QR, MoMo, VNPAY, PayPal, Stripe. */
  methods: PaymentProvider[];
  /** Cách chọn sẵn: cách chủ hội đặt làm mặc định nếu còn bật, không thì cách đầu tiên. */
  defaultMethod: PaymentProvider | null;
  bank: typeof communityPayoutAccounts.$inferSelect | null;
  gateways: GatewayRow[];
}

/**
 * Các cách thanh toán người mua dùng được ở một hội. Người mua không thuộc workspace của hội nên policy RLS không cho họ
 * đọc các bảng này; máy chủ đọc hộ bằng quyền bypass và chỉ dùng để dựng bước thanh toán.
 */
export async function ownerPaymentMethods(ctx: Ctx, communityId: string): Promise<OwnerMethods> {
  return elevated(ctx, async () => {
    const [bank, gateways, c] = await Promise.all([
      ctx.db.query.communityPayoutAccounts.findFirst({ where: eq(communityPayoutAccounts.communityId, communityId) }),
      ctx.db.query.communityPaymentGateways.findMany({ where: eq(communityPaymentGateways.communityId, communityId) }),
      ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId), columns: { defaultPaymentMethod: true } }),
    ]);
    const methods: PaymentProvider[] = [];
    if (bank?.enabled) methods.push('sepay');
    // Cổng còn thiếu bước webhook thì chưa hiện: người mua trả xong mà cổng không báo về được thì đơn không tự mở quyền.
    for (const p of OWNER_GATEWAYS) if (gateways.some((g) => g.provider === p && g.enabled && gatewayComplete(p, g.summary))) methods.push(p);
    const want = c?.defaultPaymentMethod as PaymentProvider | null | undefined;
    return { methods, defaultMethod: want && methods.includes(want) ? want : methods[0] ?? null, bank: bank ?? null, gateways };
  });
}

/** Phần chủ hội thấy lại của một cổng: không có khóa bí mật, chỉ có phần không bí mật và 4 ký tự cuối. */
export function gatewayView(ctx: Ctx, provider: OwnerGateway, g: GatewayRow | undefined) {
  return {
    provider,
    configured: Boolean(g),
    /** Đã điền đủ mọi ô, kể cả bước webhook. Chưa đủ thì người mua chưa thấy cổng này. */
    complete: g ? gatewayComplete(provider, g.summary) : false,
    /** Tên các ô còn thiếu (thường là ô của bước webhook). */
    missing: g ? OWNER_GATEWAY_FIELDS[provider].filter((f) => !g.summary[f.key]).map((f) => f.label) : [],
    enabled: g?.enabled ?? false,
    mode: g?.mode ?? 'production',
    summary: g?.summary ?? {},
    /** Địa chỉ dán vào trang quản lý của cổng (IPN, webhook). Có sau khi lưu khóa lần đầu. */
    webhookUrl: g ? gatewayWebhookUrl(ctx, g.webhookToken) : null,
    lastWebhookAt: g?.lastWebhookAt ?? null,
    updatedAt: g?.updatedAt ?? null,
  };
}

const mask = (v: string) => (v.length <= 4 ? '••••' : `••••${v.slice(-4)}`);

/** Kiểm khóa đã gộp: đủ ô, đúng dạng của từng cổng. Trả về lời báo lỗi, hoặc null khi ổn. */
function credentialProblem(provider: OwnerGateway, c: Record<string, string>): string | null {
  // Ô của bước webhook điền sau được (xem OWNER_GATEWAY_FIELDS); các ô còn lại phải có ngay lần lưu đầu.
  const missing = OWNER_GATEWAY_FIELDS[provider].filter((f) => !f.webhookStep && !c[f.key]);
  if (missing.length) return `Còn thiếu: ${missing.map((f) => f.label).join(', ')}`;
  if (provider === 'stripe') {
    if (!/^(sk|rk)_(live|test)_/.test(c.secretKey!)) return 'Secret key của Stripe bắt đầu bằng sk_live_ hoặc sk_test_';
    if (c.webhookSecret && !c.webhookSecret.startsWith('whsec_')) return 'Signing secret của webhook Stripe bắt đầu bằng whsec_';
  }
  if (provider === 'vnpay' && !/^[A-Z0-9]{6,16}$/i.test(c.tmnCode!)) return 'Mã website VNPAY gồm chữ và số, thường 8 ký tự';
  return null;
}

/** Chủ hội lưu khóa một cổng, bật tắt hoặc đổi chế độ thử và thật. Ô khóa để trống là giữ nguyên khóa đã lưu. */
export async function saveGateway(ctx: Ctx, communityId: string, provider: OwnerGateway, input: OwnerGatewayInput) {
  const access = await requireCommunityPermission(ctx, communityId, 'billing.manage');
  const existing = await ctx.db.query.communityPaymentGateways.findFirst({ where: and(eq(communityPaymentGateways.communityId, communityId), eq(communityPaymentGateways.provider, provider)) });
  const allowed = new Set(OWNER_GATEWAY_FIELDS[provider].map((f) => f.key));
  const incoming: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.credentials ?? {})) if (allowed.has(k) && v.trim()) incoming[k] = v.trim();
  const changed = Object.keys(incoming).length > 0;
  if (!existing && !changed) throw invalid('Nhập khóa của cổng trước khi bật');
  const stored: Record<string, string> = existing ? await gatewayCredentials(ctx, existing).catch(() => ({})) : {};
  const creds: Record<string, string> = { ...stored, ...incoming };
  const problem = credentialProblem(provider, creds);
  if (problem) throw invalid(problem);
  // Bộ khóa thử của Hội Mình đi qua trang mô phỏng: ngoài máy dev và test thì không cho lưu, để không ai tự đánh dấu "đã trả".
  if (isSimulatorCredentials(provider, creds) && !isLocalEnv(ctx.env.APP_ENV)) throw invalid('Khóa này là khóa thử, không dùng để nhận tiền thật được. Dán khóa trong trang quản lý của cổng.');
  // Stripe tự biết thử hay thật theo khóa: sk_live_ là thật, sk_test_ là thử.
  const mode = provider === 'stripe' ? (/^(sk|rk)_live_/.test(creds.secretKey!) ? 'production' : 'sandbox') : (input.mode ?? existing?.mode ?? 'production');
  const summary: Record<string, string> = {};
  for (const f of OWNER_GATEWAY_FIELDS[provider]) if (creds[f.key]) summary[f.key] = f.secret ? mask(creds[f.key]!) : creds[f.key]!;
  const values = {
    mode,
    enabled: input.enabled ?? existing?.enabled ?? true,
    summary,
    ...(changed || !existing ? { credentialsEncrypted: await encryptJson(creds, ctx.env.ENCRYPTION_KEY, ctx.env.ENCRYPTION_KEY_VERSION) } : {}),
    updatedAt: ctx.now(),
  };
  const [row] = existing
    ? await ctx.db.update(communityPaymentGateways).set(values).where(eq(communityPaymentGateways.id, existing.id)).returning()
    : await ctx.db.insert(communityPaymentGateways).values({ communityId, workspaceId: access.workspaceId, provider, webhookToken: randomToken(20), credentialsEncrypted: values.credentialsEncrypted!, ...values }).returning();
  await audit(ctx, { action: existing ? 'payment_gateway.update' : 'payment_gateway.create', resourceType: 'community', resourceId: communityId, communityId, workspaceId: access.workspaceId, metadata: { provider, mode, enabled: values.enabled, credentialsChanged: changed } });
  return gatewayView(ctx, provider, row);
}

/** Gỡ hẳn một cổng: xóa khóa đã lưu, người mua không thấy cổng này nữa. */
export async function removeGateway(ctx: Ctx, communityId: string, provider: OwnerGateway) {
  const access = await requireCommunityPermission(ctx, communityId, 'billing.manage');
  const rows = await ctx.db.delete(communityPaymentGateways).where(and(eq(communityPaymentGateways.communityId, communityId), eq(communityPaymentGateways.provider, provider))).returning({ id: communityPaymentGateways.id });
  if (!rows.length) throw notFound('Hội chưa cài cổng này');
  await audit(ctx, { action: 'payment_gateway.remove', resourceType: 'community', resourceId: communityId, communityId, workspaceId: access.workspaceId, metadata: { provider } });
  return gatewayView(ctx, provider, undefined);
}

/** Bật tắt chuyển khoản QR và chọn cách mặc định. Chỉ đặt mặc định được cho cách đã cài và đang bật. */
export async function updatePaymentMethods(ctx: Ctx, communityId: string, input: PaymentMethodsUpdate) {
  const access = await requireCommunityPermission(ctx, communityId, 'billing.manage');
  if (input.bankEnabled !== undefined) {
    const rows = await ctx.db.update(communityPayoutAccounts).set({ enabled: input.bankEnabled, updatedAt: ctx.now() }).where(eq(communityPayoutAccounts.communityId, communityId)).returning({ id: communityPayoutAccounts.id });
    if (!rows.length) throw invalidState('Nhập tài khoản ngân hàng trước khi bật chuyển khoản QR');
  }
  if (input.defaultMethod !== undefined) {
    if (input.defaultMethod !== null) {
      const { methods } = await ownerPaymentMethods(ctx, communityId);
      if (!methods.includes(input.defaultMethod)) throw invalidState(`${METHOD_NAME[input.defaultMethod]} chưa cài hoặc đang tắt nên chưa đặt làm mặc định được`);
    }
    await ctx.db.update(communities).set({ defaultPaymentMethod: input.defaultMethod, updatedAt: ctx.now() }).where(eq(communities.id, communityId));
  }
  await audit(ctx, { action: 'payment_methods.update', resourceType: 'community', resourceId: communityId, communityId, workspaceId: access.workspaceId, metadata: { ...input } });
  const m = await ownerPaymentMethods(ctx, communityId);
  return { methods: m.methods, defaultMethod: m.defaultMethod };
}

export interface GatewayWebhookOutcome { status: number; body: unknown; result: 'processed' | 'duplicate' | 'ignored' | 'unmatched' | 'invalid_signature' | 'not_found' }

/**
 * Cổng của chủ hội gọi về `/webhooks/hoi/<mã>`. Mã xác định hội và cổng; chữ ký kiểm bằng khóa của chủ hội. Giao dịch
 * chỉ khớp với đơn của đúng hội đó, trả qua đúng cổng đó, đúng mã đơn và đủ tiền.
 */
export async function handleOwnerGatewayWebhook(ctx: Ctx, token: string, req: IncomingWebhook): Promise<GatewayWebhookOutcome> {
  // Bên gọi là cổng thanh toán, không phải người dùng nào của hội: mã trong địa chỉ cùng chữ ký là bằng chứng.
  return elevated(ctx, () => processOwnerGatewayWebhook(ctx, token, req));
}

async function processOwnerGatewayWebhook(ctx: Ctx, token: string, req: IncomingWebhook): Promise<GatewayWebhookOutcome> {
  const g = /^[a-f0-9]{40}$/.test(token) ? await ctx.db.query.communityPaymentGateways.findFirst({ where: eq(communityPaymentGateways.webhookToken, token) }) : null;
  if (!g) return { status: 404, body: { success: false, message: 'Địa chỉ không đúng' }, result: 'not_found' };
  const adapter = await ownerGatewayAdapter(ctx, g);
  const verified = await adapter.verifyWebhook(req);
  const event = verified ? adapter.parseWebhook(req) : null;
  if (!verified || !event) {
    ctx.log.warn('owner_gateway.invalid', { provider: g.provider, gatewayId: g.id, verified });
    return { ...adapter.webhookResponse(false), result: 'invalid_signature' };
  }
  // Chữ ký đúng là cổng đã nối đúng, kể cả khi sự kiện không liên quan tới đơn nào (lần "gửi thử" của cổng).
  await ctx.db.update(communityPaymentGateways).set({ lastWebhookAt: ctx.now() }).where(eq(communityPaymentGateways.id, g.id));
  // Mã giao dịch của mỗi tài khoản cổng là riêng, nên gắn thêm id cổng để hai chủ hội không đụng nhau.
  const inserted = await ctx.db.insert(webhookEvents).values({ provider: g.provider, providerEventId: `owner:${g.id}:${event.providerEventId}`, eventType: event.type, payload: event.raw, signatureVerified: true, processingStatus: 'received' }).onConflictDoNothing().returning();
  const respond = (result: GatewayWebhookOutcome['result']) => ({ ...adapter.webhookResponse(true), result });
  if (!inserted.length) return respond('duplicate');
  const row = inserted[0]!;
  try {
    const result = await processGatewayEvent(ctx, g, event, adapter);
    await ctx.db.update(webhookEvents).set({ processingStatus: result === 'processed' ? 'processed' : 'ignored', processedAt: ctx.now() }).where(eq(webhookEvents.id, row.id));
    return respond(result);
  } catch (err) {
    await ctx.db.update(webhookEvents).set({ processingStatus: 'failed', error: err instanceof Error ? err.message : String(err) }).where(eq(webhookEvents.id, row.id));
    throw err;
  }
}

async function processGatewayEvent(ctx: Ctx, g: GatewayRow, event: NormalizedEvent, adapter: PaymentAdapter): Promise<'processed' | 'ignored' | 'unmatched'> {
  if (event.type === 'ignored') return 'ignored';
  const ownOrder = and(eq(orders.communityId, g.communityId), eq(payments.provider, g.provider));
  let payment: typeof payments.$inferSelect | undefined;
  if (event.reference) {
    const n = normalizeReference(event.reference);
    [payment] = (await ctx.db.select({ p: payments }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(and(eq(payments.reference, `${n.slice(0, 2)} ${n.slice(2)}`), ownOrder))).map((r) => r.p);
  }
  // Sự kiện hoàn tiền của Stripe không mang mã đơn, chỉ có mã giao dịch của cổng.
  if (!payment && event.providerPaymentId) [payment] = (await ctx.db.select({ p: payments }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(and(eq(payments.providerPaymentId, event.providerPaymentId), ownOrder))).map((r) => r.p);
  if (!payment || !isOwnerPayee(payment)) return 'unmatched';
  await ctx.db.insert(paymentEvents).values({ paymentId: payment.id, eventType: event.type, payload: event.raw });
  const expected = settlementOf(payment);
  if (event.type === 'payment.approved') {
    // Người mua đồng ý trên PayPal: thu tiền bằng khóa của chủ hội. Quyền chỉ mở khi PAYMENT.CAPTURE.COMPLETED về.
    if (payment.status !== 'pending' && payment.status !== 'processing') return 'ignored';
    if (!adapter.capture || !event.providerPaymentId) return 'ignored';
    const r = await adapter.capture(event.providerPaymentId);
    if (!r.ok) throw new AppError('payment_error', 'Không thu được tiền PayPal cho đơn đã duyệt');
    return 'processed';
  }
  if (event.type === 'payment.succeeded') {
    if (payment.status === 'succeeded' || payment.status === 'refunded' || payment.status === 'partially_refunded') return 'ignored';
    if (event.currency !== expected.currency || event.amountMinor < expected.amountMinor) {
      ctx.log.warn('owner_gateway.amount_mismatch', { paymentId: payment.id, expected, got: { amountMinor: event.amountMinor, currency: event.currency } });
      return 'unmatched';
    }
    await confirmPayment(ctx, payment.id, { providerPaymentId: event.providerPaymentId, rawStatus: event.type, paidAt: event.transactionAt });
    return 'processed';
  }
  if (event.type === 'payment.failed') {
    // Báo thất bại đến muộn không được lật một thanh toán đã thành công.
    if (payment.status !== 'pending' && payment.status !== 'processing') return 'ignored';
    await ctx.db.update(payments).set({ status: 'failed', providerRawStatus: 'failed', updatedAt: ctx.now() }).where(and(eq(payments.id, payment.id), inArray(payments.status, ['pending', 'processing'])));
    await ctx.events.emit('payment.failed', { paymentId: payment.id, orderId: payment.orderId, userId: payment.customerUserId, reason: 'provider_failed' });
    return 'processed';
  }
  if (event.type === 'payment.refunded') {
    // Chủ hội hoàn tiền ngay trong trang của cổng: ghi nhận và thu hồi quyền. Quy về tiền của đơn theo tỷ lệ đã thu.
    const toOrder = (v: number) => (expected.amountMinor ? Math.round((payment!.amountMinor * v) / expected.amountMinor) : v);
    const remaining = payment.amountMinor - payment.refundedMinor;
    const amount = Math.min(remaining, event.cumulative ? toOrder(event.amountMinor) - payment.refundedMinor : toOrder(event.amountMinor) || remaining);
    if (amount <= 0) return 'ignored';
    const r = await applyRefund(ctx, payment.id, amount, 'Chủ hội hoàn tiền trong trang của cổng thanh toán', null, { fromProvider: true, providerRefundId: event.cumulative ? null : event.providerPaymentId });
    return r.alreadyRefunded ? 'ignored' : 'processed';
  }
  return 'ignored';
}

/**
 * Trang mô phỏng của cổng chủ hội (chỉ máy dev và test): dựng đúng sự kiện mà cổng thật sẽ gửi, ký bằng khóa của chủ hội,
 * rồi đưa qua đúng đường nhận webhook. Nhờ vậy toàn bộ đường xử lý (kiểm chữ ký, khớp đơn, mở quyền) là đường thật.
 */
export async function simulateOwnerGateway(ctx: Ctx, token: string, p: { orderRef: string; amount: number; requestId: string; success: boolean }): Promise<GatewayWebhookOutcome> {
  if (!isLocalEnv(ctx.env.APP_ENV)) throw notFound('Không có trang này');
  const g = await elevated(ctx, async () => (/^[a-f0-9]{40}$/.test(token) ? await ctx.db.query.communityPaymentGateways.findFirst({ where: eq(communityPaymentGateways.webhookToken, token) }) : null) ?? null);
  if (!g) throw notFound('Cổng không tồn tại');
  const c = await gatewayCredentials(ctx, g);
  const now = ctx.now();
  let req: IncomingWebhook;
  if (g.provider === 'momo') {
    const body = { partnerCode: c.partnerCode ?? '', orderId: p.orderRef, requestId: p.requestId || p.orderRef, amount: p.amount, orderInfo: 'Hoi Minh', orderType: 'momo_wallet', transId: now.getTime(), resultCode: p.success ? 0 : 1006, message: p.success ? 'Successful.' : 'Cancelled', payType: 'qr', responseTime: now.getTime(), extraData: '', signature: '' };
    body.signature = await hmacHex(c.secretKey ?? '', MomoAdapter.ipnSignatureString(c.accessKey ?? '', body));
    req = { headers: {}, rawBody: JSON.stringify(body), query: {} };
  } else if (g.provider === 'vnpay') {
    const pad = (n: number) => String(n).padStart(2, '0');
    const t = new Date(now.getTime() + 7 * 3_600_000);
    const q: Record<string, string> = { vnp_Amount: String(p.amount * 100), vnp_BankCode: 'NCB', vnp_OrderInfo: 'Hoi Minh', vnp_PayDate: `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}`, vnp_ResponseCode: p.success ? '00' : '24', vnp_TmnCode: c.tmnCode ?? '', vnp_TransactionNo: String(now.getTime()), vnp_TransactionStatus: p.success ? '00' : '02', vnp_TxnRef: p.orderRef };
    q.vnp_SecureHash = await hmacHex(c.hashSecret ?? '', vnpQueryString(q), 'SHA-512');
    req = { headers: {}, rawBody: '', query: q };
  } else if (g.provider === 'paypal') {
    const body = { id: `WH-SIM-${now.getTime()}`, event_type: p.success ? 'PAYMENT.CAPTURE.COMPLETED' : 'PAYMENT.CAPTURE.DENIED', create_time: now.toISOString(), resource: { id: `CAP-${now.getTime()}`, custom_id: p.orderRef, amount: { value: (p.amount / 100).toFixed(2), currency_code: 'USD' } } };
    req = { headers: { 'x-hoiminh-simulator': 'paypal' }, rawBody: JSON.stringify(body), query: {} };
  } else {
    // Stripe chỉ nhận chữ ký trong vòng 5 phút theo đồng hồ thật, nên mốc ký lấy giờ thật, không lấy giờ của ctx.
    const t = Math.floor(Date.now() / 1000);
    const body = { id: `evt_sim_${now.getTime()}`, type: p.success ? 'checkout.session.completed' : 'checkout.session.expired', created: t, data: { object: { id: `cs_sim_${now.getTime()}`, client_reference_id: p.orderRef, amount_total: p.amount, currency: 'vnd', payment_status: p.success ? 'paid' : 'unpaid', payment_intent: `pi_sim_${now.getTime()}` } } };
    const rawBody = JSON.stringify(body);
    req = { headers: { 'stripe-signature': `t=${t},v1=${await hmacHex(c.webhookSecret ?? '', StripeAdapter.signedPayload(t, rawBody))}` }, rawBody, query: {} };
  }
  return handleOwnerGatewayWebhook(ctx, token, req);
}
