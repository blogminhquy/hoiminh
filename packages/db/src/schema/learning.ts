// Học tập: khóa học, module, bài học (video nhúng ngoài), tài liệu, tiến độ.
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, money, timestamps, ts } from './_helpers';
import { communities, workspaces } from './tenant';
import { users } from './users';

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseAccessMode = 'all_members' | 'premium' | 'store_only' | 'premium_and_store';
export type LessonKind = 'video' | 'text' | 'task' | 'file';

export const courses = pgTable(
  'courses',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    shortDescription: text('short_description').notNull().default(''),
    descriptionMd: text('description_md').notNull().default(''),
    coverUrl: text('cover_url'),
    coverColor: text('cover_color').notNull().default('#D4593A'),
    introVideoUrl: text('intro_video_url'),
    status: text('status').$type<CourseStatus>().notNull().default('draft'),
    accessMode: text('access_mode').$type<CourseAccessMode>().notNull().default('premium_and_store'),
    priceMinor: money('price_minor'),
    compareAtMinor: money('compare_at_minor'),
    previewFirstModule: boolean('preview_first_module').notNull().default(true),
    affiliateEnabled: boolean('affiliate_enabled').notNull().default(true),
    dripEnabled: boolean('drip_enabled').notNull().default(false),
    certificateEnabled: boolean('certificate_enabled').notNull().default(true),
    sequential: boolean('sequential').notNull().default(false),
    hiddenFromStore: boolean('hidden_from_store').notNull().default(false),
    lessonCount: integer('lesson_count').notNull().default(0),
    totalDurationSeconds: integer('total_duration_seconds').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    publishedAt: ts('published_at'),
    deletedAt: ts('deleted_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('courses_slug_uq').on(t.workspaceId, t.slug), index('courses_community_idx').on(t.communityId, t.status)],
);

export const courseModules = pgTable(
  'course_modules',
  {
    id: id(),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('course_modules_course_idx').on(t.courseId, t.sortOrder)],
);

export const lessons = pgTable(
  'lessons',
  {
    id: id(),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id').notNull().references(() => courseModules.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: text('kind').$type<LessonKind>().notNull().default('video'),
    videoProvider: text('video_provider'),
    videoExternalId: text('video_external_id'),
    videoUrl: text('video_url'),
    contentMd: text('content_md').notNull().default(''),
    isPreview: boolean('is_preview').notNull().default(false),
    dripDays: integer('drip_days').notNull().default(0),
    requireComplete: boolean('require_complete').notNull().default(false),
    durationSeconds: integer('duration_seconds'),
    sortOrder: integer('sort_order').notNull().default(0),
    status: text('status').notNull().default('published'),
    ...timestamps(),
  },
  (t) => [index('lessons_module_idx').on(t.moduleId, t.sortOrder), index('lessons_course_idx').on(t.courseId)],
);

export const lessonResources = pgTable(
  'lesson_resources',
  {
    id: id(),
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id'),
    name: text('name').notNull(),
    url: text('url').notNull(),
    sizeBytes: integer('size_bytes'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('lesson_resources_lesson_idx').on(t.lessonId)],
);

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: id(),
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    completed: boolean('completed').notNull().default(false),
    watchedSeconds: integer('watched_seconds').notNull().default(0),
    completedAt: ts('completed_at'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('lesson_progress_uq').on(t.lessonId, t.userId), index('lesson_progress_course_user_idx').on(t.courseId, t.userId)],
);

/** Tiến độ cấp khóa học (cache, mục 196). */
export const courseProgress = pgTable(
  'course_progress',
  {
    id: id(),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    completedLessons: integer('completed_lessons').notNull().default(0),
    totalLessons: integer('total_lessons').notNull().default(0),
    percent: integer('percent').notNull().default(0),
    lastLessonId: uuid('last_lesson_id'),
    lastAccessedAt: ts('last_accessed_at'),
    completedAt: ts('completed_at'),
    startedAt: ts('started_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('course_progress_uq').on(t.courseId, t.userId), index('course_progress_user_idx').on(t.userId)],
);

export const courseEnrollments = pgTable(
  'course_enrollments',
  {
    id: id(),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    entitlementId: uuid('entitlement_id'),
    status: text('status').$type<'active' | 'expired' | 'completed' | 'revoked'>().notNull().default('active'),
    enrolledAt: ts('enrolled_at').notNull().defaultNow(),
    expiresAt: ts('expires_at'),
    completedAt: ts('completed_at'),
  },
  (t) => [uniqueIndex('course_enrollments_uq').on(t.courseId, t.userId)],
);
