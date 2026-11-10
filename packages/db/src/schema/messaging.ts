// Tin nhắn không realtime (polling) và thông báo trong app.
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
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
    /** Người gửi tin cuối, để danh sách hiện "Bạn: ..." trước dòng xem trước. */
    lastMessageSenderId: uuid('last_message_sender_id'),
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
    /** Ghim hội thoại lên đầu danh sách (chỉ phía mình). */
    pinnedAt: ts('pinned_at'),
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
    /** Tin đang được trả lời (trích dẫn). */
    replyToId: uuid('reply_to_id').references((): AnyPgColumn => messages.id, { onDelete: 'set null' }),
    /** Cảm xúc: mỗi người một cảm xúc trên một tin, lưu { userId: emoji }. */
    reactions: jsonb('reactions').$type<Record<string, string>>().notNull().default({}),
    /** Đã thu hồi: nội dung không còn trả về cho ai. */
    recalledAt: ts('recalled_at'),
    /** Tệp đính kèm (tối đa 5MB): object key của tệp riêng trong kho, tên gốc và dung lượng chép lại lúc gửi. */
    fileUrl: text('file_url'),
    fileName: text('file_name'),
    fileSize: integer('file_size'),
    /** Ứng dụng của người nhận đã nhận được tin (trạng thái "Đã nhận", trước "Đã xem"). */
    deliveredAt: ts('delivered_at'),
    readAt: ts('read_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)],
);

/** Chặn một người: hai bên không nhắn được cho nhau cho tới khi người chặn bỏ chặn. */
export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerUserId: uuid('blocker_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    blockedUserId: uuid('blocked_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerUserId, t.blockedUserId] }), index('user_blocks_blocked_idx').on(t.blockedUserId)],
);

export type UserReportReason = 'spam' | 'harassment' | 'scam' | 'inappropriate' | 'other';
/** Báo cáo một người dùng (từ khung chat) để quản trị hệ thống xem xét. */
export const userReports = pgTable(
  'user_reports',
  {
    id: id(),
    reporterUserId: uuid('reporter_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    reportedUserId: uuid('reported_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
    reason: text('reason').$type<UserReportReason>().notNull(),
    detail: text('detail').notNull().default(''),
    status: text('status').$type<'open' | 'resolved'>().notNull().default('open'),
    resolvedByUserId: uuid('resolved_by_user_id'),
    resolvedAt: ts('resolved_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('user_reports_status_idx').on(t.status, t.createdAt), index('user_reports_reported_idx').on(t.reportedUserId)],
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
