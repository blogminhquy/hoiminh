// Cổng thanh toán riêng của chủ hội (14/11/2026): chủ hội cài MoMo, VNPAY, PayPal, Stripe bằng khóa của mình, người mua
// chỉ thấy cách đã cài và đang bật, cách mặc định được chọn sẵn. Kiểm tra: lưu khóa (không bao giờ trả khóa ra lại),
// chọn mặc định, tạo đơn qua cổng của chủ hội, cổng báo về đúng địa chỉ thì đơn tự chuyển sang đã trả, cổng của hội khác
// hay cổng của Hội Mình không xác nhận hộ được, và đơn gói Hội Mình chỉ hiện cổng quản trị đã cài.
import { hmacHex } from '@hoiminh/config';
import { communityPaymentGateways, orders, payments, providerAccounts } from '@hoiminh/db';
import { MomoAdapter } from '@hoiminh/payments';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import type { AppError } from '../errors';
import * as admin from '../services/admin';
import * as checkout from '../services/checkout';
import * as entitlementSvc from '../services/entitlements';
import * as ownerGateways from '../services/owner-gateways';
import * as ownerPayout from '../services/owner-payout';
import * as paymentsSvc from '../services/payments';
import * as platformBilling from '../services/platform-billing';
import * as platformMethods from '../services/platform-methods';
import * as shell from '../services/shell';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let vy: Ctx; // chủ hội "Ngoại ngữ cùng Vy": hội freemium, chưa cài cách nhận tiền nào
let VY = '', KD = '';
const MOMO = { partnerCode: 'MOMOVY01', accessKey: 'momo-sandbox-vy-access', secretKey: 'momo-sandbox-vy-secret-key-123456' };
const STRIPE = { secretKey: 'sk_test_hoiminh_vy_0001', webhookSecret: 'whsec_vy_test_secret' };

