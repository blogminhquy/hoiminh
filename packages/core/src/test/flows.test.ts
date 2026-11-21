// Kiểm tra các luồng nghiệp vụ chính ở tầng service (mục 6 của prompt), chạy trên PGlite với dữ liệu seed.
import { and, eq, like } from 'drizzle-orm';
import { affiliateCommissions, communities as communitiesTable, communityMembers, communityPlugins, entitlements, messages as messagesTable, orders, payments } from '@hoiminh/db';
import { normalizeWelcomeTemplate } from '@hoiminh/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { register, login, verifyEmail, forgotPassword, resetPassword, verifyTwoFactor } from '../auth/service';
import * as totp from '../auth/totp';
import { requireCommunityPermission } from '../permissions';
import * as affiliate from '../services/affiliate';
import * as checkout from '../services/checkout';
import * as communities from '../services/communities';
import * as courses from '../services/courses';
import * as entitlementSvc from '../services/entitlements';
import * as events from '../services/events';
import * as members from '../services/members';
import * as messaging from '../services/messaging';
import * as notifications from '../services/notifications';
import * as paymentsSvc from '../services/payments';
import * as posts from '../services/posts';
import * as withdrawals from '../services/withdrawals';
import * as admin from '../services/admin';
import { createTestApp, ownerBankPaid, type TestApp } from './setup';

let app: TestApp;
const KD = 'community:kd';

beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

