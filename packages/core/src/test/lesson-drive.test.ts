// Bài học dùng link Google Drive: nhận diện link tệp, nhúng khung xem trước, và không gửi link gốc cho người học.
import { parseDriveUrl, parseLessonVideoUrl, parseVideoUrl } from '@hoiminh/contracts';
import { eq } from 'drizzle-orm';
import { lessons } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as courses from '../services/courses';
import { fetchVideoMeta } from '../services/video-meta';
import { createTestApp, type TestApp } from './setup';

const FILE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const PREVIEW = `https://drive.google.com/file/d/${FILE_ID}/preview`;

describe('nhận diện link Google Drive', () => {
  it.each([
    `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`,
    `https://drive.google.com/file/d/${FILE_ID}/view?usp=drive_link`,
    `https://drive.google.com/file/d/${FILE_ID}/preview`,
    `https://drive.google.com/file/d/${FILE_ID}/edit`,
    `https://drive.google.com/u/0/file/d/${FILE_ID}/view`,
    `https://drive.google.com/open?id=${FILE_ID}`,
    `https://drive.google.com/uc?id=${FILE_ID}&export=download`,
    `https://docs.google.com/file/d/${FILE_ID}/edit`,
    `  https://www.drive.google.com/file/d/${FILE_ID}/view  `,
  ])('%s → khung xem trước', (url) => {
    expect(parseDriveUrl(url)).toMatchObject({ provider: 'gdrive', externalId: FILE_ID, embedUrl: PREVIEW });
  });

  it('tệp cũ có resourcekey thì giữ tham số đó trong khung', () => {
    expect(parseDriveUrl(`https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing&resourcekey=0-AbC_dEf-123`)?.embedUrl).toBe(`${PREVIEW}?resourcekey=0-AbC_dEf-123`);
  });

  it.each([
    'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
    'https://drive.google.com/file/d/ngan/view',
    `https://drive.google.com/file/d/${FILE_ID}"><script>/view`,
    `https://drive.google.com.evil.example/file/d/${FILE_ID}/view`,
    `https://evil.example/file/d/${FILE_ID}/view?x=drive.google.com`,
    'https://drive.google.com/open?id=',
    'khong phai link',
  ])('%s → không nhận', (url) => {
    expect(parseDriveUrl(url)).toBeNull();
  });

  it('chỉ bài học nhận Drive: parseVideoUrl dùng cho bài viết, sự kiện vẫn từ chối; link YouTube không đổi', () => {
    const drive = `https://drive.google.com/file/d/${FILE_ID}/view`;
    expect(parseVideoUrl(drive)).toBeNull();
    expect(parseLessonVideoUrl(drive)?.provider).toBe('gdrive');
    expect(parseLessonVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ'));
  });

  it('nhập nhanh nhận link Drive mà không gọi ra ngoài', async () => {
    const r = await fetchVideoMeta(`https://drive.google.com/file/d/${FILE_ID}/view`, { fetch: () => { throw new Error('không được gọi mạng'); } });
    expect(r).toMatchObject({ embed: { provider: 'gdrive' }, meta: null });
  });
});

describe('bài học Google Drive', () => {
  let app: TestApp;
  let courseId = '';
  let lessonId = '';
  const shareUrl = `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`;

  beforeAll(async () => {
    app = await createTestApp();
    courseId = await app.ids('course:fmm');
    // Bài đầu của chương đầu: khóa mẫu cho xem trước chương đầu nên thành viên thường mở được.
    const course = await courses.getCourse(await app.as('minhquy'), courseId);
    lessonId = course.modules[0]!.lessons[0]!.id;
  }, 180_000);
  afterAll(async () => {
    await app.close();
  });

  it('chủ khóa dán link chia sẻ: lưu là gdrive, chủ khóa vẫn thấy link gốc để sửa', async () => {
    const owner = await app.as('minhquy');
    const saved = await courses.upsertLesson(owner, courseId, { id: lessonId, videoUrl: shareUrl });
    expect(saved).toMatchObject({ videoProvider: 'gdrive', videoExternalId: FILE_ID, videoUrl: shareUrl });
    const seen = await courses.getLesson(owner, lessonId);
    expect(seen.lesson.videoUrl).toBe(shareUrl);
    expect(seen.embed).toMatchObject({ provider: 'gdrive', embedUrl: PREVIEW, originalUrl: shareUrl, externalId: FILE_ID });
  });

  it('người học nhận khung xem trước, không nhận link chia sẻ gốc', async () => {
    const seen = await courses.getLesson(await app.as('member1'), lessonId);
    expect(seen.locked).toBe(false);
    expect(seen.embed).toEqual({ provider: 'gdrive', embedUrl: PREVIEW, externalId: '', originalUrl: '' });
    expect(seen.lesson.videoUrl).toBeNull();
    expect(seen.lesson.videoExternalId).toBeNull();
    expect(JSON.stringify(seen)).not.toContain('usp=sharing');
    // Dữ liệu gốc không đổi: chỉ câu trả lời cho người học bị lược.
    expect((await app.ctx.db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) }))?.videoUrl).toBe(shareUrl);
  });

  it('link thư mục Drive bị từ chối kèm lời giải thích', async () => {
    await expect(courses.upsertLesson(await app.as('minhquy'), courseId, { id: lessonId, videoUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345' })).rejects.toMatchObject({ status: 422, message: expect.stringContaining('Google Drive') });
  });

  it('bài YouTube không bị lược gì với người học', async () => {
    const owner = await app.as('minhquy');
    await courses.upsertLesson(owner, courseId, { id: lessonId, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    const seen = await courses.getLesson(await app.as('member1'), lessonId);
    expect(seen.embed).toMatchObject({ provider: 'youtube', externalId: 'dQw4w9WgXcQ' });
    expect(seen.lesson.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
  });
});
