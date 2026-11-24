// Đối tác chính thức của affiliate nền tảng (chủ dự án chốt ngày 24/11/2026):
//   1. Chỉ quản trị hệ thống quản lý đối tác. Thêm theo email; email chưa có tài khoản, trùng đối tác, % hay thời hạn sai thì báo rõ.
//   2. % riêng và thời hạn riêng hiện ở danh sách đối tác và ở chương trình nền tảng của chính đối tác.
//   3. Thời hạn riêng được dùng thật khi ghi hoa hồng: trọn đời thì vẫn nhận sau 12 tháng, theo mức chung thì không.
//   4. Kết thúc hợp tác: % và thời hạn về mức chung, dòng đối tác giữ lại; thêm lại thì mở lại hợp tác.
import { and, eq } from 'drizzle-orm';
import { affiliateAccounts, affiliateAttributions, affiliateCommissions, affiliateConversions, platformPartners } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { register } from '../auth/service';
import type { Ctx } from '../context';
import { AppError } from '../errors';
import * as affiliate from '../services/affiliate';
import * as checkout from '../services/checkout';
import * as communitiesSvc from '../services/communities';
import * as partners from '../services/partners';
import * as paymentsSvc from '../services/payments';
import { effectiveDurationMonths } from '../services/partner-terms';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let admin: Ctx;
const HV_EMAIL = 'hoangvu@gmail.com';

beforeAll(async () => {
  app = await createTestApp();
  admin = await app.as('admin');
}, 180_000);
afterAll(async () => {
  await app.close();
});

