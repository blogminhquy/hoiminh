// Mua trước, tạo tài khoản sau (chủ dự án yêu cầu ngày 27/11/2026): khách chưa có tài khoản trả tiền bằng email, trả xong
// thì tạo tài khoản ngay trên màn thanh toán hoặc bằng link trong email, chưa làm thì được nhắc sau 1, 3, 7 ngày.
// Kiểm cả đường chặn chiếm quyền: email đã có tài khoản phải đăng nhập, mua lại bằng email đã có đơn trả tiền thì chỉ tạo
// tài khoản được bằng link trong email.
import { accountClaims, communities, communityMembers, orders, userCredentials, users } from '@hoiminh/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { remindPendingAccounts } from '../auth/claims';
import * as authSvc from '../auth/service';
import type { Ctx } from '../context';
import * as guest from '../services/guest-checkout';
import { createTestApp, ownerBankPaid, type TestApp } from './setup';

let app: TestApp;
let KD = '', KD_SLUG = '';

beforeAll(async () => {
  app = await createTestApp();
  KD = await app.ids('community:kd');
  KD_SLUG = (await app.ctx.db.query.communities.findFirst({ where: eq(communities.id, KD), columns: { slug: true } }))!.slug;
}, 180_000);
afterAll(async () => {
  await app.close();
});

// Hàm chứ không phải hằng: KD chỉ có giá trị sau beforeAll.
const premium = () => ({ type: 'tier' as const, communityId: KD, tierKey: 'premium' as const, cycle: 'monthly' as const });
const buy = (email: string, name = 'Lan Anh') => guest.guestCheckout(app.anon(), { target: premium(), provider: 'sepay', email, name });
const mails = (to: string, template: string) => app.emails.filter((m) => m.to === to && m.template === template);
const userOf = async (email: string) => (await app.ctx.db.query.users.findFirst({ where: eq(users.email, email) }))!;
const claimOf = async (userId: string) => app.ctx.db.query.accountClaims.findFirst({ where: eq(accountClaims.userId, userId) });
const later = (days: number): Ctx => ({ ...app.system(), now: () => new Date(Date.now() + days * 86_400_000) });
const tokenIn = (html: string) => /\/tao-tai-khoan\?token=([0-9a-f.-]+)/.exec(html)?.[1] ?? '';

async function expectCode(p: Promise<unknown>, code: string): Promise<{ message: string; details?: Record<string, unknown> }> {
  const err = await p.then(() => null, (e: unknown) => e as { code?: string; message: string; details?: Record<string, unknown> });
  expect(err?.code).toBe(code);
  return err!;
}

