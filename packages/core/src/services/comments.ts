// Bình luận lồng nhau (bài viết, bài học, sự kiện), ghim, thích; phản ứng cho bài viết.
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { comments, communityMembers, events, lessons, posts, reactions, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { forbidden, notFound } from '../errors';
import { mentions } from '../lib/markdown';
import { requireCommunityPermission, requireUser, resolveCommunityAccess } from '../permissions';

const authorCols = { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor };

async function communityOfTarget(ctx: Ctx, targetType: 'post' | 'lesson' | 'event', targetId: string): Promise<string> {
  if (targetType === 'post') return (await ctx.db.query.posts.findFirst({ where: and(eq(posts.id, targetId), isNull(posts.deletedAt)), columns: { communityId: true } }))?.communityId ?? '';
  if (targetType === 'event') return (await ctx.db.query.events.findFirst({ where: eq(events.id, targetId), columns: { communityId: true } }))?.communityId ?? '';
  const l = await ctx.db.query.lessons.findFirst({ where: eq(lessons.id, targetId), columns: { courseId: true } });
  if (!l) return '';
  const r = await raw(ctx.db, sql`select community_id from courses where id = ${l.courseId}`);
  return (r[0] as { community_id: string } | undefined)?.community_id ?? '';
}

/** Danh sách bình luận theo cây (2 cấp: gốc + trả lời). */
export async function listComments(ctx: Ctx, targetType: 'post' | 'lesson' | 'event', targetId: string, q: { sort?: 'top' | 'newest' } = {}) {
  const communityId = await communityOfTarget(ctx, targetType, targetId);
  if (!communityId) throw notFound();
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has('community.read')) throw forbidden();
  const rows = await ctx.db
    .select({ c: comments, author: authorCols, level: communityMembers.level, role: communityMembers.role })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorUserId))
    .leftJoin(communityMembers, and(eq(communityMembers.communityId, comments.communityId), eq(communityMembers.userId, comments.authorUserId)))
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId), isNull(comments.deletedAt)))
    .orderBy(desc(comments.pinned), q.sort === 'newest' ? desc(comments.createdAt) : desc(comments.likeCount), asc(comments.createdAt));
  const liked = ctx.actor.type === 'user' ? new Set((await ctx.db.query.reactions.findMany({ where: and(eq(reactions.userId, ctx.actor.userId), eq(reactions.targetType, 'comment')) })).map((r) => r.targetId)) : new Set<string>();
  const items = rows.map((r) => ({ ...r.c, author: { ...r.author, level: r.level ?? 1, isAdmin: r.role === 'owner' || r.role === 'admin' }, liked: liked.has(r.c.id), replies: [] as Array<typeof rows[number]['c'] & { author: typeof rows[number]['author'] & { level: number; isAdmin: boolean }; liked: boolean; replies: never[] }> }));
  const roots = items.filter((i) => !i.parentCommentId);
  for (const i of items) if (i.parentCommentId) {
    const parent = items.find((p) => p.id === i.parentCommentId);
    if (parent) parent.replies.push(i as never);
  }
  for (const r of roots) r.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return { items: roots, total: items.length, canModerate: access.permissions.has('post.moderate') };
}

