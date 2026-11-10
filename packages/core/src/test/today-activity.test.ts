// Trang "Hôm nay": đếm việc người xem đã làm trong ngày (giờ Việt Nam) ở một hội.
import { and, eq } from 'drizzle-orm';
import { comments, communityMembers, lessonProgress } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as members from '../services/members';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('startOfVietnamDay', () => {
  it('00:00 giờ Việt Nam là 17:00 UTC hôm trước', () => {
    expect(members.startOfVietnamDay(new Date('2026-11-09T20:30:00Z')).toISOString()).toBe('2026-11-09T17:00:00.000Z');
    expect(members.startOfVietnamDay(new Date('2026-11-09T16:59:59Z')).toISOString()).toBe('2026-11-08T17:00:00.000Z');
    expect(members.startOfVietnamDay(new Date('2026-11-09T17:00:00Z')).toISOString()).toBe('2026-11-09T17:00:00.000Z');
  });
});

describe('todayActivity', () => {
  it('đếm bài học xong và bình luận trong ngày, bỏ qua việc của hôm qua và của người khác', async () => {
    const ctx = await app.as('cong');
    const userId = ctx.actor.type === 'user' ? ctx.actor.userId : '';
    const communityId = await app.ids('community:kd');
    const courseId = await app.ids('course:fmm');
    const [l0, l1, l2] = await Promise.all([app.ids('lesson:fmm:0:0'), app.ids('lesson:fmm:0:1'), app.ids('lesson:fmm:0:2')]);
    await app.ctx.db.delete(lessonProgress).where(eq(lessonProgress.userId, userId));
    await app.ctx.db.delete(comments).where(eq(comments.authorUserId, userId));

    const now = ctx.now();
    const today = new Date(members.startOfVietnamDay(now).getTime() + 60_000);
    const yesterday = new Date(members.startOfVietnamDay(now).getTime() - 60_000);
    await app.ctx.db.insert(lessonProgress).values([
      { lessonId: l0!, courseId, userId, completed: true, completedAt: yesterday },
      { lessonId: l1!, courseId, userId, completed: true, completedAt: today },
      { lessonId: l2!, courseId, userId, completed: false, completedAt: null },
    ]);
    const other = await app.as('hoangvu');
    const otherId = other.actor.type === 'user' ? other.actor.userId : '';
    await app.ctx.db.insert(comments).values([
      { communityId, targetType: 'lesson', targetId: l1!, authorUserId: userId, contentMd: 'Hôm nay', createdAt: today },
      { communityId, targetType: 'lesson', targetId: l1!, authorUserId: userId, contentMd: 'Hôm qua', createdAt: yesterday },
      { communityId, targetType: 'lesson', targetId: l1!, authorUserId: userId, contentMd: 'Đã xóa', createdAt: today, deletedAt: today },
      { communityId, targetType: 'lesson', targetId: l1!, authorUserId: otherId, contentMd: 'Của người khác', createdAt: today },
    ]);

    const r = await members.todayActivity(ctx, communityId);
    expect(r.lessonsDone).toBe(1);
    expect(r.comments).toBe(1);
    expect(r.since).toBe(members.startOfVietnamDay(now).toISOString());

    await app.ctx.db.delete(comments).where(and(eq(comments.communityId, communityId), eq(comments.contentMd, 'Của người khác')));
  });

  it('người không thuộc hội bị từ chối', async () => {
    const ctx = await app.as('thulan');
    const userId = ctx.actor.type === 'user' ? ctx.actor.userId : '';
    const communityId = await app.ids('community:kd');
    await app.ctx.db.delete(communityMembers).where(and(eq(communityMembers.userId, userId), eq(communityMembers.communityId, communityId)));
    await expect(members.todayActivity(ctx, communityId)).rejects.toThrow();
  });
});
