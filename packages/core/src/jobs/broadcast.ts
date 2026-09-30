// Email broadcast bài viết: job cha chia thành viên thành lô; mỗi lô lọc theo tùy chọn thông báo, khử trùng từng người rồi gửi.
import { templates } from '@hoiminh/email';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { communities, notificationPrefs, posts, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { chunk, claimRecipients, FANOUT_CHUNK } from './fanout';

export const broadcastKey = (postId: string) => `post-broadcast:${postId}`;

/** Job cha: chia thành viên đang hoạt động của hội thành lô, mỗi lô một message `post.broadcast.batch`. */
export async function runPostBroadcast(ctx: Ctx, p: { postId: string }, opts: { chunkSize?: number } = {}): Promise<'sent' | 'stale'> {
  const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, p.postId) });
  if (!post) return 'stale';
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, post.communityId) });
  if (!community) return 'stale';
  const members = await raw<{ id: string }>(ctx.db, sql`select u.id from community_members m join users u on u.id = m.user_id where m.community_id = ${post.communityId} and m.status in ('active','cancelling') and u.status = 'active' order by u.id`);
  for (const userIds of chunk(members.map((m) => m.id), opts.chunkSize ?? FANOUT_CHUNK)) {
    await ctx.queue.enqueue('post.broadcast.batch', { postId: post.id, userIds }, { dedupeKey: `${broadcastKey(post.id)}:${userIds[0]}` });
  }
  return 'sent';
}

/** Một lô: bỏ người tắt email, claim từng người, gửi. Tôn trọng tùy chọn thông báo (mục 195). */
export async function runPostBroadcastBatch(ctx: Ctx, p: { postId: string; userIds: string[] }): Promise<'sent' | 'stale'> {
  const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, p.postId) });
  if (!post) return 'stale';
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, post.communityId) });
  if (!community) return 'stale';
  const rows = await ctx.db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(inArray(users.id, p.userIds)).orderBy(asc(users.id));
  const prefs = rows.length ? await ctx.db.query.notificationPrefs.findMany({ where: inArray(notificationPrefs.userId, rows.map((r) => r.id)) }) : [];
  const optedOut = new Set(prefs.filter((x) => x.emailDigest === false || x.perCommunity[post.communityId] === 'off').map((x) => x.userId));
  const eligible = rows.filter((r) => !optedOut.has(r.id));
  const claimed = new Set(await claimRecipients(ctx, broadcastKey(post.id), eligible.map((r) => r.id)));
  let sent = 0;
  for (const r of eligible) {
    if (!claimed.has(r.id)) continue;
    // Kết quả gửi được RecordingSender ghi vào email_logs.
    await ctx.email.send(templates.broadcastPost(r.email, community.name, post.title || post.excerpt.slice(0, 60), post.excerpt, `${ctx.env.APP_URL}/${community.slug}/bai-viet/${post.id}`));
    sent++;
  }
  ctx.log.info('post.broadcast.batch.done', { postId: post.id, sent });
  return 'sent';
}
