// Gói Hội Mình theo kế hoạch 11/11/2026: bốn gói, mỗi gói cho một hội, hai chu kỳ, không dùng thử.
// Kiểm tra bảng gói, mua/gia hạn/nâng gói, hội miễn phí của tài khoản, trần thành viên, khóa tính năng, nhắc hạn và hết hạn.
import { PLAN_DEFAULTS, planQuote, type PlanCycle, type PlanKey } from '@hoiminh/contracts';
import { communities, communityMembers, platformSubscriptions } from '@hoiminh/db';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { register } from '../auth/service';
import type { Ctx } from '../context';
import { AppError } from '../errors';
import * as affiliate from '../services/affiliate';
import * as apiKeys from '../services/api-keys';
import * as automation from '../services/automation';
import * as checkout from '../services/checkout';
import * as communitiesSvc from '../services/communities';
import * as courses from '../services/courses';
import * as members from '../services/members';
import * as paymentsSvc from '../services/payments';
import * as platformBilling from '../services/platform-billing';
import { communityPlan } from '../services/plans';
import * as shell from '../services/shell';
import * as workspaces from '../services/workspaces';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let vy: Ctx; // chủ hội "Ngoại ngữ cùng Vy": gói Miễn phí, 41 thành viên
let duc: Ctx; // chủ hội "Shopee 0 đồng": gói Miễn phí, 12 thành viên
let VY = '', SHOPEE = '', KD = '';
const DAY = 86_400_000;

beforeAll(async () => {
  app = await createTestApp();
  const sys = app.system();
  vy = { ...sys, actor: { type: 'user', userId: await app.ids('user:thaovy'), isSuperAdmin: false, email: 'vy.english@gmail.com' } };
  duc = { ...sys, actor: { type: 'user', userId: await app.ids('user:phamduc'), isSuperAdmin: false, email: 'phamduc@gmail.com' } };
  VY = await app.ids('community:vy');
  SHOPEE = await app.ids('community:shopee');
  KD = await app.ids('community:kd');
}, 180_000);
afterAll(async () => {
  await app.close();
});

async function sepayPaid(reference: string, amount: number) {
  const body = { id: Math.floor(Math.random() * 1e9), gateway: 'Vietcombank', transactionDate: '2026-11-11 09:03:11', accountNumber: '0071000123456', code: null, content: `NGUYEN VAN A ck ${reference}`, transferType: 'in', transferAmount: amount, accumulated: 0, subAccount: null, referenceCode: `FT${Math.floor(Math.random() * 1e9)}`, description: '' };
  return paymentsSvc.handleWebhook(app.system(), 'sepay', { headers: { authorization: `Apikey ${app.ctx.env.SEPAY_API_KEY}` }, rawBody: JSON.stringify(body), query: {} });
}

/** Chủ hội mua một gói cho hội và trả tiền xong. */
async function buy(ctx: Ctx, communityId: string, planKey: Exclude<PlanKey, 'free'>, cycle: PlanCycle) {
  const s = await checkout.createCheckout(ctx, { target: { type: 'platform', communityId, planKey, cycle }, provider: 'sepay' });
  const r = await sepayPaid(s.reference, s.amountMinor);
  expect(r.result).toBe('processed');
  return s;
}

const defaults = () => PLAN_DEFAULTS.map((p) => ({ key: p.key, monthlyMinor: p.monthlyMinor, memberCap: p.memberCap, features: [...p.features] }));
const daysFromNow = (d: Date | null) => Math.round(((d?.getTime() ?? 0) - Date.now()) / DAY);