/** Chủ hội Thảo Vy (hội gói Miễn phí), dùng cho các bài mua gói Hội Mình. */
async function vyOwner() {
  return { ...app.system(), actor: { type: 'user' as const, userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' } };
}

/** Đăng nhập và khẳng định tài khoản không bật hai lớp (đa số test dùng dạng này). */
async function loginOk(...args: Parameters<typeof login>) {
  const s = await login(...args);
  if ('twoFactorRequired' in s) throw new Error('Không mong đợi bước xác thực hai lớp');
  return s;
}

/** Giả lập SePay báo có cho một đơn: gửi webhook đã ký với đúng nội dung và số tiền. */
async function sepayPaid(reference: string, amount: number, content = reference) {
  const body = { id: Math.floor(Math.random() * 1e9), gateway: 'Vietcombank', transactionDate: '2026-09-14 09:03:11', accountNumber: '0071000123456', code: null, content: `NGUYEN VAN A ck ${content}`, transferType: 'in', transferAmount: amount, accumulated: 0, subAccount: null, referenceCode: `MBVCB.${Date.now()}`, description: '' };
  return paymentsSvc.handleWebhook(app.system(), 'sepay', { headers: { authorization: `Apikey ${app.ctx.env.SEPAY_API_KEY}` }, rawBody: JSON.stringify(body), query: {} });
}

describe('Luồng 1: đăng ký → xác minh → tham gia hội miễn phí → tin nhắn chào', () => {
  let userId = '';
  it('đăng ký với mã affiliate, nhận mã xác minh 6 số', async () => {
    const s = await register(app.anon(), app.auth, { name: 'Người Mới', email: 'nguoimoi@example.com', password: 'matkhau123', ref: 'hv8k2', communitySlug: 'minhquy', acceptTerms: true });
    userId = s.user.id;
    expect(s.accessToken).toBeTruthy();
    expect(app.emails.some((e) => e.template === 'verify_code' && e.to === 'nguoimoi@example.com')).toBe(true);
    const ctx = { ...app.anon(), actor: { type: 'user' as const, userId, isSuperAdmin: false, email: 'nguoimoi@example.com' } };
    const u = await verifyEmail(ctx, userId, '482913');
    expect(u.emailVerifiedAt).toBeTruthy();
    await expect(verifyEmail(ctx, userId, '000000')).rejects.toThrow();
  });
  it('đăng nhập sai mật khẩu bị từ chối, đúng thì có phiên', async () => {
    await expect(login(app.anon(), app.auth, { email: 'nguoimoi@example.com', password: 'sai', remember: true })).rejects.toThrow();
    const s = await loginOk(app.anon(), app.auth, { email: 'nguoimoi@example.com', password: 'matkhau123', remember: true });
    expect(s.user.handle).toBe('nguoi-moi');
  });
  it('tham gia Freemium → thành viên Tiêu chuẩn, có tin nhắn chào sau khi cron chạy', async () => {
    const ctx = { ...app.anon(), actor: { type: 'user' as const, userId, isSuperAdmin: false, email: 'nguoimoi@example.com' } };
    await expect(members.joinCommunity(ctx, 'minhquy', { ref: 'hv8k2' })).rejects.toThrow(/Cần trả lời/);
    const about = await communities.aboutPage(ctx, 'minhquy', 'hv8k2');
    expect(about.referrer?.name).toBe('Hoàng Vũ');
    const r = await members.joinCommunity(ctx, 'minhquy', { ref: 'hv8k2', answers: about.joinQuestions.map((q) => ({ questionId: q.id, answer: 'Bán phụ kiện' })) });
    expect(r.member.status).toBe('active');
    expect(r.member.referredByAffiliateId).toBe(await app.ids('affiliate:kd:hoangvu'));
    // Job chào được hẹn sau 2 phút bằng delay của Queue (không chờ cron); cho chạy ngay thay vì chờ đồng hồ thật.
    expect(app.queue.delayed.some((d) => d.job.name === 'scheduled.run' && d.job.dedupeKey?.startsWith('welcome_dm:') && Math.abs(d.delaySeconds - 120) <= 5)).toBe(true);
    expect(app.queue.releaseDelayed()).toBeGreaterThanOrEqual(1);
    await app.queue.drain();
    const convos = await messaging.listConversations(ctx, {});
    expect(convos.items.some((c) => c.automated)).toBe(true);
    const msgs = await messaging.listMessages(ctx, convos.items[0]!.id, {});
    expect(msgs.items[0]!.body).toContain('Chào Người Mới, chào mừng bạn đến với ');
    expect(msgs.items[0]!.body).not.toContain('{{');
    expect(msgs.items[0]!.automated).toBe(true);
  });
  it('mẫu tin nhắn chào: biến tên tiếng Anh, mẫu cũ dùng tên tiếng Việt vẫn chạy và được đổi sang tên mới', async () => {
    expect(normalizeWelcomeTemplate('Chào {{tên}} và {{ Cộng  đồng }}: {{link bắt đầu}} {{ Full_Name }} {{ first_name }} {{khác}}')).toBe('Chào {{full_name}} và {{community_name}}: {{start_link}} {{full_name}} {{first_name}} {{khác}}');
    expect(normalizeWelcomeTemplate('{{te\u0302n}}')).toBe('{{full_name}}');
    const kd = await app.ids(KD);
    const owner = { ...app.system(), actor: { type: 'user' as const, userId: await app.ids('user:minhquy'), isSuperAdmin: false, email: 'owner@example.com' } };
    const where = and(eq(communityPlugins.communityId, kd), eq(communityPlugins.pluginKey, 'welcome_dm'));
    // Mẫu lưu từ trước khi đổi tên biến: đọc ra đã là tên mới.
    const before = (await app.ctx.db.query.communityPlugins.findFirst({ where }))!;
    await app.ctx.db.update(communityPlugins).set({ config: { ...before.config, template: 'Chào {{tên}} đến {{cộng đồng}}, xem {{link bắt đầu}}' } }).where(where);
    const listed = (await communities.listPlugins(owner, kd)).find((p) => p.pluginKey === 'welcome_dm')!;
    expect((listed.config as { template: string }).template).toBe('Chào {{full_name}} đến {{community_name}}, xem {{start_link}}');
    // Gửi bằng mẫu cũ vẫn thay đủ ba biến.
    expect(await messaging.sendWelcomeDm(app.system(), kd, await app.ids('user:thaovy'))).toBe(true);
    const sent = await app.ctx.db.query.messages.findFirst({ where: like(messagesTable.body, 'Chào % đến %, xem %') });
    expect(sent!.body).toMatch(/^Chào Trần Thảo Vy đến .+, xem https?:\/\/\S+\/bang-tin$/);
    // Lưu bằng tên cũ thì database nhận tên mới.
    const saved = await communities.updatePlugin(owner, kd, 'welcome_dm', { enabled: true, config: { template: 'Xin chào {{tên}}' } });
    expect((saved.config as { template: string }).template).toBe('Xin chào {{full_name}}');
  });
  it('quên mật khẩu → token → đặt lại → đăng nhập bằng mật khẩu mới', async () => {
    const { token } = await forgotPassword(app.anon(), 'nguoimoi@example.com');
    expect(token).toBeTruthy();
    await resetPassword(app.anon(), app.auth, token!, 'matkhaumoi456', true);
    const s = await loginOk(app.anon(), app.auth, { email: 'nguoimoi@example.com', password: 'matkhaumoi456', remember: true });
    expect(s.user.id).toBe(userId);
  });
});

describe('Luồng 2: nâng cấp Premium qua SePay, idempotent, mở khóa khóa học', () => {
  it('thành viên Tiêu chuẩn bị khóa bài Premium, sau khi webhook báo có thì mở', async () => {
    const kien = await app.as('kienbui');
    const kd = await app.ids(KD);
    const fmm = await app.ids('course:fmm');
    const before = await entitlementSvc.canAccessCourse(kien, kien.actor.type === 'user' ? kien.actor.userId : '', fmm);
    expect(before.allowed).toBe(false);
    const session = await checkout.createCheckout(kien, { target: { type: 'tier', communityId: kd, tierKey: 'premium', cycle: 'monthly' }, provider: 'sepay' });
    expect(session.instruction.kind).toBe('bank_qr');
    expect(session.amountMinor).toBe(249_000);
    expect(session.referredBy).toBe('Hoàng Vũ');
    // Tiền của đơn này về thẳng tài khoản của chủ hội, không phải tài khoản Hội Mình.
    expect(session.instruction).toMatchObject({ payee: 'owner', accountNumber: '0071000999888', accountHolder: 'NGUYEN MINH QUY', transferContent: session.reference });
    // Chuyển nhầm vào tài khoản Hội Mình với đúng mã đơn: không được tính là đã trả cho chủ hội.
    expect((await sepayPaid(session.reference, 249_000)).result).toBe('unmatched');
    expect((await app.ctx.db.query.orders.findFirst({ where: eq(orders.id, session.orderId) }))?.status).toBe('pending');
    // Thiếu tiền thì chưa xác nhận; đủ tiền thì xác nhận; báo có lần hai cho đơn đã trả thì bỏ qua.
    expect((await ownerBankPaid(app, session.reference, 200_000)).result).toBe('unmatched');
    const r1 = await ownerBankPaid(app, session.reference, 249_000);
    expect(r1.result).toBe('processed');
    const r2 = await ownerBankPaid(app, session.reference, 249_000);
    expect(r2.result).toBe('ignored');
    const order = await app.ctx.db.query.orders.findFirst({ where: eq(orders.id, session.orderId) });
    expect(order?.status).toBe('paid');
    const after = await entitlementSvc.canAccessCourse(kien, kien.actor.type === 'user' ? kien.actor.userId : '', fmm);
    expect(after.allowed).toBe(true);
    const m = await app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, kd), eq(communityMembers.userId, await app.ids('user:kienbui'))) });
    expect(m?.lifetimeValueCents).toBe(1_000_000 + 249_000);
    expect(app.emails.some((e) => e.template === 'payment_succeeded' && e.to === 'kienbui@gmail.com')).toBe(true);
    const comm = await app.ctx.db.query.affiliateCommissions.findFirst({ where: eq(affiliateCommissions.orderId, session.orderId) });
    expect(comm?.status).toBe('pending');
    expect(comm?.amountMinor).toBe(124_500);
  });
  it('webhook cùng provider_event_id lần hai bị bỏ qua (idempotent)', async () => {
    const body = { id: 424242, gateway: 'Vietcombank', transactionDate: '2026-09-14 10:00:00', accountNumber: '0071000123456', code: null, content: 'khong co ma', transferType: 'in', transferAmount: 1000, accumulated: 0, subAccount: null, referenceCode: 'X', description: '' };
    const req = { headers: { authorization: `Apikey ${app.ctx.env.SEPAY_API_KEY}` }, rawBody: JSON.stringify(body), query: {} };
    const a = await paymentsSvc.handleWebhook(app.system(), 'sepay', req);
    const b = await paymentsSvc.handleWebhook(app.system(), 'sepay', req);
    expect(a.result).toBe('unmatched');
    expect(b.result).toBe('duplicate');
    const bad = await paymentsSvc.handleWebhook(app.system(), 'sepay', { ...req, headers: { authorization: 'Apikey sai' } });
    expect(bad.result).toBe('invalid_signature');
  });
});