beforeAll(async () => {
  app = await createTestApp();
  vy = { ...app.system(), actor: { type: 'user', userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' } };
  VY = await app.ids('community:vy');
  KD = await app.ids('community:kd');
}, 180_000);
afterAll(async () => {
  await app.close();
});

const premium = (ctx: Ctx, provider?: 'sepay' | 'momo' | 'stripe' | 'vnpay' | 'paypal') => checkout.createCheckout(ctx, { target: { type: 'tier', communityId: VY, tierKey: 'premium', cycle: 'monthly' }, ...(provider ? { provider } : {}) });
const orderOf = (id: string) => app.ctx.db.query.orders.findFirst({ where: eq(orders.id, id) });
const tokenOf = (url: string | null) => url!.split('/').pop()!;

describe('chủ hội cài cổng của mình', () => {
  it('chỉ người có quyền tiền của hội mới cài được; thiếu ô hoặc sai dạng khóa thì báo rõ', async () => {
    await expect(ownerGateways.saveGateway(await app.as('member1'), VY, 'momo', { credentials: MOMO })).rejects.toThrow();
    await expect(ownerGateways.saveGateway(vy, VY, 'momo', {})).rejects.toThrow(/Nhập khóa/);
    await expect(ownerGateways.saveGateway(vy, VY, 'momo', { credentials: { partnerCode: 'MOMOVY01' } })).rejects.toThrow(/Còn thiếu: Access Key, Secret Key/);
    await expect(ownerGateways.saveGateway(vy, VY, 'stripe', { credentials: { secretKey: 'pk_live_abc', webhookSecret: 'whsec_x' } })).rejects.toThrow(/sk_live_/);
    await expect(ownerGateways.saveGateway(vy, VY, 'stripe', { credentials: { secretKey: 'sk_live_abc', webhookSecret: 'abc' } })).rejects.toThrow(/whsec_/);
    expect((await ownerPayout.payoutSetup(vy, VY)).gateways.every((g) => !g.configured)).toBe(true);
  });

  it('bộ khóa thử chỉ lưu được ở máy dev và test', async () => {
    const staging = { ...vy, env: { ...vy.env, APP_ENV: 'staging' as const } };
    await expect(ownerGateways.saveGateway(staging, VY, 'momo', { credentials: MOMO })).rejects.toThrow(/khóa thử/);
  });

  it('lưu MoMo là mở thanh toán; khóa bí mật không bao giờ trả ra lại, chỉ 4 ký tự cuối', async () => {
    const saved = await ownerGateways.saveGateway(vy, VY, 'momo', { mode: 'sandbox', credentials: MOMO });
    expect(saved).toMatchObject({ provider: 'momo', configured: true, enabled: true, mode: 'sandbox', summary: { partnerCode: 'MOMOVY01', accessKey: '••••cess', secretKey: '••••3456' } });
    expect(saved.webhookUrl).toMatch(/\/webhooks\/hoi\/[a-f0-9]{40}$/);
    expect(JSON.stringify(saved)).not.toContain(MOMO.secretKey);
    const setup = await ownerPayout.payoutSetup(vy, VY);
    expect(setup).toMatchObject({ ready: true, methods: ['momo'], defaultMethod: 'momo', account: null });
    expect(JSON.stringify(setup)).not.toContain(MOMO.secretKey);
    const row = await app.ctx.db.query.communityPaymentGateways.findFirst({ where: and(eq(communityPaymentGateways.communityId, VY), eq(communityPaymentGateways.provider, 'momo')) });
    expect(row?.credentialsEncrypted).not.toContain(MOMO.secretKey);
    const sh = await shell.communityShell(vy, 'ngoai-ngu-vy');
    expect(sh.community).toMatchObject({ paymentsReady: true, paymentMethods: ['momo'], defaultPaymentMethod: 'momo' });
  });

  it('lưu lại để trống ô bí mật thì giữ khóa cũ', async () => {
    const saved = await ownerGateways.saveGateway(vy, VY, 'momo', { credentials: { partnerCode: 'MOMOVY01', accessKey: '', secretKey: '' } });
    expect(saved.summary).toMatchObject({ secretKey: '••••3456' });
  });
});

describe('người mua trả qua MoMo của chủ hội', () => {
  let ref = '', orderId = '', amount = 0, token = '';
  it('không chọn cách nào thì dùng cách mặc định; cổng chưa cài thì không chọn được', async () => {
    const buyer = await app.as('member1');
    await expect(premium(buyer, 'sepay')).rejects.toThrow(/chưa nhận thanh toán qua Chuyển khoản QR/);
    await expect(premium(buyer, 'vnpay')).rejects.toThrow(/chưa nhận thanh toán qua VNPAY. Bạn chọn cách khác nhé: MoMo/);
    const s = await premium(buyer);
    expect(s.provider).toBe('momo');
    token = tokenOf((await ownerPayout.payoutSetup(vy, VY)).gateways.find((g) => g.provider === 'momo')!.webhookUrl);
    expect(s.instruction).toMatchObject({ kind: 'redirect', payee: 'owner', url: expect.stringContaining(`/pay/simulator/hoi/${token}?provider=momo`) });
    ref = s.reference.replace(' ', '');
    orderId = s.orderId;
    amount = s.amountMinor;
  });

  it('cổng của Hội Mình và cổng của hội khác không xác nhận hộ được đơn này', async () => {
    // IPN ký đúng bằng khóa MoMo của Hội Mình, mang mã đơn của hội Vy.
    const env = app.ctx.env;
    const p = { partnerCode: env.MOMO_PARTNER_CODE, orderId: ref, requestId: ref, amount, orderInfo: 'x', orderType: 'momo_wallet', transId: 9_000_001, resultCode: 0, message: 'Successful.', payType: 'qr', responseTime: Date.now(), extraData: '', signature: '' };
    p.signature = await hmacHex(env.MOMO_SECRET_KEY, MomoAdapter.ipnSignatureString(env.MOMO_ACCESS_KEY, p));
    expect((await paymentsSvc.handleWebhook(app.system(), 'momo', { headers: {}, rawBody: JSON.stringify(p), query: {} })).result).toBe('unmatched');
    // Cổng MoMo của hội khác (Minh Quý) báo có cho mã đơn của hội Vy.
    const kd = await ownerGateways.saveGateway(await app.as('minhquy'), KD, 'momo', { credentials: { partnerCode: 'MOMOKD01', accessKey: 'momo-sandbox-kd', secretKey: 'momo-sandbox-kd-secret' } });
    expect((await ownerGateways.simulateOwnerGateway(app.system(), tokenOf(kd.webhookUrl), { orderRef: ref, amount, requestId: ref, success: true })).result).toBe('unmatched');
    // Chữ ký sai (khóa khác) thì từ chối, không ghi nhận gì.
    const forged = { ...p, partnerCode: MOMO.partnerCode, signature: 'abc' };
    expect((await ownerGateways.handleOwnerGatewayWebhook(app.system(), token, { headers: {}, rawBody: JSON.stringify(forged), query: {} })).result).toBe('invalid_signature');
    expect((await ownerGateways.handleOwnerGatewayWebhook(app.system(), 'f'.repeat(40), { headers: {}, rawBody: '{}', query: {} })).result).toBe('not_found');
    expect((await orderOf(orderId))?.status).toBe('pending');
  });

  it('cổng của chủ hội báo đã trả thì đơn tự chuyển sang đã trả, người mua được mở quyền; gửi lại không xử lý hai lần', async () => {
    expect((await ownerGateways.simulateOwnerGateway(app.system(), token, { orderRef: ref, amount: amount - 1, requestId: ref, success: true })).result).toBe('unmatched');
    // IPN ký bằng khóa MoMo của chủ hội, đúng như MoMo gửi về địa chỉ riêng của cổng.
    const p = { partnerCode: MOMO.partnerCode, orderId: ref, requestId: ref, amount, orderInfo: 'x', orderType: 'momo_wallet', transId: 7_000_777, resultCode: 0, message: 'Successful.', payType: 'qr', responseTime: Date.now(), extraData: '', signature: '' };
    p.signature = await hmacHex(MOMO.secretKey, MomoAdapter.ipnSignatureString(MOMO.accessKey, p));
    const ipn = { headers: {}, rawBody: JSON.stringify(p), query: {} };
    const r = await ownerGateways.handleOwnerGatewayWebhook(app.system(), token, ipn);
    expect(r).toMatchObject({ result: 'processed', status: 204 });
    expect((await ownerGateways.handleOwnerGatewayWebhook(app.system(), token, ipn)).result).toBe('duplicate');
    expect((await orderOf(orderId))?.status).toBe('paid');
    expect(await entitlementSvc.memberTierKey(app.system(), await app.ids('user:member1'), VY)).toBe('premium');
    const gw = (await ownerPayout.payoutSetup(vy, VY)).gateways.find((g) => g.provider === 'momo')!;
    expect(gw.lastWebhookAt).toBeTruthy();
    // Đơn qua cổng không nằm ở danh sách "chờ bạn xác nhận" (chỉ đơn chuyển khoản mới cần chủ hội kiểm tra).
    expect((await ownerPayout.payoutSetup(vy, VY)).pending).toHaveLength(0);
  });
});

describe('chuyển khoản QR, cách mặc định, bật tắt', () => {
  it('thêm tài khoản ngân hàng: người mua thấy cả hai, chuyển khoản đứng đầu và được chọn sẵn', async () => {
    await ownerPayout.savePayoutAccount(vy, VY, { bankCode: 'TCB', accountNumber: '19039998887776', accountHolder: 'NGUYEN THAO VY', confirmMode: 'manual' });
    expect(await ownerPayout.payoutSetup(vy, VY)).toMatchObject({ methods: ['sepay', 'momo'], defaultMethod: 'sepay', account: { enabled: true } });
    expect((await premium(await app.as('member2'))).instruction).toMatchObject({ kind: 'bank_qr', payee: 'owner' });
  });

  it('đặt MoMo làm mặc định; không đặt được cổng chưa cài', async () => {
    await expect(ownerGateways.updatePaymentMethods(vy, VY, { defaultMethod: 'stripe' })).rejects.toThrow(/chưa cài hoặc đang tắt/);
    await expect(ownerGateways.updatePaymentMethods(await app.as('member1'), VY, { defaultMethod: 'momo' })).rejects.toThrow();
    expect(await ownerGateways.updatePaymentMethods(vy, VY, { defaultMethod: 'momo' })).toEqual({ methods: ['sepay', 'momo'], defaultMethod: 'momo' });
    expect((await premium(await app.as('member2'))).provider).toBe('momo');
  });

  it('tắt MoMo thì người mua không thấy nữa và cách mặc định lùi về chuyển khoản; tắt cả hai thì khóa nút mua', async () => {
    await ownerGateways.saveGateway(vy, VY, 'momo', { enabled: false });
    expect((await shell.communityShell(vy, 'ngoai-ngu-vy')).community).toMatchObject({ paymentMethods: ['sepay'], defaultPaymentMethod: 'sepay' });
    await expect(premium(await app.as('member2'), 'momo')).rejects.toThrow(/chưa nhận thanh toán qua MoMo/);
    await ownerGateways.updatePaymentMethods(vy, VY, { bankEnabled: false });
    const err = await premium(await app.as('member2')).then(() => null, (e: unknown) => e);
    expect((err as AppError).details).toMatchObject({ reason: 'payout_not_ready' });
    expect((await shell.communityShell(vy, 'ngoai-ngu-vy')).community.paymentsReady).toBe(false);
    // Bật lại: tài khoản và khóa đã nhập vẫn còn, MoMo vẫn là mặc định đã chọn.
    await ownerGateways.updatePaymentMethods(vy, VY, { bankEnabled: true });
    await ownerGateways.saveGateway(vy, VY, 'momo', { enabled: true });
    expect(await ownerPayout.payoutSetup(vy, VY)).toMatchObject({ methods: ['sepay', 'momo'], defaultMethod: 'momo' });
  });

  it('gỡ cổng thì xóa khóa đã lưu', async () => {
    await ownerGateways.removeGateway(await app.as('minhquy'), KD, 'momo');
    expect((await ownerPayout.payoutSetup(await app.as('minhquy'), KD)).gateways.find((g) => g.provider === 'momo')).toMatchObject({ configured: false, webhookUrl: null });
    await expect(ownerGateways.removeGateway(await app.as('minhquy'), KD, 'momo')).rejects.toThrow(/chưa cài/);
  });
});

describe('thẻ quốc tế qua Stripe của chủ hội', () => {
  it('lưu Stripe (khóa sk_test_ là chế độ thử), người mua trả bằng thẻ, Stripe báo về thì mở quyền; hoàn tiền đi qua cổng của chủ hội', async () => {
    const saved = await ownerGateways.saveGateway(vy, VY, 'stripe', { credentials: STRIPE });
    expect(saved).toMatchObject({ mode: 'sandbox', summary: { secretKey: '••••0001', webhookSecret: '••••cret' } });
    const buyer = await app.as('hoangvu');
    const s = await premium(buyer, 'stripe');
    expect(s.instruction).toMatchObject({ kind: 'redirect', payee: 'owner', url: expect.stringContaining('provider=stripe') });
    const ref = s.reference.replace(' ', '');
    const token = tokenOf(saved.webhookUrl);
    expect((await ownerGateways.simulateOwnerGateway(app.system(), token, { orderRef: ref, amount: s.amountMinor, requestId: ref, success: true })).result).toBe('processed');
    expect((await orderOf(s.orderId))?.status).toBe('paid');
    const pay = await app.ctx.db.query.payments.findFirst({ where: eq(payments.orderId, s.orderId) });
    expect(pay).toMatchObject({ provider: 'stripe', status: 'succeeded' });
    // Khóa thử không gọi được Stripe thật nên hoàn tiền là thủ công; quan trọng là không đi qua cổng của Hội Mình.
    const refund = await paymentsSvc.adminRefund(vy, s.orderId, 'thử');
    expect(refund).toMatchObject({ manual: true, alreadyRefunded: false });
    expect((await orderOf(s.orderId))?.status).toBe('refunded');
  });

  it('Stripe báo phiên hết hạn thì thanh toán chuyển sang thất bại, không mở quyền', async () => {
    const s = await premium(await app.as('kienbui'), 'stripe');
    const token = tokenOf((await ownerPayout.payoutSetup(vy, VY)).gateways.find((g) => g.provider === 'stripe')!.webhookUrl);
    expect((await ownerGateways.simulateOwnerGateway(app.system(), token, { orderRef: s.reference.replace(' ', ''), amount: s.amountMinor, requestId: '', success: false })).result).toBe('processed');
    expect(await app.ctx.db.query.payments.findFirst({ where: eq(payments.orderId, s.orderId) })).toMatchObject({ status: 'failed' });
  });
});

describe('PayPal hai bước: lưu khóa trước, thêm webhook sau', () => {
  it('lưu Client ID và Secret là có địa chỉ webhook, nhưng người mua chưa thấy PayPal cho tới khi có Webhook ID', async () => {
    const first = await ownerGateways.saveGateway(vy, VY, 'paypal', { mode: 'sandbox', credentials: { clientId: 'paypal-sandbox-vy', clientSecret: 'paypal-sandbox-secret' } });
    expect(first).toMatchObject({ configured: true, complete: false, missing: ['Webhook ID'], webhookUrl: expect.stringMatching(/\/webhooks\/hoi\/[a-f0-9]{40}$/) });
    expect((await ownerPayout.payoutSetup(vy, VY)).methods).not.toContain('paypal');
    await expect(ownerGateways.updatePaymentMethods(vy, VY, { defaultMethod: 'paypal' })).rejects.toThrow(/chưa cài hoặc đang tắt/);
    const done = await ownerGateways.saveGateway(vy, VY, 'paypal', { credentials: { webhookId: 'WH-VY-1' } });
    expect(done).toMatchObject({ complete: true, missing: [], summary: { clientId: 'paypal-sandbox-vy', clientSecret: '••••cret', webhookId: 'WH-VY-1' } });
    expect((await ownerPayout.payoutSetup(vy, VY)).methods).toContain('paypal');
  });

  it('người mua trả bằng USD qua PayPal của chủ hội; PayPal báo đã thu thì mở quyền', async () => {
    const s = await premium(await app.as('member2'), 'paypal');
    const settlement = (await app.ctx.db.query.payments.findFirst({ where: eq(payments.orderId, s.orderId) }))!.instruction as { settlement: { amountMinor: number; currency: string } };
    expect(settlement.settlement).toEqual({ amountMinor: Math.ceil((s.amountMinor * 100) / app.ctx.env.PAYPAL_USD_RATE), currency: 'USD' });
    const token = tokenOf((await ownerPayout.payoutSetup(vy, VY)).gateways.find((g) => g.provider === 'paypal')!.webhookUrl);
    const ref = s.reference.replace(' ', '');
    expect((await ownerGateways.simulateOwnerGateway(app.system(), token, { orderRef: ref, amount: settlement.settlement.amountMinor, requestId: ref, success: true })).result).toBe('processed');
    expect((await orderOf(s.orderId))?.status).toBe('paid');
  });
});

describe('đơn gói Hội Mình chỉ hiện cổng quản trị đã cài', () => {
  it('ở máy test: cổng chưa có khóa thật vẫn chạy qua trang mô phỏng; PayPal đang tắt, Stripe chưa có khóa thì không hiện', async () => {
    const { states } = await platformMethods.platformAvailability(app.system(), null);
    expect(states).toEqual({ sepay: 'ready', momo: 'ready', vnpay: 'ready', paypal: 'disabled', stripe: 'no_credentials' });
    const status = await platformBilling.communityPlanStatus(vy, VY);
    expect(status.payment).toEqual({ methods: ['sepay', 'momo', 'vnpay'], defaultMethod: 'sepay' });
    await expect(checkout.createCheckout(vy, { target: { type: 'platform', communityId: VY, planKey: 'pro', cycle: 'quarterly' }, provider: 'stripe' })).rejects.toThrow(/đang tạm tắt/);
  });

  it('ngoài máy dev, cổng còn dùng khóa mặc định thì không hiện', async () => {
    const staging = { ...app.system(), env: { ...app.ctx.env, APP_ENV: 'staging' as const } };
    expect((await platformMethods.platformPaymentMethods(staging, null)).methods).toEqual([]);
  });

  it('quản trị đặt cổng mặc định; chủ hội mua gói không chọn cách nào thì dùng cổng đó', async () => {
    const adm = await app.as('admin');
    await admin.updateProvider(adm, 'momo', { isDefault: true });
    await admin.updateProvider(adm, 'vnpay', { isDefault: true });
    const rows = await app.ctx.db.query.providerAccounts.findMany({ where: eq(providerAccounts.scopeType, 'platform') });
    expect(rows.filter((r) => (r.configuration as { isDefault?: boolean }).isDefault).map((r) => r.provider)).toEqual(['vnpay']);
    const list = await admin.listProviders(adm);
    expect(list.map((p) => [p.provider, p.isDefault, p.availability])).toEqual([['sepay', false, 'ready'], ['momo', false, 'ready'], ['vnpay', true, 'ready'], ['paypal', false, 'disabled'], ['stripe', false, 'no_credentials']]);
    const s = await checkout.createCheckout(vy, { target: { type: 'platform', communityId: VY, planKey: 'pro', cycle: 'quarterly' } });
    expect(s.provider).toBe('vnpay');
    // Cổng mặc định bị tắt thì chọn sẵn cổng đầu tiên còn bật.
    await admin.updateProvider(adm, 'vnpay', { enabled: false });
    expect((await platformMethods.platformPaymentMethods(app.system(), null)).defaultMethod).toBe('sepay');
  });
});
