// Chứng nhận hoàn thành khóa học: chỉ cấp khi học xong, cấp một lần, tra cứu công khai theo mã.
import { and, eq } from 'drizzle-orm';
import { certificates as certTable, courseProgress, courses } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as certificates from '../services/certificates';
import * as courseSvc from '../services/courses';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

/** Đặt tiến độ của một người học cho một khóa, giống sau khi học hết bài. */
async function setProgress(courseId: string, userId: string, percent: number) {
  await app.ctx.db
    .insert(courseProgress)
    .values({ courseId, userId, completedLessons: percent, totalLessons: 100, percent, completedAt: percent >= 100 ? new Date() : null })
    .onConflictDoUpdate({ target: [courseProgress.courseId, courseProgress.userId], set: { percent, completedAt: percent >= 100 ? new Date() : null } });
}

describe('cấp chứng nhận', () => {
  it('chưa học xong thì không có chứng nhận', async () => {
    const ctx = await app.as('cong');
    const userId = ctx.actor.type === 'user' ? ctx.actor.userId : '';
    const courseId = await app.ids('course:fmm');
    await setProgress(courseId, userId, 60);
    expect(await certificates.issueCertificate(app.system(), courseId, userId)).toBeNull();
    expect(await certificates.myCertificate(ctx, courseId)).toBeNull();
  });

  it('học xong 100% thì cấp, mã có dạng HM-CN-XXXXX', async () => {
    const ctx = await app.as('cong');
    const userId = ctx.actor.type === 'user' ? ctx.actor.userId : '';
    const courseId = await app.ids('course:fmm');
    await setProgress(courseId, userId, 100);

    const cert = await certificates.issueCertificate(app.system(), courseId, userId);
    expect(cert).not.toBeNull();
    expect(cert!.code).toMatch(/^HM-CN-[A-Z0-9]{5}$/);
    expect(cert!.recipientName).toBe('Công Trần');
    expect(cert!.courseTitle).toBe('Funnel Money Model 2026');
    expect(cert!.issuerName).toBe('Kinh Doanh Online Cùng AI');
    expect(cert!.revokedAt).toBeNull();
  });

  it('gọi lại không cấp tờ thứ hai', async () => {
    const ctx = await app.as('duy');
    const userId = ctx.actor.type === 'user' ? ctx.actor.userId : '';
    const courseId = await app.ids('course:aiagent');
    await setProgress(courseId, userId, 100);

    const first = await certificates.issueCertificate(app.system(), courseId, userId);
    const second = await certificates.issueCertificate(app.system(), courseId, userId);
    expect(second!.code).toBe(first!.code);
    const rows = await app.ctx.db.query.certificates.findMany({ where: and(eq(certTable.courseId, courseId), eq(certTable.userId, userId)) });
    expect(rows).toHaveLength(1);
  });

  it('khóa tắt chứng nhận thì không cấp', async () => {
    const ctx = await app.as('hoangvu');
    const userId = ctx.actor.type === 'user' ? ctx.actor.userId : '';
    const courseId = await app.ids('course:fbads');
    await app.ctx.db.update(courses).set({ certificateEnabled: false }).where(eq(courses.id, courseId));
    await setProgress(courseId, userId, 100);
    expect(await certificates.issueCertificate(app.system(), courseId, userId)).toBeNull();
    await app.ctx.db.update(courses).set({ certificateEnabled: true }).where(eq(courses.id, courseId));
  });

  it('đổi tên tài khoản hay tên khóa về sau không làm đổi tờ đã cấp', async () => {
    const ctx = await app.as('thulan');
    const userId = ctx.actor.type === 'user' ? ctx.actor.userId : '';
    const courseId = await app.ids('course:affiliate');
    await setProgress(courseId, userId, 100);
    const cert = await certificates.issueCertificate(app.system(), courseId, userId);
    const tenGoc = cert!.courseTitle;

    await app.ctx.db.update(courses).set({ title: 'Tên khóa đã đổi' }).where(eq(courses.id, courseId));
    const again = await certificates.myCertificate(ctx, courseId);
    expect(again!.courseTitle).toBe(tenGoc);
    await app.ctx.db.update(courses).set({ title: tenGoc }).where(eq(courses.id, courseId));
  });
});

describe('tra cứu chứng nhận', () => {
  it('ai cầm mã cũng tra được, kể cả khách chưa đăng nhập', async () => {
    const ctx = await app.as('cong');
    const userId = ctx.actor.type === 'user' ? ctx.actor.userId : '';
    const courseId = await app.ids('course:fmm');
    await setProgress(courseId, userId, 100);
    const cert = await certificates.issueCertificate(app.system(), courseId, userId);

    const found = await certificates.verifyCertificate(app.system(), cert!.code);
    expect(found.recipientName).toBe('Công Trần');
    // Mã viết thường hay có khoảng trắng thừa vẫn tra được.
    const loose = await certificates.verifyCertificate(app.system(), `  ${cert!.code.toLowerCase()} `);
    expect(loose.code).toBe(cert!.code);
  });

  it('mã sai thì báo không tìm thấy', async () => {
    await expect(certificates.verifyCertificate(app.system(), 'HM-CN-KHONG')).rejects.toThrow(/Không tìm thấy/);
  });

  it('danh sách chứng nhận của tôi chỉ có của tôi', async () => {
    const cong = await app.as('cong');
    const duy = await app.as('duy');
    const mine = await certificates.listMyCertificates(cong);
    const theirs = await certificates.listMyCertificates(duy);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((c) => c.recipientName === 'Công Trần')).toBe(true);
    expect(theirs.some((c) => mine.some((m) => m.code === c.code))).toBe(false);
  });
});

describe('học xong bài cuối thì tự có chứng nhận', () => {
  it('hoàn thành khóa qua completeLesson sẽ cấp chứng nhận và thông báo dẫn tới đúng mã', async () => {
    const owner = await app.as('minhquy');
    const communityId = await app.ids('community:kd');
    const course = await courseSvc.createCourse(owner, communityId, { title: 'Khóa một bài', shortDescription: 'x', descriptionMd: '', accessMode: 'all_members', previewFirstModule: false, affiliateEnabled: false, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: true });
    const mod = await courseSvc.upsertModule(owner, course.id, { title: 'Phần 1' });
    const lesson = await courseSvc.upsertLesson(owner, course.id, { moduleId: mod.id, title: 'Bài duy nhất', kind: 'text', contentMd: 'nội dung' });
    await courseSvc.updateCourse(owner, course.id, { status: 'published' });

    const learner = await app.as('cong');
    const learnerId = learner.actor.type === 'user' ? learner.actor.userId : '';
    const r = await courseSvc.completeLesson(learner, lesson.id);
    expect(r.percent).toBe(100);

    const cert = await certificates.myCertificate(learner, course.id);
    expect(cert, 'học xong bài cuối phải có chứng nhận').not.toBeNull();
    expect(cert!.courseTitle).toBe('Khóa một bài');

    const { notifications } = await import('@hoiminh/db');
    const notes = await app.ctx.db.query.notifications.findMany({ where: and(eq(notifications.userId, learnerId), eq(notifications.kind, 'course.completed')) });
    const note = notes.find((n) => n.link === `/chung-nhan/${cert!.code}`);
    expect(note, 'thông báo phải dẫn tới đúng tờ chứng nhận').toBeTruthy();
    expect(note!.body).toContain(cert!.code);
  });
});
