// Màn chờ xác nhận và email cho chủ hội: đơn trả thẳng chủ hội thì `orderStatus` cho người mua biết chủ hội là ai
// (chỉ thông tin công khai), người mua bấm "Tôi đã chuyển khoản" thì chủ hội nhận đúng một email để vào xác nhận,
// và đơn được thanh toán xong (chủ hội bấm xác nhận hoặc ngân hàng báo về) thì chủ hội nhận đúng một email báo đơn mới.
import { notifications, users } from '@hoiminh/db';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import * as checkout from '../services/checkout';
import * as ownerPayout from '../services/owner-payout';
import { createTestApp, ownerBankPaid, type TestApp } from './setup';

let app: TestApp;
let vy: Ctx; // chủ hội "Ngoại ngữ cùng Vy"
let VY = '', VY_USER = '';
const OWNER_EMAIL = 'vy.english@gmail.com';
const ACCOUNT = { bankCode: 'TCB' as const, accountNumber: '19039998887776', accountHolder: 'NGUYEN THAO VY', confirmMode: 'manual' as const };

beforeAll(async () => {
  app = await createTestApp();
  VY_USER = await app.ids('user:thaovy');
  vy = { ...app.system(), actor: { type: 'user', userId: VY_USER, isSuperAdmin: false, email: OWNER_EMAIL } };
  VY = await app.ids('community:vy');
  await ownerPayout.savePayoutAccount(vy, VY, ACCOUNT);
}, 180_000);
afterAll(async () => {
  await app.close();
});

const premium = (ctx: Ctx) => checkout.createCheckout(ctx, { target: { type: 'tier', communityId: VY, tierKey: 'premium', cycle: 'monthly' }, provider: 'sepay' });
const ownerEmails = (template: string, reference: string) => app.emails.filter((m) => m.to === OWNER_EMAIL && m.template === template && m.html.includes(reference));
const transferNotes = () => app.ctx.db.query.notifications.findMany({ where: and(eq(notifications.userId, VY_USER), eq(notifications.kind, 'order.buyer_transferred')) });
const nameOf = async (key: Parameters<TestApp['ids']>[0]) => (await app.ctx.db.query.users.findFirst({ where: eq(users.id, await app.ids(key)), columns: { name: true } }))!.name;

