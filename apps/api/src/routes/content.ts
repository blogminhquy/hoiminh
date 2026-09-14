// Bảng tin, bài viết, bình chọn, bình luận, phản ứng.
import { createCommentSchema, createPostSchema, feedQuerySchema, toggleReactionSchema, updatePostSchema, voteSchema } from '@hoiminh/contracts';
import { comments, posts } from '@hoiminh/core';
import { files } from '@hoiminh/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { body, parse, query, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/common';

export const contentRoutes = router();

contentRoutes.get('/communities/:id/feed', async (c) => {
  const q = await parse(feedQuerySchema, query(c));
  return c.json(await posts.feed(c.get('ctx'), c.req.param('id'), q));
});
contentRoutes.post('/communities/:id/posts', requireAuth, rateLimit({ windowMs: 60_000, max: 10, key: () => 'post' }), async (c) => c.json(await posts.createPost(c.get('ctx'), c.req.param('id'), await parse(createPostSchema, await body(c))), 201));
contentRoutes.get('/posts/:id', async (c) => c.json(await posts.getPost(c.get('ctx'), c.req.param('id'))));
contentRoutes.patch('/posts/:id', requireAuth, async (c) => {
  const input = await parse(updatePostSchema, await body(c));
  return c.json(await posts.updatePost(c.get('ctx'), c.req.param('id'), { title: input.title, contentMd: input.contentMd, spaceId: input.spaceId, pinned: input.pinned, statusBgKey: input.statusBgKey }));
});
contentRoutes.delete('/posts/:id', requireAuth, async (c) => {
  await posts.deletePost(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
contentRoutes.post('/polls/:id/vote', requireAuth, async (c) => {
  const { optionIds } = await parse(voteSchema, await body(c));
  return c.json(await posts.vote(c.get('ctx'), c.req.param('id'), optionIds));
});

const targetSchema = z.object({ targetType: z.enum(['post', 'lesson', 'event']), targetId: z.string().uuid() });
contentRoutes.get('/comments', async (c) => {
  const q = await parse(targetSchema.extend({ sort: z.enum(['top', 'newest']).optional() }), query(c));
  return c.json(await comments.listComments(c.get('ctx'), q.targetType, q.targetId, { sort: q.sort }));
});
contentRoutes.post('/comments', requireAuth, rateLimit({ windowMs: 60_000, max: 30, key: () => 'comment' }), async (c) => {
  const input = await parse(targetSchema.merge(createCommentSchema), await body(c));
  const ctx = c.get('ctx');
  const imageUrl = input.imageFileId ? ((await ctx.db.query.files.findFirst({ where: eq(files.id, input.imageFileId) }))?.url ?? null) : null;
  return c.json(await comments.createComment(ctx, input.targetType, input.targetId, { contentMd: input.contentMd, parentCommentId: input.parentCommentId ?? null, imageUrl }), 201);
});
contentRoutes.post('/comments/:id/pin', requireAuth, async (c) => {
  const { pinned } = await parse(z.object({ pinned: z.boolean() }), await body(c));
  await comments.pinComment(c.get('ctx'), c.req.param('id'), pinned);
  return c.json({ ok: true });
});
contentRoutes.delete('/comments/:id', requireAuth, async (c) => {
  await comments.deleteComment(c.get('ctx'), c.req.param('id'));
  return c.json({ ok: true });
});
contentRoutes.post('/reactions/toggle', requireAuth, async (c) => {
  const input = await parse(toggleReactionSchema, await body(c));
  return c.json(await comments.toggleReaction(c.get('ctx'), input.targetType, input.targetId));
});
