// Hoàn thành khóa học: completeLesson báo đúng một lần khóa vừa đạt 100% (để giao diện chuyển sang màn chúc mừng),
// cho biết khóa có cấp chứng nhận không, và ngày hoàn thành in trên chứng nhận không đổi khi bấm hoàn thành lại.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as courses from '../services/courses';
import { createTestApp, type TestApp } from './setup';

const KD = 'community:kd';
const base = { shortDescription: 'x', descriptionMd: '', accessMode: 'all_members', previewFirstModule: false, affiliateEnabled: true, dripEnabled: false, sequential: false, hiddenFromStore: false } as const;

describe('hoàn thành khóa học', () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });

  /** Chủ hội tạo một khóa đã đăng có hai bài ở hai chương khác nhau. */
  async function seedCourse(title: string, certificateEnabled: boolean, publish = true) {
    const mq = await app.as('minhquy');
    const course = await courses.createCourse(mq, await app.ids(KD), { ...base, title, certificateEnabled });
    const m1 = await courses.upsertModule(mq, course.id, { title: 'Chương 1' });
    const m2 = await courses.upsertModule(mq, course.id, { title: 'Chương 2' });
    const l1 = await courses.upsertLesson(mq, course.id, { moduleId: m1.id, title: 'Bài 1', kind: 'text', contentMd: 'a' });
    const l2 = await courses.upsertLesson(mq, course.id, { moduleId: m2.id, title: 'Bài 2', kind: 'text', contentMd: 'b' });
    if (publish) await courses.updateCourse(mq, course.id, { status: 'published' });
    return { course, l1, l2 };
  }

  it('courseCompleted chỉ đúng ở lượt làm khóa đạt 100%, không lặp lại khi bấm hoàn thành lại', async () => {
    const { course, l1, l2 } = await seedCourse('Khóa chúc mừng', true);
    const cong = await app.as('cong');
    const first = await courses.completeLesson(cong, l1.id);
    expect(first).toMatchObject({ percent: 50, courseCompleted: false, certificateEnabled: true });
    const last = await courses.completeLesson(cong, l2.id);
    expect(last).toMatchObject({ percent: 100, completedLessons: 2, totalLessons: 2, courseCompleted: true, certificateEnabled: true });
    // Chứng nhận có ngay sau lượt hoàn thành cuối, không phải chờ sự kiện course.completed chạy xong.
    const cert = await courses.certificate(app.anon(), course.id, await app.ids('user:cong'));
    expect(cert.course).toMatchObject({ lessonCount: 2 });

    const again = await courses.completeLesson(cong, l1.id);
    expect(again).toMatchObject({ percent: 100, courseCompleted: false });
    const after = await courses.certificate(app.anon(), course.id, await app.ids('user:cong'));
    expect(new Date(after.completedAt).getTime()).toBe(new Date(cert.completedAt).getTime());
  });

  it('học sai thứ tự: bài hoàn thành sau cùng mới là bài làm khóa xong, dù nó không phải bài cuối giáo trình', async () => {
    const { l1, l2 } = await seedCourse('Khóa học ngược', true);
    const duy = await app.as('duy');
    expect((await courses.completeLesson(duy, l2.id)).courseCompleted).toBe(false);
    expect((await courses.completeLesson(duy, l1.id)).courseCompleted).toBe(true);
  });

  it('khóa tắt chứng nhận: vẫn báo vừa hoàn thành nhưng certificateEnabled là false, bài học cũng trả cờ này', async () => {
    const { l1, l2 } = await seedCourse('Khóa không chứng nhận', false);
    const cong = await app.as('cong');
    await courses.completeLesson(cong, l1.id);
    expect(await courses.completeLesson(cong, l2.id)).toMatchObject({ courseCompleted: true, certificateEnabled: false });
    expect((await courses.getLesson(cong, l2.id)).course.certificateEnabled).toBe(false);
  });

  it('bài học trả certificateEnabled để trang học hiện lối vào chứng chỉ; khóa nháp thì chưa cấp', async () => {
    const on = await seedCourse('Khóa có chứng nhận', true);
    expect((await courses.getLesson(await app.as('cong'), on.l1.id)).course.certificateEnabled).toBe(true);
    const draft = await seedCourse('Khóa nháp có chứng nhận', true, false);
    const mq = await app.as('minhquy');
    expect((await courses.getLesson(mq, draft.l1.id)).course.certificateEnabled).toBe(false);
    expect(await courses.completeLesson(mq, draft.l1.id)).toMatchObject({ certificateEnabled: false });
  });

  it('khóa thêm bài sau khi đã xong: học nốt bài mới thì được chúc mừng lại với ngày hoàn thành mới', async () => {
    const { course, l1, l2 } = await seedCourse('Khóa thêm bài', true);
    const mq = await app.as('minhquy');
    const duy = await app.as('duy');
    await courses.completeLesson(duy, l1.id);
    expect((await courses.completeLesson(duy, l2.id)).courseCompleted).toBe(true);
    const mod = (await courses.getCourse(mq, course.id)).modules[0]!;
    const l3 = await courses.upsertLesson(mq, course.id, { moduleId: mod.id, title: 'Bài 3', kind: 'text', contentMd: 'c' });
    await expect(courses.certificate(app.anon(), course.id, await app.ids('user:duy'))).rejects.toThrow(/chưa hoàn thành/);
    expect(await courses.completeLesson(duy, l3.id)).toMatchObject({ percent: 100, courseCompleted: true });
  });
});