describe('Luồng 3: mua lẻ trong Cửa hàng bằng chuyển khoản tới chủ hội và hoàn tiền trong 7 ngày', () => {
  it('mua khóa AI Agent, ngân hàng của chủ hội báo có, rồi hoàn tiền khi xem < 20%', async () => {
    const duy = await app.as('duy');
    const productId = await app.ids('product:aiagent');
    // Cổng của Hội Mình (MoMo, VNPAY, PayPal) không dùng cho đơn của hội: tiền qua đó về tài khoản Hội Mình. Hội chỉ
    // cài chuyển khoản thì người mua chỉ chọn được chuyển khoản.
    await expect(checkout.createCheckout(duy, { target: { type: 'product', productId }, provider: 'momo' })).rejects.toThrow(/chưa nhận thanh toán qua MoMo.*Chuyển khoản QR/);
    const session = await checkout.createCheckout(duy, { target: { type: 'product', productId }, provider: 'sepay' });
    expect(session.instruction).toMatchObject({ kind: 'bank_qr', payee: 'owner' });
    const r = await ownerBankPaid(app, session.reference, session.amountMinor);
    expect(r.result).toBe('processed');
    const owned = await entitlementSvc.ownsProduct(duy, await app.ids('user:duy'), productId);
    expect(owned).toBe(true);
    await expect(checkout.createCheckout(duy, { target: { type: 'product', productId }, provider: 'sepay' })).rejects.toThrow(/đã sở hữu/);
    const refund = await paymentsSvc.requestRefund(duy, session.orderId, 'Không hợp');
    expect(refund.alreadyRefunded).toBe(false);
    const after = await entitlementSvc.ownsProduct(duy, await app.ids('user:duy'), productId);
    expect(after).toBe(false);
    const pay = await app.ctx.db.query.payments.findFirst({ where: eq(payments.orderId, session.orderId) });
    expect(pay?.status).toBe('refunded');
  });
});

