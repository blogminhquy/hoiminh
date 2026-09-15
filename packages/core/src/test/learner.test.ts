// Khu học tập của người mua lẻ (V2, mục 153): thư viện dựng từ entitlement, chạy được với người không thuộc hội nào.
import { and, eq } from 'drizzle-orm';
import { communityMembers, courseProgress, entitlements } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as checkout from '../services/checkout';
import * as entitlementSvc from '../services/entitlements';
import * as learner from '../services/learner';
import * as paymentsSvc from '../services/payments';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

/**
 * Người mua lẻ sạch: lấy một tài khoản seed rồi gỡ hết tư cách thành viên, entitlement và tiến độ,
 * để mỗi test bắt đầu từ "chưa sở hữu gì, không thuộc hội nào".
 */
async function outsider() {
  const ctx = await app.as('thulan');
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : '';
  const communityId = await app.ids('community:kd');
  await app.ctx.db.delete(communityMembers).where(eq(communityMembers.userId, userId));
  await app.ctx.db.delete(entitlements).where(eq(entitlements.userId, userId));
  await app.ctx.db.delete(courseProgress).where(eq(courseProgress.userId, userId));
  return { ctx, userId, communityId };
}

describe('thư viện Khu học tập', () => {
  it('người chưa mua gì thấy thư viện rỗng, không lỗi dù không thuộc hội nào', async () => {
    const { ctx } = await outsider();
    const lib = await learner.myLibrary(ctx);
    expect(lib.counts).toEqual({ courses: 0, inProgress: 0, completed: 0, digital: 0 });
    expect(lib.courses).toEqual([]);
    expect(lib.memberCommunityIds).toEqual([]);
  });

  it('mua lẻ một khóa → khóa vào thư viện với nguồn "đã mua" và bài học để bắt đầu', async () => {
    const { ctx, userId, communityId } = await outsider();
    const productId = await app.ids('product:fmm');
    const courseId = await app.ids('course:fmm');
    await entitlementSvc.grant(app.system(), { userId, workspaceId: null, communityId, resourceType: 'product', resourceId: productId, sourceType: 'purchase', sourceId: `test-${Date.now()}` });

    const lib = await learner.myLibrary(ctx);
    expect(lib.counts.courses).toBe(1);
    const item = lib.courses[0]!;
    expect(item.id).toBe(courseId);
    expect(item.source).toBe('purchase');
    expect(item.resumeLessonId).toBeTruthy();
    // Vẫn không phải thành viên hội — đây chính là điểm của mục 153.
    expect(lib.memberCommunityIds).toEqual([]);
  });

  it('mua combo → mở mọi khóa con, đánh dấu nguồn "trong combo"', async () => {
    const { ctx, userId, communityId } = await outsider();
    const comboId = await app.ids('product:combo');
    await entitlementSvc.grant(app.system(), { userId, workspaceId: null, communityId, resourceType: 'product', resourceId: comboId, sourceType: 'purchase', sourceId: `test-combo-${Date.now()}` });

    const lib = await learner.myLibrary(ctx);
    expect(lib.counts.courses).toBeGreaterThanOrEqual(4);
    expect(lib.courses.every((c) => c.source === 'purchase' || c.source === 'bundle')).toBe(true);
    expect(lib.courses.some((c) => c.source === 'bundle')).toBe(true);
  });

  it('sản phẩm số vào mục tài liệu, không lẫn vào khóa học', async () => {
    const { ctx, userId, communityId } = await outsider();
    const promptsId = await app.ids('product:prompts');
    await entitlementSvc.grant(app.system(), { userId, workspaceId: null, communityId, resourceType: 'product', resourceId: promptsId, sourceType: 'purchase', sourceId: `test-digital-${Date.now()}` });

    const lib = await learner.myLibrary(ctx);
    expect(lib.counts.digital).toBe(1);
    expect(lib.counts.courses).toBe(0);
    expect(lib.digital[0]!.title).toContain('prompt');
  });

  it('entitlement bị thu hồi (hoàn tiền) thì khóa rời thư viện', async () => {
    const { ctx, userId, communityId } = await outsider();
    const productId = await app.ids('product:aiagent');
    const source = `test-refund-${Date.now()}`;
    await entitlementSvc.grant(app.system(), { userId, workspaceId: null, communityId, resourceType: 'product', resourceId: productId, sourceType: 'purchase', sourceId: source });
    expect((await learner.myLibrary(ctx)).counts.courses).toBe(1);

    await entitlementSvc.revokeBySource(app.system(), 'purchase', source);
    expect((await learner.myLibrary(ctx)).counts.courses).toBe(0);
  });

  it('entitlement hết hạn không còn tính là sở hữu', async () => {
    const { ctx, userId, communityId } = await outsider();
    const productId = await app.ids('product:fbads');
    const source = `test-expired-${Date.now()}`;
    await entitlementSvc.grant(app.system(), { userId, workspaceId: null, communityId, resourceType: 'product', resourceId: productId, sourceType: 'purchase', sourceId: source, expiresAt: new Date(Date.now() - 1000) });
    const lib = await learner.myLibrary(ctx);
    expect(lib.counts.courses).toBe(0);
  });

  it('gợi ý vào hội miễn phí đã mua đồ, và không gợi ý khi đã là thành viên', async () => {
    const { ctx, userId, communityId } = await outsider();
    const productId = await app.ids('product:fmm');
    await entitlementSvc.grant(app.system(), { userId, workspaceId: null, communityId, resourceType: 'product', resourceId: productId, sourceType: 'purchase', sourceId: `test-suggest-${Date.now()}` });

    const lib = await learner.myLibrary(ctx);
    expect(lib.suggestedCommunities.map((c) => c.id)).toContain(communityId);

    // Là thành viên rồi thì không mời nữa.
    const member = await app.as('cong');
    const memberLib = await learner.myLibrary(member);
    expect(memberLib.suggestedCommunities.map((c) => c.id)).not.toContain(communityId);
  });

  it('học xong thì khóa chuyển sang nhóm hoàn thành và xếp xuống cuối', async () => {
    const { ctx, userId, communityId } = await outsider();
    for (const key of ['fmm', 'aiagent']) {
      await entitlementSvc.grant(app.system(), { userId, workspaceId: null, communityId, resourceType: 'product', resourceId: await app.ids(`product:${key}`), sourceType: 'purchase', sourceId: `test-sort-${key}-${Date.now()}` });
    }
    const before = await learner.myLibrary(ctx);
    expect(before.counts.courses).toBe(2);
    expect(before.counts.completed).toBe(0);

    // Đánh dấu một khóa đã xong bằng course_progress, giống sau khi học hết bài.
    const doneCourseId = await app.ids('course:fmm');
    await app.ctx.db.insert(courseProgress).values({ courseId: doneCourseId, userId, completedLessons: 10, totalLessons: 10, percent: 100, completedAt: new Date() }).onConflictDoUpdate({ target: [courseProgress.courseId, courseProgress.userId], set: { percent: 100, completedAt: new Date() } });

    const after = await learner.myLibrary(ctx);
    expect(after.counts.completed).toBe(1);
    expect(after.courses[after.courses.length - 1]!.id).toBe(doneCourseId);
  });
});

