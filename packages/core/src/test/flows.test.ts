// Kiểm tra các luồng nghiệp vụ chính ở tầng service (mục 6 của prompt), chạy trên PGlite với dữ liệu seed.
import { hmacHex } from '@hoiminh/config';
import { MomoAdapter } from '@hoiminh/payments';
import { and, eq } from 'drizzle-orm';
import { affiliateCommissions, communityMembers, entitlements, orders, payments } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { register, login, verifyEmail, forgotPassword, resetPassword } from '../auth/service';
import { runCron, runScheduledJobs } from '../jobs/cron';
import { requireCommunityPermission } from '../permissions';
import * as affiliate from '../services/affiliate';
import * as checkout from '../services/checkout';
import * as communities from '../services/communities';
import * as courses from '../services/courses';
import * as entitlementSvc from '../services/entitlements';
import * as events from '../services/events';
import * as members from '../services/members';
import * as messaging from '../services/messaging';
import * as paymentsSvc from '../services/payments';
import * as posts from '../services/posts';
import * as withdrawals from '../services/withdrawals';
import * as admin from '../services/admin';
import * as platformBilling from '../services/platform-billing';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
const KD = 'community:kd';

beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

/** Giả lập SePay báo có cho một đơn: gửi webhook đã ký với đúng nội dung và số tiền. */
async function sepayPaid(reference: string, amount: number, content = reference) {
  const body = { id: Math.floor(Math.random() * 1e9), gateway: 'Vietcombank', transactionDate: '2026-09-14 09:03:11', accountNumber: '0071000123456', code: null, content: `NGUYEN VAN A ck ${content}`, transferType: 'in', transferAmount: amount, accumulated: 0, subAccount: null, referenceCode: `MBVCB.${Date.now()}`, description: '' };
  return paymentsSvc.handleWebhook(app.system(), 'sepay', { headers: { authorization: `Apikey ${app.ctx.env.SEPAY_API_KEY}` }, rawBody: JSON.stringify(body), query: {} });
}

