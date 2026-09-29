// Dọn tệp trên R2 khi ảnh bị gỡ: xóa bài, xóa bình luận, đổi avatar/logo/ảnh bìa, hủy ảnh tải lên dở.
// Việc xóa R2 đi qua hàng đợi scheduled_jobs (ghi cùng transaction với việc gỡ tham chiếu), cron mỗi phút mới xóa thật.
import { fakeBucket, type FakeBucket } from '@hoiminh/media/testing';
import { comments as commentsTable, files, lessonResources, postImages, productPages, products, scheduledJobs } from '@hoiminh/db';
import * as schema from '@hoiminh/db';
import { and, eq, getTableName, is, sql } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { runCron, runScheduledJobs } from '../jobs/cron';
import { withTenantScope } from '../lib/tenant-scope';
import * as comments from '../services/comments';
import * as communities from '../services/communities';
import * as courses from '../services/courses';
import * as filesSvc from '../services/files';
import * as posts from '../services/posts';
import * as store from '../services/store';
import * as users from '../services/users';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let bucket: FakeBucket;
const KD = 'community:kd';

beforeAll(async () => {
  bucket = fakeBucket();
  app = await createTestApp({ r2Bucket: bucket });
}, 180_000);
afterAll(async () => {
  await app.close();
});

interface Uploaded { fileId: string; url: string; key: string }

/** Tải một ảnh lên như trình duyệt: xin URL, ghi vào R2 giả, xác nhận xong. */
async function upload(ctx: Ctx, purpose: 'post_image' | 'avatar' | 'cover' | 'comment_image', opts: { communityId?: string | null; complete?: boolean } = {}): Promise<Uploaded> {
  const r = await filesSvc.requestUpload(ctx, { fileName: 'anh.jpg', mimeType: 'image/jpeg', sizeBytes: 1234, purpose, communityId: opts.communityId ?? null });
  await bucket.put(r.upload.objectKey, new Uint8Array([1, 2, 3]), { httpMetadata: { contentType: 'image/jpeg' } });
  if (opts.complete !== false) await filesSvc.completeUpload(ctx, r.fileId, { width: 100, height: 100 });
  return { fileId: r.fileId, url: r.url!, key: r.upload.objectKey };
}

const fileRow = (fileId: string) => app.ctx.db.query.files.findFirst({ where: eq(files.id, fileId) });
const jobFor = (key: string) => app.ctx.db.query.scheduledJobs.findFirst({ where: eq(scheduledJobs.dedupeKey, `${filesSvc.FILE_DELETE_JOB}:${key}`) });
/** Chạy cron mỗi phút như trên production: đây là lúc R2 thật sự bị xóa. */
const runJobs = () => runScheduledJobs(app.system());

async function newPost(ctx: Ctx, images: Uploaded[]) {
  const kd = await app.ids(KD);
  return posts.createPost(ctx, kd, { spaceId: await app.ids('space:kd:chia-se'), title: 'Bài có ảnh', contentMd: 'nội dung', imageFileIds: images.map((i) => i.fileId), broadcastEmail: false });
}

