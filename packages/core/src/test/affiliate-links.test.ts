// Trang Tài khoản → Affiliate phải luôn lấy được link (chủ dự án báo ngày 21/11/2026):
//   1. Chương trình nền tảng tự có trên database chưa chạy dữ liệu mẫu (web thật), không tạo trùng.
//   2. Danh sách chương trình gồm cả hội chưa bật, kèm lối đi bật cho người quản lý.
//   3. Mỗi chương trình trả về các trang lấy link được: trang hội và từng sản phẩm đang bán.
import { eq, sql } from 'drizzle-orm';
import { affiliateAccounts, affiliateAttributions, affiliateClicks, affiliatePrograms, communities, courses, products } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as affiliate from '../services/affiliate';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let KD = '';
let PROGRAM = '';
let SLUG = '';

beforeAll(async () => {
  app = await createTestApp();
  KD = await app.ids('community:kd');
  PROGRAM = await app.ids('program:kd');
  SLUG = (await app.ctx.db.query.communities.findFirst({ where: eq(communities.id, KD), columns: { slug: true } }))!.slug;
}, 180_000);
afterAll(async () => {
  await app.close();
});

const platformRows = () => app.ctx.db.query.affiliatePrograms.findMany({ where: eq(affiliatePrograms.scopeType, 'platform') });

describe('affiliate: danh sách chương trình của tôi', () => {
  it('nền tảng đứng đầu, rồi tới hội đang tham gia; chủ hội có quyền bật, thành viên thì không', async () => {
    const owner = await affiliate.myPrograms(await app.as('minhquy'));
    expect(owner[0]).toMatchObject({ scope: 'platform', name: 'Nền tảng Hội Mình', enabled: true, rateBps: 4000, durationMonths: 12 });
    expect(owner.find((p) => p.id === PROGRAM)).toMatchObject({ scope: 'community', enabled: true, canManage: true, rateBps: 5000 });
    const member = await affiliate.myPrograms(await app.as('cong'));
    expect(member.find((p) => p.id === PROGRAM)).toMatchObject({ enabled: true, canManage: false });
    // Hoàng Vũ đã có ví trong hội; quản trị hệ thống là người quản lý chương trình nền tảng.
    expect((await affiliate.myPrograms(await app.as('hoangvu'))).find((p) => p.id === PROGRAM)?.hasAccount).toBe(true);
    expect((await affiliate.myPrograms(await app.as('admin')))[0]?.canManage).toBe(true);
    expect(member[0]?.canManage).toBe(false);
  });

  it('mức hoa hồng riêng của tài khoản thắng mức chung của chương trình', async () => {
    const hv = await app.ids('affiliate:kd:hoangvu');
    await app.ctx.db.update(affiliateAccounts).set({ commissionRateBps: 6000 }).where(eq(affiliateAccounts.id, hv));
    expect((await affiliate.myPrograms(await app.as('hoangvu'))).find((p) => p.id === PROGRAM)?.rateBps).toBe(6000);
    await app.ctx.db.update(affiliateAccounts).set({ commissionRateBps: null }).where(eq(affiliateAccounts.id, hv));
  });

  it('hội chưa bật vẫn nằm trong danh sách, xếp sau hội đang bật, và không tự mở ví', async () => {
    await app.ctx.db.update(affiliatePrograms).set({ status: 'paused' }).where(eq(affiliatePrograms.id, PROGRAM));
    try {
      // member1 là thành viên chưa từng lấy link.
      const list = await affiliate.myPrograms(await app.as('member1'));
      const kd = list.find((p) => p.id === PROGRAM);
      expect(kd).toMatchObject({ enabled: false, canManage: false, hasAccount: false });
      expect(list.findIndex((p) => p.id === PROGRAM)).toBeGreaterThanOrEqual(list.filter((p) => p.enabled).length);
      const accounts = await app.ctx.db.query.affiliateAccounts.findMany({ where: eq(affiliateAccounts.userId, await app.ids('user:member1')) });
      expect(accounts.some((a) => a.programId === PROGRAM)).toBe(false);
      // Ví của một chương trình đang tắt nói rõ là đang tắt, để giao diện không mời chia sẻ link.
      expect((await affiliate.myWallet(await app.as('hoangvu'), PROGRAM)).enabled).toBe(false);
    } finally {
      await app.ctx.db.update(affiliatePrograms).set({ status: 'active' }).where(eq(affiliatePrograms.id, PROGRAM));
    }
  });
});

