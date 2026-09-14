// Bài viết Markdown: bảng tin, tạo với ảnh/bình chọn/nền màu, chi tiết, ghim, sửa, xóa mềm; bình luận và phản ứng ở comments.ts.
import type { CreatePostInput } from '@hoiminh/contracts';
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { communities, communityMembers, communityTiers, files, pollOptions, pollVotes, polls, postImages, posts, reactions, spaces, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { forbidden, invalid, notFound } from '../errors';
import { canUseStatusBg, excerptOf } from '../lib/markdown';
import { decodeCursor, paginate } from '../lib/pagination';
import { requireCommunityPermission, requireUser, resolveCommunityAccess, type CommunityAccess } from '../permissions';
import { audit } from './audit';
import { assertWorkspaceUnlocked } from './workspaces';

const authorCols = { id: users.id, name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor };

async function canPostInSpace(ctx: Ctx, access: CommunityAccess, space: typeof spaces.$inferSelect): Promise<void> {
  if (space.postPermission === 'admins_only' && !access.permissions.has('post.moderate')) throw forbidden('Chỉ quản trị viên đăng được ở chuyên mục này');
  if (space.postPermission === 'premium' && !access.permissions.has('post.moderate')) {
    const tier = access.tierId ? await ctx.db.query.communityTiers.findFirst({ where: eq(communityTiers.id, access.tierId), columns: { key: true } }) : null;
    if (!tier || tier.key === 'standard') throw forbidden('Chuyên mục này dành cho thành viên Premium');
  }
}

/** Bảng tin: bài ghim trước, rồi mới nhất; kèm ảnh, bình chọn, đã thích. */
export async function feed(ctx: Ctx, communityId: string, q: { spaceId?: string; cursor?: string; limit?: number }) {
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has('community.read')) throw forbidden('Tham gia hội để xem bảng tin');
  const limit = q.limit ?? 20;
  const conds = [eq(posts.communityId, communityId), isNull(posts.deletedAt)];
  if (q.spaceId) conds.push(eq(posts.spaceId, q.spaceId));
  const c = decodeCursor(q.cursor);
  if (c) conds.push(or(lt(posts.createdAt, new Date(c.at)), and(eq(posts.createdAt, new Date(c.at)), lt(posts.id, c.id)))!);
  const rows = await ctx.db
    .select({ p: posts, author: authorCols, space: { id: spaces.id, name: spaces.name, slug: spaces.slug, colorKey: spaces.colorKey }, level: communityMembers.level })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorUserId))
    .innerJoin(spaces, eq(spaces.id, posts.spaceId))
    .leftJoin(communityMembers, and(eq(communityMembers.communityId, posts.communityId), eq(communityMembers.userId, posts.authorUserId)))
    .where(and(...conds))
    .orderBy(c ? desc(posts.createdAt) : desc(posts.pinned), desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);
  const page = paginate(rows.map((r) => ({ ...r.p, author: r.author, space: r.space, authorLevel: r.level ?? 1 })), limit);
  const ids = page.items.map((p) => p.id);
  const [images, likes, pollRows] = ids.length ? await Promise.all([ctx.db.query.postImages.findMany({ where: inArray(postImages.postId, ids), orderBy: asc(postImages.sortOrder) }), ctx.actor.type === 'user' ? ctx.db.query.reactions.findMany({ where: and(eq(reactions.userId, ctx.actor.userId), eq(reactions.targetType, 'post'), inArray(reactions.targetId, ids)) }) : [], loadPolls(ctx, ids)]) : [[], [], new Map()];
  const spaceList = await ctx.db.query.spaces.findMany({ where: eq(spaces.communityId, communityId), orderBy: asc(spaces.sortOrder) });
  return { ...page, items: page.items.map((p) => ({ ...p, images: images.filter((i) => i.postId === p.id), liked: likes.some((l) => l.targetId === p.id), poll: pollRows.get(p.id) ?? null })), spaces: spaceList, access: { role: access.role, canBroadcast: access.permissions.has('post.broadcast'), canModerate: access.permissions.has('post.moderate') } };
}

