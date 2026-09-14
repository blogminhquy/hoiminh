// Sự kiện: chuỗi, buổi, đăng ký, câu hỏi gửi trước, bình chọn câu hỏi, bản ghi xem lại.
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps, ts } from './_helpers';
import { communities } from './tenant';
import { users } from './users';

export type EventKind = 'online' | 'offline' | 'hybrid';
export type EventAccess = 'all_members' | 'premium' | 'public';
export type EventStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

export const eventSeries = pgTable(
  'event_series',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    recurrence: text('recurrence').$type<'none' | 'weekly' | 'monthly'>().notNull().default('weekly'),
    coverColor: text('cover_color').notNull().default('#0E8E96'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('event_series_community_idx').on(t.communityId)],
);

export const events = pgTable(
  'events',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    seriesId: uuid('series_id').references(() => eventSeries.id, { onDelete: 'set null' }),
    seriesIndex: integer('series_index'),
    createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    descriptionMd: text('description_md').notNull().default(''),
    coverColor: text('cover_color').notNull().default('#0E8E96'),
    kind: text('kind').$type<EventKind>().notNull().default('online'),
    recurrence: text('recurrence').$type<'none' | 'weekly' | 'monthly'>().notNull().default('none'),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),
    meetingUrl: text('meeting_url'),
    meetingProvider: text('meeting_provider'),
    location: text('location'),
    hostUserIds: jsonb('host_user_ids').$type<string[]>().notNull().default([]),
    capacity: integer('capacity'),
    access: text('access').$type<EventAccess>().notNull().default('all_members'),
    allowQuestions: boolean('allow_questions').notNull().default(true),
    autoPublishRecording: boolean('auto_publish_recording').notNull().default(true),
    reminders: jsonb('reminders').$type<string[]>().notNull().default(['1d', '1h', 'start']),
    remindersSent: jsonb('reminders_sent').$type<string[]>().notNull().default([]),
    status: text('status').$type<EventStatus>().notNull().default('scheduled'),
    registrationCount: integer('registration_count').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('events_community_time_idx').on(t.communityId, t.startsAt), index('events_series_idx').on(t.seriesId)],
);

export const eventRegistrations = pgTable(
  'event_registrations',
  {
    id: id(),
    eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').$type<'registered' | 'attended' | 'cancelled'>().notNull().default('registered'),
    reminderPrefs: jsonb('reminder_prefs').$type<string[]>().notNull().default(['1h', 'start']),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('event_registrations_uq').on(t.eventId, t.userId), index('event_registrations_user_idx').on(t.userId)],
);

export const eventQuestions = pgTable(
  'event_questions',
  {
    id: id(),
    eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    voteCount: integer('vote_count').notNull().default(0),
    answeredAt: ts('answered_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('event_questions_event_idx').on(t.eventId, t.voteCount)],
);

export const eventQuestionVotes = pgTable(
  'event_question_votes',
  {
    id: id(),
    questionId: uuid('question_id').notNull().references(() => eventQuestions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('event_question_votes_uq').on(t.questionId, t.userId)],
);

export const eventRecordings = pgTable(
  'event_recordings',
  {
    id: id(),
    eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    videoUrl: text('video_url').notNull(),
    videoProvider: text('video_provider'),
    videoExternalId: text('video_external_id'),
    durationSeconds: integer('duration_seconds'),
    publishedAt: ts('published_at').notNull().defaultNow(),
  },
  (t) => [index('event_recordings_community_idx').on(t.communityId, t.publishedAt)],
);
