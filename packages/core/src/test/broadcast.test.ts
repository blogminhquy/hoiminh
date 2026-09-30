// Email broadcast bài viết: chia lô, tôn trọng tùy chọn thông báo, và mỗi thành viên chỉ nhận một lần dù job bị giao lại hay retry.
import { eq, sql } from 'drizzle-orm';
import { jobRecipients, notificationPrefs, posts as postsTable } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '../context';
import { runPostBroadcast, runPostBroadcastBatch } from '../jobs/broadcast';
import { raw } from '../lib/db';
import type { EnqueueOptions, JobMap, JobName, JobQueue } from '../jobs/queue';
import { withSystemScope } from '../lib/tenant-scope';
import * as posts from '../services/posts';
import { createTestApp, type TestApp } from './setup';

class SpyQueue implements JobQueue {
  sent: Array<{ name: string; payload: unknown; opts?: EnqueueOptions }> = [];
  async enqueue<K extends JobName>(name: K, payload: JobMap[K], opts?: EnqueueOptions): Promise<void> {
    this.sent.push({ name, payload, opts });
  }
}

let app: TestApp;
let kd: string;
beforeAll(async () => {
  app = await createTestApp();
  kd = await app.ids('community:kd');
}, 180_000);
afterAll(async () => {
  await app.close();
});

async function newPost(title: string, broadcastEmail = false) {
  const mq = await app.as('minhquy');
  return posts.createPost(mq, kd, { spaceId: await app.ids('space:kd:thong-bao'), title, contentMd: 'nội dung bài', imageFileIds: [], broadcastEmail });
}
const broadcastEmails = (title: string) => app.emails.filter((e) => e.template === 'broadcast_post' && e.subject.includes(title));
const spyCtx = (): { spy: SpyQueue; ctx: Ctx } => {
  const spy = new SpyQueue();
  return { spy, ctx: { ...app.system(), queue: spy } };
};
const activeMemberCount = async () => {
  const r = await raw<{ c: number }>(app.ctx.db, sql`select count(*)::int as c from community_members m join users u on u.id = m.user_id where m.community_id = ${kd} and m.status in ('active','cancelling') and u.status = 'active'`);
  return Number(r[0]!.c);
};

describe('post.broadcast', () => {
  it('bài không còn tồn tại thì bỏ qua', async () => {
    const { spy, ctx } = spyCtx();
    expect(await runPostBroadcast(ctx, { postId: '00000000-0000-4000-8000-000000000000' })).toBe('stale');
    expect(spy.sent).toHaveLength(0);
  });

  it('chia thành viên đang hoạt động thành các lô theo kích thước', async () => {
    const post = await newPost('Chia lô broadcast');
    const total = await activeMemberCount();
    expect(total).toBeGreaterThan(3);
    const { spy, ctx } = spyCtx();
    expect(await runPostBroadcast(ctx, { postId: post.id }, { chunkSize: 3 })).toBe('sent');
    const batches = spy.sent.filter((m) => m.name === 'post.broadcast.batch');
    const ids = batches.flatMap((b) => (b.payload as { userIds: string[] }).userIds);
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
    expect(Math.max(...batches.map((b) => (b.payload as { userIds: string[] }).userIds.length))).toBeLessThanOrEqual(3);
    expect(broadcastEmails('Chia lô broadcast')).toHaveLength(0);
  });

  it('mỗi lô gửi email cho đúng số người, tôn trọng emailDigest = false', async () => {
    const post = await newPost('Tôn trọng tùy chọn');
    const duy = await app.ids('user:duy');
    await app.ctx.db.insert(notificationPrefs).values({ userId: duy, emailDigest: false }).onConflictDoUpdate({ target: notificationPrefs.userId, set: { emailDigest: false } });
    const total = await activeMemberCount();
    const { spy, ctx } = spyCtx();
    await runPostBroadcast(ctx, { postId: post.id });
    for (const m of spy.sent) await withSystemScope(app.system(), (c) => runPostBroadcastBatch(c, m.payload as JobMap['post.broadcast.batch']));
    const mails = broadcastEmails('Tôn trọng tùy chọn');
    expect(mails).toHaveLength(total - 1);
    expect(mails.some((m) => m.to === 'duynguyen@gmail.com')).toBe(false);
    await app.ctx.db.update(notificationPrefs).set({ emailDigest: true }).where(eq(notificationPrefs.userId, duy));
  });

  it('cùng một lô chạy hai lần hoặc retry sau lỗi thì mỗi người chỉ nhận một email', async () => {
    const post = await newPost('Không gửi trùng');
    const total = await activeMemberCount();
    const { spy, ctx } = spyCtx();
    await runPostBroadcast(ctx, { postId: post.id });
    const batch = spy.sent[0]!.payload as JobMap['post.broadcast.batch'];
    await expect(
      withSystemScope(app.system(), async (c) => {
        await runPostBroadcastBatch(c, batch);
        throw new Error('hỏng sau khi xử lý lô');
      }),
    ).rejects.toThrow();
    expect(broadcastEmails('Không gửi trùng')).toHaveLength(0);
    for (const m of spy.sent) await withSystemScope(app.system(), (c) => runPostBroadcastBatch(c, m.payload as JobMap['post.broadcast.batch']));
    for (const m of spy.sent) await withSystemScope(app.system(), (c) => runPostBroadcastBatch(c, m.payload as JobMap['post.broadcast.batch']));
    expect(broadcastEmails('Không gửi trùng')).toHaveLength(total);
    expect((await app.ctx.db.select().from(jobRecipients).where(eq(jobRecipients.jobKey, `post-broadcast:${post.id}`))).length).toBe(total);
  });

  it('lô tới sau khi bài đã bị xoá thì bỏ qua', async () => {
    const post = await newPost('Bài bị xoá');
    const { spy, ctx } = spyCtx();
    await runPostBroadcast(ctx, { postId: post.id });
    await app.ctx.db.delete(postsTable).where(eq(postsTable.id, post.id));
    for (const m of spy.sent) await withSystemScope(app.system(), (c) => runPostBroadcastBatch(c, m.payload as JobMap['post.broadcast.batch']));
    expect(broadcastEmails('Bài bị xoá')).toHaveLength(0);
  });

  it('đầu-cuối qua hàng đợi: đăng bài có broadcastEmail thì mọi thành viên nhận đúng một email', async () => {
    const total = await activeMemberCount();
    await newPost('Đầu cuối broadcast', true);
    await app.queue.drain();
    expect(broadcastEmails('Đầu cuối broadcast')).toHaveLength(total);
  });
});