describe('affiliate: các trang lấy link được', () => {
  it('hội: trang giới thiệu hội trước, rồi từng sản phẩm đang bán, link nào cũng mang mã của tôi', async () => {
    const w = await affiliate.myWallet(await app.as('hoangvu'), PROGRAM);
    expect(w.enabled).toBe(true);
    expect(w.targets[0]).toMatchObject({ key: 'community', kind: 'community', url: `${app.ctx.env.APP_URL}/${SLUG}?ref=${w.affiliateCode}`, commission: true });
    const published = await app.ctx.db.query.products.findMany({ where: (t, { and, eq: is, isNull }) => and(is(t.communityId, KD), is(t.status, 'published'), isNull(t.deletedAt)) });
    expect(published.length).toBeGreaterThan(0);
    const items = w.targets.filter((t) => t.kind === 'product');
    expect(items.map((t) => t.key).sort()).toEqual(published.map((p) => p.id).sort());
    for (const t of items) {
      const p = published.find((x) => x.id === t.key)!;
      expect(t).toMatchObject({ label: p.name, priceMinor: p.priceMinor, productKind: p.kind, url: `${app.ctx.env.APP_URL}/${SLUG}/cua-hang/${p.slug}?ref=${w.affiliateCode}` });
    }
  });

  it('sản phẩm nháp không có link; khóa học tắt hoa hồng bán lẻ thì đánh dấu không tính hoa hồng', async () => {
    const code = (await affiliate.myWallet(await app.as('hoangvu'), PROGRAM)).affiliateCode;
    const [withCourse] = await app.ctx.db.select({ id: products.id, courseId: products.courseId }).from(products).where(sql`${products.communityId} = ${KD} and ${products.status} = 'published' and ${products.deletedAt} is null and ${products.courseId} is not null`).limit(1);
    expect(withCourse?.courseId).toBeTruthy();
    const [other] = await app.ctx.db.select({ id: products.id }).from(products).where(sql`${products.communityId} = ${KD} and ${products.status} = 'published' and ${products.deletedAt} is null and ${products.id} <> ${withCourse!.id}`).limit(1);
    await app.ctx.db.update(courses).set({ affiliateEnabled: false }).where(eq(courses.id, withCourse!.courseId!));
    await app.ctx.db.update(products).set({ status: 'draft' }).where(eq(products.id, other!.id));
    try {
      const program = (await app.ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, PROGRAM) }))!;
      const { linkTargets } = await import('../services/affiliate-links');
      const targets = await linkTargets(app.system(), program, code);
      expect(targets.find((t) => t.key === withCourse!.id)?.commission).toBe(false);
      expect(targets.some((t) => t.key === other!.id)).toBe(false);
    } finally {
      await app.ctx.db.update(courses).set({ affiliateEnabled: true }).where(eq(courses.id, withCourse!.courseId!));
      await app.ctx.db.update(products).set({ status: 'published' }).where(eq(products.id, other!.id));
    }
  });

  it('nền tảng: link trang mở hội và trang chủ, thành viên nào cũng lấy được', async () => {
    const platform = (await platformRows())[0]!;
    const w = await affiliate.myWallet(await app.as('member1'), platform.id);
    expect(w).toMatchObject({ scope: 'platform', enabled: true, commissionDurationMonths: 12 });
    expect(w.targets.map((t) => [t.key, t.url])).toEqual([
      ['create', `${app.ctx.env.APP_URL}/tao-hoi?ref=${w.affiliateCode}`],
      ['home', `${app.ctx.env.APP_URL}/?ref=${w.affiliateCode}`],
    ]);
    expect(w.link).toBe(`${app.ctx.env.APP_URL}/tao-hoi?ref=${w.affiliateCode}`);
  });
});

