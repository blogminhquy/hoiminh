// Kỳ hạn và khuyến mãi của gói thành viên (chủ dự án yêu cầu 12/11/2026).
// Chủ hội bán gói theo 1 tháng hoặc số tháng khác nhau và đặt được một đợt giảm giá. Kiểm tra: hàm tính dùng chung,
// lưu và đọc cài đặt, tiền thu đúng kỳ hạn và đúng khuyến mãi (tính ở máy chủ), số tháng được cấp sau khi thanh toán.
import { applyPromo, cheapestPerMonth, cycleOfMonths, legacyPricesOf, monthsOfCycle, normalizeTerms, perMonth, promoActive, termSavingPercent, termsFromLegacy, tierTerms } from '@hoiminh/contracts';
import { communityTiers, offers, orders, prices, subscriptions } from '@hoiminh/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { periodEnd, periodEndMonths } from '../lib/money';
import * as checkout from '../services/checkout';
import * as communitiesSvc from '../services/communities';
import * as ownerPayout from '../services/owner-payout';
import * as shell from '../services/shell';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let vy: Ctx; // chủ hội "Ngoại ngữ cùng Vy"
let VY = '';
const ACCOUNT = { bankCode: 'TCB' as const, accountNumber: '19039998887776', accountHolder: 'NGUYEN THAO VY', confirmMode: 'manual' as const };
const TIERS = [
  { key: 'standard' as const, name: 'Tiêu chuẩn', description: '', benefits: [], isDefault: true, isActive: true },
  { key: 'premium' as const, name: 'Premium', description: '', benefits: ['Mở khóa toàn bộ khóa học'], isDefault: false, isActive: true },
];
const TERMS = [{ months: 6, amountMinor: 749_000 }, { months: 1, amountMinor: 149_000 }, { months: 3, amountMinor: 399_000 }];

