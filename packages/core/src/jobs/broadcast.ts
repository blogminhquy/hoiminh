// Báo bài viết cho cả hội: job cha chia thành viên thành lô; mỗi lô khử trùng từng người rồi tạo thông báo trong ứng dụng.
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { communities, posts, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { notify } from '../services/notifications';
import { chunk, claimRecipients, FANOUT_CHUNK } from './fanout';
import { scheduleJob } from './schedule';

export const broadcastKey = (postId: string) => `post-broadcast:${postId}`;

/** Job cha: chia thành viên đang hoạt động của hội thành lô, mỗi lô một dòng scheduled_jobs `post.broadcast.batch`. */
export async function runPostBroadcast(ctx: Ctx, p: { postId: string }, opts: { chunkSize?: number } = {}): Promise<'sent' | 'stale'> {
  const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, p.postId) });
  if (!post) return 'stale';
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, post.communityId) });
  if (!community) return 'stale';
  const members = await raw<{ id: string }>(ctx.db, sql`select u.id from community_members m join users u on u.id = m.user_id where m.community_id = ${post.communityId} and m.status in ('active','cancelling') and u.status = 'active' order by u.id`);
  for (const userIds of chunk(members.map((m) => m.id), opts.chunkSize ?? FANOUT_CHUNK)) {
    // Mỗi lô là một dòng scheduled_jobs: Queue lỗi sau commit thì bộ quét vẫn đẩy được, không thành viên nào bị bỏ sót.
    await scheduleJob(ctx, { kind: 'post.broadcast.batch', payload: { postId: post.id, userIds }, dedupeKey: `${broadcastKey(post.id)}:${userIds[0]}`, runAt: ctx.now() });
  }
  return 'sent';
}

/**
 * Một lô: claim từng người rồi tạo thông báo trong ứng dụng (chuông thông báo, web và ứng dụng). Không gửi email:
 * email thông báo của hội đã bỏ theo kế hoạch 11/11/2026, email chỉ còn dùng cho việc hệ thống (xác minh, đặt lại
 * mật khẩu, biên nhận, nhắc gia hạn, nhắc sự kiện). `notify` tự tôn trọng tùy chọn "tắt thông báo hội này" của từng người.
 */
export async function runPostBroadcastBatch(ctx: Ctx, p: { postId: string; userIds: string[] }): Promise<'sent' | 'stale'> {
  const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, p.postId) });
  if (!post) return 'stale';
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, post.communityId) });
  if (!community) return 'stale';
  const rows = await ctx.db.select({ id: users.id }).from(users).where(inArray(users.id, p.userIds)).orderBy(asc(users.id));
  // Người viết bài không cần được báo về bài của chính mình.
  const eligible = rows.filter((r) => r.id !== post.authorUserId);
  const claimed = new Set(await claimRecipients(ctx, broadcastKey(post.id), eligible.map((r) => r.id)));
  const title = post.title || post.excerpt.slice(0, 60);
  let sent = 0;
  for (const r of eligible) {
    if (!claimed.has(r.id)) continue;
    await notify(ctx, { userId: r.id, communityId: community.id, kind: 'post.broadcast', category: 'post', title: `${community.name}: ${title}`, body: post.excerpt, actorUserId: post.authorUserId, link: `/${community.slug}/bai-viet/${post.id}`, actionLabel: 'Đọc bài' });
    sent++;
  }
  ctx.log.info('post.broadcast.batch.done', { postId: post.id, sent });
  return 'sent';
}
