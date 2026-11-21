// Lời mời vào hội: mã trên link `?invite=` được đọc lại lúc tham gia, trao đúng vai trò, dùng đúng một lần, đúng người,
// đúng hội, còn hạn; và những thứ lời mời KHÔNG được vượt qua (tiền, lệnh chặn, vai trò quản trị qua link chung).
import { and, eq } from 'drizzle-orm';
import { communities as communitiesTable, communityInvites, communityMembers, users } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { register } from '../auth/service';
import type { Ctx } from '../context';
import * as communities from '../services/communities';
import { inviteState, listInvites, revokeInvite } from '../services/invites';
import * as members from '../services/members';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let mq: Ctx;
let KD = '';
let n = 0;

beforeAll(async () => {
  app = await createTestApp();
  mq = await app.as('minhquy');
  KD = await app.ids('community:kd');
  // Hội duyệt tay và có câu hỏi bắt buộc: người thường phải trả lời và chờ duyệt, để thấy rõ lời mời bỏ qua cả hai.
  await communities.updatePlugin(mq, KD, 'instant_approval', { enabled: false, config: {} });
}, 180_000);
afterAll(async () => {
  await app.close();
});

/** Tài khoản mới, mặc định đã xác minh email. */
async function account(email: string, verified = true) {
  n += 1;
  const s = await register(app.anon(), app.auth, { name: `Khách Mời ${n}`, email, password: 'matkhau123', acceptTerms: true });
  if (verified) await app.ctx.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, s.user.id));
  const ctx: Ctx = { ...app.anon(), actor: { type: 'user', userId: s.user.id, isSuperAdmin: false, email: s.user.email } };
  return { id: s.user.id, ctx };
}
const tokenOf = (url: string) => new URL(url).searchParams.get('invite')!;
const memberOf = (userId: string) => app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, KD), eq(communityMembers.userId, userId)) });
/** Mời một email, trả mã mời trên link đã gửi. */
async function inviteEmail(email: string, role: 'member' | 'admin' = 'member') {
  const [r] = await members.invite(mq, KD, { emails: [email], role });
  return tokenOf(r!.url);
}

describe('xét lời mời (hàm thuần)', () => {
  const now = new Date('2026-11-21T10:00:00Z');
  const later = new Date('2026-12-01T10:00:00Z');
  const before = new Date('2026-11-20T10:00:00Z');
  const me = { email: 'An@Example.com', emailVerifiedAt: now };
  it('còn hạn, đúng người thì dùng được; so email không phân biệt hoa thường', () => {
    expect(inviteState({ email: 'an@example.com', expiresAt: later, acceptedAt: null }, now, me)).toBe('valid');
    expect(inviteState({ email: 'an@example.com', expiresAt: later, acceptedAt: null }, now, null)).toBe('valid');
  });
  it('không có, hết hạn, đã dùng, sai email, chưa xác minh email', () => {
    expect(inviteState(null, now, me)).toBe('not_found');
    expect(inviteState({ email: 'an@example.com', expiresAt: before, acceptedAt: null }, now, me)).toBe('expired');
    expect(inviteState({ email: 'an@example.com', expiresAt: now, acceptedAt: null }, now, me)).toBe('expired');
    expect(inviteState({ email: 'an@example.com', expiresAt: later, acceptedAt: before }, now, me)).toBe('used');
    expect(inviteState({ email: 'khac@example.com', expiresAt: later, acceptedAt: null }, now, me)).toBe('wrong_email');
    expect(inviteState({ email: 'an@example.com', expiresAt: later, acceptedAt: null }, now, { ...me, emailVerifiedAt: null })).toBe('unverified_email');
  });
  it('link mời chung không gắn email: ai cũng dùng được, dùng nhiều lần tới khi hết hạn', () => {
    expect(inviteState({ email: null, expiresAt: later, acceptedAt: null }, now, { ...me, emailVerifiedAt: null })).toBe('valid');
    expect(inviteState({ email: null, expiresAt: before, acceptedAt: null }, now, me)).toBe('expired');
  });
});