describe('khách mua khi chưa có tài khoản', () => {
  const EMAIL = 'lananh.khach@example.com';
  let orderId = '', token = '';

  it('mua bằng email: tạo tài khoản chờ chưa có mật khẩu, trả mã đơn cho trình duyệt', async () => {
    const s = await buy(EMAIL);
    orderId = s.orderId;
    token = s.guestToken!;
    expect(token).toMatch(/^[0-9a-f]{40}$/);
    expect(s.amountMinor).toBe(249_000);
    expect(s.instruction).toMatchObject({ kind: 'bank_qr', payee: 'owner' });
    const user = await userOf(EMAIL);
    expect(user.name).toBe('Lan Anh');
    expect(await app.ctx.db.query.userCredentials.findFirst({ where: eq(userCredentials.userId, user.id) })).toBeUndefined();
    expect(await claimOf(user.id)).toMatchObject({ orderId, communityId: KD, claimedAt: null, lastEmailedAt: null });
    const o = await guest.guestOrderStatus(app.anon(), orderId, token);
    expect(o).toMatchObject({ status: 'pending', account: { email: EMAIL, hasAccount: false, canCreateHere: true } });
    // Mã sai thì như đơn không tồn tại.
    await expectCode(guest.guestOrderStatus(app.anon(), orderId, '0'.repeat(40)), 'not_found');
    // Chưa trả tiền thì chưa gửi email nào cho khách.
    expect(app.emails.filter((m) => m.to === EMAIL)).toHaveLength(0);
  });

  it('báo đã chuyển khoản bằng mã đơn', async () => {
    expect(await guest.guestMarkProcessing(app.anon(), orderId, token)).toMatchObject({ status: 'pending', paymentStatus: 'processing' });
  });

  it('tiền về: mở quyền như đơn thường, email báo đã nhận tiền kèm link tạo tài khoản thay cho email thường', async () => {
    const o = await app.ctx.db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    expect((await ownerBankPaid(app, o!.reference, 249_000)).result).toBe('processed');
    const user = await userOf(EMAIL);
    const member = await app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, KD), eq(communityMembers.userId, user.id)) });
    expect(member?.status).toBe('active');
    const sent = mails(EMAIL, 'account_claim');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain('Đã nhận thanh toán');
    expect(sent[0]!.html).toContain('249.000đ');
    expect(sent[0]!.html).toContain(o!.reference);
    expect(tokenIn(sent[0]!.html)).toBe(`${user.id}.${tokenIn(sent[0]!.html).split('.')[1]}`);
    // Không gửi email "Vào học ngay" hay "Chào mừng": link trong đó chưa vào được khi chưa có mật khẩu.
    expect(mails(EMAIL, 'payment_succeeded')).toHaveLength(0);
    expect(mails(EMAIL, 'welcome_member')).toHaveLength(0);
    expect((await claimOf(user.id))?.lastEmailedAt).not.toBeNull();
    expect(await guest.guestOrderStatus(app.anon(), orderId, token)).toMatchObject({ status: 'paid', nextUrl: `/${KD_SLUG}/khoa-hoc`, account: { canCreateHere: true } });
  });

  it('chưa tạo tài khoản: đăng nhập báo rõ, quên mật khẩu và đăng ký trùng email gửi lại link tạo tài khoản', async () => {
    const login = await expectCode(authSvc.login(app.anon(), app.auth, { email: EMAIL, password: 'matkhau123', remember: true }), 'unauthorized');
    expect(login.message).toContain('chưa tạo mật khẩu');
    await authSvc.forgotPassword(app.anon(), EMAIL);
    expect(mails(EMAIL, 'reset_password')).toHaveLength(0);
    expect(mails(EMAIL, 'account_claim')).toHaveLength(2);
    const reg = await expectCode(authSvc.register(app.anon(), app.auth, { name: 'Lan Anh', email: EMAIL, password: 'matkhau123', acceptTerms: true }), 'conflict');
    expect(reg.details).toMatchObject({ reason: 'claim_email_sent' });
    expect(mails(EMAIL, 'account_claim')).toHaveLength(3);
    // Khách tự xin lại link thì không tính là một lần nhắc.
    expect((await claimOf((await userOf(EMAIL)).id))?.remindersSent).toBe(0);
  });

  it('nhắc tạo tài khoản sau 1, 3, 7 ngày rồi thôi; mỗi mốc chỉ một email', async () => {
    const userId = (await userOf(EMAIL)).id;
    const before = mails(EMAIL, 'account_claim').length;
    expect(await remindPendingAccounts(later(0.2))).toBe(0);
    expect(await remindPendingAccounts(later(1))).toBe(1);
    expect(await remindPendingAccounts(later(1))).toBe(0);
    expect(mails(EMAIL, 'account_claim')).toHaveLength(before + 1);
    expect(mails(EMAIL, 'account_claim').at(-1)!.subject).toContain('tạo tài khoản để bắt đầu');
    // Mốc tính từ email gần nhất: lần 2 sau thêm 2 ngày (ngày thứ 3), lần 3 sau thêm 4 ngày (ngày thứ 7).
    await app.ctx.db.update(accountClaims).set({ lastEmailedAt: new Date(Date.now() - 2 * 86_400_000) }).where(eq(accountClaims.userId, userId));
    expect(await remindPendingAccounts(later(0))).toBe(1);
    await app.ctx.db.update(accountClaims).set({ lastEmailedAt: new Date(Date.now() - 4 * 86_400_000) }).where(eq(accountClaims.userId, userId));
    expect(await remindPendingAccounts(later(0))).toBe(1);
    expect(await remindPendingAccounts(later(30))).toBe(0);
    expect((await claimOf(userId))?.remindersSent).toBe(3);
  });

  it('tạo tài khoản ngay trên màn thanh toán bằng mã đơn: đăng nhập luôn, vào đúng hội, email chưa xác minh thì gửi mã', async () => {
    const info = await guest.claimInfo(app.anon(), { orderId, orderToken: token });
    expect(info).toMatchObject({ email: EMAIL, claimed: false, paid: true, item: expect.stringContaining('Premium') });
    const r = await guest.claimAccount(app.anon(), app.auth, { orderId, orderToken: token, name: 'Nguyễn Lan Anh', password: 'matkhau123' });
    expect(r.redirect).toBe(`/${KD_SLUG}/khoa-hoc`);
    expect(r.session.user).toMatchObject({ email: EMAIL, name: 'Nguyễn Lan Anh', emailVerifiedAt: null });
    expect(mails(EMAIL, 'verify_code')).toHaveLength(1);
    expect((await claimOf(r.session.user.id))?.claimedAt).not.toBeNull();
    // Từ giờ là tài khoản thường: đăng nhập bằng mật khẩu vừa đặt, không nhắc nữa, không tạo lại được.
    expect(await authSvc.login(app.anon(), app.auth, { email: EMAIL, password: 'matkhau123', remember: true })).toHaveProperty('accessToken');
    expect(await remindPendingAccounts(later(60))).toBe(0);
    const again = await expectCode(guest.claimAccount(app.anon(), app.auth, { orderId, orderToken: token, password: 'matkhau456' }), 'conflict');
    expect(again.details).toMatchObject({ reason: 'already_claimed' });
    // Mua tiếp khi chưa đăng nhập bằng email đã có tài khoản thật: phải đăng nhập.
    const exists = await expectCode(buy(EMAIL), 'conflict');
    expect(exists.details).toMatchObject({ reason: 'account_exists' });
  });
});

