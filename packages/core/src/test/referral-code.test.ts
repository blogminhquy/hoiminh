// Mã giới thiệu chung (chủ dự án yêu cầu ngày 21/11/2026): mỗi người tự chọn một mã, dùng cho link của mọi chương
// trình, không trùng với ai, chỉ đặt được một lần. Luật hoa hồng không đổi: mã chung mở ở trang của một hội chỉ tính
// cho hội đó, mở ở trang nền tảng chỉ tính cho nền tảng; mã riêng cũ vẫn chạy.
import { and, eq } from 'drizzle-orm';
import { affiliateAccounts, affiliateAttributions, affiliateUserCodes, communityMembers, communitySlugAliases } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { register } from '../auth/service';
import type { Ctx } from '../context';
import * as affiliate from '../services/affiliate';
import * as communities from '../services/communities';
import * as members from '../services/members';
import * as referralCodes from '../services/referral-codes';
import * as store from '../services/store';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let KD = '';
let HV = '';
let PROGRAM = '';
let PLATFORM = '';
const SLUG = 'minhquy';

beforeAll(async () => {
  app = await createTestApp();
  KD = await app.ids('community:kd');
  HV = await app.ids('affiliate:kd:hoangvu');
  PROGRAM = await app.ids('program:kd');
  PLATFORM = await app.ids('program:platform');
}, 180_000);
afterAll(async () => {
  await app.close();
});

let n = 0;
/** Tạo một tài khoản mới mang theo các mã giới thiệu `ref` (như cookie và link gửi lên lúc đăng ký). */
async function newAccount(ref?: string) {
  n += 1;
  const s = await register(app.anon(), app.auth, { name: `Khách Mới ${n}`, email: `khach.ma.chung.${n}@example.com`, password: 'matkhau123', ref, acceptTerms: true });
  const ctx: Ctx = { ...app.anon(), actor: { type: 'user', userId: s.user.id, isSuperAdmin: false, email: s.user.email } };
  const join = async (joinRef?: string) => {
    const about = await communities.aboutPage(ctx, SLUG, joinRef);
    return members.joinCommunity(ctx, SLUG, { ref: joinRef, answers: about.joinQuestions.map((q) => ({ questionId: q.id, answer: 'Học bán hàng' })) });
  };
  return { id: s.user.id, ctx, join };
}
const attributed = async (userId: string, programId: string) => (await app.ctx.db.query.affiliateAttributions.findMany({ where: and(eq(affiliateAttributions.userId, userId), eq(affiliateAttributions.programId, programId)) })).map((r) => r.affiliateAccountId);
const accountOf = async (userKey: string, programId: string) => app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, await app.ids(`user:${userKey}`)), eq(affiliateAccounts.programId, programId)) });