describe('mời làm thành viên', () => {
  it('không có lời mời: phải trả lời câu hỏi và chờ duyệt', async () => {
    const u = await account('thuong@example.com');
    await expect(members.joinCommunity(u.ctx, 'minhquy', {})).rejects.toThrow(/Cần trả lời/);
    const about = await communities.aboutPage(u.ctx, 'minhquy');
    expect(about.invite).toBeNull();
    const r = await members.joinCommunity(u.ctx, 'minhquy', { answers: about.joinQuestions.map((q) => ({ questionId: q.id, answer: 'Học' })) });
    expect(r.member.status).toBe('pending');
  });

  it('có lời mời: vào thẳng, không câu hỏi, không chờ duyệt, nguồn là "invite"; lời mời dùng đúng một lần', async () => {
    const token = await inviteEmail('duocmoi@example.com');
    const u = await account('duocmoi@example.com');
    // Trang giới thiệu báo lời mời dùng được, cho cả khách chưa đăng nhập lẫn đúng người được mời.
    expect((await communities.aboutPage(app.anon(), 'minhquy', null, token)).invite).toEqual({ state: 'valid', role: 'member', message: null });
    expect((await communities.aboutPage(u.ctx, 'minhquy', null, token)).invite?.state).toBe('valid');
    const before = (await app.ctx.db.query.communities.findFirst({ where: eq(communitiesTable.id, KD) }))!.memberCount;
    const r = await members.joinCommunity(u.ctx, 'minhquy', { invite: token });
    expect(r.member).toMatchObject({ status: 'active', role: 'member', source: 'invite' });
    expect((await app.ctx.db.query.communities.findFirst({ where: eq(communitiesTable.id, KD) }))!.memberCount).toBe(before + 1);
    expect((await app.ctx.db.query.communityInvites.findFirst({ where: eq(communityInvites.token, token) }))!.acceptedAt).not.toBeNull();
    // Dùng lại: báo rõ đã dùng, trang giới thiệu cũng báo vậy.
    const preview = await communities.aboutPage(app.anon(), 'minhquy', null, token);
    expect(preview.invite).toMatchObject({ state: 'used' });
    expect(preview.invite!.message).toContain('đã được dùng');
  });

  it('thành viên đang chờ duyệt nhận lời mời thì thành thành viên chính thức', async () => {
    const u = await account('dangcho@example.com');
    const about = await communities.aboutPage(u.ctx, 'minhquy');
    await members.joinCommunity(u.ctx, 'minhquy', { answers: about.joinQuestions.map((q) => ({ questionId: q.id, answer: 'Học' })) });
    expect((await memberOf(u.id))?.status).toBe('pending');
    const r = await members.joinCommunity(u.ctx, 'minhquy', { invite: await inviteEmail('dangcho@example.com') });
    expect(r.member.status).toBe('active');
  });

  it('sai người, chưa xác minh email, hết hạn, đã thu hồi, mã bịa, mã của hội khác: đều bị từ chối với lời giải thích', async () => {
    const token = await inviteEmail('dungnguoi@example.com');
    const stranger = await account('nguoila@example.com');
    await expect(members.joinCommunity(stranger.ctx, 'minhquy', { invite: token })).rejects.toThrow(/địa chỉ email khác/);
    expect((await communities.aboutPage(stranger.ctx, 'minhquy', null, token)).invite?.state).toBe('wrong_email');

    const unverified = await account('dungnguoi@example.com', false);
    await expect(members.joinCommunity(unverified.ctx, 'minhquy', { invite: token })).rejects.toThrow(/xác minh email/);
    expect(await memberOf(unverified.id)).toBeUndefined();

    await app.ctx.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, unverified.id));
    await app.ctx.db.update(communityInvites).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(communityInvites.token, token));
    await expect(members.joinCommunity(unverified.ctx, 'minhquy', { invite: token })).rejects.toThrow(/hết hạn/);
    expect((await communities.aboutPage(unverified.ctx, 'minhquy', null, token)).invite?.state).toBe('expired');

    await expect(members.joinCommunity(unverified.ctx, 'minhquy', { invite: 'ma-bia-khong-co-that-0000' })).rejects.toThrow(/không còn hiệu lực/);

    // Mã thật nhưng của hội khác thì không dùng được ở hội này.
    const vy = await app.ids('community:vy');
    const [other] = await app.ctx.db.insert(communityInvites).values({ communityId: vy, email: 'dungnguoi@example.com', token: 'ma-cua-hoi-khac-0123456789abcdef', role: 'admin', expiresAt: new Date(Date.now() + 86_400_000) }).returning();
    await expect(members.joinCommunity(unverified.ctx, 'minhquy', { invite: other!.token })).rejects.toThrow(/không còn hiệu lực/);
    expect(await memberOf(unverified.id)).toBeUndefined();
  });

  it('hội đóng cổng: người được mời vẫn vào được, người khác thì không', async () => {
    await app.ctx.db.update(communitiesTable).set({ doorsOpen: false }).where(eq(communitiesTable.id, KD));
    try {
      const token = await inviteEmail('dongcong@example.com');
      const outsider = await account('ngoai@example.com');
      await expect(members.joinCommunity(outsider.ctx, 'minhquy', {})).rejects.toThrow(/đóng cổng/);
      const u = await account('dongcong@example.com');
      expect((await members.joinCommunity(u.ctx, 'minhquy', { invite: token })).member.status).toBe('active');
    } finally {
      await app.ctx.db.update(communitiesTable).set({ doorsOpen: true }).where(eq(communitiesTable.id, KD));
    }
  });

  it('người đã bị chặn không vào lại được bằng lời mời', async () => {
    const u = await account('bichan@example.com');
    await members.joinCommunity(u.ctx, 'minhquy', { invite: await inviteEmail('bichan@example.com') });
    await members.memberAction(mq, KD, (await memberOf(u.id))!.id, 'ban');
    await expect(members.joinCommunity(u.ctx, 'minhquy', { invite: await inviteEmail('bichan@example.com') })).rejects.toThrow(/bị chặn/);
  });
});

