// Người dùng, thông tin đăng nhập local, xác minh email, đặt lại mật khẩu, phiên đăng nhập.
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps, ts } from './_helpers';

export type UserStatus = 'active' | 'suspended' | 'deleted';
export interface ProfileLink {
  kind: string;
  label: string;
  url: string;
}
export interface ProfilePrivacy {
  publicProfile: boolean;
  showProgress: boolean;
  showCommunities: boolean;
  allowMessages: boolean;
}

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    handle: text('handle').notNull(),
    avatarUrl: text('avatar_url'),
    coverColor: text('cover_color').default('#D4593A'),
    bio: text('bio').notNull().default(''),
    location: text('location').notNull().default(''),
    occupation: text('occupation').notNull().default(''),
    links: jsonb('links').$type<ProfileLink[]>().notNull().default([]),
    privacy: jsonb('privacy')
      .$type<ProfilePrivacy>()
      .notNull()
      .default({ publicProfile: true, showProgress: true, showCommunities: false, allowMessages: true }),
    status: text('status').$type<UserStatus>().notNull().default('active'),
    isSuperAdmin: boolean('is_super_admin').notNull().default(false),
    emailVerifiedAt: ts('email_verified_at'),
    /** Id người dùng phía Supabase Auth (null khi dùng auth local). */
    authProviderId: text('auth_provider_id'),
    locale: text('locale').notNull().default('vi-VN'),
    timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),
    lastSeenAt: ts('last_seen_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email), uniqueIndex('users_handle_uq').on(t.handle), index('users_auth_provider_idx').on(t.authProviderId)],
);

/** Mật khẩu băm (PBKDF2) khi AUTH_PROVIDER=local. */
export const userCredentials = pgTable('user_credentials', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  passwordVersion: integer('password_version').notNull().default(1),
  ...timestamps(),
});

export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('email_verifications_user_idx').on(t.userId)],
);

export const passwordResets = pgTable(
  'password_resets',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('password_resets_token_uq').on(t.tokenHash), index('password_resets_user_idx').on(t.userId)],
);

/** Phiên đăng nhập (refresh token băm) để đăng xuất khỏi thiết bị khác. */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('auth_sessions_refresh_uq').on(t.refreshTokenHash), index('auth_sessions_user_idx').on(t.userId)],
);