describe('Luồng 4: affiliate · hold → available → rút ≥ 500k → xem xét → trả / từ chối', () => {
  it('cron giải phóng hoa hồng quá hạn giữ và ghi credit vào ví', async () => {
    const { sql } = await import('drizzle-orm');
    await app.ctx.db.execute(sql`update affiliate_commissions set available_at = now() - interval '1 day' where status = 'pending'`);
    const n = await affiliate.releaseDueCommissions(app.system());
    expect(n).toBeGreaterThan(0);
    const hv = await app.as('hoangvu');
    const wallet = await affiliate.myWallet(hv, await app.ids('program:kd'));
    expect(wallet.pendingMinor).toBe(0);
    expect(wallet.availableMinor).toBeGreaterThanOrEqual(500_000);
    expect(app.emails.some((e) => e.template === 'commission_available')).toBe(true);
  });
  it('yêu cầu rút: dưới min bị từ chối, đủ thì hold; hai yêu cầu liên tiếp không tiêu cùng một khoản', async () => {
    const hv = await app.as('hoangvu');
    const programId = await app.ids('program:kd');
    await expect(withdrawals.requestWithdrawal(hv, programId, 100_000)).rejects.toThrow(/tối thiểu/);
    const w = await affiliate.myWallet(hv, programId);
    // Chủ hội đăng ký webhook để trợ lý biết ngay khi có yêu cầu rút cần xử lý.
    const { createWebhook } = await import('../services/webhooks-out');
    const { webhookDeliveries } = await import('@hoiminh/db');
    const hook = await createWebhook(await app.as('minhquy'), await app.ids('workspace:minhquy'), { url: 'https://example.com/rut', events: ['affiliate.withdrawal_requested'] });
    const wd = await withdrawals.requestWithdrawal(hv, programId, w.availableMinor);
    expect(wd.status).toBe('requested');
    const sent = await app.ctx.db.query.webhookDeliveries.findMany({ where: eq(webhookDeliveries.webhookId, hook.id) });
    expect(sent.map((d) => d.eventName)).toEqual(['affiliate.withdrawal_requested']);
    expect(sent[0]!.payload).toMatchObject({ withdrawalId: wd.id, amountMinor: w.availableMinor, communityId: await app.ids(KD) });
    await expect(withdrawals.requestWithdrawal(hv, programId, 500_000)).rejects.toThrow();
    const mq = await app.as('minhquy');
    const review = await withdrawals.reviewWithdrawal(mq, wd.id);
    expect(review.payout.accountNumber).toBe('0071008812345');
    expect(review.qrImageUrl).toContain('vietqr');
    expect(review.withdrawal.status).toBe('reviewing');
    const paid = await withdrawals.markPaid(mq, wd.id, 'FT26091499999', review.withdrawal.version);
    expect(paid.status).toBe('paid');
    await expect(withdrawals.markPaid(mq, wd.id, 'FT2', review.withdrawal.version)).rejects.toThrow();
    const after = await affiliate.myWallet(hv, programId);
    expect(after.availableMinor).toBe(0);
    expect(app.emails.some((e) => e.template === 'withdrawal_paid' && e.to === 'hoangvu@gmail.com')).toBe(true);
  });
  it('từ chối yêu cầu thì tiền quay lại ví (release)', async () => {
    const hk = await app.as('hongkim');
    const programId = await app.ids('program:kd');
    const before = await affiliate.myWallet(hk, programId);
    const queue = await withdrawals.payoutQueue(await app.as('minhquy'), programId);
    const mine = queue.queue.find((q) => q.affiliateAccountId === before.affiliateAccountId);
    expect(mine).toBeTruthy();
    const rejected = await withdrawals.rejectWithdrawal(await app.as('minhquy'), mine!.id, 'Sai tên chủ tài khoản', mine!.version);
    expect(rejected.status).toBe('rejected');
    const after = await affiliate.myWallet(hk, programId);
    expect(after.availableMinor).toBe(before.availableMinor + mine!.amountMinor);
  });
  it('hoàn tiền trong thời gian giữ → hoa hồng reversed; thành viên thường không xử lý được rút', async () => {
    const cong = await app.as('cong');
    const kd = await app.ids(KD);
    const session = await checkout.createCheckout(cong, { target: { type: 'tier', communityId: kd, tierKey: 'premium', cycle: 'monthly' }, provider: 'sepay' });
    await ownerBankPaid(app, session.reference, 249_000);
    const comm = await app.ctx.db.query.affiliateCommissions.findFirst({ where: eq(affiliateCommissions.orderId, session.orderId) });
    expect(comm?.status).toBe('pending');
    await paymentsSvc.adminRefund(await app.as('minhquy'), session.orderId, 'Khách yêu cầu');
    const reversed = await app.ctx.db.query.affiliateCommissions.findFirst({ where: eq(affiliateCommissions.id, comm!.id) });
    expect(reversed?.status).toBe('reversed');
    await expect(withdrawals.payoutQueue(cong, await app.ids('program:kd'))).rejects.toThrow();
  });
  it('bảng xếp hạng tính từ snapshot, dòng "bạn" có mặt', async () => {
    await affiliate.snapshotLeaderboards(app.system());
    const lb = await affiliate.leaderboard(await app.as('hoangvu'), await app.ids(KD), 'month');
    expect(lb.items.length).toBeGreaterThan(0);
    expect(lb.items.some((i) => i.isMe)).toBe(true);
  });
});