describe('mua lẻ không còn bị tự thêm vào hội (mục 153)', () => {
  it('thanh toán sản phẩm xong: có quyền học, vẫn không phải thành viên, và đơn trỏ về Khu học tập', async () => {
    const { ctx, userId, communityId } = await outsider();
    const productId = await app.ids('product:affiliate');
    await app.ctx.db.delete(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.resourceId, productId)));

    const session = await checkout.createCheckout(ctx, { target: { type: 'product', productId }, provider: 'sepay' });
    const body = { id: Math.floor(Math.random() * 1e9), gateway: 'Vietcombank', transactionDate: '2026-09-15 09:03:11', accountNumber: '0071000123456', code: null, content: `CK ${session.reference}`, transferType: 'in', transferAmount: session.amountMinor, accumulated: 0, subAccount: null, referenceCode: `MB.${Date.now()}`, description: '' };
    const r = await paymentsSvc.handleWebhook(app.system(), 'sepay', { headers: { authorization: `Apikey ${app.ctx.env.SEPAY_API_KEY}` }, rawBody: JSON.stringify(body), query: {} });
    expect(r.result).toBe('processed');

    expect(await entitlementSvc.ownsProduct(ctx, userId, productId)).toBe(true);
    const membership = await app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)) });
    expect(membership, 'mua lẻ không được tự thêm vào hội').toBeUndefined();

    const status = await checkout.orderStatus(ctx, session.orderId);
    expect(status.status).toBe('paid');
    expect(status.nextUrl).toBe('/hoc');

    const lib = await learner.myLibrary(ctx);
    expect(lib.counts.courses).toBe(1);
  });
});
