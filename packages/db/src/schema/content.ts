// Nội dung: chuyên mục, bài viết (Markdown), ảnh, bình luận lồng nhau, phản ứng, bình chọn.
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps, ts } from './_helpers';
import { communities } from './tenant';
import { users } from './users';

export type PostPermission = 'everyone' | 'admins_only' | 'premium';

export const spaces = pgTable(
  'spaces',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    postPermission: text('post_permission').$type<PostPermission>().notNull().default('everyone'),
    colorKey: text('color_key').notNull().default('accent'),
    sortOrder: integer('sort_order').notNull().default(0),
    postCount: integer('post_count').notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex('spaces_uq').on(t.communityId, t.slug)],
);

export const posts = pgTable(
  'posts',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id').notNull().references(() => spaces.id),
    authorUserId: uuid('author_user_id').notNull().references(() => users.id),
    title: text('title').notNull().default(''),
    contentMd: text('content_md').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    /** Nền màu cho status ngắn (< 130 ký tự, không ảnh). */
    statusBgKey: text('status_bg_key'),
    videoUrl: text('video_url'),
    linkUrl: text('link_url'),
    pinned: boolean('pinned').notNull().default(false),
    broadcast: boolean('broadcast').notNull().default(false),
    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    lastCommentAt: ts('last_comment_at'),
    editedAt: ts('edited_at'),
    deletedAt: ts('deleted_at'),
    ...timestamps(),
  },
  (t) => [index('posts_feed_idx').on(t.communityId, t.pinned, t.createdAt), index('posts_space_idx').on(t.spaceId), index('posts_author_idx').on(t.authorUserId)],
);

export const postImages = pgTable(
  'post_images',
  {
    id: id(),
    postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id'),
    url: text('url').notNull(),
    width: integer('width'),
    height: integer('height'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('post_images_post_idx').on(t.postId)],
);

export const comments = pgTable(
  'comments',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    /** Bình luận cho bài viết, bài học hoặc sự kiện. */
    targetType: text('target_type').$type<'post' | 'lesson' | 'event'>().notNull().default('post'),
    targetId: uuid('target_id').notNull(),
    authorUserId: uuid('author_user_id').notNull().references(() => users.id),
    parentCommentId: uuid('parent_comment_id'),
    contentMd: text('content_md').notNull(),
    imageUrl: text('image_url'),
    pinned: boolean('pinned').notNull().default(false),
    likeCount: integer('like_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    deletedAt: ts('deleted_at'),
    ...timestamps(),
  },
  (t) => [index('comments_target_idx').on(t.targetType, t.targetId, t.createdAt), index('comments_parent_idx').on(t.parentCommentId), index('comments_author_idx').on(t.authorUserId)],
);

export const reactions = pgTable(
  'reactions',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').$type<'post' | 'comment'>().notNull(),
    targetId: uuid('target_id').notNull(),
    reaction: text('reaction').notNull().default('like'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('reactions_uq').on(t.userId, t.targetType, t.targetId), index('reactions_target_idx').on(t.targetType, t.targetId)],
);

export const polls = pgTable('polls', {
  id: id(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  multipleChoice: boolean('multiple_choice').notNull().default(false),
  closesAt: ts('closes_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const pollOptions = pgTable(
  'poll_options',
  {
    id: id(),
    pollId: uuid('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    voteCount: integer('vote_count').notNull().default(0),
  },
  (t) => [index('poll_options_poll_idx').on(t.pollId)],
);

export const pollVotes = pgTable(
  'poll_votes',
  {
    id: id(),
    pollId: uuid('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id').notNull().references(() => pollOptions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('poll_votes_uq').on(t.pollId, t.optionId, t.userId), index('poll_votes_user_idx').on(t.pollId, t.userId)],
);
