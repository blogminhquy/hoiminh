// Nhận tiền của chủ hội (kế hoạch 11/11/2026): tiền bán hàng của hội về thẳng tài khoản của chủ hội.
// Kiểm tra: hội chưa cài thì chưa bán được, cài xong thì mã QR dùng tài khoản của chủ hội, hai cách xác nhận đơn
// (chủ hội bấm "Đã nhận tiền", dịch vụ báo có gọi về), và không ai xác nhận hộ được đơn của hội khác.
import { notifications, orders, payments } from '@hoiminh/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { AppError } from '../errors';
import * as checkout from '../services/checkout';
import * as communitiesSvc from '../services/communities';
import * as entitlementSvc from '../services/entitlements';
import * as ownerPayout from '../services/owner-payout';
import * as revenue from '../services/revenue';
import * as shell from '../services/shell';
import { createTestApp, ownerBankPaid, type TestApp } from './setup';

let app: TestApp;
let vy: Ctx; // chủ hội "Ngoại ngữ cùng Vy": hội freemium, chưa cài nhận tiền
let VY = '', KD = '';
const ACCOUNT = { bankCode: 'TCB' as const, accountNumber: '19039998887776', accountHolder: 'nguyen thao vy', confirmMode: 'manual' as const };

beforeAll(async () => {
  app = await createTestApp();
  vy = { ...app.system(), actor: { type: 'user', userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' } };
  VY = await app.ids('community:vy');
  KD = await app.ids('community:kd');
}, 180_000);
afterAll(async () => {
  await app.close();
});

const premium = (ctx: Ctx, communityId: string) => checkout.createCheckout(ctx, { target: { type: 'tier', communityId, tierKey: 'premium', cycle: 'monthly' }, provider: 'sepay' });
const orderOf = (id: string) => app.ctx.db.query.orders.findFirst({ where: eq(orders.id, id) });

describe('hội chưa cài nhận tiền', () => {
  it('chưa bán được: tạo đơn báo lỗi rõ, giao diện nhận cờ paymentsReady = false', async () => {
    const buyer = await app.as('member1');
    const err = await premium(buyer, VY).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('payment_error');
    expect((err as AppError).details).toMatchObject({ reason: 'payout_not_ready' });
    expect((await shell.communityShell(vy, 'ngoai-ngu-vy')).community.paymentsReady).toBe(false);
    expect((await communitiesSvc.aboutPage(app.anon(), 'ngoai-ngu-vy')).pricing.paymentsReady).toBe(false);
    const setup = await ownerPayout.payoutSetup(vy, VY);
    expect(setup).toMatchObject({ ready: false, account: null, pending: [] });
    expect(setup.banks.length).toBeGreaterThanOrEqual(10);
  });

  it('chỉ người có quyền tiền của hội mới cài được', async () => {
    await expect(ownerPayout.savePayoutAccount(await app.as('member1'), VY, ACCOUNT)).rejects.toThrow();
    await expect(ownerPayout.payoutSetup(await app.as('minhquy'), VY)).rejects.toThrow();
  });
});

describe('chủ hội tự bấm "Đã nhận tiền"', () => {
  let orderId = '';
  it('lưu tài khoản là mở thanh toán; mã QR chuyển tới đúng tài khoản của chủ hội', async () => {
    const saved = await ownerPayout.savePayoutAccount(vy, VY, { ...ACCOUNT, accountHolder: 'NGUYEN THAO VY' });
    expect(saved).toMatchObject({ bankName: 'Techcombank', accountNumber: '19039998887776', accountHolder: 'NGUYEN THAO VY', confirmMode: 'manual' });
    expect(saved.webhookUrl).toMatch(/\/webhooks\/bank\/[a-f0-9]{40}$/);
    expect((await shell.communityShell(vy, 'ngoai-ngu-vy')).community.paymentsReady).toBe(true);
    // Trang giới thiệu công khai chỉ biết hội đã mở thanh toán, không lộ địa chỉ báo có.
    const about = await communitiesSvc.aboutPage(app.anon(), 'ngoai-ngu-vy');
    expect(about.pricing.paymentsReady).toBe(true);
    expect(JSON.stringify(about)).not.toContain('webhooks/bank');

    const buyer = await app.as('member1');
    const s = await premium(buyer, VY);
    orderId = s.orderId;
    expect(s.instruction).toMatchObject({ kind: 'bank_qr', payee: 'owner', confirmMode: 'manual', bankCode: 'TCB', bankName: 'Techcombank', accountNumber: '19039998887776', accountHolder: 'NGUYEN THAO VY', transferContent: s.reference });
    const qr = (s.instruction as { qrImageUrl: string }).qrImageUrl;
    expect(qr).toContain('img.vietqr.io/image/970407-19039998887776-');
    expect(qr).toContain(`amount=${s.amountMinor}`);
    expect(qr).toContain(encodeURIComponent(s.reference));
    // Cổng của Hội Mình không dùng cho đơn của hội.
    await expect(checkout.createCheckout(buyer, { target: { type: 'tier', communityId: VY, tierKey: 'premium', cycle: 'monthly' }, provider: 'vnpay' })).rejects.toThrow(/chuyển khoản ngân hàng/);
  });

  it('người mua bấm "Tôi đã chuyển khoản" thì chủ hội được báo, đơn lên đầu danh sách chờ', async () => {
    const buyer = await app.as('member1');
    await checkout.markProcessing(buyer, orderId);
    const note = await app.ctx.db.query.notifications.findFirst({ where: and(eq(notifications.userId, await app.ids('user:thaovy')), eq(notifications.kind, 'order.buyer_transferred')) });
    expect(note?.title).toMatch(/báo đã chuyển 149\.000đ · HM /);
    expect(note?.link).toBe('/ngoai-ngu-vy/tien');
    const setup = await ownerPayout.payoutSetup(vy, VY);
    expect(setup.pending).toHaveLength(1);
    expect(setup.pending[0]).toMatchObject({ orderId, amountMinor: 149_000, buyerSaysPaid: true });
    const money = await revenue.payoutSettings(vy, VY);
    expect(money).toMatchObject({ ready: true, pendingCount: 1, pendingMinor: 149_000 });
    expect(money).not.toHaveProperty('availableMinor');
    expect(money).not.toHaveProperty('holdingMinor');
  });

  it('chỉ chủ hội xác nhận được; xác nhận xong người mua được mở quyền ngay, bấm lại không cấp hai lần', async () => {
    await expect(ownerPayout.confirmOwnerOrder(await app.as('member1'), VY, orderId)).rejects.toThrow();
    await expect(ownerPayout.confirmOwnerOrder(await app.as('minhquy'), KD, orderId)).rejects.toThrow(/không tồn tại/);
    const r = await ownerPayout.confirmOwnerOrder(vy, VY, orderId);
    expect(r).toMatchObject({ confirmed: true, alreadyPaid: false });
    expect((await orderOf(orderId))?.status).toBe('paid');
    const pay = await app.ctx.db.query.payments.findFirst({ where: eq(payments.orderId, orderId) });
    expect(pay).toMatchObject({ status: 'succeeded', providerRawStatus: 'owner_confirmed' });
    const tier = await entitlementSvc.memberTierKey(app.system(), await app.ids('user:member1'), VY);
    expect(tier).toBe('premium');
    expect(await ownerPayout.confirmOwnerOrder(vy, VY, orderId)).toMatchObject({ confirmed: false, alreadyPaid: true });
    const setup = await ownerPayout.payoutSetup(vy, VY);
    expect(setup.pending).toHaveLength(0);
    expect(setup.received30Minor).toBe(149_000);
  });
});

describe('tự xác nhận bằng dịch vụ báo có của chủ hội', () => {
  it('địa chỉ báo có sai thì 404; đúng địa chỉ nhưng mã đơn của hội khác thì không khớp', async () => {
    const buyer = await app.as('member2');
    const s = await premium(buyer, VY);
    expect((await ownerBankPaid(app, s.reference, s.amountMinor, { token: 'f'.repeat(40) })).result).toBe('not_found');
    expect((await ownerBankPaid(app, s.reference, s.amountMinor, { token: 'khong-dung-dinh-dang' })).result).toBe('not_found');
    // Báo có của hội chính (Minh Quý) mang mã đơn của hội Vy: không xác nhận hộ được.
    expect((await ownerBankPaid(app, s.reference, s.amountMinor)).result).toBe('unmatched');
    expect((await orderOf(s.orderId))?.status).toBe('pending');
  });

  it('chủ hội chuyển sang tự xác nhận: báo có đúng mã và đủ tiền thì đơn tự chuyển sang đã trả, gửi lại không xử lý hai lần', async () => {
    const saved = await ownerPayout.savePayoutAccount(vy, VY, { ...ACCOUNT, accountHolder: 'NGUYEN THAO VY', confirmMode: 'auto' });
    const token = saved.webhookUrl.split('/').pop()!;
    const buyer = await app.as('hoangvu');
    const s = await premium(buyer, VY);
    expect(s.instruction).toMatchObject({ payee: 'owner', confirmMode: 'auto' });
    // Tự xác nhận thì không làm phiền chủ hội khi người mua bấm "Tôi đã chuyển khoản".
    await checkout.markProcessing(buyer, s.orderId);
    const notes = await app.ctx.db.query.notifications.findMany({ where: and(eq(notifications.userId, await app.ids('user:thaovy')), eq(notifications.kind, 'order.buyer_transferred')) });
    expect(notes).toHaveLength(1);
    expect((await ownerBankPaid(app, s.reference, s.amountMinor - 1, { token })).result).toBe('unmatched');
    expect((await ownerBankPaid(app, s.reference, s.amountMinor, { token, id: 777001 })).result).toBe('processed');
    expect((await ownerBankPaid(app, s.reference, s.amountMinor, { token, id: 777001 })).result).toBe('duplicate');
    expect((await orderOf(s.orderId))?.status).toBe('paid');
    expect((await ownerPayout.payoutSetup(vy, VY)).account?.lastWebhookAt).toBeTruthy();
  });

  it('đổi địa chỉ báo có thì địa chỉ cũ ngừng nhận ngay', async () => {
    const before = (await ownerPayout.payoutSetup(vy, VY)).account!.webhookUrl.split('/').pop()!;
    const after = (await ownerPayout.rotatePayoutWebhook(vy, VY)).webhookUrl.split('/').pop()!;
    expect(after).not.toBe(before);
    const s = await premium(await app.as('hongkim'), VY);
    expect((await ownerBankPaid(app, s.reference, s.amountMinor, { token: before })).result).toBe('not_found');
    expect((await ownerBankPaid(app, s.reference, s.amountMinor, { token: after })).result).toBe('processed');
  });
  it('chủ hội bấm "Gửi thử" bên SePay: Hội Mình nhận, trả 200 và ghi lần báo có, không đụng tới đơn nào', async () => {
    // Đổi địa chỉ để bắt đầu từ trạng thái chưa nhận lần báo có nào, như lúc chủ hội vừa bật tự xác nhận.
    const fresh = await ownerPayout.rotatePayoutWebhook(vy, VY);
    expect(fresh.lastWebhookAt).toBeNull();
    const token = fresh.webhookUrl.split('/').pop()!;
    const s = await premium(await app.as('member2'), VY);
    // Dữ liệu mẫu của SePay: mã giao dịch giả (0), mã thanh toán theo cấu hình của họ, không có mã đơn của Hội Mình.
    const sample = { id: 0, gateway: 'MBBank', transactionDate: '2026-11-12 10:00:00', accountNumber: '19039998887776', code: 'DH123456', content: 'Thanh toan don hang DH123456', transferType: 'in', transferAmount: 2000, accumulated: 0, subAccount: null, referenceCode: 'FT00000000', description: 'Thanh toan don hang DH123456' };
    const send = () => ownerPayout.handleOwnerBankWebhook(app.system(), token, { headers: {}, rawBody: JSON.stringify(sample), query: {} });
    expect(await send()).toMatchObject({ status: 200, result: 'ignored' });
    expect((await ownerPayout.payoutSetup(vy, VY)).account?.lastWebhookAt).toBeTruthy();
    // Bấm "Gửi thử" lần nữa (cùng mã giả) vẫn được trả 200 để SePay báo thành công.
    expect(await send()).toMatchObject({ status: 200, result: 'duplicate' });
    expect((await orderOf(s.orderId))?.status).toBe('pending');
  });
});