beforeAll(async () => {
  app = await createTestApp();
  vy = { ...app.system(), actor: { type: 'user', userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' } };
  VY = await app.ids('community:vy');
  await ownerPayout.savePayoutAccount(vy, VY, ACCOUNT);
}, 180_000);
afterAll(async () => {
  await app.close();
});

const save = (premium: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  communitiesSvc.updatePricing(vy, VY, { pricingMode: 'freemium', doorsOpen: true, enabledProviders: ['sepay'], tiers: [TIERS[0]!, { ...TIERS[1]!, ...premium }], ...extra });
const buy = (ctx: Ctx, target: { cycle: 'monthly' | 'yearly' | 'one_time'; months?: number }) =>
  checkout.createCheckout(ctx, { target: { type: 'tier', communityId: VY, tierKey: 'premium', ...target }, provider: 'sepay' });
const orderOf = (id: string) => app.ctx.db.query.orders.findFirst({ where: eq(orders.id, id) });
const subOf = async (user: string) => app.ctx.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.communityId, VY), eq(subscriptions.userId, await app.ids(`user:${user}`))) });
const inFuture = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('hàm tính dùng chung', () => {
  it('kỳ hạn: sắp theo số tháng, bỏ dòng chưa có giá, mỗi số tháng một dòng', () => {
    expect(normalizeTerms([{ months: 12, amountMinor: 990_000 }, { months: 1, amountMinor: 99_000 }, { months: 3, amountMinor: 0 }, { months: 1, amountMinor: 119_000 }, { months: 40, amountMinor: 5 }]))
      .toEqual([{ months: 1, amountMinor: 119_000 }, { months: 12, amountMinor: 990_000 }]);
    expect(normalizeTerms(null)).toEqual([]);
  });

  it('gói cũ chỉ có giá tháng và giá năm vẫn đọc ra kỳ 1 tháng và 12 tháng', () => {
    expect(termsFromLegacy(149_000, 1_490_000)).toEqual([{ months: 1, amountMinor: 149_000 }, { months: 12, amountMinor: 1_490_000 }]);
    expect(termsFromLegacy(null, null)).toEqual([]);
    expect(tierTerms({ terms: [], monthlyMinor: 99_000, yearlyMinor: null })).toEqual([{ months: 1, amountMinor: 99_000 }]);
    expect(tierTerms({ terms: [{ months: 3, amountMinor: 250_000 }], monthlyMinor: 99_000, yearlyMinor: null })).toEqual([{ months: 3, amountMinor: 250_000 }]);
    expect(legacyPricesOf([{ months: 3, amountMinor: 250_000 }, { months: 12, amountMinor: 900_000 }])).toEqual({ monthlyMinor: null, yearlyMinor: 900_000 });
  });

  it('tiết kiệm tính so với kỳ ngắn nhất, theo giá mỗi tháng', () => {
    const terms = normalizeTerms(TERMS);
    expect(perMonth(terms[2]!)).toBe(124_833);
    expect(termSavingPercent(terms, 1)).toBe(0);
    expect(termSavingPercent(terms, 3)).toBe(11); // 399.000 so với 3 x 149.000 = 447.000
    expect(termSavingPercent(terms, 6)).toBe(16); // 749.000 so với 894.000
    expect(termSavingPercent([{ months: 1, amountMinor: 100_000 }, { months: 3, amountMinor: 320_000 }], 3)).toBe(0); // đắt hơn thì không ghi tiết kiệm
    expect(cheapestPerMonth(terms)).toEqual({ months: 6, amountMinor: 749_000 });
  });

  it('khuyến mãi: còn hạn thì trừ, hết hạn thì giá gốc, tiền giảm làm tròn xuống', () => {
    const now = new Date('2026-11-12T00:00:00Z');
    expect(promoActive({ percentOff: 20, endsAt: null }, now)).toBe(true);
    expect(promoActive({ percentOff: 20, endsAt: '2026-11-13T00:00:00.000Z' }, now)).toBe(true);
    expect(promoActive({ percentOff: 20, endsAt: '2026-11-11T00:00:00.000Z' }, now)).toBe(false);
    expect(promoActive({ percentOff: 0, endsAt: null }, now)).toBe(false);
    expect(promoActive(null, now)).toBe(false);
    expect(applyPromo(399_000, { percentOff: 20, endsAt: null }, now)).toEqual({ payMinor: 319_200, discountMinor: 79_800, percentOff: 20 });
    expect(applyPromo(149_999, { percentOff: 33, endsAt: null }, now)).toEqual({ payMinor: 100_500, discountMinor: 49_499, percentOff: 33 });
    expect(applyPromo(399_000, { percentOff: 20, endsAt: '2026-11-11T00:00:00.000Z' }, now)).toEqual({ payMinor: 399_000, discountMinor: 0, percentOff: 0 });
  });

  it('số tháng và mã chu kỳ đổi qua lại đúng; kỳ 1 tháng và 12 tháng cho đúng ngày hết hạn như trước', () => {
    expect([cycleOfMonths(1), cycleOfMonths(3), cycleOfMonths(12)]).toEqual(['monthly', 'monthly', 'yearly']);
    expect([monthsOfCycle('monthly'), monthsOfCycle('yearly'), monthsOfCycle('monthly', 6), monthsOfCycle('yearly', null)]).toEqual([1, 12, 6, 12]);
    const start = new Date('2026-11-12T09:00:00Z');
    expect(periodEndMonths(start, 1)).toEqual(periodEnd(start, 'monthly'));
    expect(periodEndMonths(start, 12)).toEqual(periodEnd(start, 'yearly'));
    expect(periodEndMonths(start, 3).toISOString()).toBe('2027-02-12T09:00:00.000Z');
  });
});