describe('đặt mã giới thiệu chung', () => {
  it('chưa đặt thì ví hiện mã riêng và còn được đổi', async () => {
    const hv = await app.as('hoangvu');
    expect(await referralCodes.myReferralCode(hv)).toEqual({ code: null, editable: true });
    const w = await affiliate.myWallet(hv, PROGRAM);
    expect(w).toMatchObject({ affiliateCode: 'hv8k2', codeEditable: true, previousCode: null });
  });

  it('từ chối mã sai dạng, mã giữ cho hệ thống, mã đã có người dùng, mã trùng tên định danh người khác', async () => {
    const hv = await app.as('hoangvu');
    for (const bad of ['ab', 'có dấu', 'vu-hoang', 'vu.hoang', 'a'.repeat(21)]) await expect(referralCodes.setMyReferralCode(hv, { code: bad })).rejects.toThrow(/3 đến 20 ký tự/);
    await expect(referralCodes.setMyReferralCode(hv, { code: 'hoiminh' })).rejects.toThrow(/giữ cho hệ thống/);
    // hk3m1 là mã riêng của Hồng Kim, hv8k2 là mã riêng của chính Hoàng Vũ: mã riêng nào cũng không lấy làm mã chung được.
    await expect(referralCodes.setMyReferralCode(hv, { code: 'hk3m1' })).rejects.toThrow(/đã có người dùng/);
    await expect(referralCodes.setMyReferralCode(hv, { code: 'HV8K2' })).rejects.toThrow(/đã có người dùng/);
    // "minhquy" là tên định danh của chủ hội: người khác không lấy làm mã để mạo danh được, chính chủ thì được.
    await expect(referralCodes.setMyReferralCode(hv, { code: 'minhquy' })).rejects.toThrow(/tên định danh/);
    // Đặt không thành thì chưa mất lượt.
    expect(await referralCodes.myReferralCode(hv)).toEqual({ code: null, editable: true });
  });

  it('đặt được đúng một lần; người khác không lấy trùng được', async () => {
    const hv = await app.as('hoangvu');
    expect(await referralCodes.setMyReferralCode(hv, { code: ' VuHoang ' })).toEqual({ code: 'vuhoang', editable: false });
    expect(await referralCodes.myReferralCode(hv)).toEqual({ code: 'vuhoang', editable: false });
    await expect(referralCodes.setMyReferralCode(hv, { code: 'vuhoang2' })).rejects.toThrow(/chỉ được đổi một lần/);
    await expect(referralCodes.setMyReferralCode(await app.as('hongkim'), { code: 'vuhoang' })).rejects.toThrow(/đã có người dùng/);
    expect(await app.ctx.db.query.affiliateUserCodes.findMany({ where: eq(affiliateUserCodes.code, 'vuhoang') })).toHaveLength(1);
    // Chủ hội lấy đúng tên định danh của mình làm mã thì được.
    expect((await referralCodes.setMyReferralCode(await app.as('minhquy'), { code: 'minhquy' })).code).toBe('minhquy');
  });

  it('một mã cho mọi chương trình: ví của hội và ví nền tảng cùng hiện mã chung, link đổi theo', async () => {
    const hv = await app.as('hoangvu');
    const community = await affiliate.myWallet(hv, PROGRAM);
    expect(community).toMatchObject({ affiliateCode: 'vuhoang', codeEditable: false, previousCode: 'hv8k2' });
    expect(community.link).toBe(`${app.ctx.env.APP_URL}/${SLUG}?ref=vuhoang`);
    for (const t of community.targets) expect(t.url.endsWith('?ref=vuhoang')).toBe(true);
    const platform = await affiliate.myWallet(hv, PLATFORM);
    expect(platform.affiliateCode).toBe('vuhoang');
    expect(platform.targets.map((t) => t.url)).toEqual([`${app.ctx.env.APP_URL}/tao-hoi?ref=vuhoang`, `${app.ctx.env.APP_URL}/?ref=vuhoang`]);
    // Mã riêng của từng ví không đổi: link cũ vẫn trỏ về đúng tài khoản.
    expect((await app.ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, HV) }))?.affiliateCode).toBe('hv8k2');
    // Link affiliate trên trang bán sản phẩm và ở bảng xếp hạng cũng dùng mã chung.
    const product = (await store.listProducts(hv, KD, {})).items[0]!;
    expect((await store.getProduct(hv, product.id)).affiliateLink).toBe(`${app.ctx.env.APP_URL}/${SLUG}/cua-hang/${product.slug}?ref=vuhoang`);
    const board = await affiliate.leaderboard(hv, KD, 'month');
    expect(board.me).toMatchObject({ affiliateCode: 'vuhoang', link: `${app.ctx.env.APP_URL}/${SLUG}?ref=vuhoang` });
  });
});