async function expectCode(p: Promise<unknown>, code: string): Promise<AppError> {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

const platformOf = async (ctx: Ctx) => (await affiliate.myPrograms(ctx)).find((p) => p.scope === 'platform')!;

describe('thời hạn thực tế (hàm thuần)', () => {
  it('theo mức chung, số tháng riêng, hoặc trọn đời', () => {
    expect(effectiveDurationMonths(12, null)).toBe(12);
    expect(effectiveDurationMonths(12, { durationMode: 'program', commissionDurationMonths: null })).toBe(12);
    expect(effectiveDurationMonths(12, { durationMode: 'months', commissionDurationMonths: 24 })).toBe(24);
    expect(effectiveDurationMonths(12, { durationMode: 'lifetime', commissionDurationMonths: null })).toBeNull();
  });
});

describe('quản lý đối tác', () => {
  it('chỉ quản trị hệ thống xem và thêm được', async () => {
    const hv = await app.as('hoangvu');
    await expect(partners.listPartners(hv)).rejects.toThrow();
    await expect(partners.addPartner(hv, { email: HV_EMAIL, commissionRateBps: 5000, durationMode: 'lifetime' })).rejects.toThrow();
  });

  it('báo rõ khi email chưa có tài khoản, % quá 90% hoặc thời hạn riêng thiếu số tháng', async () => {
    const e = await expectCode(partners.addPartner(admin, { email: 'chuaco@example.com', commissionRateBps: 5000, durationMode: 'program' }), 'validation_error');
    expect(e.message).toContain('chưa có tài khoản');
    await expectCode(partners.addPartner(admin, { email: HV_EMAIL, commissionRateBps: 9500, durationMode: 'program' }), 'validation_error');
    await expectCode(partners.addPartner(admin, { email: HV_EMAIL, commissionRateBps: 5000, durationMode: 'months', commissionDurationMonths: null }), 'validation_error');
  });

  it('thêm đối tác 50% trọn đời: danh sách và chương trình nền tảng của đối tác đều thấy điều khoản riêng', async () => {
    const row = await partners.addPartner(admin, { email: '  HoangVu@Gmail.com ', commissionRateBps: 5000, durationMode: 'lifetime', note: 'Coach kinh doanh online, 2.000 học viên' });
    expect(row.status).toBe('active');
    const list = await partners.listPartners(admin);
    const p = list.items.find((x) => x.id === row.id)!;
    expect(p).toMatchObject({ status: 'active', commissionRateBps: 5000, effectiveRateBps: 5000, durationMode: 'lifetime', effectiveDurationMonths: null, note: 'Coach kinh doanh online, 2.000 học viên' });
    expect(p.user.email).toBe(HV_EMAIL);
    expect(await platformOf(await app.as('hoangvu'))).toMatchObject({ rateBps: 5000, durationMonths: null, isPartner: true });
    // Thêm lần nữa khi đang hợp tác thì báo trùng.
    await expectCode(partners.addPartner(admin, { email: HV_EMAIL, commissionRateBps: 4000, durationMode: 'program' }), 'validation_error');
  });

  it('sửa điều khoản: 45% trong 24 tháng', async () => {
    const { items } = await partners.listPartners(admin);
    const id = items.find((x) => x.user.email === HV_EMAIL)!.id;
    await partners.updatePartner(admin, id, { commissionRateBps: 4500, durationMode: 'months', commissionDurationMonths: 24, note: '' });
    const p = (await partners.listPartners(admin)).items.find((x) => x.id === id)!;
    expect(p).toMatchObject({ commissionRateBps: 4500, durationMode: 'months', commissionDurationMonths: 24, effectiveDurationMonths: 24, note: null });
    expect(await platformOf(await app.as('hoangvu'))).toMatchObject({ rateBps: 4500, durationMonths: 24, isPartner: true });
  });

  it('kết thúc hợp tác: về mức chung, dòng đối tác vẫn còn; thêm lại thì mở lại đúng dòng đó', async () => {
    const { items, program } = await partners.listPartners(admin);
    const id = items.find((x) => x.user.email === HV_EMAIL)!.id;
    await partners.endPartner(admin, id);
    await expectCode(partners.updatePartner(admin, id, { commissionRateBps: 5000, durationMode: 'program' }), 'not_found');
    const ended = (await partners.listPartners(admin)).items.find((x) => x.id === id)!;
    expect(ended).toMatchObject({ status: 'ended', commissionRateBps: null, effectiveRateBps: program.commissionRateBps });
    expect(ended.endedAt).not.toBeNull();
    expect(await platformOf(await app.as('hoangvu'))).toMatchObject({ rateBps: program.commissionRateBps, durationMonths: program.commissionDurationMonths, isPartner: false });
    const again = await partners.addPartner(admin, { email: HV_EMAIL, commissionRateBps: 5000, durationMode: 'program' });
    expect(again.id).toBe(id);
    expect(again.status).toBe('active');
  });
});

describe('thời hạn riêng khi ghi hoa hồng gói nền tảng', () => {
  async function sepayPaid(reference: string, amount: number) {
    const body = { id: Math.floor(Math.random() * 1e9), gateway: 'Vietcombank', transactionDate: '2026-11-11 09:03:11', accountNumber: '0071000123456', code: null, content: `NGUYEN VAN A ck ${reference}`, transferType: 'in', transferAmount: amount, accumulated: 0, subAccount: null, referenceCode: `FT${Math.floor(Math.random() * 1e9)}`, description: '' };
    return paymentsSvc.handleWebhook(app.system(), 'sepay', { headers: { authorization: `Apikey ${app.ctx.env.SEPAY_API_KEY}` }, rawBody: JSON.stringify(body), query: {} });
  }

  /**
   * Một chủ hội mới do đối tác giới thiệu, lần đầu trả tiền cách đây 14 tháng (quá mức chung 12 tháng), giờ mua gói
   * Khởi đầu cho hội của mình. Trả về số hoa hồng đối tác nhận từ lần mua này.
   */
  async function buyAfter14Months(slug: string, email: string): Promise<number> {
    const program = await affiliate.platformProgram(app.system());
    const hv = (await app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.programId, program.id), eq(affiliateAccounts.affiliateCode, (await partners.listPartners(admin)).items.find((x) => x.user.email === HV_EMAIL)!.code)) }))!;
    const s = await register(app.anon(), app.auth, { name: 'Học Viên Đối Tác', email, password: 'matkhau123', acceptTerms: true });
    const me: Ctx = { ...app.system(), actor: { type: 'user', userId: s.user.id, isSuperAdmin: false, email } };
    await app.ctx.db.delete(affiliateAttributions).where(and(eq(affiliateAttributions.userId, s.user.id), eq(affiliateAttributions.programId, program.id)));
    await app.ctx.db.insert(affiliateAttributions).values({ affiliateAccountId: hv.id, programId: program.id, userId: s.user.id, expiresAt: new Date(Date.now() + 30 * 86_400_000) });
    await app.ctx.db.insert(affiliateConversions).values({ affiliateAccountId: hv.id, programId: program.id, customerUserId: s.user.id, conversionType: 'platform_subscription', grossMinor: 297_000, convertedAt: new Date(Date.now() - 14 * 30.5 * 86_400_000) });
    const c = await communitiesSvc.createCommunity(me, { name: `Hội ${slug}`, slug, shortDescription: '', description: '', category: 'kinh-doanh', pricingMode: 'free', template: 'blank' });
    const order = await checkout.createCheckout(me, { target: { type: 'platform', communityId: c.id, planKey: 'starter', cycle: 'quarterly' }, provider: 'sepay' });
    expect((await sepayPaid(order.reference, order.amountMinor)).result).toBe('processed');
    const rows = await app.ctx.db.select({ amount: affiliateCommissions.amountMinor }).from(affiliateCommissions).innerJoin(affiliateConversions, eq(affiliateConversions.id, affiliateCommissions.conversionId)).where(and(eq(affiliateCommissions.affiliateAccountId, hv.id), eq(affiliateConversions.customerUserId, s.user.id)));
    return rows.reduce((sum, r) => sum + r.amount, 0);
  }

  it('đối tác trọn đời vẫn nhận hoa hồng sau 12 tháng; đối tác theo mức chung (12 tháng) thì không', async () => {
    const id = (await partners.listPartners(admin)).items.find((x) => x.user.email === HV_EMAIL && x.status === 'active')!.id;
    await partners.updatePartner(admin, id, { commissionRateBps: 5000, durationMode: 'lifetime' });
    expect(await buyAfter14Months('hoi-doi-tac-tron-doi', 'trondoi@example.com')).toBe(Math.round(297_000 * 0.5));
    await partners.updatePartner(admin, id, { commissionRateBps: 5000, durationMode: 'program' });
    expect(await buyAfter14Months('hoi-doi-tac-muc-chung', 'mucchung@example.com')).toBe(0);
    expect(await app.ctx.db.query.platformPartners.findFirst({ where: eq(platformPartners.id, id) })).toMatchObject({ status: 'active', durationMode: 'program' });
  });
});