describe('chủ hội cài kỳ hạn và khuyến mãi', () => {
  it('hội tạo từ trước (chỉ có giá tháng) vẫn hiện đúng một kỳ 1 tháng', async () => {
    const before = await communitiesSvc.pricingSettings(vy, VY);
    const premium = before.tiers.find((t) => t.key === 'premium')!;
    expect(premium.terms).toEqual(termsFromLegacy(premium.monthlyMinor, premium.yearlyMinor));
    expect(premium.terms[0]).toEqual({ months: 1, amountMinor: 149_000 });
    expect(before).toMatchObject({ promo: null, promoActive: false });
  });

  it('lưu ba kỳ hạn và một đợt giảm 20%: đọc lại đúng thứ tự, giá tháng và giá năm tự theo', async () => {
    const saved = await save({ terms: TERMS }, { promo: { percentOff: 20, endsAt: inFuture(7) } });
    const premium = saved.tiers.find((t) => t.key === 'premium')!;
    expect(premium.terms).toEqual([{ months: 1, amountMinor: 149_000 }, { months: 3, amountMinor: 399_000 }, { months: 6, amountMinor: 749_000 }]);
    expect(premium).toMatchObject({ monthlyMinor: 149_000, yearlyMinor: null });
    expect(saved).toMatchObject({ promo: { percentOff: 20 }, promoActive: true });
    // Mỗi kỳ hạn một offer có giá đang bật.
    const rows = await app.ctx.db.select({ cycle: offers.cycle, amount: prices.amountMinor }).from(offers).innerJoin(prices, and(eq(prices.offerId, offers.id), eq(prices.isActive, true))).where(and(eq(offers.resourceType, 'tier'), eq(offers.resourceId, premium.id)));
    expect(rows.map((r) => `${r.cycle}:${r.amount}`).sort()).toEqual(['m3:399000', 'm6:749000', 'monthly:149000']);
  });

  it('người xem và trang giới thiệu nhận đủ kỳ hạn và khuyến mãi đang chạy', async () => {
    const s = await shell.communityShell(await app.as('member1'), 'ngoai-ngu-vy');
    expect(s.premium?.terms.map((t) => t.months)).toEqual([1, 3, 6]);
    expect(s.premium?.promo).toMatchObject({ percentOff: 20 });
    const about = await communitiesSvc.aboutPage(app.anon(), 'ngoai-ngu-vy');
    expect(about.pricing.premiumTerms).toHaveLength(3);
    expect(about.pricing.promo).toMatchObject({ percentOff: 20 });
  });

  it('không gửi trường khuyến mãi thì giữ nguyên; gửi null thì tắt', async () => {
    expect(await save({ terms: TERMS })).toMatchObject({ promo: { percentOff: 20 }, promoActive: true });
    expect(await save({ terms: TERMS }, { promo: null })).toMatchObject({ promo: null, promoActive: false });
    await save({ terms: TERMS }, { promo: { percentOff: 20, endsAt: inFuture(7) } });
  });

  it('chỉ người có quyền tiền của hội mới đổi được giá', async () => {
    await expect(communitiesSvc.updatePricing(await app.as('member1'), VY, { pricingMode: 'freemium', doorsOpen: true, enabledProviders: ['sepay'], tiers: TIERS })).rejects.toThrow();
  });
});