describe('mã chung tính theo trang mà link được mở, luật hoa hồng không đổi', () => {
  it('đổi mã chung thành mã riêng của đúng chương trình, giữ thứ tự, bỏ mã không ai dùng', async () => {
    const hvPlatform = (await accountOf('hoangvu', PLATFORM))!.affiliateCode;
    expect(await referralCodes.canonicalRefs(app.anon(), `vuhoang.${SLUG}`)).toEqual(['hv8k2']);
    expect(await referralCodes.canonicalRefs(app.anon(), 'vuhoang._')).toEqual([hvPlatform]);
    // Trang không phải của hội nào (trang mở hội, trang đăng ký trơn) là trang nền tảng.
    expect(await referralCodes.canonicalRefs(app.anon(), 'vuhoang.tao-hoi')).toEqual([hvPlatform]);
    expect(await referralCodes.canonicalRefs(app.anon(), `khongco.${SLUG},hk3m1.${SLUG},vuhoang.${SLUG},hv8k2`)).toEqual(['hk3m1', 'hv8k2']);
    // Mã chung gõ tay (không có phạm vi): nơi gọi biết chương trình thì lấy chương trình đó, không thì tính cho nền tảng.
    expect(await referralCodes.canonicalRefs(app.anon(), 'vuhoang', { programId: PROGRAM })).toEqual(['hv8k2']);
    expect(await referralCodes.canonicalRefs(app.anon(), 'vuhoang')).toEqual([hvPlatform]);
  });

  it('mở ở trang của hội rồi đăng ký: tính cho hội, KHÔNG tính người giới thiệu nền tảng (vẫn mặc định là chủ hội)', async () => {
    const u = await newAccount(`vuhoang.${SLUG}`);
    expect(await attributed(u.id, PROGRAM)).toEqual([HV]);
    expect(await attributed(u.id, PLATFORM)).toEqual([]);
    expect((await communities.aboutPage(u.ctx, SLUG)).referrer?.name).toBe('Hoàng Vũ');
    expect((await u.join()).member.referredByAffiliateId).toBe(HV);
    const owner = await affiliate.ensureAccount(app.system(), await app.ids('user:minhquy'), PLATFORM);
    expect(await attributed(u.id, PLATFORM)).toEqual([owner.id]);
  });

  it('mở ở trang nền tảng rồi đăng ký: tính cho nền tảng, KHÔNG tính cho hội', async () => {
    const hvPlatform = (await accountOf('hoangvu', PLATFORM))!;
    const u = await newAccount('vuhoang._');
    expect(await attributed(u.id, PLATFORM)).toEqual([hvPlatform.id]);
    expect(await attributed(u.id, PROGRAM)).toEqual([]);
    // Vào hội mà chỉ mang mã chung bấm ở trang nền tảng: hội không ghi người giới thiệu, nền tảng giữ nguyên Hoàng Vũ.
    expect((await u.join('vuhoang._')).member.referredByAffiliateId).toBeNull();
    expect(await attributed(u.id, PLATFORM)).toEqual([hvPlatform.id]);
  });

  it('tài khoản đã có vào hội qua link mã chung của hội: được tính như link mã riêng', async () => {
    const u = await newAccount();
    expect((await communities.aboutPage(app.anon(), SLUG, `vuhoang.${SLUG}`)).referrer?.name).toBe('Hoàng Vũ');
    expect((await u.join(`vuhoang.${SLUG}`)).member.referredByAffiliateId).toBe(HV);
  });

  it('link và mã riêng cũ vẫn chạy sau khi đặt mã chung', async () => {
    const u = await newAccount('hv8k2');
    expect(await attributed(u.id, PROGRAM)).toEqual([HV]);
    // Mã cũ được web mới gắn thêm phạm vi cũng không sao: tài khoản đã thuộc sẵn một chương trình.
    const v = await newAccount('hv8k2._');
    expect(await attributed(v.id, PROGRAM)).toEqual([HV]);
    expect(await attributed(v.id, PLATFORM)).toEqual([]);
  });

  it('hội đổi đường dẫn: link mã chung ở đường dẫn cũ vẫn tính cho hội', async () => {
    await app.ctx.db.insert(communitySlugAliases).values({ slug: 'ten-cu-cua-hoi', communityId: KD }).onConflictDoNothing();
    const u = await newAccount('vuhoang.ten-cu-cua-hoi');
    expect(await attributed(u.id, PROGRAM)).toEqual([HV]);
  });

  it('đếm lượt bấm vào đúng ví theo trang mở link', async () => {
    const clicks = async (id: string) => (await app.ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, id) }))!.clickCount;
    const hvPlatform = (await accountOf('hoangvu', PLATFORM))!;
    const [c0, p0] = [await clicks(HV), await clicks(hvPlatform.id)];
    expect(await affiliate.recordLandingClick(app.anon(), `vuhoang.${SLUG}`, { visitorId: 'khach-ma-chung-1' })).toBe(true);
    expect([await clicks(HV), await clicks(hvPlatform.id)]).toEqual([c0 + 1, p0]);
    expect(await affiliate.recordLandingClick(app.anon(), 'vuhoang._', { visitorId: 'khach-ma-chung-2' })).toBe(true);
    expect([await clicks(HV), await clicks(hvPlatform.id)]).toEqual([c0 + 1, p0 + 1]);
    expect(await affiliate.recordLandingClick(app.anon(), `khongco.${SLUG}`, { visitorId: 'khach-ma-chung-3' })).toBe(false);
  });

  it('thành viên nhập tay mã chung ở trang Xếp hạng của hội: chọn được người đó làm người giới thiệu', async () => {
    const duy = await app.as('duy');
    const r = await affiliate.setMyReferrer(duy, KD, { code: ' VuHoang ' });
    expect(r.referrer).toMatchObject({ name: 'Hoàng Vũ', code: 'vuhoang', active: true });
    const member = await app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, KD), eq(communityMembers.userId, await app.ids('user:duy'))) });
    expect(member?.referredByAffiliateId).toBe(HV);
  });
});