describe('affiliate: đếm lượt bấm của link ?ref=', () => {
  const HV_CODE = 'hv8k2';
  const clicksOf = async () => (await app.ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.affiliateCode, HV_CODE) }))!.clickCount;
  const visit = (visitorId: string, over: { ip?: string; userAgent?: string } = {}) => affiliate.recordLandingClick(app.anon(), HV_CODE, { visitorId, ip: over.ip ?? `10.0.0.${visitorId.length}`, userAgent: over.userAgent ?? `ua-${visitorId}`, landingUrl: `${app.ctx.env.APP_URL}/${SLUG}/cua-hang/x?ref=${HV_CODE}` });

  it('khách mở link thì đếm một lượt, có ghi trang đã mở, và không ghi người giới thiệu', async () => {
    const before = await clicksOf();
    const attributions = (await app.ctx.db.select({ n: sql<number>`count(*)::int` }).from(affiliateAttributions))[0]!.n;
    expect(await visit('khach-a')).toBe(true);
    expect(await clicksOf()).toBe(before + 1);
    const row = await app.ctx.db.query.affiliateClicks.findFirst({ where: eq(affiliateClicks.visitorId, 'khach-a') });
    expect(row?.landingUrl).toContain(`/cua-hang/x?ref=${HV_CODE}`);
    // Chỉ đếm: luật tính người giới thiệu (lúc đăng ký, lúc vào hội) không đổi.
    expect((await app.ctx.db.select({ n: sql<number>`count(*)::int` }).from(affiliateAttributions))[0]!.n).toBe(attributions);
  });

  it('cùng người xem mở lại trong 30 phút không đếm thêm, kể cả khi mất mã khách nhưng cùng mạng và trình duyệt', async () => {
    const before = await clicksOf();
    expect(await visit('khach-b')).toBe(true);
    expect(await visit('khach-b')).toBe(false);
    expect(await visit('khach-b-moi', { ip: `10.0.0.${'khach-b'.length}`, userAgent: 'ua-khach-b' })).toBe(false);
    expect(await clicksOf()).toBe(before + 1);
    // Người khác cùng mạng nhưng khác trình duyệt vẫn được đếm.
    expect(await visit('khach-c', { ip: `10.0.0.${'khach-b'.length}` })).toBe(true);
    expect(await clicksOf()).toBe(before + 2);
  });

  it('quá 30 phút thì lượt mở lại được đếm', async () => {
    const before = await clicksOf();
    expect(await visit('khach-d')).toBe(true);
    await app.ctx.db.update(affiliateClicks).set({ clickedAt: new Date(Date.now() - 31 * 60_000) }).where(eq(affiliateClicks.visitorId, 'khach-d'));
    expect(await visit('khach-d')).toBe(true);
    expect(await clicksOf()).toBe(before + 2);
  });

  it('không đếm: chính affiliate tự mở link của mình, mã lạ, chương trình đang tắt', async () => {
    const before = await clicksOf();
    expect(await affiliate.recordLandingClick(await app.as('hoangvu'), HV_CODE, { visitorId: 'chinh-chu' })).toBe(false);
    expect(await affiliate.recordLandingClick(app.anon(), 'khong-co-ma-nay', { visitorId: 'khach-e' })).toBe(false);
    expect(await affiliate.recordLandingClick(app.anon(), '  ', { visitorId: 'khach-e' })).toBe(false);
    await app.ctx.db.update(affiliatePrograms).set({ status: 'paused' }).where(eq(affiliatePrograms.id, PROGRAM));
    try {
      expect(await visit('khach-f')).toBe(false);
    } finally {
      await app.ctx.db.update(affiliatePrograms).set({ status: 'active' }).where(eq(affiliatePrograms.id, PROGRAM));
    }
    expect(await clicksOf()).toBe(before);
    // Thành viên khác đang đăng nhập mở link thì vẫn đếm; mã viết hoa cũng nhận.
    expect(await affiliate.recordLandingClick(await app.as('cong'), HV_CODE.toUpperCase(), { visitorId: 'thanh-vien' })).toBe(true);
    expect(await clicksOf()).toBe(before + 1);
  });
});

