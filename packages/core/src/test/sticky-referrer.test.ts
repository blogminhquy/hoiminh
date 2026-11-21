// Ba việc chủ dự án báo ngày 21/11/2026:
//   1. Affiliate "người giới thiệu cố định": thành viên đã có người giới thiệu thì mọi hoa hồng về người đó, bấm link
//      của affiliate khác không đổi được. Link của hội (cookie 30 ngày, lượt bấm cuối) tính lúc đăng ký tài khoản và
//      lúc một người chưa ở trong hội vào hội, không tính cho từng đơn hàng của thành viên; link nền tảng chỉ tính lúc
//      đăng ký. Ngoài ra chỉ thành viên tự chọn hoặc tự đổi được.
//   2. Hội đổi đường dẫn thì đường dẫn cũ vẫn dẫn về hội (thông báo cũ từng ra "Hội không tồn tại").
//   3. Xóa bài học thì tiến độ không còn trỏ tới bài đã xóa (thẻ khóa học từng ra "Bài học không tồn tại").
import { and, eq } from 'drizzle-orm';
import { affiliateAccounts, affiliateAttributions, affiliateCommissions, affiliateLinks, auditLogs, communityMembers, communitySlugAliases, courseProgress, lessons, notifications, orders, users } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginWithIdentity, register } from '../auth/service';
import type { Ctx } from '../context';
import * as affiliate from '../services/affiliate';
import * as checkout from '../services/checkout';
import * as communities from '../services/communities';
import * as courses from '../services/courses';
import * as members from '../services/members';
import * as shell from '../services/shell';
import { createTestApp, ownerBankPaid, type TestApp } from './setup';

let app: TestApp;
let KD = '';
let HV = '';
let HK = '';
let PROGRAM = '';

beforeAll(async () => {
  app = await createTestApp();
  KD = await app.ids('community:kd');
  HV = await app.ids('affiliate:kd:hoangvu');
  HK = await app.ids('affiliate:kd:hongkim');
  PROGRAM = await app.ids('program:kd');
}, 180_000);
afterAll(async () => {
  await app.close();
});

const premium = (ctx: Ctx, ref?: string) => checkout.createCheckout(ctx, { target: { type: 'tier', communityId: KD, tierKey: 'premium', cycle: 'monthly' }, provider: 'sepay', ref });
const affiliateOfOrder = async (orderId: string) => (await app.ctx.db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { affiliateAccountId: true } }))?.affiliateAccountId ?? null;
const memberOf = async (userKey: string) => app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, KD), eq(communityMembers.userId, await app.ids(`user:${userKey}`))) });

