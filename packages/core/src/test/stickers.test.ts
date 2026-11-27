// Nhãn dán, GIF và đồ đính kèm của bình luận / tin nhắn (chủ dự án yêu cầu ngày 27/11/2026):
//   1. Bộ nhãn động khởi đầu "Mèo Mình" có sẵn sau migration, mỗi nhãn có từ khóa gợi ý.
//   2. Chỉ quản trị hệ thống tạo bộ, tải nhãn lên, sửa từ khóa, xóa; bộ tắt thì không hiện và không gửi được nữa.
//   3. Bình luận và tin nhắn gửi kèm một trong ba: ảnh, nhãn dán, GIF; được để trống chữ khi đã có đồ kèm.
//   4. Xóa bình luận dùng nhãn không bao giờ kéo theo xóa ảnh của nhãn.
//   5. GIF qua GIPHY: chưa có khóa thì tắt; có khóa thì tìm được, link lưu lại luôn nằm trên media.giphy.com.
import { fakeBucket, type FakeBucket } from '@hoiminh/media/testing';
import { files, stickerPacks } from '@hoiminh/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { AppError } from '../errors';
import * as attachments from '../services/attachments';
import * as comments from '../services/comments';
import * as filesSvc from '../services/files';
import * as gifs from '../services/gifs';
import * as messaging from '../services/messaging';
import * as posts from '../services/posts';
import * as stickers from '../services/stickers';
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

