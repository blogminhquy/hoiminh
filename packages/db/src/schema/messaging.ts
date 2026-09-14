// Tin nhắn không realtime (polling) và thông báo trong app.
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, ts } from './_helpers';
import { communities } from './tenant';
import { users } from './users';

export const conversations = pgTable(
  'conversations',
  {
    id: id(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    /** Khóa duy nhất cho hội thoại 1-1: hai user id sắp xếp, nối bằng ':'. */
    pairKey: text('pair_key'),
    lastMessageAt: ts('last_message_at'),
    lastMessagePreview: text('last_message_preview').notNull().default(''),
    lastMessageAutomated: boolean('last_message_automated').notNull().default(false),
    archivedAt: ts('archived_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('conversations_pair_uq').on(t.pairKey), index('conversations_last_idx').on(t.lastMessageAt)],
);

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    id: id(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    unreadCount: integer('unread_count').notNull().default(0),
    lastReadAt: ts('last_read_at'),
    archivedAt: ts('archived_at'),
  },
  (t) => [uniqueIndex('conversation_participants_uq').on(t.conversationId, t.userId), index('conversation_participants_user_idx').on(t.userId)],
);

export const messages = pgTable(
  'messages',
  {
    id: id(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id').notNull().references(() => users.id),
    body: text('body').notNull(),
    imageUrl: text('image_url'),
    automated: boolean('automated').notNull().default(false),
    readAt: ts('read_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    category: text('category').$type<'all' | 'mention' | 'affiliate' | 'system' | 'payment' | 'event' | 'comment' | 'like' | 'post'>().notNull().default('all'),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    actorUserId: uuid('actor_user_id'),
    link: text('link'),
    actionLabel: text('action_label'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    readAt: ts('read_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.readAt, t.createdAt)],
);

export const notificationPrefs = pgTable('notification_prefs', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  emailDigest: boolean('email_digest').notNull().default(true),
  push: boolean('push').notNull().default(true),
  likes: boolean('likes').notNull().default(false),
  perCommunity: jsonb('per_community').$type<Record<string, 'all' | 'mentions' | 'off'>>().notNull().default({}),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});