describe('affiliate: chương trình nền tảng tự có', () => {
  it('database chưa có chương trình nền tảng (web thật): tự tạo đúng một dòng với mức mặc định, gọi đồng thời không tạo trùng', async () => {
    await app.ctx.db.delete(affiliatePrograms).where(eq(affiliatePrograms.scopeType, 'platform'));
    expect(await platformRows()).toHaveLength(0);
    const [a, b] = await Promise.all([affiliate.platformProgram(app.system()), affiliate.platformProgram(app.system())]);
    expect(a.id).toBe(b.id);
    const rows = await platformRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'active', commissionRateBps: 4000, commissionDurationMonths: 12, holdDays: 30, minWithdrawalMinor: 500_000, cookieDays: 30, communityId: null });
    // Người dùng mở trang Affiliate là có ngay link nền tảng.
    const list = await affiliate.myPrograms(await app.as('member2'));
    expect(list[0]).toMatchObject({ id: a.id, scope: 'platform', enabled: true, hasAccount: false });
    const w = await affiliate.myWallet(await app.as('member2'), a.id);
    expect(w.link).toContain('/tao-hoi?ref=');
    expect((await affiliate.myPrograms(await app.as('member2')))[0]?.hasAccount).toBe(true);
  });
  it('người vào hội khi database chưa có chương trình nền tảng: chương trình được tạo và chủ hội là người giới thiệu nền tảng', async () => {
    await app.ctx.db.delete(affiliatePrograms).where(eq(affiliatePrograms.scopeType, 'platform'));
    expect(await platformRows()).toHaveLength(0);
    const member = await app.ids('user:member1');
    const owner = await app.ids('user:minhquy');
    await affiliate.defaultPlatformReferrer(app.system(), { userId: member, communityId: KD });
    const [program] = await platformRows();
    expect(program).toMatchObject({ status: 'active', commissionRateBps: 4000 });
    const rows = await app.ctx.db.select({ accountUser: affiliateAccounts.userId }).from(affiliateAttributions).innerJoin(affiliateAccounts, eq(affiliateAccounts.id, affiliateAttributions.affiliateAccountId)).where(sql`${affiliateAttributions.userId} = ${member} and ${affiliateAttributions.programId} = ${program!.id}`);
    expect(rows).toEqual([{ accountUser: owner }]);
    // Gọi lại (người đó vào thêm hội khác) không ghi thêm và không tạo thêm chương trình.
    await affiliate.defaultPlatformReferrer(app.system(), { userId: member, communityId: KD });
    expect(await platformRows()).toHaveLength(1);
    expect((await app.ctx.db.select({ n: sql<number>`count(*)::int` }).from(affiliateAttributions).where(sql`${affiliateAttributions.userId} = ${member} and ${affiliateAttributions.programId} = ${program!.id}`))[0]!.n).toBe(1);
  });

  it('chương trình nền tảng đang tạm dừng thì không ghi người giới thiệu mặc định', async () => {
    const [program] = await platformRows();
    await app.ctx.db.update(affiliatePrograms).set({ status: 'paused' }).where(eq(affiliatePrograms.id, program!.id));
    try {
      const member = await app.ids('user:member2');
      await app.ctx.db.delete(affiliateAttributions).where(sql`${affiliateAttributions.userId} = ${member} and ${affiliateAttributions.programId} = ${program!.id}`);
      await affiliate.defaultPlatformReferrer(app.system(), { userId: member, communityId: KD });
      expect((await app.ctx.db.select({ n: sql<number>`count(*)::int` }).from(affiliateAttributions).where(sql`${affiliateAttributions.userId} = ${member} and ${affiliateAttributions.programId} = ${program!.id}`))[0]!.n).toBe(0);
    } finally {
      await app.ctx.db.update(affiliatePrograms).set({ status: 'active' }).where(eq(affiliatePrograms.id, program!.id));
    }
  });
});