describe('mời làm quản trị viên', () => {
  it('người được mời vào hội với vai trò quản trị viên và có quyền quản trị thật', async () => {
    const token = await inviteEmail('quantri@example.com', 'admin');
    expect((await communities.aboutPage(app.anon(), 'minhquy', null, token)).invite).toMatchObject({ state: 'valid', role: 'admin' });
    const u = await account('quantri@example.com');
    const r = await members.joinCommunity(u.ctx, 'minhquy', { invite: token });
    expect(r.member).toMatchObject({ status: 'active', role: 'admin' });
    // Quyền thật: quản trị viên mới xem được danh sách lời mời đang chờ.
    expect((await listInvites(u.ctx, KD)).items).toBeDefined();
  });

  it('thành viên sẵn có nhận lời mời thì được nâng lên quản trị viên; lời mời thành viên không hạ được quản trị viên', async () => {
    const u = await account('nangcap@example.com');
    await members.joinCommunity(u.ctx, 'minhquy', { invite: await inviteEmail('nangcap@example.com') });
    expect((await memberOf(u.id))?.role).toBe('member');
    const r = await members.joinCommunity(u.ctx, 'minhquy', { invite: await inviteEmail('nangcap@example.com', 'admin') });
    expect(r).toMatchObject({ alreadyMember: true, member: { role: 'admin' } });
    const again = await members.joinCommunity(u.ctx, 'minhquy', { invite: await inviteEmail('nangcap@example.com', 'member') });
    expect(again.member.role).toBe('admin');
    // Chủ hội mở link mời quản trị của chính mình cũng không đổi gì.
    const own = await members.joinCommunity(mq, 'minhquy', { invite: await inviteEmail('minhquy@gmail.com', 'admin') });
    expect(own.member.role).toBe('owner');
  });

  it('không tạo được link mời chung mang quyền quản trị: mời quản trị phải kèm email', async () => {
    await expect(members.invite(mq, KD, { role: 'admin' })).rejects.toThrow(/kèm email/);
    await expect(members.invite(mq, KD, { role: 'admin', emails: [] })).rejects.toThrow(/kèm email/);
  });

  it('link mời chung (không gắn email): nhiều người dùng được, chỉ trao vai trò thành viên', async () => {
    const [link] = await members.invite(mq, KD, {});
    const token = tokenOf(link!.url);
    for (const email of ['chung1@example.com', 'chung2@example.com']) {
      const u = await account(email, false);
      expect((await members.joinCommunity(u.ctx, 'minhquy', { invite: token })).member).toMatchObject({ status: 'active', role: 'member' });
    }
  });
});