describe('đơn chủ hội tự xác nhận', () => {
  let orderId = '', reference = '';

  it('orderStatus trả hội và chủ hội của đơn, chỉ thông tin công khai', async () => {
    const buyer = await app.as('member1');
    const s = await premium(buyer);
    orderId = s.orderId;
    reference = s.reference;
    const o = await checkout.orderStatus(buyer, orderId);
    const owner = (await app.ctx.db.query.users.findFirst({ where: eq(users.id, VY_USER) }))!;
    expect(o.seller).toEqual({ communityId: VY, communityName: expect.any(String), communitySlug: 'ngoai-ngu-vy', owner: { id: VY_USER, name: owner.name, handle: owner.handle, avatarUrl: owner.avatarUrl, coverColor: owner.coverColor, acceptsMessages: true } });
    // Không lộ email hay thông tin riêng của chủ hội cho người mua.
    expect(JSON.stringify(o.seller)).not.toContain(OWNER_EMAIL);
    expect(Object.keys(o.seller!.owner).sort()).toEqual(['acceptsMessages', 'avatarUrl', 'coverColor', 'handle', 'id', 'name']);
  });

  it('chủ hội tắt nhận tin nhắn thì orderStatus báo đúng, để giao diện không mời nhắn tin', async () => {
    await app.ctx.db.execute(sql`update users set privacy = privacy || '{"allowMessages": false}'::jsonb where id = ${VY_USER}`);
    expect((await checkout.orderStatus(await app.as('member1'), orderId)).seller?.owner.acceptsMessages).toBe(false);
    await app.ctx.db.execute(sql`update users set privacy = privacy || '{"allowMessages": true}'::jsonb where id = ${VY_USER}`);
    expect((await checkout.orderStatus(await app.as('member1'), orderId)).seller?.owner.acceptsMessages).toBe(true);
  });

  it('bấm "Tôi đã chuyển khoản": chủ hội nhận đúng một email đủ thông tin để đối chiếu; bấm lần hai không gửi thêm', async () => {
    const buyer = await app.as('member1');
    expect(ownerEmails('owner_transfer_reported', reference)).toHaveLength(0);
    const o = await checkout.markProcessing(buyer, orderId);
    // Đơn vẫn chờ (trang của người mua tiếp tục tự hỏi lại), thanh toán chuyển sang đang xử lý.
    expect(o).toMatchObject({ status: 'pending', paymentStatus: 'processing' });
    const sent = ownerEmails('owner_transfer_reported', reference);
    expect(sent).toHaveLength(1);
    const m = sent[0]!;
    const buyerName = await nameOf('user:member1');
    expect(m.subject).toBe(`${buyerName} báo đã chuyển 149.000đ · ${reference}`);
    expect(m.html).toContain(`<strong>${buyerName}</strong> báo đã chuyển khoản`);
    expect(m.html).toContain('Số tiền: <strong>149.000đ</strong>');
    expect(m.html).toContain(`Nội dung chuyển khoản cần đối chiếu: <strong>${reference}</strong>`);
    expect(m.html).toMatch(/href="[^"]*\/ngoai-ngu-vy\/tien"/);
    expect(m.text).toContain('Mở trang Tiền để xác nhận');
    await checkout.markProcessing(buyer, orderId);
    await checkout.markProcessing(buyer, orderId);
    expect(ownerEmails('owner_transfer_reported', reference)).toHaveLength(1);
    expect(await transferNotes()).toHaveLength(1);
  });

  it('đơn đã hết hạn giữ chỗ: bấm báo chuyển khoản không gửi email, không tạo thông báo', async () => {
    const buyer = await app.as('member2');
    const s = await premium(buyer);
    await app.ctx.db.execute(sql`update orders set expires_at = now() - interval '1 minute' where id = ${s.orderId}`);
    const o = await checkout.markProcessing(buyer, s.orderId);
    expect(o).toMatchObject({ status: 'expired', paymentStatus: 'expired' });
    expect(ownerEmails('owner_transfer_reported', s.reference)).toHaveLength(0);
    expect(await transferNotes()).toHaveLength(1);
  });

  it('chủ hội bấm "Đã nhận tiền": chủ hội nhận một email báo đơn đã thanh toán, bấm lại không gửi thêm', async () => {
    expect(ownerEmails('owner_order_paid', reference)).toHaveLength(0);
    expect(await ownerPayout.confirmOwnerOrder(vy, VY, orderId)).toMatchObject({ confirmed: true });
    const sent = ownerEmails('owner_order_paid', reference);
    expect(sent).toHaveLength(1);
    const buyerName = await nameOf('user:member1');
    expect(sent[0]!.subject).toBe(`Đơn mới đã thanh toán: ${buyerName} · 149.000đ`);
    expect(sent[0]!.html).toContain(`Mã đơn: <strong>${reference}</strong>`);
    expect(sent[0]!.html).toMatch(/href="[^"]*\/ngoai-ngu-vy\/tien"/);
    // Người mua vẫn nhận email của mình như trước.
    expect(app.emails.some((m) => m.template === 'payment_succeeded' && m.to === 'an.nguyen@example.com')).toBe(true);
    expect(await ownerPayout.confirmOwnerOrder(vy, VY, orderId)).toMatchObject({ confirmed: false, alreadyPaid: true });
    expect(ownerEmails('owner_order_paid', reference)).toHaveLength(1);
    expect((await checkout.orderStatus(await app.as('member1'), orderId)).status).toBe('paid');
  });
});

describe('đơn tự xác nhận khi ngân hàng của chủ hội báo về', () => {
  it('bấm báo chuyển khoản không làm phiền chủ hội; tiền về thì chủ hội nhận đúng một email báo đơn đã thanh toán', async () => {
    const saved = await ownerPayout.savePayoutAccount(vy, VY, { ...ACCOUNT, confirmMode: 'auto' });
    const token = saved.webhookUrl.split('/').pop()!;
    const buyer = await app.as('hoangvu');
    const s = await premium(buyer);
    expect(await checkout.markProcessing(buyer, s.orderId)).toMatchObject({ status: 'pending', paymentStatus: 'processing' });
    expect(ownerEmails('owner_transfer_reported', s.reference)).toHaveLength(0);
    expect((await ownerBankPaid(app, s.reference, s.amountMinor, { token, id: 881001 })).result).toBe('processed');
    expect((await ownerBankPaid(app, s.reference, s.amountMinor, { token, id: 881001 })).result).toBe('duplicate');
    expect(ownerEmails('owner_order_paid', s.reference)).toHaveLength(1);
    expect((await checkout.orderStatus(buyer, s.orderId)).status).toBe('paid');
  });
});

describe('đơn không có chủ hội để báo', () => {
  it('đơn mua gói Hội Mình: orderStatus không có bên bán là hội, chủ hội không nhận email báo đơn', async () => {
    const before = app.emails.filter((m) => m.template === 'owner_order_paid' || m.template === 'owner_transfer_reported').length;
    const s = await checkout.createCheckout(vy, { target: { type: 'platform', planKey: 'starter', cycle: 'quarterly', communityId: VY }, provider: 'sepay' });
    expect((await checkout.orderStatus(vy, s.orderId)).seller).toBeNull();
    await checkout.markProcessing(vy, s.orderId);
    expect(app.emails.filter((m) => m.template === 'owner_order_paid' || m.template === 'owner_transfer_reported')).toHaveLength(before);
  });
});