describe('xóa bài viết', () => {
  it('gỡ ảnh khỏi bài và xóa tệp trên R2 khi cron chạy', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const a = await upload(mq, 'post_image', { communityId: kd });
    const b = await upload(mq, 'post_image', { communityId: kd });
    const post = await newPost(mq, [a, b]);
    expect(await app.ctx.db.query.postImages.findMany({ where: eq(postImages.postId, post.id) })).toHaveLength(2);

    await posts.deletePost(mq, post.id);

    // Ngay sau khi xóa bài: tham chiếu đã gỡ, việc xóa R2 nằm trong hàng đợi, tệp trên R2 chưa mất.
    expect(await app.ctx.db.query.postImages.findMany({ where: eq(postImages.postId, post.id) })).toHaveLength(0);
    expect(await fileRow(a.fileId)).toBeUndefined();
    expect((await jobFor(a.key))?.status).toBe('pending');
    expect(bucket.objects.has(a.key)).toBe(true);

    await runJobs();
    expect(bucket.objects.has(a.key)).toBe(false);
    expect(bucket.objects.has(b.key)).toBe(false);
    expect((await jobFor(a.key))?.status).toBe('done');
  });

  it('bài bị từ chối duyệt cũng dọn ảnh', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const img = await upload(mq, 'post_image', { communityId: kd });
    const post = await newPost(mq, [img]);
    await app.ctx.db.execute(sql`update posts set moderation_status = 'pending' where id = ${post.id}`);
    await posts.moderatePost(mq, post.id, 'reject', 'Không phù hợp');
    await runJobs();
    expect(bucket.objects.has(img.key)).toBe(false);
  });

  it('dọn cả ảnh trong bình luận của bài', async () => {
    const mq = await app.as('minhquy');
    const duy = await app.as('duy');
    const kd = await app.ids(KD);
    const post = await newPost(mq, []);
    const img = await upload(duy, 'comment_image', { communityId: kd });
    const c = await comments.createComment(duy, 'post', post.id, { contentMd: 'ảnh minh họa', imageUrl: img.url });
    await posts.deletePost(mq, post.id);
    expect((await app.ctx.db.query.comments.findFirst({ where: eq(commentsTable.id, c.id) }))?.imageUrl).toBeNull();
    await runJobs();
    expect(bucket.objects.has(img.key)).toBe(false);
  });

  it('người kiểm duyệt xóa bài của thành viên vẫn xóa được ảnh của thành viên đó', async () => {
    const mq = await app.as('minhquy');
    const duy = await app.as('duy');
    const kd = await app.ids(KD);
    const img = await upload(duy, 'post_image', { communityId: kd });
    const post = await newPost(duy, [img]);
    await posts.deletePost(mq, post.id);
    await runJobs();
    expect(bucket.objects.has(img.key)).toBe(false);
  });
});

describe('xóa bình luận', () => {
  it('xóa bình luận có ảnh thì xóa tệp', async () => {
    const mq = await app.as('minhquy');
    const duy = await app.as('duy');
    const kd = await app.ids(KD);
    const post = await newPost(mq, []);
    const img = await upload(duy, 'comment_image', { communityId: kd });
    const c = await comments.createComment(duy, 'post', post.id, { contentMd: 'có ảnh', imageUrl: img.url });
    await comments.deleteComment(duy, c.id);
    await runJobs();
    expect(bucket.objects.has(img.key)).toBe(false);
  });
});