async function expectCode(p: Promise<unknown>, code: string): Promise<AppError> {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

describe('cách tính một lần mua gói (hàm thuần)', () => {
  const now = new Date('2026-11-11T02:00:00Z');
  const pro = { key: 'pro' as const, monthlyMinor: 299_000, memberCap: 5_000 };
  const starter = { key: 'starter' as const, monthlyMinor: 99_000, memberCap: 500 };

  it('3 tháng bằng 3 lần giá tháng và 90 ngày; 1 năm bằng 10 lần giá tháng và 365 ngày', () => {
    const q = planQuote({ now, current: { key: 'free', endsAt: null }, target: pro, cycle: 'quarterly', members: 10 });
    expect(q).toMatchObject({ ok: true, action: 'buy', amountMinor: 897_000, days: 90, carryDays: 0, totalDays: 90 });
    const y = planQuote({ now, current: { key: 'free', endsAt: null }, target: pro, cycle: 'yearly', members: 10 });
    expect(y).toMatchObject({ amountMinor: 2_990_000, days: 365 });
  });

  it('nâng gói: Khởi đầu còn 60 ngày, mua Chuyên nghiệp 3 tháng thì được 90 + 60 ngày', () => {
    const endsAt = new Date(now.getTime() + 60 * DAY);
    const q = planQuote({ now, current: { key: 'starter', endsAt }, target: pro, cycle: 'quarterly', members: 10 });
    expect(q).toMatchObject({ ok: true, action: 'upgrade', carryDays: 60, totalDays: 150 });
    expect(q.endsAt.getTime()).toBe(now.getTime() + 150 * DAY);
  });

  it('gia hạn cùng gói thì nối tiếp vào ngày hết hạn', () => {
    const endsAt = new Date(now.getTime() + 10 * DAY);
    const q = planQuote({ now, current: { key: 'pro', endsAt }, target: pro, cycle: 'yearly', members: 10 });
    expect(q).toMatchObject({ ok: true, action: 'renew', totalDays: 375 });
  });

  it('không mua được gói thấp hơn gói đang còn hạn, hay gói có trần thấp hơn số thành viên', () => {
    const endsAt = new Date(now.getTime() + 10 * DAY);
    expect(planQuote({ now, current: { key: 'pro', endsAt }, target: starter, cycle: 'quarterly', members: 10 })).toMatchObject({ ok: false, blocked: 'lower' });
    expect(planQuote({ now, current: { key: 'free', endsAt: null }, target: starter, cycle: 'quarterly', members: 1_240 })).toMatchObject({ ok: false, blocked: 'cap' });
    // Gói cũ đã hết hạn thì mua gói thấp hơn bình thường, không còn ngày nào để tặng.
    expect(planQuote({ now, current: { key: 'free', endsAt: new Date(now.getTime() - DAY) }, target: starter, cycle: 'quarterly', members: 10 })).toMatchObject({ ok: true, action: 'buy', carryDays: 0 });
  });
});

describe('bảng bốn gói', () => {
  it('luôn đủ bốn gói với giá và trần đã chốt', async () => {
    const list = await platformBilling.listPlans(app.anon());
    expect(list.map((p) => [p.key, p.monthlyMinor, p.memberCap])).toEqual([['free', 0, 100], ['starter', 99_000, 500], ['pro', 299_000, 5_000], ['unlimited', 799_000, null]]);
    expect(list[0]!.features).toEqual([]);
    expect(list[2]!.features).toEqual(['automation', 'custom_domain', 'affiliate', 'api']);
  });

  it('chỉ quản trị hệ thống lưu được bảng gói, và bảng phải hợp lý', async () => {
    const admin = await app.as('admin');
    await expect(platformBilling.savePlans(await app.as('minhquy'), { plans: defaults() })).rejects.toThrow();
    const patch = (key: PlanKey, change: Partial<ReturnType<typeof defaults>[number]>) => ({ plans: defaults().map((p) => (p.key === key ? { ...p, ...change } : p)) });
    await expect(platformBilling.savePlans(admin, patch('free', { monthlyMinor: 1_000 }))).rejects.toThrow(/Miễn phí luôn có giá 0/);
    await expect(platformBilling.savePlans(admin, patch('starter', { monthlyMinor: 0 }))).rejects.toThrow(/lớn hơn 0/);
    await expect(platformBilling.savePlans(admin, patch('pro', { monthlyMinor: 50_000 }))).rejects.toThrow(/không được rẻ hơn/);
    await expect(platformBilling.savePlans(admin, patch('pro', { memberCap: 200 }))).rejects.toThrow(/không được thấp hơn/);
    const saved = await platformBilling.savePlans(admin, patch('starter', { monthlyMinor: 129_000, memberCap: 800, features: ['custom_domain'] }));
    expect(saved.find((p) => p.key === 'starter')).toMatchObject({ monthlyMinor: 129_000, memberCap: 800, features: ['custom_domain'] });
    await platformBilling.savePlans(admin, { plans: defaults() });
    const stats = await platformBilling.planStats(admin);
    expect(stats.plans).toHaveLength(4);
    // Dữ liệu mẫu: hội chính ở Chuyên nghiệp 3 tháng, hội YouTube ở Chuyên nghiệp 1 năm.
    expect(stats.plans.find((p) => p.key === 'pro')).toMatchObject({ quarterlyCount: 1, yearlyCount: 1, communities: 2 });
  });
});

describe('trần thành viên theo gói', () => {
  it('hội chạm trần: người mới vào hàng chờ, chủ hội bấm Duyệt thì nhận lỗi member_cap kèm gói gợi ý', async () => {
    const admin = await app.as('admin');
    // Hạ trần gói Miễn phí xuống đúng số thành viên của hội Shopee (12) để hội này chạm trần.
    await platformBilling.savePlans(admin, { plans: defaults().map((p) => (p.key === 'free' ? { ...p, memberCap: 12 } : p)) });
    expect((await communityPlan(app.system(), SHOPEE)).full).toBe(true);

    const joiner = await app.as('member1');
    const r = await members.joinCommunity(joiner, 'shopee-0d', {});
    expect(r.waitlisted).toBe(true);
    expect(r.member.status).toBe('pending');
    const before = await app.ctx.db.query.communities.findFirst({ where: eq(communities.id, SHOPEE) });
    expect(before!.memberCount).toBe(12);

    const err = await expectCode(members.memberAction(duc, SHOPEE, r.member.id, 'approve'), 'member_cap');
    expect(err.details).toMatchObject({ planKey: 'free', cap: 12, members: 12, nextPlanKey: 'starter', nextPlanName: 'Khởi đầu' });
    const still = await app.ctx.db.query.communityMembers.findFirst({ where: eq(communityMembers.id, r.member.id) });
    expect(still!.status).toBe('pending');

    // Chủ hội xem khung hội thì thấy gói và trạng thái đủ chỗ; thành viên thường không nhận dữ liệu gói.
    expect((await shell.communityShell(duc, 'shopee-0d')).plan).toMatchObject({ key: 'free', memberCap: 12, full: true });
    expect((await shell.communityShell(await app.as('member2'), 'minhquy')).plan).toBeNull();

    // Nâng gói xong thì duyệt được ngay.
    await buy(duc, SHOPEE, 'starter', 'quarterly');
    await members.memberAction(duc, SHOPEE, r.member.id, 'approve');
    const after = await app.ctx.db.query.communities.findFirst({ where: eq(communities.id, SHOPEE) });
    expect(after!.memberCount).toBe(13);
    await platformBilling.savePlans(admin, { plans: defaults() });
  });

  it('không mua được gói có trần thấp hơn số thành viên đang có', async () => {
    const admin = await app.as('admin');
    await platformBilling.savePlans(admin, { plans: defaults().map((p) => (p.key === 'free' ? { ...p, memberCap: 30 } : p.key === 'starter' ? { ...p, memberCap: 40 } : p)) });
    await expect(checkout.createCheckout(vy, { target: { type: 'platform', communityId: VY, planKey: 'starter', cycle: 'quarterly' }, provider: 'sepay' })).rejects.toThrow(/nhiều hơn trần 40/);
    await platformBilling.savePlans(admin, { plans: defaults() });
  });
});

describe('khóa tính năng trả phí theo gói', () => {
  it('hội gói Miễn phí: tự động hóa, tên miền riêng, cộng sự, API đều bị chặn với lỗi plan_locked', async () => {
    const e1 = await expectCode(automation.createSource(vy, VY, { name: 'Nguồn thử' }), 'plan_locked');
    expect(e1.details).toMatchObject({ reason: 'feature', feature: 'automation', requiredPlanKey: 'pro', requiredPlanName: 'Chuyên nghiệp' });
    await expectCode(communitiesSvc.updateGeneral(vy, VY, { customDomain: 'hoc.vy.vn' }), 'plan_locked');
    await expectCode(affiliate.updateProgram(vy, VY, { enabled: true, commissionRateBps: 3000, holdDays: 14, minWithdrawalMinor: 500_000, leaderboardVisibility: 'members', leaderboardShowMoney: true }), 'plan_locked');
    await expectCode(apiKeys.createApiKey(vy, await app.ids('workspace:thaovy'), { name: 'key', scopes: ['*'] }), 'plan_locked');
    // Việc không thuộc tính năng trả phí vẫn làm được: đổi mô tả, đọc danh sách thẻ.
    await communitiesSvc.updateGeneral(vy, VY, { shortDescription: 'Học tiếng Anh giao tiếp mỗi ngày.' });
    expect(Array.isArray(await automation.listTags(vy, VY))).toBe(true);
  });

  it('hội gói Chuyên nghiệp dùng được cả bốn tính năng', async () => {
    const mq = await app.as('minhquy');
    const source = await automation.createSource(mq, KD, { name: 'Nguồn của hội chính' });
    expect(source.url).toContain('/webhooks/in/');
    await communitiesSvc.updateGeneral(mq, KD, { customDomain: 'hoc2.minhquy.vn' });
    const key = await apiKeys.createApiKey(mq, await app.ids('workspace:minhquy'), { name: 'key', scopes: ['*'] });
    expect(await apiKeys.authenticateApiKey(app.system(), key.raw)).toBeTruthy();
  });
});

describe('mua, nâng và gia hạn gói cho một hội', () => {
  it('hội Miễn phí mua Khởi đầu 3 tháng: 297.000đ, 90 ngày, đơn không lẫn vào doanh thu của hội', async () => {
    const s = await buy(vy, VY, 'starter', 'quarterly');
    expect(s.amountMinor).toBe(297_000);
    const plan = await communityPlan(app.system(), VY);
    expect(plan).toMatchObject({ key: 'starter', memberCap: 500, needsPlan: false, full: false });
    expect(daysFromNow(plan.endsAt)).toBe(90);
    const home = await workspaces.myWorkspaceHome(vy);
    expect(home.owned[0]).toMatchObject({ revenue30Minor: 0, plan: { key: 'starter', daysLeft: 90, isFreeSlot: true } });
    const status = await platformBilling.communityPlanStatus(vy, VY);
    expect(status).toMatchObject({ cycle: 'quarterly', canBuy: true, plan: { key: 'starter' } });
    expect(status.plans).toHaveLength(4);
  });

  it('nâng lên Chuyên nghiệp 1 năm: số ngày còn lại của Khởi đầu được tặng sang gói mới', async () => {
    const s = await buy(vy, VY, 'pro', 'yearly');
    expect(s.amountMinor).toBe(2_990_000);
    const plan = await communityPlan(app.system(), VY);
    expect(plan.key).toBe('pro');
    expect(daysFromNow(plan.endsAt)).toBe(365 + 90);
    // Tính năng của gói mới mở ngay.
    const source = await automation.createSource(vy, VY, { name: 'Nguồn của Vy' });
    expect(source.id).toBeTruthy();
  });

  it('đang ở gói cao hơn và còn hạn thì không mua được gói thấp hơn; gia hạn cùng gói thì nối tiếp', async () => {
    await expect(checkout.createCheckout(vy, { target: { type: 'platform', communityId: VY, planKey: 'starter', cycle: 'quarterly' }, provider: 'sepay' })).rejects.toThrow(/còn hạn/);
    await buy(vy, VY, 'pro', 'quarterly');
    expect(daysFromNow((await communityPlan(app.system(), VY)).endsAt)).toBe(365 + 90 + 90);
    const sub = await app.ctx.db.query.platformSubscriptions.findFirst({ where: eq(platformSubscriptions.communityId, VY) });
    expect(sub).toMatchObject({ planKey: 'pro', status: 'active', billingCycle: 'quarterly' });
  });

  it('chỉ chủ workspace mua được gói', async () => {
    await expect(checkout.createCheckout(await app.as('member1'), { target: { type: 'platform', communityId: VY, planKey: 'pro', cycle: 'quarterly' }, provider: 'sepay' })).rejects.toThrow();
  });
});

describe('nhắc hạn và hết hạn', () => {
  it('còn 3 ngày thì nhắc một lần; tới hạn thì hội về gói Miễn phí, dữ liệu giữ nguyên', async () => {
    const setEnd = (interval: string) => app.ctx.db.execute(sql`update platform_subscriptions set current_period_end = now() + ${interval}::interval, reminders_sent = '[]'::jsonb where community_id = ${VY}`).then(() => app.ctx.db.execute(sql`update communities set plan_ends_at = now() + ${interval}::interval where id = ${VY}`));
    await setEnd('3 days');
    app.emails.length = 0;
    const r1 = await platformBilling.runPlatformBillingCron(app.system());
    expect(r1.reminded).toBeGreaterThanOrEqual(1);
    const mail = app.emails.find((m) => m.template === 'plan_reminder' && m.to === 'vy.english@gmail.com');
    expect(mail?.subject).toMatch(/Gói Chuyên nghiệp của Ngoại ngữ cùng Vy còn 3 ngày/);
    // Chạy lại trong ngày không nhắc trùng.
    app.emails.length = 0;
    await platformBilling.runPlatformBillingCron(app.system());
    expect(app.emails.filter((m) => m.to === 'vy.english@gmail.com')).toHaveLength(0);

    await setEnd('-1 hours');
    const r2 = await platformBilling.runPlatformBillingCron(app.system());
    expect(r2.expired).toBeGreaterThanOrEqual(1);
    expect(app.emails.find((m) => m.template === 'plan_reminder' && m.to === 'vy.english@gmail.com')?.subject).toMatch(/đã hết hạn/);
    const plan = await communityPlan(app.system(), VY);
    expect(plan).toMatchObject({ key: 'free', memberCap: 100, boughtKey: 'pro', needsPlan: false });
    // Hội miễn phí của tài khoản vẫn tạo nội dung được; tính năng trả phí thì khóa lại.
    const course = await courses.createCourse(vy, VY, { title: 'Sau khi hết hạn', shortDescription: '', descriptionMd: '', accessMode: 'all_members', previewFirstModule: true, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: false });
    expect(course.id).toBeTruthy();
    await expectCode(automation.createSource(vy, VY, { name: 'Sau khi hết hạn' }), 'plan_locked');
    // Hết hạn rồi thì mua lại gói thấp hơn được.
    await buy(vy, VY, 'starter', 'quarterly');
    expect((await communityPlan(app.system(), VY)).key).toBe('starter');
  });
});

describe('mỗi tài khoản một hội miễn phí', () => {
  it('tài khoản mới: không có dùng thử, hội đầu tiên là hội miễn phí và hoạt động ngay', async () => {
    const s = await register(app.anon(), app.auth, { name: 'Chủ Hội Mới', email: 'chuhoimoi@example.com', password: 'matkhau123', acceptTerms: true });
    const me: Ctx = { ...app.system(), actor: { type: 'user', userId: s.user.id, isSuperAdmin: false, email: 'chuhoimoi@example.com' } };
    const c = await communitiesSvc.createCommunity(me, { name: 'Hội đầu tiên', slug: 'hoi-dau-tien-x1', shortDescription: '', description: '', category: 'kinh-doanh', pricingMode: 'free', template: 'blank' });
    expect(c).toMatchObject({ status: 'active', isFreeSlot: true, needsPlan: false, planKey: 'free' });
    const home = await workspaces.myWorkspaceHome(me);
    expect(home.workspace).toMatchObject({ status: 'active', trialEndsAt: null });
    expect(home.freeSlotUsed).toBe(true);
    expect(await app.ctx.db.query.platformSubscriptions.findFirst({ where: eq(platformSubscriptions.communityId, c.id) })).toBeUndefined();
  });

  it('hội thứ hai: tạo ở trạng thái chờ thanh toán, chưa ai vào được, trả gói xong thì mở', async () => {
    const mq = await app.as('minhquy');
    const c = await communitiesSvc.createCommunity(mq, { name: 'Hội thứ tư của Quý', slug: 'hoi-thu-tu-x1', shortDescription: '', description: '', category: 'kinh-doanh', pricingMode: 'free', template: 'blank' });
    expect(c).toMatchObject({ status: 'draft', lockedReason: 'plan_required', isFreeSlot: false, needsPlan: true });
    const err = await expectCode(courses.createCourse(mq, c.id, { title: 'Chưa trả tiền', shortDescription: '', descriptionMd: '', accessMode: 'all_members', previewFirstModule: true, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: false }), 'plan_locked');
    expect(err.details).toMatchObject({ reason: 'needs_plan' });
    await expect(members.joinCommunity(await app.as('member2'), 'hoi-thu-tu-x1', {})).rejects.toThrow(/chưa mở/);

    await buy(mq, c.id, 'starter', 'yearly');
    const opened = await app.ctx.db.query.communities.findFirst({ where: eq(communities.id, c.id) });
    expect(opened).toMatchObject({ status: 'active', lockedReason: null, planKey: 'starter' });
    const joined = await members.joinCommunity(await app.as('member2'), 'hoi-thu-tu-x1', {});
    expect(joined.member.status).toBe('active');
    // Hội miễn phí của tài khoản vẫn là hội chính.
    const free = await app.ctx.db.query.communities.findMany({ where: and(eq(communities.workspaceId, await app.ids('workspace:minhquy')), eq(communities.isFreeSlot, true)) });
    expect(free.map((x) => x.id)).toEqual([KD]);
  });
});
