// An toàn tiền: webhook đồng thời không cấp trùng, hoàn tiền không vượt số đã thu, PayPal so đúng USD,
// credential nhập ở trang quản trị được dùng thật, API key không hoàn được đơn gói nền tảng.
import { and, eq } from 'drizzle-orm';
import { invoices, orders, payments } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as admin from '../services/admin';
import * as checkout from '../services/checkout';
import * as featureFlags from '../services/feature-flags';
import * as paymentsSvc from '../services/payments';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

function sepayBody(reference: string, amount: number) {
  return { id: Math.floor(Math.random() * 1e9), gateway: 'Vietcombank', transactionDate: '2026-09-14 09:03:11', accountNumber: '0071000123456', code: null, content: `ck ${reference}`, transferType: 'in', transferAmount: amount, accumulated: 0, subAccount: null, referenceCode: `MBVCB.${Math.random()}`, description: '' };
}
function sepayPaid(reference: string, amount: number, apiKey = app.ctx.env.SEPAY_API_KEY) {
  return paymentsSvc.handleWebhook(app.system(), 'sepay', { headers: { authorization: `Apikey ${apiKey}` }, rawBody: JSON.stringify(sepayBody(reference, amount)), query: {} });
}
function paypalEvent(reference: string, value: string, type = 'PAYMENT.CAPTURE.COMPLETED', currency = 'USD') {
  const body = { id: `WH-${Math.random()}`, event_type: type, create_time: new Date().toISOString(), resource: { id: `CAP-${Math.random()}`, custom_id: reference, amount: { value, currency_code: currency } } };
  return paymentsSvc.handleWebhook(app.system(), 'paypal', { headers: { 'x-hoiminh-simulator': 'paypal' }, rawBody: JSON.stringify(body), query: {} });
}

async function buyPrompts(user: 'dien' | 'cong' | 'thulan' | 'hongkim' | 'hoangvu', provider: 'sepay' | 'paypal' = 'sepay') {
  const ctx = await app.as(user);
  return checkout.createCheckout(ctx, { target: { type: 'product', productId: await app.ids('product:prompts') }, provider });
}

