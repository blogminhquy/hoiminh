// Quản lý khóa học ngay tại thư viện (menu ba chấm trên thẻ): sắp thứ tự thẻ và nhân bản khóa.
import { and, eq, inArray } from 'drizzle-orm';
import { courseModules, courseProgress, lessonResources, lessons } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as courses from '../services/courses';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let communityId = '';
beforeAll(async () => {
  app = await createTestApp();
  communityId = await app.ids('community:kd');
}, 180_000);
afterAll(async () => {
  await app.close();
});

const libraryIds = async (key: 'minhquy' | 'member1' = 'minhquy') => (await courses.listCourses(await app.as(key), communityId)).items.map((c) => c.id);

describe('sắp thứ tự thẻ khóa học', () => {
  it('chủ hội đảo thứ tự, thư viện trả đúng thứ tự mới', async () => {
    const owner = await app.as('minhquy');
    const before = await libraryIds();
    expect(before.length).toBeGreaterThan(2);
    const reversed = [...before].reverse();
    await courses.reorderCourses(owner, communityId, reversed);
    expect(await libraryIds()).toEqual(reversed);
  });

  it('chỉ gửi vài khóa: các khóa đó lên đầu, khóa còn lại giữ thứ tự cũ', async () => {
    const owner = await app.as('minhquy');
    const before = await libraryIds();
    const last = before[before.length - 1]!;
    await courses.reorderCourses(owner, communityId, [last]);
    expect(await libraryIds()).toEqual([last, ...before.slice(0, -1)]);
  });

  it('thành viên thường không đổi được thứ tự; id lạ bị từ chối', async () => {
    const before = await libraryIds();
    await expect(courses.reorderCourses(await app.as('member1'), communityId, [...before].reverse())).rejects.toMatchObject({ status: 403 });
    await expect(courses.reorderCourses(await app.as('minhquy'), communityId, ['00000000-0000-4000-8000-000000000000'])).rejects.toMatchObject({ status: 422 });
    expect(await libraryIds()).toEqual(before);
  });
});

describe('nhân bản khóa học', () => {
  it('bản sao là nháp, đứng ngay sau khóa gốc, đủ chương, bài và tài liệu, không mang theo tiến độ', async () => {
    const owner = await app.as('minhquy');
    const sourceId = await app.ids('course:fmm');
    const source = await courses.getCourse(owner, sourceId);
    const copy = await courses.duplicateCourse(owner, sourceId);

    expect(copy.id).not.toBe(sourceId);
    expect(copy.status).toBe('draft');
    expect(copy.publishedAt).toBeNull();
    expect(copy.title).toBe(`${source.title} (bản sao)`);
    expect(copy.slug).not.toBe(source.slug);
    expect(copy).toMatchObject({ accessMode: source.accessMode, priceMinor: source.priceMinor, coverColor: source.coverColor, lessonCount: source.lessonCount, totalDurationSeconds: source.totalDurationSeconds, sequential: source.sequential, dripEnabled: source.dripEnabled });

    const ids = await libraryIds();
    expect(ids[ids.indexOf(sourceId) + 1]).toBe(copy.id);

    const copied = await courses.getCourse(owner, copy.id);
    expect(copied.modules.map((m) => m.title)).toEqual(source.modules.map((m) => m.title));
    expect(copied.modules.map((m) => m.lessons.map((l) => l.title))).toEqual(source.modules.map((m) => m.lessons.map((l) => l.title)));
    expect(copied.resources.map((r) => r.name).sort()).toEqual(source.resources.map((r) => r.name).sort());
    expect(copied.learners).toEqual({ total: 0, completed: 0 });

    // Bài của bản sao là dòng mới, giữ nguyên video và nội dung; khóa gốc không mất bài nào.
    const [srcLessons, newLessons] = await Promise.all([
      app.ctx.db.query.lessons.findMany({ where: eq(lessons.courseId, sourceId) }),
      app.ctx.db.query.lessons.findMany({ where: eq(lessons.courseId, copy.id) }),
    ]);
    expect(newLessons).toHaveLength(srcLessons.length);
    expect(newLessons.some((l) => srcLessons.some((s) => s.id === l.id))).toBe(false);
    const byTitle = new Map(srcLessons.map((l) => [l.title, l]));
    for (const l of newLessons) expect({ videoUrl: l.videoUrl, contentMd: l.contentMd, isPreview: l.isPreview, dripDays: l.dripDays }).toEqual({ videoUrl: byTitle.get(l.title)!.videoUrl, contentMd: byTitle.get(l.title)!.contentMd, isPreview: byTitle.get(l.title)!.isPreview, dripDays: byTitle.get(l.title)!.dripDays });
    const newModules = await app.ctx.db.query.courseModules.findMany({ where: eq(courseModules.courseId, copy.id) });
    expect(newLessons.every((l) => newModules.some((m) => m.id === l.moduleId))).toBe(true);
    if (newLessons.length) expect(await app.ctx.db.query.lessonResources.findMany({ where: inArray(lessonResources.lessonId, newLessons.map((l) => l.id)) })).toHaveLength(source.resources.length);
    expect(await app.ctx.db.query.courseProgress.findMany({ where: and(eq(courseProgress.courseId, copy.id)) })).toHaveLength(0);
  });

  it('học viên không thấy bản sao còn nháp; thành viên thường không nhân bản được', async () => {
    const owner = await app.as('minhquy');
    const copy = await courses.duplicateCourse(owner, await app.ids('course:fbads'));
    expect(await libraryIds('member1')).not.toContain(copy.id);
    await expect(courses.duplicateCourse(await app.as('member1'), await app.ids('course:fbads'))).rejects.toMatchObject({ status: 403 });
  });

  it('tên dài vẫn nằm trong giới hạn 80 ký tự', async () => {
    const owner = await app.as('minhquy');
    const long = await courses.createCourse(owner, communityId, { title: 'K'.repeat(80), shortDescription: '', descriptionMd: '', accessMode: 'all_members', previewFirstModule: true, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: false });
    const copy = await courses.duplicateCourse(owner, long.id);
    expect(copy.title.length).toBeLessThanOrEqual(80);
    expect(copy.title.endsWith('(bản sao)')).toBe(true);
  });
});
