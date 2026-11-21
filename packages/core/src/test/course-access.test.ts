// Access Resolver theo lô (resolveCourseAccess): một lượt cho cả danh sách khóa học phải cho đúng kết quả
// như khi hỏi từng khóa, với đủ các lý do: quản lý, chủ khóa, cấp thủ công, mua lẻ, mua combo, hạng thành viên.
import { and, eq } from 'drizzle-orm';
import { communityMembers, courses as coursesTable, entitlements } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as courses from '../services/courses';
import { canAccessCourse, grant, resolveCourseAccess } from '../services/entitlements';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let kd = '';
let all: Array<typeof coursesTable.$inferSelect> = [];
const id: Record<string, string> = {};

beforeAll(async () => {
  app = await createTestApp();
  kd = await app.ids('community:kd');
  for (const k of ['fmm', 'fbads', 'aiagent', 'affiliate']) id[k] = await app.ids(`course:${k}`);
  all = await app.ctx.db.query.courses.findMany({ where: eq(coursesTable.communityId, kd) });
}, 180_000);
afterAll(async () => {
  await app.close();
});

const published = () => all.filter((c) => c.status !== 'draft');
const reasons = (m: Map<string, { allowed: boolean; reason: string }>) => Object.fromEntries(Object.entries(id).map(([k, v]) => [k, m.get(v)?.reason]));

describe('resolveCourseAccess: quyền của cả danh sách khóa học trong một lượt', () => {
  it('người quản lý mở mọi khóa; khách chưa đăng nhập bị khóa mọi khóa; chủ khóa luôn mở', async () => {
    const sys = app.system();
    const staff = await resolveCourseAccess(sys, await app.ids('user:member1'), published(), { isStaff: true });
    expect([...staff.values()].every((d) => d.allowed && d.reason === 'owner')).toBe(true);
    const anon = await resolveCourseAccess(sys, null, published());
    expect([...anon.values()].every((d) => !d.allowed && d.reason === 'not_member')).toBe(true);
    const owner = await resolveCourseAccess(sys, published()[0]!.ownerUserId, published());
    expect(owner.get(published()[0]!.id)).toEqual({ allowed: true, reason: 'owner' });
    expect((await resolveCourseAccess(sys, null, [])).size).toBe(0);
  });

  it('thành viên Tiêu chuẩn: cấp thủ công, mua lẻ, mua combo, hết hạn, rời hội', async () => {
    const sys = app.system();
    const userId = await app.ids('user:kienbui');
    const wsId = (await sys.db.query.communities.findFirst({ where: (c, { eq: e }) => e(c.id, kd) }))!.workspaceId;
    const run = async () => reasons(await resolveCourseAccess(sys, userId, published()));

    // Ban đầu: hạng Tiêu chuẩn, mọi khóa Premium đều cần nâng hạng.
    expect(await run()).toEqual({ fmm: 'needs_premium', fbads: 'needs_premium', aiagent: 'needs_premium', affiliate: 'needs_premium' });

    // Cấp thủ công một khóa: chỉ khóa đó mở.
    await grant(sys, { userId, workspaceId: wsId, communityId: kd, resourceType: 'course', resourceId: id.fbads!, sourceType: 'manual_grant', sourceId: 'test-manual' });
    expect(await run()).toEqual({ fmm: 'needs_premium', fbads: 'manual', aiagent: 'needs_premium', affiliate: 'needs_premium' });

    // Mua lẻ sản phẩm bán một khóa khác.
    const single = await grant(sys, { userId, workspaceId: wsId, communityId: kd, resourceType: 'product', resourceId: await app.ids('product:aiagent'), sourceType: 'purchase', sourceId: 'test-single' });
    expect(await run()).toEqual({ fmm: 'needs_premium', fbads: 'manual', aiagent: 'purchase', affiliate: 'needs_premium' });

    // Quyền đã hết hạn thì không tính.
    await sys.db.update(entitlements).set({ expiresAt: new Date(sys.now().getTime() - 60_000) }).where(eq(entitlements.id, single.id));
    expect((await run()).aiagent).toBe('needs_premium');

    // Mua combo chứa cả bốn khóa: khóa nào cũng mở nhờ đã mua; khóa cấp thủ công vẫn báo lý do thủ công (xét trước).
    const combo = await grant(sys, { userId, workspaceId: wsId, communityId: kd, resourceType: 'product', resourceId: await app.ids('product:combo'), sourceType: 'purchase', sourceId: 'test-combo' });
    expect(await run()).toEqual({ fmm: 'purchase', fbads: 'manual', aiagent: 'purchase', affiliate: 'purchase' });

    // Hỏi từng khóa (canAccessCourse) và hỏi cả lô phải ra cùng một kết quả; trang danh sách khóa học cũng vậy.
    const batch = await resolveCourseAccess(sys, userId, published());
    for (const c of published()) expect(await canAccessCourse(sys, userId, c.id)).toEqual(batch.get(c.id));
    const list = await courses.listCourses(await app.as('kienbui'), kd);
    for (const item of list.items) expect({ locked: item.locked, reason: item.lockReason }).toEqual({ locked: !batch.get(item.id)!.allowed, reason: batch.get(item.id)!.reason });
    expect(list.items.every((i) => i.status === 'published')).toBe(true);

    // Thu hồi hết: quay về cần nâng hạng. Rời hội: không còn là thành viên.
    await sys.db.update(entitlements).set({ status: 'revoked' }).where(and(eq(entitlements.userId, userId), eq(entitlements.sourceType, 'manual_grant')));
    await sys.db.update(entitlements).set({ status: 'revoked' }).where(eq(entitlements.id, combo.id));
    expect(await run()).toEqual({ fmm: 'needs_premium', fbads: 'needs_premium', aiagent: 'needs_premium', affiliate: 'needs_premium' });
    await sys.db.update(communityMembers).set({ status: 'churned' }).where(and(eq(communityMembers.communityId, kd), eq(communityMembers.userId, userId)));
    expect(await run()).toEqual({ fmm: 'not_member', fbads: 'not_member', aiagent: 'not_member', affiliate: 'not_member' });
  });

  it('thành viên Premium mở khóa theo hạng; người quản lý xem danh sách thấy cả bản nháp và không khóa nào bị khóa', async () => {
    const sys = app.system();
    // Hoàng Vũ đang ở hạng Premium; Thu Lan đã bấm hủy nhưng còn trong kỳ (cancelling) nên vẫn giữ quyền của hạng.
    for (const who of ['hoangvu', 'thulan']) {
      const premium = await resolveCourseAccess(sys, await app.ids(`user:${who}`), published());
      expect([...premium.values()].every((d) => d.allowed && ['tier', 'purchase', 'manual'].includes(d.reason))).toBe(true);
    }
    const list = await courses.listCourses(await app.as('minhquy'), kd);
    expect(list.canManage).toBe(true);
    expect(list.items.some((c) => c.status === 'draft')).toBe(true);
    expect(list.items.every((c) => !c.locked)).toBe(true);
  });
});