describe('đổi hoặc gỡ ảnh', () => {
  it('đổi avatar: tệp cũ bị xóa, tệp mới giữ nguyên', async () => {
    const cong = await app.as('cong');
    const oldAv = await upload(cong, 'avatar');
    await users.updateProfile(cong, { avatarUrl: oldAv.url });
    const newAv = await upload(cong, 'avatar');
    await users.updateProfile(cong, { avatarUrl: newAv.url });
    await runJobs();
    expect(bucket.objects.has(oldAv.key)).toBe(false);
    expect(bucket.objects.has(newAv.key)).toBe(true);
    expect(await fileRow(newAv.fileId)).toBeTruthy();
  });

  it('gỡ avatar thì xóa tệp; lưu lại đúng avatar đang dùng thì không xóa', async () => {
    const cong = await app.as('cong');
    const av = await upload(cong, 'avatar');
    await users.updateProfile(cong, { avatarUrl: av.url });
    await users.updateProfile(cong, { avatarUrl: av.url, bio: 'lưu lại cùng avatar' });
    await runJobs();
    expect(bucket.objects.has(av.key)).toBe(true);
    await users.updateProfile(cong, { avatarUrl: null });
    await runJobs();
    expect(bucket.objects.has(av.key)).toBe(false);
  });

  it('không xóa tệp của người khác dù avatar đang trỏ vào nó', async () => {
    const mq = await app.as('minhquy');
    const duy = await app.as('duy');
    const kd = await app.ids(KD);
    const victim = await upload(mq, 'post_image', { communityId: kd });
    await newPost(mq, [victim]);
    // Duy đặt avatar trỏ vào ảnh của Minh Quý rồi đổi avatar: tệp của Minh Quý phải còn nguyên.
    await users.updateProfile(duy, { avatarUrl: victim.url });
    await users.updateProfile(duy, { avatarUrl: null });
    await runJobs();
    expect(bucket.objects.has(victim.key)).toBe(true);
    expect(await fileRow(victim.fileId)).toBeTruthy();
  });

  it('tệp còn nơi khác dùng thì giữ lại, hết nơi dùng mới xóa', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const img = await upload(mq, 'post_image', { communityId: kd });
    const post = await newPost(mq, [img]);
    await communities.updateGeneral(mq, kd, { logoUrl: img.url });
    await posts.deletePost(mq, post.id);
    await runJobs();
    expect(bucket.objects.has(img.key)).toBe(true); // logo hội vẫn dùng
    await communities.updateGeneral(mq, kd, { logoUrl: null });
    await runJobs();
    expect(bucket.objects.has(img.key)).toBe(false);
  });

  it('đổi logo và ảnh bìa hội: tệp cũ bị xóa', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const logo1 = await upload(mq, 'avatar', { communityId: kd });
    const cover1 = await upload(mq, 'cover', { communityId: kd });
    await communities.updateGeneral(mq, kd, { logoUrl: logo1.url, coverUrl: cover1.url });
    const logo2 = await upload(mq, 'avatar', { communityId: kd });
    await communities.updateGeneral(mq, kd, { logoUrl: logo2.url });
    await runJobs();
    expect(bucket.objects.has(logo1.key)).toBe(false);
    expect(bucket.objects.has(logo2.key)).toBe(true);
    expect(bucket.objects.has(cover1.key)).toBe(true); // không đổi ảnh bìa thì giữ
    await communities.updateGeneral(mq, kd, { coverUrl: null });
    await runJobs();
    expect(bucket.objects.has(cover1.key)).toBe(false);
  });

  it('đổi ảnh bìa khóa học xóa ảnh cũ; xóa khóa học xóa ảnh bìa', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const c1 = await upload(mq, 'cover', { communityId: kd });
    const course = await courses.createCourse(mq, kd, { title: 'Khóa dọn ảnh', shortDescription: 'x', descriptionMd: '', coverFileId: c1.fileId, accessMode: 'all_members', previewFirstModule: false, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: false });
    const c2 = await upload(mq, 'cover', { communityId: kd });
    await courses.updateCourse(mq, course.id, { coverFileId: c2.fileId });
    await runJobs();
    expect(bucket.objects.has(c1.key)).toBe(false);
    expect(bucket.objects.has(c2.key)).toBe(true);
    await courses.deleteCourse(mq, course.id);
    await runJobs();
    expect(bucket.objects.has(c2.key)).toBe(false);
  });

  it('xóa sản phẩm xóa ảnh bìa của sản phẩm và trang bán', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const cover = await upload(mq, 'cover', { communityId: kd });
    const p = await app.ctx.db.query.products.findFirst({ where: and(eq(products.communityId, kd), sql`${products.deletedAt} is null`) });
    await app.ctx.db.update(products).set({ coverUrl: cover.url }).where(eq(products.id, p!.id));
    await app.ctx.db.update(productPages).set({ coverImageUrl: cover.url }).where(eq(productPages.productId, p!.id));
    await store.deleteProduct(mq, p!.id);
    await runJobs();
    expect(bucket.objects.has(cover.key)).toBe(false);
    expect((await app.ctx.db.query.productPages.findFirst({ where: eq(productPages.productId, p!.id) }))?.coverImageUrl).toBeNull();
  });
});