describe('mã chung của người chưa mở ví', () => {
  it('thành viên của hội chưa từng lấy link: mã chung vẫn dùng được ở hội, ví tự mở', async () => {
    expect(await accountOf('member1', PROGRAM)).toBeUndefined();
    await referralCodes.setMyReferralCode(await app.as('member1'), { code: 'thanhvienmot' });
    const u = await newAccount(`thanhvienmot.${SLUG}`);
    const acc = await accountOf('member1', PROGRAM);
    expect(acc?.status).toBe('active');
    expect(await attributed(u.id, PROGRAM)).toEqual([acc!.id]);
  });

  it('người không ở trong hội: mã chung mở ở trang của hội đó không tính cho ai, không mở ví', async () => {
    const outsider = await newAccount();
    await referralCodes.setMyReferralCode(outsider.ctx, { code: 'nguoingoai' });
    const u = await newAccount(`nguoingoai.${SLUG}`);
    expect(await attributed(u.id, PROGRAM)).toEqual([]);
    expect(await app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, outsider.id), eq(affiliateAccounts.programId, PROGRAM)) })).toBeUndefined();
    // Ở trang nền tảng thì ai cũng làm affiliate được: mã chung của người này vẫn tính cho nền tảng.
    const v = await newAccount('nguoingoai._');
    const platformAcc = await app.ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, outsider.id), eq(affiliateAccounts.programId, PLATFORM)) });
    expect(await attributed(v.id, PLATFORM)).toEqual([platformAcc!.id]);
  });

  it('mã sinh tự động cho ví mới không trùng mã chung ai đó đã chọn', async () => {
    expect(await referralCodes.codeTaken(app.anon(), 'vuhoang')).toBe(true);
    expect(await referralCodes.codeTaken(app.anon(), 'hv8k2')).toBe(true);
    expect(await referralCodes.codeTaken(app.anon(), 'chuaaidung')).toBe(false);
  });
});
