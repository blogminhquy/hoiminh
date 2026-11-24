// Chia sẻ khóa học ở thư viện khóa học (chủ dự án yêu cầu ngày 23/11/2026):
//   1. Số tiền ước tính cho từng khóa bán lẻ và cho giới thiệu vào hội, tính như lúc ghi hoa hồng thật, không tạo ví.
//   2. Khóa tắt hoa hồng bán lẻ, hội tắt affiliate, người không còn là thành viên: không có gì để chia sẻ.
//   3. Link chia sẻ kèm mã của tôi; lúc này mới tạo ví.
//   4. Trang chứng nhận có đủ dữ liệu cho khối giới thiệu (id hội) và lời mời học khóa (giá, trang bán lẻ).
import { and, eq } from 'drizzle-orm';
import { affiliateAccounts, affiliatePrograms, communityMembers, communityTiers, courseProgress, courses, products } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { certificate } from '../services/courses';
import { cheapestMonthlyMinor, shareLinks, shareOffer } from '../services/course-share';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let KD = '';
let PROGRAM = '';

beforeAll(async () => {
  app = await createTestApp();
  KD = await app.ids('community:kd');
  PROGRAM = await app.ids('program:kd');
}, 180_000);
afterAll(async () => {
  await app.close();
});

/** Khóa bán lẻ đang bán của hội kd, kèm giá: dữ liệu mẫu có thể đổi nên đọc thẳng từ database. */
async function retailCourses() {
  const rows = await app.ctx.db.select({ courseId: products.courseId, priceMinor: products.priceMinor, affiliateEnabled: courses.affiliateEnabled, status: products.status, kind: products.kind }).from(products).innerJoin(courses, eq(courses.id, products.courseId)).where(eq(products.communityId, KD));
  return rows.filter((r) => r.kind === 'course' && r.status === 'published' && r.affiliateEnabled && r.priceMinor > 0);
}

describe('giá một tháng rẻ nhất của các gói thành viên', () => {
  it('lấy giá tháng, gói bán theo năm thì chia đều ra tháng, bỏ gói miễn phí', () => {
    expect(cheapestMonthlyMinor([{ monthlyMinor: 249_000, terms: [{ months: 12, amountMinor: 2_400_000 }] }, { monthlyMinor: null, terms: [] }])).toBe(200_000);
    expect(cheapestMonthlyMinor([{ monthlyMinor: 0, terms: [] }])).toBeNull();
    expect(cheapestMonthlyMinor([])).toBeNull();
  });
});

describe('chia sẻ khóa học: số tiền nhận được', () => {
  it('mỗi khóa bán lẻ có hoa hồng một lần, giới thiệu vào hội có hoa hồng hằng tháng; làm tròn xuống như máy chủ', async () => {
    const offer = await shareOffer(await app.as('cong'), KD);
    const program = (await app.ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, PROGRAM) }))!;
    expect(offer).toMatchObject({ enabled: true, programId: PROGRAM, durationMonths: program.commissionDurationMonths });
    const retail = await retailCourses();
    expect(retail.length).toBeGreaterThan(0);
    for (const r of retail) {
      expect(offer.courses.find((c) => c.courseId === r.courseId)).toEqual({ courseId: r.courseId, priceMinor: r.priceMinor, commissionMinor: Math.floor((r.priceMinor * program.commissionRateBps) / 10_000) });
    }
    const tiers = await app.ctx.db.query.communityTiers.findMany({ where: and(eq(communityTiers.communityId, KD), eq(communityTiers.isActive, true)) });
    expect(offer.monthlyCommissionMinor).toBe(Math.floor((cheapestMonthlyMinor(tiers)! * program.commissionRateBps) / 10_000));
  });

  it('chỉ tính số tiền, không tạo ví affiliate cho người chỉ xem thư viện', async () => {
    const member1 = await app.ids('user:member1');
    const before = await app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, member1), eq(affiliateAccounts.programId, PROGRAM)) });
    expect(before).toBeUndefined();
    expect((await shareOffer(await app.as('member1'), KD)).enabled).toBe(true);
    expect(await app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, member1), eq(affiliateAccounts.programId, PROGRAM)) })).toBeUndefined();
  });

  it('khóa tắt hoa hồng bán lẻ không nằm trong danh sách', async () => {
    const [first] = await retailCourses();
    await app.ctx.db.update(courses).set({ affiliateEnabled: false }).where(eq(courses.id, first!.courseId!));
    try {
      const offer = await shareOffer(await app.as('cong'), KD);
      expect(offer.courses.some((c) => c.courseId === first!.courseId)).toBe(false);
      expect((await shareLinks(await app.as('cong'), KD, first!.courseId!)).courseUrl).toBeNull();
    } finally {
      await app.ctx.db.update(courses).set({ affiliateEnabled: true }).where(eq(courses.id, first!.courseId!));
    }
  });

  it('hội tắt affiliate hoặc người không còn là thành viên: không có gì để chia sẻ', async () => {
    await app.ctx.db.update(affiliatePrograms).set({ status: 'paused' }).where(eq(affiliatePrograms.id, PROGRAM));
    try {
      expect(await shareOffer(await app.as('cong'), KD)).toMatchObject({ enabled: false, courses: [], monthlyCommissionMinor: null });
      await expect(shareLinks(await app.as('cong'), KD, null)).rejects.toThrow();
    } finally {
      await app.ctx.db.update(affiliatePrograms).set({ status: 'active' }).where(eq(affiliatePrograms.id, PROGRAM));
    }
    const member = await app.ids('member:kd:cong');
    await app.ctx.db.update(communityMembers).set({ status: 'churned' }).where(eq(communityMembers.id, member));
    try {
      expect((await shareOffer(await app.as('cong'), KD)).enabled).toBe(false);
      await expect(shareLinks(await app.as('cong'), KD, null)).rejects.toThrow();
    } finally {
      await app.ctx.db.update(communityMembers).set({ status: 'active' }).where(eq(communityMembers.id, member));
    }
  });
});