describe('chặn chiếm quyền', () => {
  it('email của tài khoản có sẵn không mua dạng khách được; gói Hội Mình cần đăng nhập', async () => {
    expect((await expectCode(buy('an.nguyen@example.com'), 'conflict')).details).toMatchObject({ reason: 'account_exists' });
    await expectCode(guest.guestCheckout(app.anon(), { target: { type: 'platform', communityId: KD, planKey: 'starter', cycle: 'monthly' }, email: 'x.khach@example.com', name: 'Khách X' }), 'validation_error');
  });

  it('người khác gõ email của người đã trả tiền để mua: trình duyệt của họ không tạo được tài khoản, chỉ link trong email tạo được', async () => {
    const EMAIL = 'thanh.mua.truoc@example.com';
    const first = await buy(EMAIL, 'Thanh');
    expect((await ownerBankPaid(app, first.reference, 249_000)).result).toBe('processed');
    const other = await buy(EMAIL, 'Người lạ');
    const st = await guest.guestOrderStatus(app.anon(), other.orderId, other.guestToken!);
    expect(st.account).toMatchObject({ hasAccount: false, canCreateHere: false });
    await expectCode(guest.claimAccount(app.anon(), app.auth, { orderId: other.orderId, orderToken: other.guestToken!, password: 'matkhau123' }), 'forbidden');
    // Mã đơn không mở được link tạo tài khoản, và chữ ký sai thì không dùng được.
    const user = await userOf(EMAIL);
    await expectCode(guest.claimInfo(app.anon(), { token: `${user.id}.${'0'.repeat(40)}` }), 'validation_error');
    // Chủ hộp thư bấm link trong email: tạo được, email coi như đã xác minh nên không gửi mã 6 số.
    const link = tokenIn(mails(EMAIL, 'account_claim')[0]!.html);
    const r = await guest.claimAccount(app.anon(), app.auth, { token: link, password: 'matkhau123' });
    expect(r.session.user.emailVerifiedAt).not.toBeNull();
    expect(r.session.user.name).toBe('Thanh');
    expect(mails(EMAIL, 'verify_code')).toHaveLength(0);
  });

  it('bỏ dở lúc thanh toán (chưa trả đồng nào): đăng ký bình thường được bằng email đó', async () => {
    const EMAIL = 'bo.do@example.com';
    await buy(EMAIL, 'Bỏ Dở');
    const session = await authSvc.register(app.anon(), app.auth, { name: 'Minh Bỏ Dở', email: EMAIL, password: 'matkhau123', acceptTerms: true });
    expect(session.user).toMatchObject({ email: EMAIL, name: 'Minh Bỏ Dở' });
    expect((await claimOf(session.user.id))?.claimedAt).not.toBeNull();
    expect(await authSvc.login(app.anon(), app.auth, { email: EMAIL, password: 'matkhau123', remember: true })).toHaveProperty('accessToken');
  });

  it('mua lại sau lần bỏ dở: trình duyệt mua lần này được tạo tài khoản', async () => {
    const EMAIL = 'mua.lai@example.com';
    const first = await buy(EMAIL, 'Mua Lại');
    const second = await buy(EMAIL, 'Mua Lại');
    expect((await guest.guestOrderStatus(app.anon(), first.orderId, first.guestToken!)).account.canCreateHere).toBe(false);
    expect((await guest.guestOrderStatus(app.anon(), second.orderId, second.guestToken!)).account.canCreateHere).toBe(true);
  });
});
