// Nguồn traffic của affiliate (chủ dự án yêu cầu ngày 27/11/2026):
//   1. Phân loại nguồn một lượt bấm từ referrer, tham số trên link, trình duyệt trong ứng dụng.
//   2. Lượt bấm lưu nguồn và mã chỗ đặt link của Hội Mình (`pl`), giữ nguyên tham số trên địa chỉ trang đích.
//   3. Đơn có hoa hồng nối về lượt bấm đã dẫn tới nó và chép nguồn của lượt bấm đó; đơn sau của cùng người mua giữ nguồn ban đầu.
import { classifyTrafficSource, placementOf, trafficSourceLabel } from '@hoiminh/contracts';
import { eq } from 'drizzle-orm';
import { affiliateClicks, affiliateConversions } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { register } from '../auth/service';
import type { Ctx } from '../context';
import * as affiliate from '../services/affiliate';
import * as checkout from '../services/checkout';
import { createTestApp, ownerBankPaid, type TestApp } from './setup';

const APP = 'https://hoiminh.vn';
const classify = (over: { referrer?: string; landingUrl?: string; userAgent?: string }) => classifyTrafficSource({ appUrl: APP, landingUrl: `${APP}/kd?ref=hk3m1`, ...over });

describe('phân loại nguồn traffic', () => {
  it('đọc tên miền của trang giới thiệu, kể cả tên miền con', () => {
    expect(classify({ referrer: 'https://m.facebook.com/groups/123' })).toBe('facebook');
    expect(classify({ referrer: 'https://l.messenger.com/' })).toBe('facebook');
    expect(classify({ referrer: 'https://chat.zalo.me/' })).toBe('zalo');
    expect(classify({ referrer: 'https://www.youtube.com/watch?v=x' })).toBe('youtube');
    expect(classify({ referrer: 'https://www.tiktok.com/@a' })).toBe('tiktok');
    expect(classify({ referrer: 'https://www.google.com.vn/' })).toBe('google');
    expect(classify({ referrer: 'https://mail.google.com/mail/u/0/' })).toBe('email');
    expect(classify({ referrer: 'https://blog.example.com/bai-viet' })).toBe('other');
  });

  it('đọc tham số nhận diện mà nền tảng tự gắn vào link khi không có referrer', () => {
    expect(classify({ landingUrl: `${APP}/kd?ref=hk3m1&fbclid=abc` })).toBe('facebook');
    expect(classify({ landingUrl: `${APP}/kd?ref=hk3m1&zarsrc=30&utm_source=zalo` })).toBe('zalo');
    expect(classify({ landingUrl: `${APP}/kd?ref=hk3m1&gclid=x` })).toBe('google');
    expect(classify({ landingUrl: `${APP}/kd?ref=hk3m1&utm_source=newsletter&utm_medium=email` })).toBe('email');
  });

  it('nhận ra trình duyệt trong ứng dụng Zalo, Facebook, TikTok', () => {
    expect(classify({ userAgent: 'Mozilla/5.0 (iPhone) Mobile Zalo/23.11' })).toBe('zalo');
    expect(classify({ userAgent: 'Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/440.0]' })).toBe('facebook');
    expect(classify({ userAgent: 'Mozilla/5.0 (Linux) musical_ly_2023' })).toBe('tiktok');
  });

  it('link đặt trên Hội Mình và link bấm từ chính trang Hội Mình là "Trong Hội Mình"', () => {
    expect(classify({ landingUrl: `${APP}/kd?ref=hk3m1&pl=trang-chu.hero`, referrer: 'https://www.facebook.com/' })).toBe('hoiminh');
    expect(classify({ referrer: `${APP}/kd/bang-tin` })).toBe('hoiminh');
  });

  it('không có gì để đọc là truy cập trực tiếp; mã chỗ đặt sai dạng bị bỏ', () => {
    expect(classify({})).toBe('direct');
    expect(placementOf(`${APP}/?ref=a&pl=Trang-Chu`)).toBe('trang-chu');
    expect(placementOf(`${APP}/?ref=a&pl=<script>`)).toBeNull();
    expect(placementOf('khong-phai-url')).toBeNull();
    expect(trafficSourceLabel(null)).toBe('Nguồn khác');
    expect(trafficSourceLabel('zalo')).toBe('Zalo');
  });
});

let app: TestApp;
const HK_CODE = 'hk3m1';

beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

const clickOf = (visitorId: string) => app.ctx.db.query.affiliateClicks.findFirst({ where: eq(affiliateClicks.visitorId, visitorId) });
const conversionOf = (orderId: string) => app.ctx.db.query.affiliateConversions.findFirst({ where: eq(affiliateConversions.orderId, orderId) });