describe('Luồng 1: đăng ký → xác minh → tham gia hội miễn phí → tin nhắn chào', () => {
  let userId = '';
  it('đăng ký với mã cộng sự, nhận mã xác minh 6 số', async () => {
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
    const s = await login(app.anon(), app.auth, { email: 'nguoimoi@example.com', password: 'matkhau123', remember: true });
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
    // Job chào được hẹn sau 2 phút; ép chạy bằng cách lùi run_at.
    const { sql } = await import('drizzle-orm');
    await app.ctx.db.execute(sql`update scheduled_jobs set run_at = now() - interval '1 minute' where kind = 'welcome_dm.send'`);
    const n = await runScheduledJobs(app.ctx);
    expect(n).toBeGreaterThanOrEqual(1);
    const convos = await messaging.listConversations(ctx, {});
    expect(convos.items.some((c) => c.automated)).toBe(true);
    const msgs = await messaging.listMessages(ctx, convos.items[0]!.id, {});
    expect(msgs.items[0]!.body).toContain('Mới');
    expect(msgs.items[0]!.automated).toBe(true);
  });
  it('quên mật khẩu → token → đặt lại → đăng nhập bằng mật khẩu mới', async () => {
    const { token } = await forgotPassword(app.anon(), 'nguoimoi@example.com');
    expect(token).toBeTruthy();
    await resetPassword(app.anon(), app.auth, token!, 'matkhaumoi456', true);
    const s = await login(app.anon(), app.auth, { email: 'nguoimoi@example.com', password: 'matkhaumoi456', remember: true });
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
    const r1 = await sepayPaid(session.reference, 249_000);
    expect(r1.result).toBe('processed');
    const r2 = await sepayPaid(session.reference, 249_000);
    expect(r2.result).toBe('unmatched'); // đơn đã thanh toán, giao dịch thứ hai vào đối soát chứ không mở lại
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

describe('Luồng 3: mua lẻ trong Cửa hàng qua MoMo và hoàn tiền trong 7 ngày', () => {
  it('mua khóa AI Agent, nhận IPN MoMo đúng chữ ký, rồi hoàn tiền khi xem < 20%', async () => {
    const duy = await app.as('duy');
    const productId = await app.ids('product:aiagent');
    const session = await checkout.createCheckout(duy, { target: { type: 'product', productId }, provider: 'momo' });
    expect(session.instruction.kind).toBe('redirect');
    const p = { partnerCode: app.ctx.env.MOMO_PARTNER_CODE, orderId: session.reference, requestId: 'r1', amount: session.amountMinor, orderInfo: 'x', orderType: 'momo_wallet', transId: 999, resultCode: 0, message: 'Successful.', payType: 'qr', responseTime: Date.now(), extraData: '', signature: '' };
    p.signature = await hmacHex(app.ctx.env.MOMO_SECRET_KEY, MomoAdapter.ipnSignatureString(app.ctx.env.MOMO_ACCESS_KEY, p));
    const r = await paymentsSvc.handleWebhook(app.system(), 'momo', { headers: {}, rawBody: JSON.stringify(p), query: {} });
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

describe('Luồng 4: cộng sự · hold → available → rút ≥ 500k → xem xét → trả / từ chối', () => {
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
    const wd = await withdrawals.requestWithdrawal(hv, programId, w.availableMinor);
    expect(wd.status).toBe('requested');
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
    await sepayPaid(session.reference, 249_000);
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
    expect(detail.meetingUrl).toBeNull(); // chưa tới 15 phút trước giờ
    await runCron(app.ctx, 'every_minute');
    const { sql } = await import('drizzle-orm');
    await app.ctx.db.execute(sql`update scheduled_jobs set run_at = now() - interval '1 minute' where kind = 'event.remind'`);
    await runScheduledJobs(app.ctx);
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

describe('Luồng 6: gói nền tảng dùng thử → nhắc → trả → hết hạn khóa', () => {
  it('nhắc trước 3 ngày, hết hạn thì khóa tạo nội dung, thanh toán thì mở lại', async () => {
    const vyWs = await app.ids('workspace:thaovy');
    const { sql } = await import('drizzle-orm');
    const before = await platformBilling.runPlatformBillingCron(app.system());
    expect(before.reminded).toBeGreaterThanOrEqual(1);
    await app.ctx.db.execute(sql`update platform_subscriptions set current_period_end = now() - interval '1 day' where workspace_id = ${vyWs}`);
    const r = await platformBilling.runPlatformBillingCron(app.system());
    expect(r.locked).toBeGreaterThanOrEqual(1);
    const vy = await app.as('member1');
    const vyCtx = { ...vy, actor: { type: 'user' as const, userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' } };
    await expect(courses.createCourse(vyCtx, await app.ids('community:vy'), { title: 'Bị khóa', shortDescription: '', descriptionMd: '', accessMode: 'all_members', previewFirstModule: true, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: false })).rejects.toThrow(/hết hạn/);
    const session = await checkout.createCheckout(vyCtx, { target: { type: 'platform', workspaceId: vyWs, cycle: 'yearly' }, provider: 'sepay' });
    expect(session.amountMinor).toBe(4_990_000);
    await sepayPaid(session.reference, 4_990_000);
    const status = await platformBilling.platformStatus(vyCtx, vyWs);
    expect(status.locked).toBe(false);
    expect(status.subscription?.status).toBe('active');
    expect(status.subscription?.billingCycle).toBe('yearly');
  });
});

describe('Luồng 7: quản trị hệ thống', () => {
  it('đối soát: chuyển khoản sai nội dung được ghép thủ công và mở quyền', async () => {
    const dien = await app.as('dien');
    const session = await checkout.createCheckout(dien, { target: { type: 'product', productId: await app.ids('product:prompts') }, provider: 'sepay' });
    const r = await sepayPaid(session.reference, 199_000, 'chuyen tien khong ma');
    expect(r.result).toBe('unmatched');
    const adminCtx = await app.as('admin');
    const recon = await admin.reconciliation(adminCtx, { status: 'unmatched' });
    const item = recon.items.find((i) => i.amountMinor === 199_000 && i.bankContent.includes('khong ma'));
    expect(item).toBeTruthy();
    const m = await admin.matchReconciliation(adminCtx, item!.id, session.reference);
    expect(m.orderId).toBe(session.orderId);
    expect(await entitlementSvc.ownsProduct(dien, await app.ids('user:dien'), await app.ids('product:prompts'))).toBe(true);
    await expect(admin.reconciliation(dien, {})).rejects.toThrow();
  });
  it('tắt cổng thanh toán thì checkout qua cổng đó bị chặn', async () => {
    const adminCtx = await app.as('admin');
    await admin.updateProvider(adminCtx, 'vnpay', { enabled: false });
    const duy = await app.as('duy');
    await expect(checkout.createCheckout(duy, { target: { type: 'product', productId: await app.ids('product:fbads') }, provider: 'vnpay' })).rejects.toThrow(/tạm tắt/);
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