async function loadPolls(ctx: Ctx, postIds: string[]) {
  const map = new Map<string, { id: string; question: string; multipleChoice: boolean; closesAt: Date | null; options: Array<{ id: string; label: string; voteCount: number; sortOrder: number }>; myVotes: string[]; totalVotes: number }>();
  const list = await ctx.db.query.polls.findMany({ where: inArray(polls.postId, postIds) });
  if (!list.length) return map;
  const opts = await ctx.db.query.pollOptions.findMany({ where: inArray(pollOptions.pollId, list.map((p) => p.id)), orderBy: asc(pollOptions.sortOrder) });
  const mine = ctx.actor.type === 'user' ? await ctx.db.query.pollVotes.findMany({ where: and(eq(pollVotes.userId, ctx.actor.userId), inArray(pollVotes.pollId, list.map((p) => p.id))) }) : [];
  for (const p of list) {
    const options = opts.filter((o) => o.pollId === p.id);
    map.set(p.postId, { id: p.id, question: p.question, multipleChoice: p.multipleChoice, closesAt: p.closesAt, options, myVotes: mine.filter((v) => v.pollId === p.id).map((v) => v.optionId), totalVotes: options.reduce((n, o) => n + o.voteCount, 0) });
  }
  return map;
}

/** Tạo bài viết. Chuyên mục bắt buộc; nền màu chỉ khi status ngắn không ảnh; broadcast cần quyền và đưa vào hàng đợi. */
export async function createPost(ctx: Ctx, communityId: string, input: CreatePostInput) {
  const userId = requireUser(ctx);
  const access = await requireCommunityPermission(ctx, communityId, 'post.create');
  await assertWorkspaceUnlocked(ctx, access.workspaceId);
  const space = await ctx.db.query.spaces.findFirst({ where: and(eq(spaces.id, input.spaceId), eq(spaces.communityId, communityId)) });
  if (!space) throw invalid('Chọn chuyên mục trước khi đăng');
  await canPostInSpace(ctx, access, space);
  if (input.broadcastEmail && !access.permissions.has('post.broadcast')) throw forbidden('Chỉ quản trị viên gửi email cho tất cả thành viên');
  const imageFiles = input.imageFileIds.length ? await ctx.db.query.files.findMany({ where: and(inArray(files.id, input.imageFileIds), eq(files.ownerUserId, userId)) }) : [];
  const statusBgKey = input.statusBgKey && canUseStatusBg(input.contentMd, imageFiles.length, input.title) ? input.statusBgKey : null;
  const post = await ctx.db.transaction(async (tx) => {
    const [p] = await tx.insert(posts).values({ communityId, spaceId: space.id, authorUserId: userId, title: input.title, contentMd: input.contentMd, excerpt: excerptOf(input.contentMd), statusBgKey, videoUrl: input.videoUrl ?? null, linkUrl: input.linkUrl ?? null, broadcast: input.broadcastEmail }).returning();
    if (imageFiles.length) await tx.insert(postImages).values(input.imageFileIds.map((fid, i) => ({ postId: p!.id, fileId: fid, url: imageFiles.find((f) => f.id === fid)?.url ?? '', width: imageFiles.find((f) => f.id === fid)?.width ?? null, height: imageFiles.find((f) => f.id === fid)?.height ?? null, sortOrder: i })).filter((r) => r.url));
    if (input.poll) {
      const [poll] = await tx.insert(polls).values({ postId: p!.id, question: input.poll.question, multipleChoice: input.poll.multipleChoice, closesAt: input.poll.closesAt ? new Date(input.poll.closesAt) : null }).returning();
      await tx.insert(pollOptions).values(input.poll.options.map((label, i) => ({ pollId: poll!.id, label, sortOrder: i })));
    }
    await tx.update(spaces).set({ postCount: sql`${spaces.postCount} + 1` }).where(eq(spaces.id, space.id));
    return p!;
  });
  await ctx.events.emit('post.created', { postId: post.id, communityId, authorUserId: userId, spaceId: space.id, broadcast: input.broadcastEmail, title: input.title || excerptOf(input.contentMd, 80) });
  if (input.broadcastEmail) await ctx.queue.enqueue('post.broadcast', { postId: post.id });
  return post;
}

