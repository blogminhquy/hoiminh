// Bình luận lồng nhau (bài viết, bài học, sự kiện), ghim, thích; phản ứng cho bài viết.
import type { ReactionKind } from '@hoiminh/contracts';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { comments, communityMembers, events, lessons, posts, reactions, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { forbidden, notFound } from '../errors';
import { mentions } from '../lib/markdown';
import { requireCommunityPermission, requireUser, resolveCommunityAccess } from '../permissions';
import { releaseFiles } from './files';

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
  // Hội mở: người ngoài đọc được bình luận của bài viết và sự kiện. Thảo luận trong bài học vẫn chỉ dành cho thành viên.
  if (!(targetType === 'lesson' ? access.permissions.has('community.read') : access.canView)) throw forbidden();
  const rows = await ctx.db
    .select({ c: comments, author: authorCols, level: communityMembers.level, role: communityMembers.role })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorUserId))
    .leftJoin(communityMembers, and(eq(communityMembers.communityId, comments.communityId), eq(communityMembers.userId, comments.authorUserId)))
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId), isNull(comments.deletedAt)))
    .orderBy(desc(comments.pinned), q.sort === 'newest' ? desc(comments.createdAt) : desc(comments.likeCount), asc(comments.createdAt));
  const ids = rows.map((r) => r.c.id);
  const mine = new Map<string, string>(ctx.actor.type === 'user' && ids.length ? (await ctx.db.query.reactions.findMany({ where: and(eq(reactions.userId, ctx.actor.userId), eq(reactions.targetType, 'comment'), inArray(reactions.targetId, ids)) })).map((r) => [r.targetId, r.reaction] as const) : []);
  const counts = await reactionCounts(ctx, 'comment', ids);
  const items = rows.map((r) => ({ ...r.c, author: { ...r.author, level: r.level ?? 1, isAdmin: r.role === 'owner' || r.role === 'admin' }, liked: mine.has(r.c.id), myReaction: mine.get(r.c.id) ?? null, reactionCounts: counts.get(r.c.id) ?? {}, replies: [] as Array<typeof rows[number]['c'] & { author: typeof rows[number]['author'] & { level: number; isAdmin: boolean }; liked: boolean; myReaction: string | null; reactionCounts: Record<string, number>; replies: never[] }> }));
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

/** Sửa nội dung bình luận (tác giả hoặc người kiểm duyệt). Ảnh đính kèm, lượt thích và các trả lời giữ nguyên. */
export async function updateComment(ctx: Ctx, commentId: string, input: { contentMd: string }) {
  const c = await ctx.db.query.comments.findFirst({ where: and(eq(comments.id, commentId), isNull(comments.deletedAt)) });
  if (!c) throw notFound();
  const access = await resolveCommunityAccess(ctx, c.communityId);
  if (!(ctx.actor.type === 'user' && ctx.actor.userId === c.authorUserId) && !access.permissions.has('post.moderate')) throw forbidden();
  const [row] = await ctx.db.update(comments).set({ contentMd: input.contentMd, updatedAt: ctx.now() }).where(eq(comments.id, commentId)).returning();
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

/** Xóa mềm bình luận; ảnh đính kèm (nếu có) bị gỡ và dọn khỏi R2. */
export async function deleteComment(ctx: Ctx, commentId: string) {
  const c = await ctx.db.query.comments.findFirst({ where: eq(comments.id, commentId) });
  if (!c) throw notFound();
  const access = await resolveCommunityAccess(ctx, c.communityId);
  if (!(ctx.actor.type === 'user' && ctx.actor.userId === c.authorUserId) && !access.permissions.has('post.moderate')) throw forbidden();
  await ctx.db.update(comments).set({ deletedAt: ctx.now(), imageUrl: null }).where(eq(comments.id, commentId));
  if (c.targetType === 'post') await ctx.db.update(posts).set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)` }).where(eq(posts.id, c.targetId));
  await releaseFiles(ctx, { urls: [c.imageUrl] }, { ownerUserIds: [c.authorUserId], communityId: c.communityId });
}

/**
 * Thả, đổi hoặc gỡ cảm xúc ở bài viết hoặc bình luận. Mỗi người một cảm xúc cho mỗi đối tượng.
 * Không truyền `reaction`: bật tắt kiểu cũ (chưa thả thì Thích, đã thả thì gỡ). Truyền loại khác loại đang thả: đổi loại,
 * tổng số không đổi. Truyền đúng loại đang thả: gỡ.
 */
export async function toggleReaction(ctx: Ctx, targetType: 'post' | 'comment', targetId: string, reaction?: ReactionKind) {
  const userId = requireUser(ctx);
  const communityId = targetType === 'post' ? await communityOfTarget(ctx, 'post', targetId) : (await ctx.db.query.comments.findFirst({ where: eq(comments.id, targetId), columns: { communityId: true } }))?.communityId ?? '';
  if (!communityId) throw notFound();
  await requireCommunityPermission(ctx, communityId, 'community.read');
  const existing = await ctx.db.query.reactions.findFirst({ where: and(eq(reactions.userId, userId), eq(reactions.targetType, targetType), eq(reactions.targetId, targetId)) });
  const table = targetType === 'post' ? posts : comments;
  if (existing && reaction && existing.reaction !== reaction) {
    await ctx.db.update(reactions).set({ reaction }).where(eq(reactions.id, existing.id));
    const [row] = await ctx.db.select({ likeCount: table.likeCount }).from(table).where(eq(table.id, targetId));
    return { liked: true, reaction, likeCount: row?.likeCount ?? 1 };
  }
  if (existing) {
    await ctx.db.delete(reactions).where(eq(reactions.id, existing.id));
    const [row] = await ctx.db.update(table).set({ likeCount: sql`greatest(${table.likeCount} - 1, 0)` }).where(eq(table.id, targetId)).returning({ likeCount: table.likeCount });
    return { liked: false, reaction: null, likeCount: row?.likeCount ?? 0 };
  }
  const kind: ReactionKind = reaction ?? 'like';
  await ctx.db.insert(reactions).values({ userId, targetType, targetId, reaction: kind });
  const [row] = await ctx.db.update(table).set({ likeCount: sql`${table.likeCount} + 1` }).where(eq(table.id, targetId)).returning({ likeCount: table.likeCount });
  return { liked: true, reaction: kind, likeCount: row?.likeCount ?? 1 };
}

/** Số cảm xúc theo từng loại của một nhóm bài viết hoặc bình luận, để hiện mấy biểu tượng nhiều nhất cạnh tổng số. */
export async function reactionCounts(ctx: Ctx, targetType: 'post' | 'comment', ids: string[]): Promise<Map<string, Record<string, number>>> {
  const out = new Map<string, Record<string, number>>();
  if (!ids.length) return out;
  const rows = await ctx.db.select({ id: reactions.targetId, kind: reactions.reaction, n: sql<number>`count(*)::int` }).from(reactions).where(and(eq(reactions.targetType, targetType), inArray(reactions.targetId, ids))).groupBy(reactions.targetId, reactions.reaction);
  for (const r of rows) out.set(r.id, { ...(out.get(r.id) ?? {}), [r.kind]: r.n });
  return out;
}
