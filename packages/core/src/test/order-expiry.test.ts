// Hết hạn đơn không phụ thuộc cron: trạng thái hiệu lực tính khi đọc, hành động của khách bị chặn ngay khi quá hạn,
// nhưng webhook thanh toán đến muộn vẫn được nhận (tiền đã vào thì phải cấp quyền). Bộ quét chỉ dọn cờ.
import { eq, sql } from 'drizzle-orm';
import { orders, payments } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSweep } from '../jobs/sweep';
import { withSystemScope } from '../lib/tenant-scope';
import * as checkout from '../services/checkout';
import { createTestApp, ownerBankPaid, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

type Buyer = 'dien' | 'cong' | 'thulan' | 'hongkim' | 'member1';
async function buy(user: Buyer) {
  return checkout.createCheckout(await app.as(user), { target: { type: 'product', productId: await app.ids('product:prompts') }, provider: 'sepay' });
}
const expireNow = (orderId: string) => app.ctx.db.execute(sql`update orders set expires_at = now() - interval '1 minute' where id = ${orderId}`);
const orderRow = (id: string) => app.ctx.db.query.orders.findFirst({ where: eq(orders.id, id) });
const paymentRow = (orderId: string) => app.ctx.db.query.payments.findFirst({ where: eq(payments.orderId, orderId) });
const sweep = () => withSystemScope(app.system(), (c) => runSweep(c));
/** Đơn của hội trả thẳng vào tài khoản chủ hội: ngân hàng của chủ hội báo có về địa chỉ riêng của hội. */
const sepayPaid = (reference: string, amount: number) => ownerBankPaid(app, reference, amount);

describe('effectiveOrderStatus', () => {
  // Mốc giờ đủ xa nên không bị lệch dù beforeAll dựng DB mất vài giây.
  const past = new Date(Date.now() - 3_600_000);
  const future = new Date(Date.now() + 3_600_000);
  const now = new Date();
  it('pending mà quá hạn thì là expired', () => expect(checkout.effectiveOrderStatus({ status: 'pending', expiresAt: past }, now)).toBe('expired'));
  it('pending còn hạn hoặc không có hạn thì giữ pending', () => {
    expect(checkout.effectiveOrderStatus({ status: 'pending', expiresAt: future }, now)).toBe('pending');
    expect(checkout.effectiveOrderStatus({ status: 'pending', expiresAt: null }, now)).toBe('pending');
  });
  it('trạng thái khác pending không bị đổi dù quá hạn', () => {
    for (const status of ['paid', 'refunded', 'cancelled', 'expired'] as const) expect(checkout.effectiveOrderStatus({ status, expiresAt: past }, now)).toBe(status);
  });
});

describe('đọc và thao tác trên đơn quá hạn khi cron chưa chạy', () => {
  it('orderStatus trả expired ngay, dù cột status trong DB vẫn là pending', async () => {
    const s = await buy('dien');
    await expireNow(s.orderId);
    expect((await orderRow(s.orderId))?.status).toBe('pending');
    const o = await checkout.orderStatus(await app.as('dien'), s.orderId);
    expect(o.status).toBe('expired');
    expect(o.paymentStatus).toBe('expired');
  });

  it('đơn còn hạn vẫn pending', async () => {
    const s = await buy('cong');
    const o = await checkout.orderStatus(await app.as('cong'), s.orderId);
    expect(o.status).toBe('pending');
    expect(o.paymentStatus).toBe('pending');
  });

  it('markProcessing trên đơn quá hạn: trả expired và không đánh dấu payment đang xử lý', async () => {
    const s = await buy('thulan');
    await expireNow(s.orderId);
    const o = await checkout.markProcessing(await app.as('thulan'), s.orderId);
    expect(o.status).toBe('expired');
    expect((await paymentRow(s.orderId))?.status).toBe('pending');
  });

  it('markProcessing trên đơn còn hạn vẫn ghi nhận đang xử lý', async () => {
    const s = await buy('hongkim');
    const o = await checkout.markProcessing(await app.as('hongkim'), s.orderId);
    expect(o.status).toBe('pending');
    expect(o.paymentStatus).toBe('processing');
  });
});

describe('thanh toán đến sau hạn vẫn được nhận', () => {
  it('webhook đến muộn (kể cả sau khi bộ quét đã đánh dấu expired) vẫn chuyển đơn sang paid', async () => {
    const s = await buy('member1');
    await expireNow(s.orderId);
    await sweep();
    expect((await orderRow(s.orderId))?.status).toBe('expired');
    expect((await paymentRow(s.orderId))?.status).toBe('expired');
    const r = await sepayPaid(s.reference, s.amountMinor);
    expect(r.result).toBe('processed');
    expect((await orderRow(s.orderId))?.status).toBe('paid');
    expect((await checkout.orderStatus(await app.as('member1'), s.orderId)).status).toBe('paid');
  });

  it('đơn đã paid thì orderStatus giữ paid dù expiresAt đã qua', async () => {
    const s = await buy('dien');
    await sepayPaid(s.reference, s.amountMinor);
    await expireNow(s.orderId);
    expect((await checkout.orderStatus(await app.as('dien'), s.orderId)).status).toBe('paid');
  });
});

describe('bộ quét hết hạn đơn', () => {
  it('đánh dấu expired cho đơn pending quá hạn, không đụng đơn còn hạn hay đã paid; chạy hai lần vẫn an toàn', async () => {
    const late = await buy('cong');
    const fresh = await buy('thulan');
    const paid = await buy('hongkim');
    await sepayPaid(paid.reference, paid.amountMinor);
    await expireNow(late.orderId);
    await expireNow(paid.orderId);
    const first = await sweep();
    expect(first.ordersExpired).toBeGreaterThanOrEqual(1);
    expect((await orderRow(late.orderId))?.status).toBe('expired');
    expect((await paymentRow(late.orderId))?.status).toBe('expired');
    expect((await orderRow(fresh.orderId))?.status).toBe('pending');
    expect((await orderRow(paid.orderId))?.status).toBe('paid');
    const second = await sweep();
    expect(second.ordersExpired).toBe(0);
    expect((await orderRow(late.orderId))?.status).toBe('expired');
  });
});