/** Chi tiết bài viết: nội dung đầy đủ, ảnh, bình chọn, tác giả, bài liên quan, mục lục. */
export async function getPost(ctx: Ctx, postId: string) {
  const row = await ctx.db.select({ p: posts, author: { ...authorCols, bio: users.bio }, space: { id: spaces.id, name: spaces.name, colorKey: spaces.colorKey }, community: { id: communities.id, name: communities.name, slug: communities.slug } }).from(posts).innerJoin(users, eq(users.id, posts.authorUserId)).innerJoin(spaces, eq(spaces.id, posts.spaceId)).innerJoin(communities, eq(communities.id, posts.communityId)).where(and(eq(posts.id, postId), isNull(posts.deletedAt))).then((r) => r[0]);
  if (!row) throw notFound('Bài viết không tồn tại');
  const access = await resolveCommunityAccess(ctx, row.p.communityId);
  if (!access.permissions.has('community.read')) throw forbidden('Tham gia hội để đọc bài');
  const [images, liked, pollMap, member, related, authorPosts] = await Promise.all([
    ctx.db.query.postImages.findMany({ where: eq(postImages.postId, postId), orderBy: asc(postImages.sortOrder) }),
    ctx.actor.type === 'user' ? ctx.db.query.reactions.findFirst({ where: and(eq(reactions.userId, ctx.actor.userId), eq(reactions.targetType, 'post'), eq(reactions.targetId, postId)) }) : null,
    loadPolls(ctx, [postId]),
    ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.communityId, row.p.communityId), eq(communityMembers.userId, row.p.authorUserId)) }),
    ctx.db.select({ id: posts.id, title: posts.title, likeCount: posts.likeCount, commentCount: posts.commentCount, author: users.name }).from(posts).innerJoin(users, eq(users.id, posts.authorUserId)).where(and(eq(posts.communityId, row.p.communityId), isNull(posts.deletedAt), sql`${posts.id} <> ${postId}`)).orderBy(desc(posts.likeCount)).limit(3),
    ctx.db.select({ c: sql<number>`count(*)::int` }).from(posts).where(and(eq(posts.authorUserId, row.p.authorUserId), isNull(posts.deletedAt))),
  ]);
  const likers = await ctx.db.select({ ...authorCols }).from(reactions).innerJoin(users, eq(users.id, reactions.userId)).where(and(eq(reactions.targetType, 'post'), eq(reactions.targetId, postId))).orderBy(desc(reactions.createdAt)).limit(3);
  const headings = [...row.p.contentMd.matchAll(/^##?\s+(.+)$/gm)].map((m) => m[1]!.trim());
  return { ...row.p, author: { ...row.author, level: member?.level ?? 1, joinedAt: member?.joinedAt ?? null, postCount: authorPosts[0]?.c ?? 0, tierId: member?.tierId ?? null }, space: row.space, community: row.community, images, liked: Boolean(liked), poll: pollMap.get(postId) ?? null, likers, related, headings, access: { canModerate: access.permissions.has('post.moderate'), isAuthor: ctx.actor.type === 'user' && ctx.actor.userId === row.p.authorUserId } };
}

/** Sửa bài (tác giả hoặc quản trị), ghim (quản trị). */
export async function updatePost(ctx: Ctx, postId: string, input: { title?: string; contentMd?: string; spaceId?: string; pinned?: boolean; statusBgKey?: string | null }) {
  const post = await ctx.db.query.posts.findFirst({ where: and(eq(posts.id, postId), isNull(posts.deletedAt)) });
  if (!post) throw notFound();
  const access = await resolveCommunityAccess(ctx, post.communityId);
  const isAuthor = ctx.actor.type === 'user' && ctx.actor.userId === post.authorUserId;
  if (!isAuthor && !access.permissions.has('post.moderate')) throw forbidden();
  if (input.pinned !== undefined && !access.permissions.has('post.moderate')) throw forbidden('Chỉ quản trị viên ghim bài');
  const contentMd = input.contentMd ?? post.contentMd;
  const imageCount = (await ctx.db.select({ c: sql<number>`count(*)::int` }).from(postImages).where(eq(postImages.postId, postId)))[0]?.c ?? 0;
  const [row] = await ctx.db.update(posts).set({ title: input.title ?? post.title, contentMd, excerpt: excerptOf(contentMd), spaceId: input.spaceId ?? post.spaceId, pinned: input.pinned ?? post.pinned, statusBgKey: input.statusBgKey === undefined ? post.statusBgKey : input.statusBgKey && canUseStatusBg(contentMd, imageCount, input.title ?? post.title) ? input.statusBgKey : null, editedAt: input.contentMd ? ctx.now() : post.editedAt, updatedAt: ctx.now() }).where(eq(posts.id, postId)).returning();
  if (input.pinned !== undefined) await audit(ctx, { action: input.pinned ? 'post.pin' : 'post.unpin', resourceType: 'post', resourceId: postId, communityId: post.communityId });
  return row!;
}

/** Xóa mềm bài viết. */
export async function deletePost(ctx: Ctx, postId: string) {
  const post = await ctx.db.query.posts.findFirst({ where: and(eq(posts.id, postId), isNull(posts.deletedAt)) });
  if (!post) throw notFound();
  const access = await resolveCommunityAccess(ctx, post.communityId);
  if (!(ctx.actor.type === 'user' && ctx.actor.userId === post.authorUserId) && !access.permissions.has('post.moderate')) throw forbidden();
  await ctx.db.update(posts).set({ deletedAt: ctx.now() }).where(eq(posts.id, postId));
  await ctx.db.update(spaces).set({ postCount: sql`greatest(${spaces.postCount} - 1, 0)` }).where(eq(spaces.id, post.spaceId));
  await audit(ctx, { action: 'post.delete', resourceType: 'post', resourceId: postId, communityId: post.communityId });
}

/** Bình chọn: một hoặc nhiều lựa chọn tùy poll. */
export async function vote(ctx: Ctx, pollId: string, optionIds: string[]) {
  const userId = requireUser(ctx);
  const poll = await ctx.db.query.polls.findFirst({ where: eq(polls.id, pollId) });
  if (!poll) throw notFound();
  if (poll.closesAt && poll.closesAt < ctx.now()) throw invalid('Bình chọn đã đóng');
  const post = await ctx.db.query.posts.findFirst({ where: eq(posts.id, poll.postId), columns: { communityId: true } });
  await requireCommunityPermission(ctx, post!.communityId, 'community.read');
  const chosen = poll.multipleChoice ? optionIds : optionIds.slice(0, 1);
  await ctx.db.transaction(async (tx) => {
    const old = await tx.query.pollVotes.findMany({ where: and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)) });
    if (old.length) {
      await tx.delete(pollVotes).where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));
      for (const o of old) await tx.update(pollOptions).set({ voteCount: sql`greatest(${pollOptions.voteCount} - 1, 0)` }).where(eq(pollOptions.id, o.optionId));
    }
    for (const optionId of chosen) {
      await tx.insert(pollVotes).values({ pollId, optionId, userId });
      await tx.update(pollOptions).set({ voteCount: sql`${pollOptions.voteCount} + 1` }).where(eq(pollOptions.id, optionId));
    }
  });
  return (await loadPolls(ctx, [poll.postId])).get(poll.postId);
}