describe('hội thu phí', () => {
  it('mời làm thành viên không thay cho tiền; mời làm quản trị viên thì vào không cần thanh toán', async () => {
    const before = (await app.ctx.db.query.communities.findFirst({ where: eq(communitiesTable.id, KD) }))!.pricingMode;
    await app.ctx.db.update(communitiesTable).set({ pricingMode: 'subscription' }).where(eq(communitiesTable.id, KD));
    try {
      const member = await account('traphi@example.com');
      const memberToken = await inviteEmail('traphi@example.com');
      await expect(members.joinCommunity(member.ctx, 'minhquy', { invite: memberToken })).rejects.toThrow(/cần thanh toán/);
      expect(await memberOf(member.id)).toBeUndefined();
      // Lời mời chưa bị tiêu: người đó thanh toán xong vẫn là người được mời.
      expect((await app.ctx.db.query.communityInvites.findFirst({ where: eq(communityInvites.token, memberToken) }))!.acceptedAt).toBeNull();

      const admin = await account('quantri-traphi@example.com');
      const r = await members.joinCommunity(admin.ctx, 'minhquy', { invite: await inviteEmail('quantri-traphi@example.com', 'admin') });
      expect(r.member).toMatchObject({ status: 'active', role: 'admin' });
    } finally {
      await app.ctx.db.update(communitiesTable).set({ pricingMode: before }).where(eq(communitiesTable.id, KD));
    }
  });
});

describe('danh sách và thu hồi', () => {
  it('chủ hội thấy lời mời đang chờ kèm link, thu hồi thì link ngừng dùng được; thành viên thường không xem được', async () => {
    const token = await inviteEmail('thuhoi@example.com', 'admin');
    const list = await listInvites(mq, KD);
    const mine = list.items.find((i) => i.email === 'thuhoi@example.com')!;
    expect(mine).toMatchObject({ role: 'admin', expired: false, invitedBy: 'Minh Quý' });
    expect(tokenOf(mine.url)).toBe(token);
    // Lời mời đã nhận không còn nằm trong danh sách đang chờ.
    expect(list.items.some((i) => i.email === 'duocmoi@example.com')).toBe(false);

    await expect(listInvites(await app.as('duy'), KD)).rejects.toThrow();
    await expect(revokeInvite(await app.as('duy'), KD, mine.id)).rejects.toThrow();
    await expect(revokeInvite(mq, await app.ids('community:vy'), mine.id)).rejects.toThrow();

    await revokeInvite(mq, KD, mine.id);
    expect((await listInvites(mq, KD)).items.some((i) => i.id === mine.id)).toBe(false);
    const u = await account('thuhoi@example.com');
    await expect(members.joinCommunity(u.ctx, 'minhquy', { invite: token })).rejects.toThrow(/không còn hiệu lực/);
    await expect(revokeInvite(mq, KD, mine.id)).rejects.toThrow(/Không tìm thấy/);
  });
});