describe('chia sẻ khóa học: link kèm mã', () => {
  it('tạo ví nếu chưa có, trả link trang bán lẻ của khóa và link trang hội, cùng một mã', async () => {
    const [first] = await retailCourses();
    const ctx = await app.as('member2');
    const links = await shareLinks(ctx, KD, first!.courseId!);
    const acc = await app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, await app.ids('user:member2')), eq(affiliateAccounts.programId, PROGRAM)) });
    expect(acc?.affiliateCode).toBe(links.code);
    const product = await app.ctx.db.query.products.findFirst({ where: and(eq(products.courseId, first!.courseId!), eq(products.status, 'published')) });
    expect(links.courseUrl).toBe(`${app.ctx.env.APP_URL}/${(await app.ctx.db.query.communities.findFirst({ where: (t, { eq: e }) => e(t.id, KD), columns: { slug: true } }))!.slug}/cua-hang/${product!.slug}?ref=${links.code}`);
    expect(links.communityUrl.endsWith(`?ref=${links.code}`)).toBe(true);
    // Gọi lại không tạo ví thứ hai.
    expect((await shareLinks(ctx, KD, null)).code).toBe(links.code);
    expect((await app.ctx.db.query.affiliateAccounts.findMany({ where: and(eq(affiliateAccounts.userId, await app.ids('user:member2')), eq(affiliateAccounts.programId, PROGRAM)) })).length).toBe(1);
  });

  it('khóa không bán lẻ thì chỉ có link vào hội', async () => {
    const links = await shareLinks(await app.as('cong'), KD, '00000000-0000-4000-8000-000000000000');
    expect(links.courseUrl).toBeNull();
    expect(links.communityUrl).toContain('?ref=');
  });
});

describe('chứng nhận: dữ liệu cho khối giới thiệu và lời mời học khóa', () => {
  it('khóa bán lẻ: có id hội, giá và đường dẫn trang bán lẻ', async () => {
    const [first] = await retailCourses();
    const courseId = first!.courseId!;
    const userId = await app.ids('user:cong');
    await app.ctx.db.update(courses).set({ certificateEnabled: true, status: 'published' }).where(eq(courses.id, courseId));
    await app.ctx.db.insert(courseProgress).values({ courseId, userId, percent: 100, completedLessons: 1, totalLessons: 1, completedAt: new Date() }).onConflictDoUpdate({ target: [courseProgress.courseId, courseProgress.userId], set: { percent: 100, completedAt: new Date() } });
    const cert = await certificate(app.anon(), courseId, userId);
    const product = await app.ctx.db.query.products.findFirst({ where: and(eq(products.courseId, courseId), eq(products.status, 'published')) });
    expect(cert.community?.id).toBe(KD);
    expect(cert.sale).toEqual({ priceMinor: first!.priceMinor, path: `/${cert.community!.slug}/cua-hang/${product!.slug}` });
    // Link kiểm tra in trên tấm chứng chỉ vẫn là link gốc, không có mã giới thiệu.
    expect(cert.verifyUrl).not.toContain('ref=');
  });
});