async function expectCode(p: Promise<unknown>, code: string): Promise<AppError> {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

async function uploadSticker(ctx: Ctx, mimeType = 'image/gif') {
  const r = await filesSvc.requestUpload(ctx, { fileName: 'nhan.gif', mimeType, sizeBytes: 2048, purpose: 'sticker' });
  await bucket.put(r.upload.objectKey, new Uint8Array([1, 2, 3]), { httpMetadata: { contentType: mimeType } });
  await filesSvc.completeUpload(ctx, r.fileId, { width: 240, height: 240 });
  return { fileId: r.fileId, url: r.url!, key: r.upload.objectKey };
}

async function newPost(ctx: Ctx) {
  return posts.createPost(ctx, await app.ids(KD), { spaceId: await app.ids('space:kd:chia-se'), title: 'Bài thử nhãn', contentMd: 'nội dung', imageFileIds: [], broadcastEmail: false });
}

const withGifKey = (ctx: Ctx): Ctx => ({ ...ctx, env: { ...ctx.env, GIPHY_API_KEY: 'a'.repeat(32) } });

describe('bộ nhãn khởi đầu và quyền quản lý', () => {
  it('có sẵn bộ Mèo Mình 16 nhãn động, mỗi nhãn có từ khóa gợi ý', async () => {
    const duy = await app.as('duy');
    const { packs } = await stickers.listStickers(duy);
    const meo = packs.find((p) => p.name === 'Mèo Mình');
    expect(meo?.stickers).toHaveLength(16);
    expect(meo!.stickers.every((s) => s.url.startsWith('/stickers/meo-minh/') && s.url.endsWith('.svg') && s.keywords.length > 0)).toBe(true);
    expect(meo!.stickers[0]!.keywords).toContain('chào');
  });

  it('thành viên thường không tạo bộ, không tải ảnh nhãn lên được', async () => {
    const duy = await app.as('duy');
    await expectCode(stickers.createPack(duy, { name: 'Bộ lậu' }), 'forbidden');
    await expectCode(filesSvc.requestUpload(duy, { fileName: 'a.gif', mimeType: 'image/gif', sizeBytes: 100, purpose: 'sticker' }), 'forbidden');
  });

  it('quản trị tạo bộ, tải GIF động lên làm nhãn, sửa từ khóa, đổi thứ tự; tắt bộ thì không hiện và không gửi được', async () => {
    const admin = await app.as('admin');
    const duy = await app.as('duy');
    const pack = await stickers.createPack(admin, { name: 'Bộ thử' });
    const a = await uploadSticker(admin);
    const b = await uploadSticker(admin, 'image/webp');
    // GIF giữ nguyên đuôi .gif (không bị chuyển sang WebP tĩnh), nên nhãn động vẫn động.
    expect(a.key.endsWith('.gif')).toBe(true);
    const added = await stickers.addStickers(admin, pack.id, [{ fileId: a.fileId, keywords: ['xin chào'] }, { fileId: b.fileId, keywords: [] }]);
    expect(added.stickers.map((s) => s.url)).toEqual([a.url, b.url]);
    await stickers.updateSticker(admin, added.stickers[1]!.id, { keywords: ['tạm biệt', 'bye'] });
    await stickers.reorderStickers(admin, pack.id, [added.stickers[1]!.id, added.stickers[0]!.id]);
    let mine = (await stickers.listStickers(duy)).packs.find((p) => p.id === pack.id)!;
    expect(mine.stickers.map((s) => s.id)).toEqual([added.stickers[1]!.id, added.stickers[0]!.id]);
    expect(mine.stickers[0]!.keywords).toEqual(['tạm biệt', 'bye']);

    // Ảnh chưa tải xong hoặc không phải ảnh thì không thêm được.
    const pending = await filesSvc.requestUpload(admin, { fileName: 'b.png', mimeType: 'image/png', sizeBytes: 100, purpose: 'sticker' });
    await expectCode(stickers.addStickers(admin, pack.id, [{ fileId: pending.fileId, keywords: [] }]), 'validation_error');

    expect(await attachments.resolveAttachment(duy, { stickerId: added.stickers[0]!.id })).toEqual({ imageUrl: a.url, mediaKind: 'sticker' });
    await stickers.updatePack(admin, pack.id, { active: false });
    mine = (await stickers.listStickers(duy)).packs.find((p) => p.id === pack.id)!;
    expect(mine).toBeUndefined();
    await expectCode(attachments.resolveAttachment(duy, { stickerId: added.stickers[0]!.id }), 'validation_error');
    // Quản trị vẫn thấy bộ đã tắt để bật lại.
    expect((await stickers.adminListPacks(admin)).packs.find((p) => p.id === pack.id)?.active).toBe(false);
  });
});

describe('bình luận và tin nhắn kèm nhãn, ảnh, GIF', () => {
  it('bình luận chỉ có nhãn dán: để trống chữ được, lưu loại sticker; không có gì thì báo lỗi; hai thứ một lúc thì báo lỗi', async () => {
    const mq = await app.as('minhquy');
    const duy = await app.as('duy');
    const post = await newPost(mq);
    const seeded = (await stickers.listStickers(duy)).packs.find((p) => p.name === 'Mèo Mình')!.stickers[0]!;
    const media = await attachments.resolveAttachment(duy, { stickerId: seeded.id });
    const c = await comments.createComment(duy, 'post', post.id, { contentMd: '', ...media });
    expect(c.mediaKind).toBe('sticker');
    expect(c.imageUrl).toBe(seeded.url);
    const list = await comments.listComments(duy, 'post', post.id);
    expect(list.items.find((i) => i.id === c.id)?.mediaKind).toBe('sticker');
    // Sửa bình luận chỉ có nhãn: được để trống chữ.
    await comments.updateComment(duy, c.id, { contentMd: '' });

    await expectCode(comments.createComment(duy, 'post', post.id, { contentMd: '   ' }), 'validation_error');
    const textOnly = await comments.createComment(duy, 'post', post.id, { contentMd: 'chỉ có chữ' });
    await expectCode(comments.updateComment(duy, textOnly.id, { contentMd: '' }), 'validation_error');
    await expectCode(attachments.resolveAttachment(duy, { stickerId: seeded.id, gifId: 'abcDEF123' }), 'validation_error');
  });

  it('xóa bình luận dùng nhãn tải lên không xóa ảnh của nhãn, kể cả khi người bình luận chính là người tải nhãn', async () => {
    const admin = await app.as('admin');
    const mq = await app.as('minhquy');
    const pack = await stickers.createPack(admin, { name: 'Bộ của admin' });
    const up = await uploadSticker(admin);
    const [s] = (await stickers.addStickers(admin, pack.id, [{ fileId: up.fileId, keywords: [] }])).stickers;
    const post = await newPost(mq);
    const c = await comments.createComment(mq, 'post', post.id, { contentMd: '', ...(await attachments.resolveAttachment(mq, { stickerId: s!.id })) });
    await comments.deleteComment(mq, c.id);
    await app.queue.drain();
    expect(await app.ctx.db.query.files.findFirst({ where: eq(files.id, up.fileId) })).toBeTruthy();
    expect(bucket.objects.has(up.key)).toBe(true);

    // Xóa nhãn khi vẫn còn bình luận cũ trỏ tới: ảnh giữ lại cho bình luận đó.
    const c2 = await comments.createComment(mq, 'post', post.id, { contentMd: 'kèm nhãn', ...(await attachments.resolveAttachment(mq, { stickerId: s!.id })) });
    await stickers.deleteSticker(admin, s!.id);
    await app.queue.drain();
    expect(bucket.objects.has(up.key)).toBe(true);
    expect((await comments.listComments(mq, 'post', post.id)).items.find((i) => i.id === c2.id)?.imageUrl).toBe(up.url);

    // Xóa cả bộ: dòng nhãn đi theo.
    await stickers.deletePack(admin, pack.id);
    expect(await app.ctx.db.query.stickerPacks.findFirst({ where: eq(stickerPacks.id, pack.id) })).toBeUndefined();
  });

  it('tin nhắn chỉ có nhãn dán hoặc GIF: xem trước ở danh sách hội thoại ghi [Nhãn dán] / [GIF]', async () => {
    const duy = await app.as('duy');
    const cong = await app.ids('user:cong');
    const seeded = (await stickers.listStickers(duy)).packs.find((p) => p.name === 'Mèo Mình')!.stickers[1]!;
    const m = await messaging.send(duy, { recipientUserId: cong, body: '', ...(await attachments.resolveAttachment(duy, { stickerId: seeded.id })) });
    let convo = (await messaging.listConversations(duy, {})).items.find((i) => i.id === m.conversationId)!;
    expect(convo.preview).toBe('[Nhãn dán]');
    const thread = await messaging.listMessages(duy, m.conversationId, {});
    expect(thread.items.at(-1)).toMatchObject({ imageUrl: seeded.url, mediaKind: 'sticker' });

    const gifCtx = withGifKey(duy);
    await messaging.send(gifCtx, { conversationId: m.conversationId, body: '', ...(await attachments.resolveAttachment(gifCtx, { gifId: 'xT9IgG50Fb7Mi0prBC' })) });
    convo = (await messaging.listConversations(duy, {})).items.find((i) => i.id === m.conversationId)!;
    expect(convo.preview).toBe('[GIF]');
  });
});

describe('GIF qua GIPHY', () => {
  it('chưa có khóa: tắt, không gọi ra ngoài; gửi GIF bị từ chối', async () => {
    const duy = await app.as('duy');
    let called = false;
    expect(await gifs.searchGifs(duy, 'mèo', { fetch: async () => { called = true; return new Response('{}'); } })).toEqual({ enabled: false, items: [] });
    expect(called).toBe(false);
    await expectCode(attachments.resolveAttachment(duy, { gifId: 'abcDEF123' }), 'validation_error');
  });

  it('có khóa: tìm theo từ khóa (lọc an toàn, tiếng Việt), lấy bản WebP, giữ kết quả một lúc; link gửi đi luôn ở media.giphy.com', async () => {
    gifs.clearGifCache();
    const duy = withGifKey(await app.as('duy'));
    const urls: string[] = [];
    const fake = async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ data: [{ id: 'abc123XYZ', title: 'Mèo vẫy tay', images: { fixed_width: { url: 'https://media1.giphy.com/media/abc123XYZ/200w.gif', webp: 'https://media1.giphy.com/media/abc123XYZ/200w.webp', width: '200', height: '150' }, fixed_width_small: { webp: 'https://media1.giphy.com/media/abc123XYZ/100w.webp' } } }, { id: '', images: {} }] }), { status: 200 });
    };
    const r = await gifs.searchGifs(duy, 'mèo', { fetch: fake });
    expect(r.enabled).toBe(true);
    expect(r.items).toEqual([{ id: 'abc123XYZ', title: 'Mèo vẫy tay', url: 'https://media1.giphy.com/media/abc123XYZ/200w.webp', previewUrl: 'https://media1.giphy.com/media/abc123XYZ/100w.webp', width: 200, height: 150 }]);
    const called = new URL(urls[0]!);
    expect(called.pathname).toBe('/v1/gifs/search');
    expect(called.searchParams.get('rating')).toBe('g');
    expect(called.searchParams.get('lang')).toBe('vi');
    await gifs.searchGifs(duy, 'MÈO', { fetch: fake });
    expect(urls).toHaveLength(1);
    // Trống từ khóa: GIF thịnh hành.
    await gifs.searchGifs(duy, '', { fetch: fake });
    expect(new URL(urls[1]!).pathname).toBe('/v1/gifs/trending');

    expect(await attachments.resolveAttachment(duy, { gifId: 'abc123XYZ' })).toEqual({ imageUrl: 'https://media.giphy.com/media/abc123XYZ/200w.webp', mediaKind: 'gif' });
    expect(() => gifs.gifUrl('../evil')).toThrow();
  });

  it('nhãn dán GIPHY: tìm ở kho stickers (nền trong), gửi đi lưu như nhãn dán', async () => {
    gifs.clearGifCache();
    const duy = withGifKey(await app.as('duy'));
    const urls: string[] = [];
    await gifs.searchGifs(duy, 'mèo', { type: 'stickers', fetch: async (url: string) => { urls.push(url); return new Response(JSON.stringify({ data: [] })); } });
    expect(new URL(urls[0]!).pathname).toBe('/v1/stickers/search');
    expect(await attachments.resolveAttachment(duy, { giphyStickerId: 'Zz9Sticker1' })).toEqual({ imageUrl: 'https://media.giphy.com/media/Zz9Sticker1/200w.webp', mediaKind: 'sticker' });
  });

  it('GIPHY từ chối khóa: báo rõ cho người dùng', async () => {
    gifs.clearGifCache();
    const duy = withGifKey(await app.as('duy'));
    const err = await expectCode(gifs.searchGifs(duy, 'chó', { fetch: async () => new Response('{}', { status: 403 }) }), 'internal_error');
    expect(err.message).toContain('Khóa GIPHY');
  });
});