describe('affiliate: người giới thiệu cố định', () => {
  it('thành viên đã có người giới thiệu: bấm link của affiliate khác, hoa hồng vẫn về người cũ', async () => {
    // Điền do Hoàng Vũ giới thiệu. Lần này Điền thanh toán qua link của Hồng Kim.
    expect((await memberOf('dien'))?.referredByAffiliateId).toBe(HV);
    const session = await premium(await app.as('dien'), 'hk3m1');
    expect(session.referredBy).toBe('Hoàng Vũ');
    expect(await affiliateOfOrder(session.orderId)).toBe(HV);
    await ownerBankPaid(app, session.reference, session.amountMinor);
    const comm = await app.ctx.db.query.affiliateCommissions.findFirst({ where: eq(affiliateCommissions.orderId, session.orderId) });
    expect(comm?.affiliateAccountId).toBe(HV);
    expect((await memberOf('dien'))?.referredByAffiliateId).toBe(HV);
  });

  it('thành viên đang ở trong hội mà chưa có người giới thiệu: bấm link affiliate rồi mua không được tính', async () => {
    expect((await memberOf('duy'))?.referredByAffiliateId).toBeNull();
    const duy = await app.as('duy');
    const paidBefore = (await app.ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, HK) }))!.paidCount;
    const session = await premium(duy, 'hk3m1');
    expect(session.referredBy).toBeNull();
    expect(await affiliateOfOrder(session.orderId)).toBeNull();
    await ownerBankPaid(app, session.reference, session.amountMinor);
    expect(await app.ctx.db.query.affiliateCommissions.findFirst({ where: eq(affiliateCommissions.orderId, session.orderId) })).toBeUndefined();
    expect((await memberOf('duy'))?.referredByAffiliateId).toBeNull();
    expect((await app.ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, HK) }))!.paidCount).toBe(paidBefore);
    // Trang giới thiệu cũng không báo "Bạn được ... giới thiệu" với thành viên này, còn khách chưa đăng nhập thì có.
    expect((await communities.aboutPage(duy, 'minhquy', 'hk3m1')).referrer).toBeNull();
    expect((await communities.aboutPage(app.anon(), 'minhquy', 'hk3m1')).referrer?.name).toBe('Hồng Kim');
  });

  it('đăng ký tài khoản mới qua link của hội: được tính, giữ mãi, người khác không giới thiệu tranh được', async () => {
    const s = await register(app.anon(), app.auth, { name: 'Khách Qua Link', email: 'khach.qua.link@example.com', password: 'matkhau123', ref: 'hk3m1', acceptTerms: true });
    const ctx: Ctx = { ...app.anon(), actor: { type: 'user', userId: s.user.id, isSuperAdmin: false, email: s.user.email } };
    // Hai tháng sau mới vào hội, lại còn qua link của Hoàng Vũ: người giới thiệu vẫn là Hồng Kim (người lúc đăng ký).
    await app.ctx.db.update(affiliateAttributions).set({ expiresAt: new Date(Date.now() - 86_400_000) }).where(eq(affiliateAttributions.userId, s.user.id));
    const about = await communities.aboutPage(ctx, 'minhquy', 'hv8k2');
    expect(about.referrer?.name).toBe('Hồng Kim');
    const joined = await members.joinCommunity(ctx, 'minhquy', { ref: 'hv8k2', answers: about.joinQuestions.map((q) => ({ questionId: q.id, answer: 'Học bán hàng' })) });
    expect(joined.member.referredByAffiliateId).toBe(HK);
    // Mua gói qua link của Hoàng Vũ: hoa hồng vẫn về Hồng Kim, và một đơn chỉ đếm một lượt "Trả phí".
    const paidBefore = (await app.ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, HK) }))!.paidCount;
    const order = await premium(ctx, 'hv8k2');
    expect(await affiliateOfOrder(order.orderId)).toBe(HK);
    await ownerBankPaid(app, order.reference, order.amountMinor);
    expect((await app.ctx.db.query.affiliateCommissions.findFirst({ where: eq(affiliateCommissions.orderId, order.orderId) }))?.affiliateAccountId).toBe(HK);
    expect((await app.ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, HK) }))!.paidCount).toBe(paidBefore + 1);
  });

  it('tài khoản đã có (đăng ký không qua link) vào hội qua link của hội: được tính cho hội này, rồi cố định', async () => {
    const s = await register(app.anon(), app.auth, { name: 'Khách Tự Đến', email: 'khach.tu.den@example.com', password: 'matkhau123', acceptTerms: true });
    const ctx: Ctx = { ...app.anon(), actor: { type: 'user', userId: s.user.id, isSuperAdmin: false, email: s.user.email } };
    // Người này mang theo ba mã: mã của affiliate nền tảng (mới bấm nhất), rồi hai mã của hội này. Hội chỉ nhận mã của
    // chính hội, và trong đó mã mới bấm hơn thắng (Hoàng Vũ đứng trước Hồng Kim).
    const platformAcc = await affiliate.ensureAccount(app.system(), await app.ids('user:hongkim'), await app.ids('program:platform'));
    const refs = `${platformAcc.affiliateCode},hv8k2,hk3m1`;
    const about = await communities.aboutPage(ctx, 'minhquy', refs);
    expect(about.referrer?.name).toBe('Hoàng Vũ');
    const joined = await members.joinCommunity(ctx, 'minhquy', { ref: refs, answers: about.joinQuestions.map((q) => ({ questionId: q.id, answer: 'Học bán hàng' })) });
    expect(joined.member.referredByAffiliateId).toBe(HV);
    expect(joined.member.source).toBe('affiliate');
    // Đã ở trong hội với người giới thiệu là Hoàng Vũ: mua qua link của Hồng Kim, hoa hồng vẫn về Hoàng Vũ.
    const order = await premium(ctx, 'hk3m1');
    expect(await affiliateOfOrder(order.orderId)).toBe(HV);
  });

  it('người mua lẻ chưa vào hội: link của hội được tính ở đơn đầu, các đơn sau vẫn về người đó', async () => {
    const s = await register(app.anon(), app.auth, { name: 'Khách Mua Lẻ', email: 'khach.mua.le@example.com', password: 'matkhau123', acceptTerms: true });
    const buyer: Ctx = { ...app.anon(), actor: { type: 'user', userId: s.user.id, isSuperAdmin: false, email: s.user.email } };
    const memberRow = () => app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, KD), eq(communityMembers.userId, s.user.id)) });
    expect(await memberRow()).toBeUndefined();
    const first = await checkout.createCheckout(buyer, { target: { type: 'product', productId: await app.ids('product:prompts') }, provider: 'sepay', ref: 'hk3m1' });
    expect(first.referredBy).toBe('Hồng Kim');
    expect(await affiliateOfOrder(first.orderId)).toBe(HK);
    await ownerBankPaid(app, first.reference, first.amountMinor);
    expect((await app.ctx.db.query.affiliateCommissions.findFirst({ where: eq(affiliateCommissions.orderId, first.orderId) }))?.affiliateAccountId).toBe(HK);
    // Sau đó mua gói thành viên qua link của Hoàng Vũ: vẫn là Hồng Kim, và khi vào hội thì Hồng Kim là người giới thiệu.
    const second = await premium(buyer, 'hv8k2');
    expect(await affiliateOfOrder(second.orderId)).toBe(HK);
    await ownerBankPaid(app, second.reference, second.amountMinor);
    expect((await memberRow())?.referredByAffiliateId).toBe(HK);
  });

  it('một lượt đăng ký ghi được người giới thiệu của cả nền tảng lẫn hội, mỗi chương trình một người', async () => {
    const platform = await app.ids('program:platform');
    const platformAcc = await affiliate.ensureAccount(app.system(), await app.ids('user:hongkim'), platform);
    const s = await register(app.anon(), app.auth, { name: 'Khách Hai Tầng', email: 'khach.hai.tang@example.com', password: 'matkhau123', ref: `hv8k2,${platformAcc.affiliateCode},hk3m1`, acceptTerms: true });
    const rows = await app.ctx.db.query.affiliateAttributions.findMany({ where: eq(affiliateAttributions.userId, s.user.id) });
    expect(rows.map((r) => [r.programId, r.affiliateAccountId]).sort()).toEqual([[PROGRAM, HV], [platform, platformAcc.id]].sort());
  });

  it('đăng ký bằng Google cũng tính mã giới thiệu trong cookie; đăng nhập lại bằng Google thì không', async () => {
    await loginWithIdentity(app.anon(), app.auth, { providerUserId: 'google-moi-1', email: 'khach.google@example.com', name: 'Khách Google', emailVerified: true }, { ref: 'hv8k2' });
    const user = (await app.ctx.db.query.users.findFirst({ where: eq(users.email, 'khach.google@example.com') }))!;
    const attributed = () => app.ctx.db.query.affiliateAttributions.findMany({ where: eq(affiliateAttributions.userId, user.id) });
    expect((await attributed()).map((a) => a.affiliateAccountId)).toEqual([HV]);
    // Lần đăng nhập sau mang cookie của người khác: tài khoản đã có nên không ghi thêm gì.
    await loginWithIdentity(app.anon(), app.auth, { providerUserId: 'google-moi-1', email: 'khach.google@example.com', name: 'Khách Google', emailVerified: true }, { ref: 'hk3m1' });
    expect((await attributed()).map((a) => a.affiliateAccountId)).toEqual([HV]);
  });

  it('thành viên tự đổi người giới thiệu bằng mã hoặc link, từ đó hoa hồng về người mới', async () => {
    const duy = await app.as('duy');
    expect((await affiliate.myReferrer(duy, KD)).referrer).toBeNull();
    const changed = await affiliate.setMyReferrer(duy, KD, { code: ' https://hoiminh.com/minhquy?utm=zalo&ref=HV8K2 ' });
    expect(changed).toMatchObject({ enabled: true, referrer: { code: 'hv8k2', name: 'Hoàng Vũ', active: true } });
    expect((await memberOf('duy'))?.referredByAffiliateId).toBe(HV);
    // Mua tiếp qua link của Hồng Kim: người giới thiệu mới (Hoàng Vũ) vẫn nhận.
    const session = await checkout.createCheckout(duy, { target: { type: 'product', productId: await app.ids('product:prompts') }, provider: 'sepay', ref: 'hk3m1' });
    expect(await affiliateOfOrder(session.orderId)).toBe(HV);
    // Người được chọn nhận thông báo, và lần đổi có trong nhật ký.
    const note = await app.ctx.db.query.notifications.findFirst({ where: and(eq(notifications.userId, await app.ids('user:hoangvu')), eq(notifications.kind, 'affiliate.referrer_chosen')) });
    expect(note?.title).toContain('đã chọn bạn làm người giới thiệu');
    const log = await app.ctx.db.query.auditLogs.findFirst({ where: eq(auditLogs.action, 'member.change_referrer') });
    expect(log?.metadata).toMatchObject({ from: null, to: HV });
  });

  it('không tự chọn mình, không nhận mã lạ hay mã của chương trình khác, người ngoài hội không đổi được', async () => {
    const duy = await app.as('duy');
    await expect(affiliate.setMyReferrer(duy, KD, { code: 'dn2w6' })).rejects.toThrow(/tự chọn mình/);
    await expect(affiliate.setMyReferrer(duy, KD, { code: 'khong-co-ma-nay' })).rejects.toThrow(/Không tìm thấy mã/);
    const platformAcc = await affiliate.ensureAccount(app.system(), await app.ids('user:hoangvu'), await app.ids('program:platform'));
    await expect(affiliate.setMyReferrer(duy, KD, { code: platformAcc.affiliateCode })).rejects.toThrow(/Không tìm thấy mã/);
    expect((await memberOf('duy'))?.referredByAffiliateId).toBe(HV);
    // Thảo Vy là chủ một hội khác, không phải thành viên hội này.
    expect(await memberOf('thaovy')).toBeUndefined();
    const outsider: Ctx = { ...app.system(), actor: { type: 'user', userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' } };
    await expect(affiliate.setMyReferrer(outsider, KD, { code: 'hv8k2' })).rejects.toThrow(/Tham gia hội/);
    await expect(affiliate.myReferrer(outsider, KD)).rejects.toThrow(/Tham gia hội/);
  });

  it('nhập email của một thành viên trong hội cũng được tính, kể cả khi người đó chưa lấy link affiliate', async () => {
    const lan = await app.as('thulan');
    // Công đã có tài khoản affiliate (mã ct4e8): email viết hoa, thừa khoảng trắng vẫn nhận.
    const viaEmail = await affiliate.setMyReferrer(lan, KD, { code: '  CongTran@Gmail.com ' });
    expect(viaEmail.referrer).toMatchObject({ code: 'ct4e8', active: true });
    expect((await memberOf('thulan'))?.referredByAffiliateId).toBe(await app.ids('affiliate:kd:cong'));
    // member1 là thành viên nhưng chưa từng lấy link: được mở tài khoản affiliate, rồi mới gắn làm người giới thiệu.
    const m1 = (await app.ctx.db.query.users.findFirst({ where: eq(users.id, await app.ids('user:member1')) }))!;
    const accOf = () => app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, m1.id), eq(affiliateAccounts.programId, PROGRAM)) });
    expect(await accOf()).toBeUndefined();
    const opened = await affiliate.setMyReferrer(lan, KD, { code: m1.email });
    const acc = (await accOf())!;
    expect(opened.referrer).toMatchObject({ name: m1.name, code: acc.affiliateCode, active: true });
    expect((await memberOf('thulan'))?.referredByAffiliateId).toBe(acc.id);
    // Đơn sau đó tính cho người vừa chọn.
    const session = await checkout.createCheckout(lan, { target: { type: 'product', productId: await app.ids('product:prompts') }, provider: 'sepay', ref: 'hv8k2' });
    expect(await affiliateOfOrder(session.orderId)).toBe(acc.id);
  });

  it('email của chính mình, email lạ, email của người ngoài hội đều bị từ chối và không mở tài khoản thừa', async () => {
    const lan = await app.as('thulan');
    const before = (await memberOf('thulan'))?.referredByAffiliateId;
    const m2 = (await app.ctx.db.query.users.findFirst({ where: eq(users.id, await app.ids('user:member2')) }))!;
    const m2ctx = await app.as('member2');
    await expect(affiliate.setMyReferrer(m2ctx, KD, { code: m2.email })).rejects.toThrow(/tự chọn mình/);
    expect(await app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, m2.id), eq(affiliateAccounts.programId, PROGRAM)) })).toBeUndefined();
    await expect(affiliate.setMyReferrer(lan, KD, { code: 'khong-co-ai@example.com' })).rejects.toThrow(/Không có thành viên nào trong hội dùng email này/);
    // Thảo Vy có tài khoản Hội Mình nhưng không ở trong hội này.
    await expect(affiliate.setMyReferrer(lan, KD, { code: 'vy.english@gmail.com' })).rejects.toThrow(/Không có thành viên nào trong hội dùng email này/);
    expect((await memberOf('thulan'))?.referredByAffiliateId).toBe(before);
  });

  it('người giới thiệu bị khóa tài khoản affiliate: không ai nhận hoa hồng thay', async () => {
    await app.ctx.db.update(affiliateAccounts).set({ status: 'suspended' }).where(eq(affiliateAccounts.id, HV));
    try {
      const session = await premium(await app.as('dien'), 'hk3m1');
      expect(session.referredBy).toBeNull();
      expect(await affiliateOfOrder(session.orderId)).toBeNull();
      expect((await affiliate.myReferrer(await app.as('dien'), KD)).referrer).toMatchObject({ code: 'hv8k2', active: false });
    } finally {
      await app.ctx.db.update(affiliateAccounts).set({ status: 'active' }).where(eq(affiliateAccounts.id, HV));
    }
  });

  it('rời hội rồi quay lại qua link của người khác vẫn giữ người giới thiệu cũ', async () => {
    const m = (await memberOf('dien'))!;
    await app.ctx.db.update(communityMembers).set({ status: 'churned' }).where(eq(communityMembers.id, m.id));
    const dien = await app.as('dien');
    const about = await communities.aboutPage(dien, 'minhquy', 'hk3m1');
    const r = await members.joinCommunity(dien, 'minhquy', { ref: 'hk3m1', answers: about.joinQuestions.map((q) => ({ questionId: q.id, answer: 'Quay lại học' })) });
    expect(r.member.referredByAffiliateId).toBe(HV);
    expect(r.member.source).toBe('affiliate');
  });
});