/** Tạo bình luận hoặc trả lời; cập nhật đếm; phát comment.created kèm @mention. */
export async function createComment(ctx: Ctx, targetType: 'post' | 'lesson' | 'event', targetId: string, input: { contentMd: string; parentCommentId?: string | null; imageUrl?: string | null }) {
  const userId = requireUser(ctx);
  const communityId = await communityOfTarget(ctx, targetType, targetId);
  if (!communityId) throw notFound();
  await requireCommunityPermission(ctx, communityId, 'post.create');
  let parentId = input.parentCommentId ?? null;
  if (parentId) {
    const parent = await ctx.db.query.comments.findFirst({ where: eq(comments.id, parentId) });
    if (!parent || parent.targetId !== targetId) throw notFound('Bình luận gốc không tồn tại');
    parentId = parent.parentCommentId ?? parent.id;
  }
  const [row] = await ctx.db.insert(comments).values({ communityId, targetType, targetId, authorUserId: userId, parentCommentId: parentId, contentMd: input.contentMd, imageUrl: input.imageUrl ?? null }).returning();
  if (parentId) await ctx.db.update(comments).set({ replyCount: sql`${comments.replyCount} + 1` }).where(eq(comments.id, parentId));
  if (targetType === 'post') await ctx.db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1`, lastCommentAt: ctx.now() }).where(eq(posts.id, targetId));
  await ctx.events.emit('comment.created', { commentId: row!.id, communityId, authorUserId: userId, targetType, targetId, parentCommentId: parentId, mentionedHandles: mentions(input.contentMd) });
  return row!;
}

/** Ghim/bỏ ghim bình luận (tác giả bài hoặc quản trị). */
export async function pinComment(ctx: Ctx, commentId: string, pinned: boolean) {
  const c = await ctx.db.query.comments.findFirst({ where: eq(comments.id, commentId) });
  if (!c) throw notFound();
  const access = await resolveCommunityAccess(ctx, c.communityId);
  const post = c.targetType === 'post' ? await ctx.db.query.posts.findFirst({ where: eq(posts.id, c.targetId), columns: { authorUserId: true } }) : null;
  const isPostAuthor = ctx.actor.type === 'user' && post?.authorUserId === ctx.actor.userId;
  if (!isPostAuthor && !access.permissions.has('post.moderate')) throw forbidden();
  await ctx.db.update(comments).set({ pinned, updatedAt: ctx.now() }).where(eq(comments.id, commentId));
}

/** Xóa mềm bình luận. */
export async function deleteComment(ctx: Ctx, commentId: string) {
  const c = await ctx.db.query.comments.findFirst({ where: eq(comments.id, commentId) });
  if (!c) throw notFound();
  const access = await resolveCommunityAccess(ctx, c.communityId);
  if (!(ctx.actor.type === 'user' && ctx.actor.userId === c.authorUserId) && !access.permissions.has('post.moderate')) throw forbidden();
  await ctx.db.update(comments).set({ deletedAt: ctx.now() }).where(eq(comments.id, commentId));
  if (c.targetType === 'post') await ctx.db.update(posts).set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)` }).where(eq(posts.id, c.targetId));
}

/** Thích/bỏ thích bài viết hoặc bình luận. Trả về trạng thái mới và số lượt. */
export async function toggleReaction(ctx: Ctx, targetType: 'post' | 'comment', targetId: string) {
  const userId = requireUser(ctx);
  const communityId = targetType === 'post' ? await communityOfTarget(ctx, 'post', targetId) : (await ctx.db.query.comments.findFirst({ where: eq(comments.id, targetId), columns: { communityId: true } }))?.communityId ?? '';
  if (!communityId) throw notFound();
  await requireCommunityPermission(ctx, communityId, 'community.read');
  const existing = await ctx.db.query.reactions.findFirst({ where: and(eq(reactions.userId, userId), eq(reactions.targetType, targetType), eq(reactions.targetId, targetId)) });
  const table = targetType === 'post' ? posts : comments;
  if (existing) {
    await ctx.db.delete(reactions).where(eq(reactions.id, existing.id));
    const [row] = await ctx.db.update(table).set({ likeCount: sql`greatest(${table.likeCount} - 1, 0)` }).where(eq(table.id, targetId)).returning({ likeCount: table.likeCount });
    return { liked: false, likeCount: row?.likeCount ?? 0 };
  }
  await ctx.db.insert(reactions).values({ userId, targetType, targetId });
  const [row] = await ctx.db.update(table).set({ likeCount: sql`${table.likeCount} + 1` }).where(eq(table.id, targetId)).returning({ likeCount: table.likeCount });
  return { liked: true, likeCount: row?.likeCount ?? 1 };
}