describe('người mua chọn kỳ hạn', () => {
  it('mua 3 tháng khi đang giảm 20%: thu 319.200đ, đơn ghi số tháng và giá gốc', async () => {
    const buyer = await app.as('member1');
    const s = await buy(buyer, { cycle: 'monthly', months: 3 });
    expect(s.amountMinor).toBe(319_200);
    const order = await orderOf(s.orderId);
    expect(order?.metadata).toMatchObject({ cycle: 'monthly', months: 3, listMinor: 399_000, promoPercentOff: 20, title: 'Premium · 3 tháng' });
    expect(order?.subtotalMinor).toBe(319_200);
  });

  it('chủ hội bấm đã nhận tiền: người mua được đúng 3 tháng', async () => {
    const buyer = await app.as('member1');
    const s = await buy(buyer, { cycle: 'monthly', months: 3 });
    await ownerPayout.confirmOwnerOrder(vy, VY, s.orderId);
    const sub = await subOf('member1');
    expect(sub).toMatchObject({ status: 'active', billingCycle: 'monthly', periodMonths: 3, amountMinor: 319_200 });
    expect(sub!.currentPeriodEnd).toEqual(periodEndMonths(sub!.currentPeriodStart, 3));
  });

  it('gia hạn thêm 6 tháng thì nối tiếp vào ngày hết hạn đang có', async () => {
    const before = await subOf('member1');
    const s = await buy(await app.as('member1'), { cycle: 'monthly', months: 6 });
    expect(s.amountMinor).toBe(599_200); // 749.000 giảm 20%
    await ownerPayout.confirmOwnerOrder(vy, VY, s.orderId);
    const after = await subOf('member1');
    expect(after).toMatchObject({ periodMonths: 6, amountMinor: 599_200 });
    expect(after!.currentPeriodEnd).toEqual(periodEndMonths(before!.currentPeriodEnd, 6));
  });

  it('kỳ hạn hội không bán thì từ chối, kể cả kiểu gọi cũ theo năm', async () => {
    const buyer = await app.as('member2');
    await expect(buy(buyer, { cycle: 'monthly', months: 2 })).rejects.toThrow(/không bán kỳ 2 tháng/);
    await expect(buy(buyer, { cycle: 'yearly' })).rejects.toThrow(/không bán kỳ 12 tháng/);
    await expect(buy(buyer, { cycle: 'one_time' })).rejects.toThrow(/không bán trả một lần/);
  });

  it('kiểu gọi cũ chỉ có cycle monthly vẫn mua được kỳ 1 tháng', async () => {
    const s = await buy(await app.as('member2'), { cycle: 'monthly' });
    expect(s.amountMinor).toBe(119_200); // 149.000 giảm 20%
    expect((await orderOf(s.orderId))?.metadata).toMatchObject({ cycle: 'monthly', months: 1 });
  });

  it('khuyến mãi hết hạn thì thu giá gốc, đơn không ghi giảm', async () => {
    await save({ terms: TERMS }, { promo: { percentOff: 20, endsAt: new Date(Date.now() - 60_000).toISOString() } });
    expect(await communitiesSvc.pricingSettings(vy, VY)).toMatchObject({ promo: { percentOff: 20 }, promoActive: false });
    expect((await shell.communityShell(await app.as('member2'), 'ngoai-ngu-vy')).premium?.promo).toBeNull();
    const s = await buy(await app.as('member2'), { cycle: 'monthly', months: 3 });
    expect(s.amountMinor).toBe(399_000);
    const meta = (await orderOf(s.orderId))?.metadata as Record<string, unknown>;
    expect(meta.months).toBe(3);
    expect(meta.listMinor).toBeUndefined();
  });

  it('kỳ 12 tháng lưu mã chu kỳ yearly như trước', async () => {
    await save({ terms: [...TERMS, { months: 12, amountMinor: 1_290_000 }] }, { promo: null });
    const tier = await app.ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, VY), eq(communityTiers.key, 'premium')) });
    expect(tier).toMatchObject({ monthlyMinor: 149_000, yearlyMinor: 1_290_000 });
    const s = await buy(await app.as('member2'), { cycle: 'yearly' });
    expect(s.amountMinor).toBe(1_290_000);
    await ownerPayout.confirmOwnerOrder(vy, VY, s.orderId);
    expect(await subOf('member2')).toMatchObject({ billingCycle: 'yearly', periodMonths: 12 });
  });

  it('màn cài đặt cũ chỉ gửi giá tháng và giá năm vẫn lưu được, thành hai kỳ hạn', async () => {
    const saved = await save({ monthlyMinor: 199_000, yearlyMinor: 1_990_000 });
    expect(saved.tiers.find((t) => t.key === 'premium')!.terms).toEqual([{ months: 1, amountMinor: 199_000 }, { months: 12, amountMinor: 1_990_000 }]);
    // Hai kỳ 3 và 6 tháng đã bỏ: giá của chúng bị tắt, không còn bán.
    await expect(buy(await app.as('member2'), { cycle: 'monthly', months: 3 })).rejects.toThrow(/không bán kỳ 3 tháng/);
  });
});
