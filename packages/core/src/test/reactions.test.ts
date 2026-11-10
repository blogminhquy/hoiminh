// Cảm xúc kiểu Facebook trên bài viết và bình luận: thả, đổi loại, gỡ; số theo loại đi kèm bảng tin, bài viết và bình luận.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as comments from '../services/comments';
import * as posts from '../services/posts';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let kd = '';
let postId = '';

beforeAll(async () => {
  app = await createTestApp();
  kd = await app.ids('community:kd');
  // Bài mới tinh để không dính lượt thích có sẵn trong dữ liệu mẫu.
  const owner = await app.as('minhquy');
  const spaceId = (await posts.feed(owner, kd, {})).spaces[0]!.id;
  postId = (await posts.createPost(owner, kd, { spaceId, title: 'Bài thử cảm xúc', contentMd: 'Nội dung bài thử cảm xúc.', statusBgKey: null, imageFileIds: [], videoUrl: null, linkUrl: null, broadcastEmail: false, poll: null })).id;
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('cảm xúc trên bài viết', () => {
  it('không truyền loại thì bật tắt Thích như cũ', async () => {
    const duy = await app.as('duy');
    const before = (await posts.getPost(duy, postId)).likeCount;
    expect(await comments.toggleReaction(duy, 'post', postId)).toEqual({ liked: true, reaction: 'like', likeCount: before + 1 });
    expect(await comments.toggleReaction(duy, 'post', postId)).toEqual({ liked: false, reaction: null, likeCount: before });
  });

  it('thả một loại, đổi sang loại khác thì tổng không đổi, thả lại đúng loại đó thì gỡ', async () => {
    const duy = await app.as('duy');
    const before = (await posts.getPost(duy, postId)).likeCount;
    expect(await comments.toggleReaction(duy, 'post', postId, 'love')).toEqual({ liked: true, reaction: 'love', likeCount: before + 1 });
    expect(await comments.toggleReaction(duy, 'post', postId, 'haha')).toEqual({ liked: true, reaction: 'haha', likeCount: before + 1 });
    const detail = await posts.getPost(duy, postId);
    expect(detail).toMatchObject({ liked: true, myReaction: 'haha', likeCount: before + 1 });
    expect(detail.reactionCounts.haha).toBe(1);
    expect(detail.reactionCounts.love).toBeUndefined();
    expect(await comments.toggleReaction(duy, 'post', postId, 'haha')).toEqual({ liked: false, reaction: null, likeCount: before });
  });

  it('bảng tin trả cảm xúc của người xem và số theo loại; người khác thấy số nhưng không thấy cảm xúc của mình', async () => {
    const duy = await app.as('duy');
    const cong = await app.as('cong');
    await comments.toggleReaction(duy, 'post', postId, 'wow');
    await comments.toggleReaction(cong, 'post', postId, 'love');
    const mine = (await posts.feed(duy, kd, {})).items.find((p) => p.id === postId)!;
    expect(mine).toMatchObject({ liked: true, myReaction: 'wow' });
    expect(mine.reactionCounts).toMatchObject({ wow: 1, love: 1 });
    const other = (await posts.feed(await app.as('kienbui'), kd, {})).items.find((p) => p.id === postId)!;
    expect(other).toMatchObject({ liked: false, myReaction: null });
    expect(other.reactionCounts).toMatchObject({ wow: 1, love: 1 });
  });
});

describe('cảm xúc trên bình luận', () => {
  it('bình luận cũng thả được cảm xúc và trả về cùng danh sách', async () => {
    const duy = await app.as('duy');
    const c = await comments.createComment(duy, 'post', postId, { contentMd: 'Bình luận để thử cảm xúc' });
    expect(await comments.toggleReaction(await app.as('cong'), 'comment', c.id, 'sad')).toMatchObject({ liked: true, reaction: 'sad', likeCount: 1 });
    const list = await comments.listComments(await app.as('cong'), 'post', postId, { sort: 'newest' });
    const row = list.items.find((x) => x.id === c.id)!;
    expect(row).toMatchObject({ liked: true, myReaction: 'sad', likeCount: 1, reactionCounts: { sad: 1 } });
    const seenByAuthor = (await comments.listComments(duy, 'post', postId, { sort: 'newest' })).items.find((x) => x.id === c.id)!;
    expect(seenByAuthor).toMatchObject({ liked: false, myReaction: null, reactionCounts: { sad: 1 } });
  });
});