describe('hội đổi đường dẫn', () => {
  it('đường dẫn cũ vẫn tìm ra hội và trả về đường dẫn mới; link affiliate viết lại theo đường dẫn mới', async () => {
    const mq = await app.as('minhquy');
    await communities.updateGeneral(mq, KD, { slug: 'kinh-doanh-moi' });
    const viaOld = await shell.communityShell(await app.as('dien'), 'minhquy');
    expect(viaOld.community).toMatchObject({ id: KD, slug: 'kinh-doanh-moi' });
    expect((await communities.aboutPage(app.anon(), 'minhquy')).community.slug).toBe('kinh-doanh-moi');
    const link = await app.ctx.db.query.affiliateLinks.findFirst({ where: eq(affiliateLinks.affiliateAccountId, HV) });
    expect(link?.destinationUrl).toBe(`${app.ctx.env.APP_URL}/kinh-doanh-moi?ref=hv8k2`);
    await expect(communities.getCommunityBySlug(app.anon(), 'chua-tung-co')).rejects.toThrow(/Hội không tồn tại/);
  });

  it('hội khác không lấy được đường dẫn cũ; chính hội đó lấy lại được', async () => {
    const mq = await app.as('minhquy');
    await expect(communities.assertSlugAvailable(mq, 'minhquy')).rejects.toThrow(/đã có hội khác dùng/);
    await expect(communities.assertSlugAvailable(mq, 'minhquy', await app.ids('community:vy'))).rejects.toThrow(/đã có hội khác dùng/);
    await communities.updateGeneral(mq, KD, { slug: 'minhquy' });
    const aliases = await app.ctx.db.query.communitySlugAliases.findMany({ where: eq(communitySlugAliases.communityId, KD) });
    expect(aliases.map((a) => a.slug)).toEqual(['kinh-doanh-moi']);
    expect((await communities.getCommunityBySlug(app.anon(), 'kinh-doanh-moi')).slug).toBe('minhquy');
  });
});

describe('xóa bài học đang học dở', () => {
  it('tiến độ thôi trỏ tới bài đã xóa, thẻ khóa học không còn dẫn vào bài không tồn tại', async () => {
    const fmm = await app.ids('course:fmm');
    const dien = await app.as('dien');
    const dienId = await app.ids('user:dien');
    const lesson = (await app.ctx.db.query.lessons.findFirst({ where: eq(lessons.courseId, fmm) }))!;
    await courses.getLesson(dien, lesson.id);
    const progress = () => app.ctx.db.query.courseProgress.findFirst({ where: and(eq(courseProgress.courseId, fmm), eq(courseProgress.userId, dienId)) });
    expect((await progress())?.lastLessonId).toBe(lesson.id);
    await courses.deleteLesson(await app.as('minhquy'), lesson.id);
    expect((await progress())?.lastLessonId).toBeNull();
    const list = await courses.listCourses(dien, KD);
    expect(list.items.find((c) => c.id === fmm)?.lastLessonId).toBeNull();
    await expect(courses.getLesson(dien, lesson.id)).rejects.toThrow(/Bài học không tồn tại/);
  });
});