describe('lượt bấm lưu nguồn', () => {
  it('link ?ref= lưu nguồn, mã chỗ đặt, và giữ nguyên tham số trên trang đích', async () => {
    const landing = `${app.ctx.env.APP_URL}/kd/cua-hang/x?ref=${HK_CODE}&utm_campaign=${'a'.repeat(600)}`;
    expect(await affiliate.recordLandingClick(app.anon(), HK_CODE, { visitorId: 'nguon-fb-1', referrer: 'https://m.facebook.com/', landingUrl: landing })).toBe(true);
    const row = await clickOf('nguon-fb-1');
    expect(row).toMatchObject({ source: 'facebook', placement: null });
    expect(row?.landingUrl).toBe(landing);

    expect(await affiliate.recordLandingClick(app.anon(), HK_CODE, { visitorId: 'nguon-hm-1', landingUrl: `${app.ctx.env.APP_URL}/?ref=${HK_CODE}&pl=kham-pha.the-1` })).toBe(true);
    expect(await clickOf('nguon-hm-1')).toMatchObject({ source: 'hoiminh', placement: 'kham-pha.the-1' });

    expect(await affiliate.recordLandingClick(app.anon(), HK_CODE, { visitorId: 'nguon-zalo-1', userAgent: 'Mozilla/5.0 (iPhone) Zalo/23' })).toBe(true);
    expect((await clickOf('nguon-zalo-1'))?.source).toBe('zalo');
  });

  it('link rút gọn /r/<mã> cũng lưu nguồn', async () => {
    const r = await affiliate.trackClick(app.anon(), HK_CODE, { visitorId: 'nguon-r-1', referrer: 'https://www.youtube.com/watch?v=1', landingUrl: `${app.ctx.env.API_URL}/r/${HK_CODE}` });
    expect(r).not.toBeNull();
    expect((await clickOf('nguon-r-1'))?.source).toBe('youtube');
  });
});

describe('đơn có hoa hồng nối về lượt bấm', () => {
  const buyerCtx = async (email: string, name: string): Promise<Ctx> => {
    const s = await register(app.anon(), app.auth, { name, email, password: 'matkhau123', acceptTerms: true });
    return { ...app.anon(), actor: { type: 'user', userId: s.user.id, isSuperAdmin: false, email: s.user.email } };
  };
  const buyProduct = async (ctx: Ctx, visitorId?: string) => checkout.createCheckout(ctx, { target: { type: 'product', productId: await app.ids('product:prompts') }, provider: 'sepay', ref: HK_CODE }, { visitorId });

  it('bấm link từ Facebook rồi mua trên cùng trình duyệt: đơn nối về đúng lượt bấm, chép nguồn', async () => {
    expect(await affiliate.recordLandingClick(app.anon(), HK_CODE, { visitorId: 'mua-fb-1', referrer: 'https://www.facebook.com/', landingUrl: `${app.ctx.env.APP_URL}/kd?ref=${HK_CODE}` })).toBe(true);
    const click = await clickOf('mua-fb-1');
    const buyer = await buyerCtx('nguon.mua.fb@example.com', 'Khách Nguồn Facebook');
    const s = await buyProduct(buyer, 'mua-fb-1');
    expect(s.referredBy).toBe('Hồng Kim');
    expect((await app.ctx.db.query.orders.findFirst({ where: (o, { eq: e }) => e(o.id, s.orderId) }))?.metadata).toMatchObject({ visitorId: 'mua-fb-1' });
    await ownerBankPaid(app, s.reference, s.amountMinor);
    expect(await conversionOf(s.orderId)).toMatchObject({ clickId: click!.id, source: 'facebook', placement: null });

    // Mua tiếp trên máy khác (không có mã khách): giữ nguồn của lượt bấm ban đầu.
    const again = await checkout.createCheckout(buyer, { target: { type: 'tier', communityId: await app.ids('community:kd'), tierKey: 'premium', cycle: 'monthly' }, provider: 'sepay', ref: HK_CODE });
    await ownerBankPaid(app, again.reference, again.amountMinor);
    expect(await conversionOf(again.orderId)).toMatchObject({ clickId: click!.id, source: 'facebook' });
  });

  it('lượt bấm quá thời hạn cookie không được tính; không tìm được thì đơn vẫn có hoa hồng, nguồn để trống', async () => {
    expect(await affiliate.recordLandingClick(app.anon(), HK_CODE, { visitorId: 'mua-cu-1', referrer: 'https://www.tiktok.com/' })).toBe(true);
    await app.ctx.db.update(affiliateClicks).set({ clickedAt: new Date(Date.now() - 45 * 86_400_000) }).where(eq(affiliateClicks.visitorId, 'mua-cu-1'));
    const buyer = await buyerCtx('nguon.mua.cu@example.com', 'Khách Lượt Bấm Cũ');
    const s = await buyProduct(buyer, 'mua-cu-1');
    await ownerBankPaid(app, s.reference, s.amountMinor);
    const conv = await conversionOf(s.orderId);
    expect(conv).toBeDefined();
    expect(conv).toMatchObject({ clickId: null, source: null });
  });
});