describe('Luồng 5: chủ hội tạo hội → khóa học → sự kiện lặp → nhắc → bản ghi', () => {
  it('tạo hội Freemium với tier, chuyên mục, plugin mặc định', async () => {
    const mq = await app.as('minhquy');
    const c = await communities.createCommunity(mq, { name: 'Hội Test', slug: 'hoi-test', shortDescription: 'Test', description: '', pricingMode: 'freemium', category: 'kinh-doanh', template: 'course' });
    // Minh Quý đã có hội miễn phí của tài khoản, nên hội này chờ thanh toán gói; trả gói xong thì mở.
    expect(c.needsPlan).toBe(true);
    const plan = await checkout.createCheckout(mq, { target: { type: 'platform', communityId: c.id, planKey: 'starter', cycle: 'quarterly' }, provider: 'sepay' });
    await sepayPaid(plan.reference, plan.amountMinor);
    const about = await communities.aboutPage(app.anon(), 'hoi-test');
    expect(about.tiers.map((t) => t.key)).toEqual(['standard', 'premium']);
    await expect(communities.createCommunity(mq, { name: 'Trùng', slug: 'hoi-test', shortDescription: '', description: '', pricingMode: 'free', category: 'kinh-doanh', template: 'blank' })).rejects.toThrow();
    await expect(communities.createCommunity(mq, { name: 'Cấm', slug: 'admin', shortDescription: '', description: '', pricingMode: 'free', category: 'kinh-doanh', template: 'blank' })).rejects.toThrow();
    const pricing = await communities.updatePricing(mq, c.id, { pricingMode: 'freemium', doorsOpen: false, enabledProviders: ['sepay', 'momo'], tiers: [{ key: 'standard', name: 'Tiêu chuẩn', description: '', benefits: [], isDefault: true, isActive: true }, { key: 'premium', name: 'Premium', description: '', benefits: [], isDefault: false, isActive: true, monthlyMinor: 199_000 }] });
    expect(pricing.doorsOpen).toBe(false);
    await expect(members.joinCommunity(await app.as('duy'), 'hoi-test', {})).rejects.toThrow(/đóng cổng/);
  });
  it('khóa học nháp → module → bài (nhúng YouTube) → đăng → thành viên thấy', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const course = await courses.createCourse(mq, kd, { title: 'Khóa test', shortDescription: 'x', descriptionMd: '', accessMode: 'all_members', previewFirstModule: true, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: false });
    expect(course.status).toBe('draft');
    await expect(courses.updateCourse(mq, course.id, { status: 'published' })).rejects.toThrow(/Cần ít nhất/);
    const mod = await courses.upsertModule(mq, course.id, { title: 'Module 1' });
    await expect(courses.upsertLesson(mq, course.id, { moduleId: mod.id, title: 'Bài 1', videoUrl: 'https://example.com/x' })).rejects.toThrow(/không nhận diện/);
    const lesson = await courses.upsertLesson(mq, course.id, { moduleId: mod.id, title: 'Bài 1', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(lesson.videoProvider).toBe('youtube');
    await courses.updateCourse(mq, course.id, { status: 'published' });
    const list = await courses.listCourses(await app.as('duy'), kd);
    expect(list.items.some((c) => c.id === course.id && !c.locked)).toBe(true);
    const duy = await app.as('duy');
    const view = await courses.getLesson(duy, lesson.id);
    expect(view.embed?.embedUrl).toContain('dQw4w9WgXcQ');
    const done = await courses.completeLesson(duy, lesson.id);
    expect(done.percent).toBe(100);
  });
  it('sự kiện lặp hằng tuần 4 buổi, đăng ký, nhắc 1 giờ, bản ghi vào Xem lại', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const start = new Date(Date.now() + 50 * 60_000);
    const r = await events.createEvent(mq, kd, { title: 'Q&A test', descriptionMd: 'md', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString(), timezone: 'Asia/Ho_Chi_Minh', recurrence: 'weekly', occurrences: 4, kind: 'online', meetingUrl: 'https://zoom.us/j/123', hostUserIds: [], access: 'all_members', allowQuestions: true, autoPublishRecording: true, reminders: ['1h', 'start'], announceOnFeed: true, broadcastEmail: false });
    expect(r.created).toBe(4);
    const duy = await app.as('duy');
    await events.registerEvent(duy, r.event.id, true);
    const detail = await events.getEvent(duy, r.event.id);
    expect(detail.registered).toBe(true);
    expect(detail.meetingUrl).toBe('https://zoom.us/j/123'); // đăng ký xong là thấy link ngay
    expect(detail.meetingProvider).toBe('zoom');
    // Lời nhắc đã được hẹn ngay khi tạo sự kiện (không chờ cron); cho các job hẹn giờ chạy ngay thay vì chờ đồng hồ thật.
    expect(app.queue.releaseDelayed()).toBeGreaterThanOrEqual(1);
    await app.queue.drain();
    expect(app.emails.some((e) => e.template === 'event_reminder' && e.to === 'duynguyen@gmail.com')).toBe(true);
    const q = await events.askQuestion(duy, r.event.id, 'Câu hỏi gửi trước?');
    const v = await events.voteQuestion(await app.as('hoangvu'), q.id);
    expect(v.voteCount).toBe(1);
    const rec = await events.addRecording(mq, r.event.id, { videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk' });
    expect(rec.videoProvider).toBe('youtube');
    const list = await events.listEvents(duy, kd, { filter: 'upcoming' });
    expect(list.recordings.some((x) => x.id === rec.id)).toBe(true);
  });
  it('quyền: thành viên thường không tạo khóa học, không đăng ở chuyên mục Thông báo', async () => {
    const duy = await app.as('duy');
    const kd = await app.ids(KD);
    await expect(requireCommunityPermission(duy, kd, 'course.manage')).rejects.toThrow();
    await expect(posts.createPost(duy, kd, { spaceId: await app.ids('space:kd:thong-bao'), title: 'x', contentMd: 'y', imageFileIds: [], broadcastEmail: false })).rejects.toThrow();
    const p = await posts.createPost(duy, kd, { spaceId: await app.ids('space:kd:chia-se'), title: '', contentMd: 'Status ngắn có nền', statusBgKey: 'dat', imageFileIds: [], broadcastEmail: false });
    expect(p.statusBgKey).toBe('dat');
  });
});

describe('Luồng 7: quản trị hệ thống', () => {
  it('đối soát: chuyển khoản mua gói sai nội dung được ghép thủ công và gói được kích hoạt; đơn của hội thì không ghép được', async () => {
    // Tiền mua gói Hội Mình về tài khoản của Hội Mình, nên quản trị hệ thống đối soát và ghép tay được.
    const vyHoi = await app.ids('community:vy');
    const session = await checkout.createCheckout(await vyOwner(), { target: { type: 'platform', communityId: vyHoi, planKey: 'starter', cycle: 'quarterly' }, provider: 'sepay' });
    const r = await sepayPaid(session.reference, 297_000, 'chuyen tien khong ma');
    expect(r.result).toBe('unmatched');
    const adminCtx = await app.as('admin');
    const recon = await admin.reconciliation(adminCtx, { status: 'unmatched' });
    const item = recon.items.find((i) => i.amountMinor === 297_000 && i.bankContent.includes('khong ma'));
    expect(item).toBeTruthy();
    const m = await admin.matchReconciliation(adminCtx, item!.id, session.reference);
    expect(m.orderId).toBe(session.orderId);
    expect((await app.ctx.db.query.communities.findFirst({ where: eq(communitiesTable.id, vyHoi) }))?.planKey).toBe('starter');
    // Đơn của hội trả thẳng vào tài khoản chủ hội: tiền chuyển nhầm vào tài khoản Hội Mình không ghép được với đơn đó.
    const dien = await app.as('dien');
    const hoiOrder = await checkout.createCheckout(dien, { target: { type: 'product', productId: await app.ids('product:prompts') }, provider: 'sepay' });
    await sepayPaid(hoiOrder.reference, 199_000, 'chuyen nham khong ghi ma');
    const wrong = (await admin.reconciliation(adminCtx, { status: 'unmatched' })).items.find((i) => i.amountMinor === 199_000 && i.bankContent.includes('chuyen nham'));
    expect(wrong).toBeTruthy();
    await expect(admin.matchReconciliation(adminCtx, wrong!.id, hoiOrder.reference)).rejects.toThrow(/tài khoản của chủ hội/);
    expect(await entitlementSvc.ownsProduct(dien, await app.ids('user:dien'), await app.ids('product:prompts'))).toBe(false);
    await expect(admin.reconciliation(dien, {})).rejects.toThrow();
  });
  it('tắt cổng thanh toán của Hội Mình thì mua gói qua cổng đó bị chặn', async () => {
    const adminCtx = await app.as('admin');
    await admin.updateProvider(adminCtx, 'vnpay', { enabled: false });
    await expect(checkout.createCheckout(await vyOwner(), { target: { type: 'platform', communityId: await app.ids('community:vy'), planKey: 'pro', cycle: 'quarterly' }, provider: 'vnpay' })).rejects.toThrow(/tạm tắt/);
    await admin.updateProvider(adminCtx, 'vnpay', { enabled: true });
  });
  it('khóa hội bị báo cáo và ghi audit', async () => {
    const adminCtx = await app.as('admin');
    const shopee = await app.ids('community:shopee');
    await admin.communityAction(adminCtx, shopee, 'lock', 'Vi phạm');
    const list = await admin.listCommunities(adminCtx, { status: 'locked' });
    expect(list.items.some((c) => c.id === shopee)).toBe(true);
    const logs = await admin.logs(adminCtx, { kind: 'audit', limit: 5 });
    expect(logs.audit.some((a) => a.action === 'community.lock' && a.resourceId === shopee)).toBe(true);
    const ov = await admin.overview(adminCtx);
    expect(ov.totals.users).toBeGreaterThan(30);
  });
  it('entitlement không cấp trùng, thu hồi theo nguồn', async () => {
    const sys = app.system();
    const uid = await app.ids('user:member2');
    const e1 = await entitlementSvc.grant(sys, { userId: uid, workspaceId: null, communityId: null, resourceType: 'course', resourceId: 'c1', sourceType: 'manual_grant', sourceId: 's1' });
    const e2 = await entitlementSvc.grant(sys, { userId: uid, workspaceId: null, communityId: null, resourceType: 'course', resourceId: 'c1', sourceType: 'manual_grant', sourceId: 's1' });
    expect(e1.id).toBe(e2.id);
    expect(await entitlementSvc.revokeBySource(sys, 'manual_grant', 's1')).toBe(1);
    const row = await app.ctx.db.query.entitlements.findFirst({ where: eq(entitlements.id, e1.id) });
    expect(row?.status).toBe('revoked');
  });
});

describe('Xác thực hai lớp (TOTP)', () => {
  const email = 'hailop@example.com';
  const password = 'matkhau2fa';
  let userId = '';
  let ctx: Awaited<ReturnType<typeof app.as>>;
  let secret = '';
  let backupCodes: string[] = [];

  it('bật: quét mã, nhập sai bị từ chối, nhập đúng thì nhận mã dự phòng', async () => {
    const s = await register(app.anon(), app.auth, { name: 'Hai Lớp', email, password, acceptTerms: true });
    userId = s.user.id;
    ctx = { ...app.anon(), actor: { type: 'user' as const, userId, isSuperAdmin: false, email } };
    expect((await totp.status(ctx)).enabled).toBe(false);

    const setup = await totp.startSetup(ctx);
    secret = setup.secret;
    expect(setup.uri).toContain('otpauth://totp/');
    expect(setup.uri).toContain(`secret=${secret}`);

    await expect(totp.confirmSetup(ctx, '000000')).rejects.toThrow(/Mã không đúng/);
    const { totpCodeAt } = await import('@hoiminh/config');
    const step = Math.floor(Date.now() / 1000 / 30);
    const r = await totp.confirmSetup(ctx, await totpCodeAt(secret, step));
    backupCodes = r.backupCodes;
    expect(backupCodes).toHaveLength(10);
    expect((await totp.status(ctx)).enabled).toBe(true);
    expect(app.emails.some((e) => e.template === 'two_factor_changed' && e.to === email)).toBe(true);
  });

  it('đăng nhập: mật khẩu đúng chỉ ra vé, phải thêm mã mới có phiên', async () => {
    const challenge = await login(app.anon(), app.auth, { email, password, remember: true });
    if (!('twoFactorRequired' in challenge)) throw new Error('Phải yêu cầu bước hai');
    expect(challenge.ticket).toBeTruthy();
    await expect(verifyTwoFactor(app.anon(), app.auth, challenge.ticket, '000000')).rejects.toThrow();
    const { totpCodeAt } = await import('@hoiminh/config');
    // Bước kế tiếp: mã của bước vừa dùng lúc bật đã bị chặn dùng lại, và ±1 bước vẫn nằm trong cửa sổ chấp nhận.
    const next = Math.floor(Date.now() / 1000 / 30) + 1;
    const session = await verifyTwoFactor(app.anon(), app.auth, challenge.ticket, await totpCodeAt(secret, next));
    expect(session.user.id).toBe(userId);
  });

  it('không dùng lại được mã vừa dùng', async () => {
    const { totpCodeAt } = await import('@hoiminh/config');
    const used = await totpCodeAt(secret, Math.floor(Date.now() / 1000 / 30) + 1);
    const c = await login(app.anon(), app.auth, { email, password, remember: true });
    if (!('twoFactorRequired' in c)) throw new Error('Phải yêu cầu bước hai');
    await expect(verifyTwoFactor(app.anon(), app.auth, c.ticket, used)).rejects.toThrow();
  });

  it('mã dự phòng dùng được đúng một lần', async () => {
    const c1 = await login(app.anon(), app.auth, { email, password, remember: true });
    if (!('twoFactorRequired' in c1)) throw new Error('Phải yêu cầu bước hai');
    const code = backupCodes[0]!;
    const session = await verifyTwoFactor(app.anon(), app.auth, c1.ticket, code);
    expect(session.user.id).toBe(userId);
    expect((await totp.status(ctx)).backupCodesLeft).toBe(9);

    const c2 = await login(app.anon(), app.auth, { email, password, remember: true });
    if (!('twoFactorRequired' in c2)) throw new Error('Phải yêu cầu bước hai');
    await expect(verifyTwoFactor(app.anon(), app.auth, c2.ticket, code)).rejects.toThrow();
  });

  it('tắt phải nhập đúng mật khẩu; tắt xong đăng nhập lại như thường', async () => {
    await expect(totp.disable(ctx, app.auth, 'sai-mat-khau')).rejects.toThrow(/Mật khẩu không đúng/);
    await totp.disable(ctx, app.auth, password);
    expect((await totp.status(ctx)).enabled).toBe(false);
    const s = await loginOk(app.anon(), app.auth, { email, password, remember: true });
    expect(s.user.id).toBe(userId);
  });
});

describe('Công tắc khóa học có tác dụng thật (rà soát 20/09)', () => {
  it('học theo thứ tự: bài 2 khóa tới khi bài 1 hoàn thành; người quản lý không bị chặn', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const course = await courses.createCourse(mq, kd, { title: 'Khóa thứ tự', shortDescription: 'x', descriptionMd: '', accessMode: 'all_members', previewFirstModule: false, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: true, hiddenFromStore: false });
    const mod = await courses.upsertModule(mq, course.id, { title: 'M1' });
    const l1 = await courses.upsertLesson(mq, course.id, { moduleId: mod.id, title: 'Bài 1', kind: 'text', contentMd: 'a' });
    const l2 = await courses.upsertLesson(mq, course.id, { moduleId: mod.id, title: 'Bài 2', kind: 'text', contentMd: 'b' });
    await courses.updateCourse(mq, course.id, { status: 'published' });
    const duy = await app.as('duy');
    expect((await courses.getLesson(duy, l1.id)).locked).toBe(false);
    const before = await courses.getLesson(duy, l2.id);
    expect(before.locked).toBe(true);
    expect(before.sequentialLocked).toBe(true);
    expect(before.lockReason).toBe('sequential');
    expect((await courses.getLesson(mq, l2.id)).locked).toBe(false);
    await courses.completeLesson(duy, l1.id);
    expect((await courses.getLesson(duy, l2.id)).locked).toBe(false);
  });
  it('bài bật "phải hoàn thành" giữ đúng bài kế tiếp; nhỏ giọt chỉ chạy khi khóa bật dripEnabled', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const course = await courses.createCourse(mq, kd, { title: 'Khóa cờ bài', shortDescription: 'x', descriptionMd: '', accessMode: 'all_members', previewFirstModule: false, affiliateEnabled: true, dripEnabled: false, certificateEnabled: false, sequential: false, hiddenFromStore: false });
    const mod = await courses.upsertModule(mq, course.id, { title: 'M1' });
    const l1 = await courses.upsertLesson(mq, course.id, { moduleId: mod.id, title: 'Bài 1', kind: 'text', contentMd: 'a', requireComplete: true });
    const l2 = await courses.upsertLesson(mq, course.id, { moduleId: mod.id, title: 'Bài 2', kind: 'text', contentMd: 'b', dripDays: 30 });
    const l3 = await courses.upsertLesson(mq, course.id, { moduleId: mod.id, title: 'Bài 3', kind: 'text', contentMd: 'c' });
    await courses.updateCourse(mq, course.id, { status: 'published' });
    const cong = await app.as('cong');
    expect((await courses.getLesson(cong, l2.id)).sequentialLocked).toBe(true);
    expect((await courses.getLesson(cong, l3.id)).sequentialLocked).toBe(false);
    await courses.completeLesson(cong, l1.id);
    const l2view = await courses.getLesson(cong, l2.id);
    expect(l2view.sequentialLocked).toBe(false);
    expect(l2view.dripLocked).toBe(false);
    await courses.updateCourse(mq, course.id, { dripEnabled: true });
    expect((await courses.getLesson(cong, l2.id)).dripLocked).toBe(true);
  });
  it('khóa tắt "affiliate nhận hoa hồng" thì đơn mua khóa đó không tính hoa hồng', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const make = async (affiliateEnabled: boolean) => {
      const c = await courses.createCourse(mq, kd, { title: `Khóa hoa hồng ${affiliateEnabled}`, shortDescription: 'x', descriptionMd: '', accessMode: 'store_only', priceMinor: 100_000, previewFirstModule: false, affiliateEnabled, dripEnabled: false, certificateEnabled: false, sequential: false, hiddenFromStore: false });
      const mod = await courses.upsertModule(mq, c.id, { title: 'M1' });
      await courses.upsertLesson(mq, c.id, { moduleId: mod.id, title: 'Bài 1', kind: 'text', contentMd: 'a' });
      await courses.updateCourse(mq, c.id, { status: 'published' });
      const full = await courses.getCourse(mq, c.id);
      const session = await checkout.createCheckout(await app.as('thulan'), { target: { type: 'product', productId: full.product!.id }, provider: 'sepay' });
      return session.orderId;
    };
    expect(await affiliate.productsAllowCommission(app.system(), await make(false))).toBe(false);
    expect(await affiliate.productsAllowCommission(app.system(), await make(true))).toBe(true);
  });
  it('quản trị: bộ lọc "bị báo cáo" chỉ trả hội đang hoạt động có lý do khóa chờ xử lý', async () => {
    const adminCtx = await app.as('admin');
    const r = await admin.listCommunities(adminCtx, { status: 'reported' });
    expect(r.counts.reported).toBe(r.items.length);
    expect(r.items.every((c) => c.status === 'active' && c.lockedReason)).toBe(true);
  });
});