describe('hủy ảnh tải lên dở', () => {
  it('chủ tệp hủy được tệp chưa dùng vào đâu', async () => {
    const mq = await app.as('minhquy');
    const img = await upload(mq, 'post_image');
    await filesSvc.discardUpload(mq, img.fileId);
    expect(await fileRow(img.fileId)).toBeUndefined();
    await runJobs();
    expect(bucket.objects.has(img.key)).toBe(false);
  });

  it('tệp đang được dùng thì từ chối hủy', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const img = await upload(mq, 'post_image', { communityId: kd });
    await newPost(mq, [img]);
    await expect(filesSvc.discardUpload(mq, img.fileId)).rejects.toThrow(/đang được dùng/);
    expect(await fileRow(img.fileId)).toBeTruthy();
    expect(bucket.objects.has(img.key)).toBe(true);
  });

  it('tệp gắn vào sản phẩm số hoặc tài liệu bài học (id trong jsonb, file_id, object key) không bao giờ bị hủy', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const digital = await upload(mq, 'post_image', { communityId: kd });
    const p = await app.ctx.db.query.products.findFirst({ where: and(eq(products.communityId, kd), sql`${products.deletedAt} is null`) });
    await app.ctx.db.execute(sql`update products set digital_file_ids = ${JSON.stringify([digital.fileId])}::jsonb where id = ${p!.id}`);
    await expect(filesSvc.discardUpload(mq, digital.fileId)).rejects.toThrow(/đang được dùng/);

    const lesson = await app.ctx.db.query.lessons.findFirst();
    const byId = await upload(mq, 'post_image', { communityId: kd });
    await app.ctx.db.insert(lessonResources).values({ lessonId: lesson!.id, fileId: byId.fileId, name: 'tài liệu', url: 'seed://khong-lien-quan' });
    await expect(filesSvc.discardUpload(mq, byId.fileId)).rejects.toThrow(/đang được dùng/);

    const byKey = await upload(mq, 'post_image', { communityId: kd });
    await app.ctx.db.insert(lessonResources).values({ lessonId: lesson!.id, fileId: null, name: 'tài liệu riêng', url: byKey.key });
    await expect(filesSvc.discardUpload(mq, byKey.fileId)).rejects.toThrow(/đang được dùng/);

    for (const f of [digital, byId, byKey]) expect(await fileRow(f.fileId)).toBeTruthy();
    await runJobs();
    for (const f of [digital, byId, byKey]) expect(bucket.objects.has(f.key)).toBe(true);
  });

  it('người khác không hủy được tệp của mình', async () => {
    const mq = await app.as('minhquy');
    const duy = await app.as('duy');
    const img = await upload(mq, 'post_image');
    await expect(filesSvc.discardUpload(duy, img.fileId)).rejects.toThrow();
    expect(await fileRow(img.fileId)).toBeTruthy();
  });

  it('quét tệp bỏ dở: chỉ xóa tệp pending quá 24 giờ và không còn ai dùng', async () => {
    const mq = await app.as('minhquy');
    const kd = await app.ids(KD);
    const stale = await upload(mq, 'post_image', { complete: false });
    const fresh = await upload(mq, 'post_image', { complete: false });
    const staleButUsed = await upload(mq, 'post_image', { communityId: kd, complete: false });
    await newPost(mq, [staleButUsed]);
    const ready = await upload(mq, 'post_image');
    await app.ctx.db.execute(sql`update files set created_at = now() - interval '25 hours' where id in (${stale.fileId}::uuid, ${staleButUsed.fileId}::uuid, ${ready.fileId}::uuid)`);
    const swept = await runCron(app.ctx, 'daily');
    expect(swept.abandonedUploads).toBe(1);
    await runJobs();
    expect(bucket.objects.has(stale.key)).toBe(false);
    expect(bucket.objects.has(fresh.key)).toBe(true); // mới tải lên, có thể đang tải dở
    expect(bucket.objects.has(staleButUsed.key)).toBe(true); // đã gắn vào bài
    expect(bucket.objects.has(ready.key)).toBe(true); // đã xác nhận xong: không quét (có thể dán vào Markdown)
  });
});