describe('Xác nhận thanh toán không bị trùng', () => {
  it('hai webhook đến cùng lúc cho một đơn chỉ cấp một hóa đơn', async () => {
    const s = await buyPrompts('dien');
    await Promise.all([sepayPaid(s.reference, s.amountMinor), sepayPaid(s.reference, s.amountMinor)]);
    const rows = await app.ctx.db.select().from(invoices).where(eq(invoices.orderId, s.orderId));
    expect(rows).toHaveLength(1);
    const order = await app.ctx.db.query.orders.findFirst({ where: eq(orders.id, s.orderId) });
    expect(order?.status).toBe('paid');
  });

  it('gọi xác nhận lần hai trả false, không phát sự kiện lần nữa', async () => {
    const s = await buyPrompts('cong');
    const pay = await app.ctx.db.query.payments.findFirst({ where: eq(payments.orderId, s.orderId) });
    const info = { providerPaymentId: 'x', rawStatus: 'test', paidAt: new Date() };
    const [a, b] = await Promise.all([paymentsSvc.confirmPayment(app.system(), pay!.id, info), paymentsSvc.confirmPayment(app.system(), pay!.id, info)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });
});

describe('Hoàn tiền', () => {
  it('hoàn nhiều lần một phần, không vượt số đã thu', async () => {
    const s = await buyPrompts('thulan');
    await sepayPaid(s.reference, s.amountMinor);
    const pay = (await app.ctx.db.query.payments.findFirst({ where: eq(payments.orderId, s.orderId) }))!;
    const sys = app.system();
    await paymentsSvc.applyRefund(sys, pay.id, 50_000, 'một phần', null);
    await paymentsSvc.applyRefund(sys, pay.id, 50_000, 'một phần nữa', null);
    let now = await app.ctx.db.query.payments.findFirst({ where: eq(payments.id, pay.id) });
    expect(now?.status).toBe('partially_refunded');
    expect(now?.refundedMinor).toBe(100_000);
    await expect(paymentsSvc.applyRefund(sys, pay.id, 150_000, 'quá tay', null)).rejects.toThrow(/Chỉ còn hoàn được/);
    // Hai yêu cầu cùng lúc cho đúng phần còn lại: chỉ một cái được.
    const rest = s.amountMinor - 100_000;
    const results = await Promise.allSettled([paymentsSvc.applyRefund(sys, pay.id, rest, 'a', null), paymentsSvc.applyRefund(sys, pay.id, rest, 'b', null)]);
    expect(results.filter((r) => r.status === 'fulfilled' && !r.value.alreadyRefunded)).toHaveLength(1);
    now = await app.ctx.db.query.payments.findFirst({ where: eq(payments.id, pay.id) });
    expect(now?.status).toBe('refunded');
    expect(now?.refundedMinor).toBe(s.amountMinor);
  });

  it('API key không hoàn được đơn gói nền tảng (không thuộc hội nào)', async () => {
    const sys = app.system();
    // Chủ hội Thảo Vy trả gói nền tảng năm qua chuyển khoản.
    const vyWs = await app.ids('workspace:thaovy');
    const vy = { ...sys, actor: { type: 'user' as const, userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' } };
    const s = await checkout.createCheckout(vy, { target: { type: 'platform', workspaceId: vyWs, cycle: 'yearly' }, provider: 'sepay' });
    await sepayPaid(s.reference, s.amountMinor);
    const order = await app.ctx.db.query.orders.findFirst({ where: and(eq(orders.id, s.orderId), eq(orders.status, 'paid')) });
    expect(order).toBeTruthy();
    const keyCtx = { ...sys, actor: { type: 'api_key' as const, apiKeyId: 'k', workspaceId: order!.workspaceId!, scopes: ['*'], userId: order!.customerUserId } };
    await expect(paymentsSvc.adminRefund(keyCtx, order!.id, 'thử')).rejects.toThrow();
    await expect(paymentsSvc.adminRefund(vy, order!.id, 'thử')).rejects.toThrow();
    const done = await paymentsSvc.adminRefund(await app.as('admin'), order!.id, 'super admin hoàn');
    expect(done.alreadyRefunded).toBe(false);
  });
});

describe('PayPal', () => {
  /** Chủ hội Thảo Vy mua gói nền tảng năm (không phụ thuộc cổng hội cho phép). */
  async function vyPlatform(provider: 'sepay' | 'paypal') {
    const vy = { ...app.system(), actor: { type: 'user' as const, userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' } };
    return checkout.createCheckout(vy, { target: { type: 'platform', workspaceId: await app.ids('workspace:thaovy'), cycle: 'yearly' }, provider });
  }

  it('so với số USD đã thu, không nhầm với tiền VND của đơn', async () => {
    const adminCtx = await app.as('admin');
    await featureFlags.setFlag(adminCtx, 'paypal', { enabled: true });
    await admin.updateProvider(adminCtx, 'paypal', { enabled: true });
    const s = await vyPlatform('paypal');
    const pay = (await app.ctx.db.query.payments.findFirst({ where: eq(payments.orderId, s.orderId) }))!;
    const settlement = paymentsSvc.settlementOf(pay);
    expect(settlement.currency).toBe('USD');
    expect(settlement.amountMinor).toBe(Math.ceil((s.amountMinor * 100) / app.ctx.env.PAYPAL_USD_RATE));
    const usd = (settlement.amountMinor / 100).toFixed(2);
    expect((await paypalEvent(s.reference, '1.00')).result).toBe('unmatched');
    expect((await paypalEvent(s.reference, usd, 'PAYMENT.CAPTURE.COMPLETED', 'EUR')).result).toBe('ignored');
    expect((await paypalEvent(s.reference, usd)).result).toBe('processed');
    const order = await app.ctx.db.query.orders.findFirst({ where: eq(orders.id, s.orderId) });
    expect(order?.status).toBe('paid');
  });

  it('webhook PayPal không xác nhận được đơn chuyển khoản VND dù số lớn', async () => {
    const s = await vyPlatform('sepay');
    expect((await paypalEvent(s.reference, '999999.00')).result).toBe('unmatched');
    const order = await app.ctx.db.query.orders.findFirst({ where: eq(orders.id, s.orderId) });
    expect(order?.status).toBe('pending');
  });
});

describe('Credential nhập ở trang quản trị', () => {
  it('được dùng để xác minh webhook, và sửa một ô không làm mất ô khác', async () => {
    const adminCtx = await app.as('admin');
    await admin.updateProvider(adminCtx, 'sepay', { credentials: { apiKey: 'khoa-that-tu-trang-quan-tri' } });
    const s = await buyPrompts('thulan');
    expect((await sepayPaid(s.reference, s.amountMinor)).result).toBe('invalid_signature');
    await admin.updateProvider(adminCtx, 'sepay', { credentials: { apiKey: '', bankAccount: '999888777' } });
    const s2 = await buyPrompts('thulan');
    expect((s2.instruction as { accountNumber?: string }).accountNumber).toBe('999888777');
    expect((await sepayPaid(s2.reference, s2.amountMinor, 'khoa-that-tu-trang-quan-tri')).result).toBe('processed');
  });
});