describe('Duyệt bài thành viên mới và chứng nhận hoàn thành (rà soát 20/09)', () => {
  it('bật duyệt bài N ngày: thành viên mới đăng thì chờ duyệt, chỉ tác giả và người kiểm duyệt thấy; duyệt xong ai cũng thấy', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    await communities.updateFeedSettings(mq, kd, { moderateNewMembersDays: 7 });
    // Người mới: đăng ký rồi vào hội ngay trong test này.
    const s = await register(app.anon(), app.auth, { name: 'Mới Toanh', email: 'moitoanh@example.com', password: 'matkhau123', communitySlug: 'minhquy', acceptTerms: true });
    const newbie = { ...app.anon(), actor: { type: 'user' as const, userId: s.user.id, isSuperAdmin: false, email: 'moitoanh@example.com' } };
    await verifyEmail(newbie, s.user.id, '482913');
    const aboutN = await communities.aboutPage(newbie, 'minhquy');
    await members.joinCommunity(newbie, 'minhquy', { answers: aboutN.joinQuestions.map((q) => ({ questionId: q.id, answer: 'Học' })) });
    const space = await app.ids('space:kd:chia-se');
    const post = await posts.createPost(newbie, kd, { spaceId: space, title: 'Bài chờ duyệt', contentMd: 'xin chào', imageFileIds: [], broadcastEmail: false });
    expect(post.moderationStatus).toBe('pending');
    const duy = await app.as('duy');
    expect((await posts.feed(duy, kd, {})).items.some((p) => p.id === post.id)).toBe(false);
    await expect(posts.getPost(duy, post.id)).rejects.toThrow(/không tồn tại/);
    expect((await posts.feed(newbie, kd, {})).items.some((p) => p.id === post.id)).toBe(true);
    expect((await posts.feed(mq, kd, {})).items.some((p) => p.id === post.id)).toBe(true);
    await expect(posts.moderatePost(duy, post.id, 'approve')).rejects.toThrow();
    await posts.moderatePost(mq, post.id, 'approve');
    expect((await posts.feed(duy, kd, {})).items.some((p) => p.id === post.id)).toBe(true);
    // Thành viên lâu năm không bị duyệt (seed ghi joined_at lúc seed nên lùi tay 30 ngày); tắt cài đặt thì người mới cũng không.
    const { sql: rawSql } = await import('drizzle-orm');
    await app.ctx.db.execute(rawSql`update community_members set joined_at = now() - interval '30 days' where user_id = ${await app.ids('user:duy')} and community_id = ${kd}`);
    const old = await posts.createPost(duy, kd, { spaceId: space, title: 'Bài cũ', contentMd: 'ok', imageFileIds: [], broadcastEmail: false });
    expect(old.moderationStatus).toBe('approved');
    await communities.updateFeedSettings(mq, kd, { moderateNewMembersDays: 0 });
    expect((await posts.createPost(newbie, kd, { spaceId: space, title: 'Bài 2', contentMd: 'ok', imageFileIds: [], broadcastEmail: false })).moderationStatus).toBe('approved');
  });
  it('từ chối bài chờ duyệt thì bài bị xóa mềm và tác giả nhận thông báo', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    await communities.updateFeedSettings(mq, kd, { moderateNewMembersDays: 30 });
    const s = await register(app.anon(), app.auth, { name: 'Mới Hai', email: 'moihai@example.com', password: 'matkhau123', communitySlug: 'minhquy', acceptTerms: true });
    const newbie = { ...app.anon(), actor: { type: 'user' as const, userId: s.user.id, isSuperAdmin: false, email: 'moihai@example.com' } };
    await verifyEmail(newbie, s.user.id, '482913');
    const aboutN = await communities.aboutPage(newbie, 'minhquy');
    await members.joinCommunity(newbie, 'minhquy', { answers: aboutN.joinQuestions.map((q) => ({ questionId: q.id, answer: 'Học' })) });
    const post = await posts.createPost(newbie, kd, { spaceId: await app.ids('space:kd:chia-se'), title: 'Spam', contentMd: 'mua ngay', imageFileIds: [], broadcastEmail: false });
    await posts.moderatePost(mq, post.id, 'reject', 'Quảng cáo');
    await expect(posts.getPost(mq, post.id)).rejects.toThrow();
    const n = await notifications.listNotifications(newbie, {});
    expect(n.items.some((x: { kind: string; body: string | null }) => x.kind === 'post.rejected' && x.body === 'Quảng cáo')).toBe(true);
    await communities.updateFeedSettings(mq, kd, { moderateNewMembersDays: 0 });
  });
  it('chứng nhận: chỉ có khi khóa bật cấp chứng nhận và học đủ 100%; ai cũng kiểm tra được', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const course = await courses.createCourse(mq, kd, { title: 'Khóa chứng nhận', shortDescription: 'x', descriptionMd: '', accessMode: 'all_members', previewFirstModule: false, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: false });
    const mod = await courses.upsertModule(mq, course.id, { title: 'M1' });
    const l1 = await courses.upsertLesson(mq, course.id, { moduleId: mod.id, title: 'Bài 1', kind: 'text', contentMd: 'a' });
    await courses.updateCourse(mq, course.id, { status: 'published' });
    const cong = await app.as('cong');
    const congId = await app.ids('user:cong');
    await expect(courses.certificate(app.anon(), course.id, congId)).rejects.toThrow(/chưa hoàn thành/);
    await courses.completeLesson(cong, l1.id);
    const cert = await courses.certificate(app.anon(), course.id, congId);
    expect(cert.learner.id).toBe(congId);
    expect(cert.course.title).toBe('Khóa chứng nhận');
    expect(cert.verifyUrl).toContain(`/chung-nhan/${course.id}/${congId}`);
    await courses.updateCourse(mq, course.id, { certificateEnabled: false });
    await expect(courses.certificate(app.anon(), course.id, congId)).rejects.toThrow(/không cấp/);
  });
});