describe('độ tin cậy của việc xóa', () => {
  it('giao dịch bị hủy thì tệp, tham chiếu và hàng đợi đều nguyên vẹn', async () => {
    const mq = await app.as('minhquy');
    const img = await upload(mq, 'post_image');
    await expect(withTenantScope(mq, async (scoped) => {
      const n = await filesSvc.releaseFiles(scoped, { fileIds: [img.fileId] }, { ownerUserIds: [await app.ids('user:minhquy')] });
      expect(n).toBe(1);
      throw new Error('hủy giao dịch');
    })).rejects.toThrow('hủy giao dịch');
    expect(await fileRow(img.fileId)).toBeTruthy();
    expect(await jobFor(img.key)).toBeUndefined();
    await runJobs();
    expect(bucket.objects.has(img.key)).toBe(true);
  });

  it('R2 lỗi thì job được thử lại, không mất', async () => {
    const mq = await app.as('minhquy');
    const img = await upload(mq, 'post_image');
    await filesSvc.discardUpload(mq, img.fileId);
    const realDelete = bucket.delete.bind(bucket);
    let failures = 1;
    bucket.delete = async (keys) => {
      if (failures-- > 0) throw new Error('R2 tạm thời lỗi');
      return realDelete(keys);
    };
    try {
      await runJobs();
      const failed = await jobFor(img.key);
      expect(failed?.status).toBe('pending');
      expect(failed?.attempts).toBe(1);
      expect(failed?.lastError).toContain('R2 tạm thời lỗi');
      expect(bucket.objects.has(img.key)).toBe(true);
      await app.ctx.db.execute(sql`update scheduled_jobs set run_at = now() - interval '1 minute' where dedupe_key = ${`${filesSvc.FILE_DELETE_JOB}:${img.key}`}`);
      await runJobs();
      expect(bucket.objects.has(img.key)).toBe(false);
      expect((await jobFor(img.key))?.status).toBe('done');
    } finally {
      bucket.delete = realDelete;
    }
  });

  it('xóa một khóa không còn trên R2 vẫn coi là xong', async () => {
    const mq = await app.as('minhquy');
    const img = await upload(mq, 'post_image');
    bucket.objects.delete(img.key);
    await filesSvc.discardUpload(mq, img.fileId);
    await runJobs();
    expect((await jobFor(img.key))?.status).toBe('done');
  });

  it('bỏ qua địa chỉ không phải tệp của mình: ảnh dữ liệu mẫu, link ngoài, chuỗi rỗng', async () => {
    const mq = await app.as('minhquy');
    const n = await filesSvc.releaseFiles(mq, { urls: ['data:image/svg+xml;utf8,<svg/>', 'https://example.com/a.png', '', null, undefined], fileIds: [null, undefined] }, { ownerUserIds: [await app.ids('user:minhquy')] });
    expect(n).toBe(0);
  });

  it('không có phạm vi thì không xóa gì', async () => {
    const mq = await app.as('minhquy');
    const img = await upload(mq, 'post_image');
    expect(await filesSvc.releaseFiles(mq, { fileIds: [img.fileId] }, {})).toBe(0);
    expect(await fileRow(img.fileId)).toBeTruthy();
  });
});

describe('danh sách cột tham chiếu tệp', () => {
  // Cột nào lưu URL hoặc id tệp mà không nằm trong FILE_REFERENCES thì việc dọn R2 sẽ xóa nhầm tệp đang dùng.
  // Thêm cột kiểu này thì thêm vào FILE_REFERENCES; cột chỉ là link ngoài thì thêm vào NOT_A_FILE_REFERENCE bên dưới.
  const NOT_A_FILE_REFERENCE = [
    'affiliate_links.destination_url', 'affiliate_clicks.landing_url', 'events.meeting_url', 'event_recordings.video_url',
    'lessons.video_url', 'courses.intro_video_url', 'communities.intro_video_url', 'product_pages.intro_video_url', 'product_pages.external_landing_url',
    'posts.video_url', 'posts.link_url', 'webhooks.url', 'files.url',
  ];
  const allColumns = (Object.values(schema) as unknown[]).filter((t): t is PgTable => typeof t === 'object' && t !== null && Object.getPrototypeOf(t) !== null && is(t, PgTable)).flatMap((t) => getTableConfig(t).columns.map((c) => `${getTableName(t)}.${c.name}`));

  it('mọi cột có vẻ chứa URL hoặc id tệp đều đã được xếp loại', () => {
    const known = new Set([...filesSvc.FILE_REFERENCES.map((r) => `${r.table}.${r.column}`), ...NOT_A_FILE_REFERENCE]);
    const unclassified = allColumns.filter((c) => /(url|file)/i.test(c.split('.')[1]!) && !known.has(c));
    expect(unclassified).toEqual([]);
  });

  it('mọi cột trong FILE_REFERENCES và danh sách loại trừ có thật trong schema (chống gõ nhầm tên)', () => {
    const listed = [...filesSvc.FILE_REFERENCES.map((r) => `${r.table}.${r.column}`), ...NOT_A_FILE_REFERENCE];
    expect(listed.filter((c) => !allColumns.includes(c))).toEqual([]);
  });
});

