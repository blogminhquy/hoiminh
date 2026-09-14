// Tenant: workspace → community → thành viên, tier, câu hỏi khi tham gia, plugin, tùy chọn người dùng, lời mời.
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, money, timestamps, ts } from './_helpers';
import { users } from './users';

export type WorkspaceStatus = 'trial' | 'active' | 'past_due' | 'locked' | 'archived';
export type WorkspaceRole = 'owner' | 'admin' | 'editor';
export type CommunityStatus = 'draft' | 'active' | 'archived' | 'locked';
export type PricingMode = 'free' | 'freemium' | 'subscription' | 'one_time';
export type MemberStatus = 'active' | 'cancelling' | 'churned' | 'banned' | 'pending';
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member';
export type MemberSource = 'invite' | 'affiliate' | 'discovery' | 'direct';
export interface CommunityLink {
  label: string;
  url: string;
}

export const workspaces = pgTable(
  'workspaces',
  {
    id: id(),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    planKey: text('plan_key').notNull().default('hoiminh'),
    status: text('status').$type<WorkspaceStatus>().notNull().default('trial'),
    trialEndsAt: ts('trial_ends_at'),
    /** Hết hạn gói thì khóa tạo nội dung, không xóa dữ liệu. */
    contentLockedAt: ts('content_locked_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('workspaces_slug_uq').on(t.slug), index('workspaces_owner_idx').on(t.ownerUserId)],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<WorkspaceRole>().notNull().default('admin'),
    status: text('status').notNull().default('active'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('workspace_members_uq').on(t.workspaceId, t.userId), index('workspace_members_user_idx').on(t.userId)],
);

export const communities = pgTable(
  'communities',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    shortDescription: text('short_description').notNull().default(''),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('kinh-doanh'),
    logoUrl: text('logo_url'),
    logoMark: text('logo_mark').notNull().default('HM'),
    logoColor: text('logo_color').notNull().default('#D4593A'),
    coverUrl: text('cover_url'),
    coverColor: text('cover_color').notNull().default('#0E8E96'),
    coverTagline: text('cover_tagline').notNull().default(''),
    introVideoUrl: text('intro_video_url'),
    rules: jsonb('rules').$type<string[]>().notNull().default([]),
    links: jsonb('links').$type<CommunityLink[]>().notNull().default([]),
    status: text('status').$type<CommunityStatus>().notNull().default('active'),
    pricingMode: text('pricing_mode').$type<PricingMode>().notNull().default('freemium'),
    doorsOpen: boolean('doors_open').notNull().default(true),
    discoverable: boolean('discoverable').notNull().default(true),
    customDomain: text('custom_domain'),
    customDomainVerifiedAt: ts('custom_domain_verified_at'),
    enabledProviders: jsonb('enabled_providers').$type<string[]>().notNull().default(['sepay', 'momo', 'vnpay']),
    /** Tab hiển thị với thành viên (mục 191). */
    tabs: jsonb('tabs').$type<Record<string, boolean>>().notNull().default({ feed: true, courses: true, events: true, members: true, affiliate: true, store: true, about: true, resources: false }),
    requireSpace: boolean('require_space').notNull().default(true),
    moderateNewMembersDays: integer('moderate_new_members_days').notNull().default(0),
    memberCount: integer('member_count').notNull().default(0),
    paidMemberCount: integer('paid_member_count').notNull().default(0),
    lockedReason: text('locked_reason'),
    deletedAt: ts('deleted_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('communities_slug_uq').on(t.slug), index('communities_workspace_idx').on(t.workspaceId), index('communities_discover_idx').on(t.discoverable, t.status)],
);

export const communityTiers = pgTable(
  'community_tiers',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    key: text('key').$type<'standard' | 'premium' | 'vip'>().notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    benefits: jsonb('benefits').$type<string[]>().notNull().default([]),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    monthlyMinor: money('monthly_minor'),
    yearlyMinor: money('yearly_minor'),
    oneTimeMinor: money('one_time_minor'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('community_tiers_uq').on(t.communityId, t.key)],
);

export const communityMembers = pgTable(
  'community_members',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<MemberRole>().notNull().default('member'),
    status: text('status').$type<MemberStatus>().notNull().default('active'),
    tierId: uuid('tier_id').references(() => communityTiers.id),
    /** Id subscription hiện tại (bảng subscriptions, không FK để tránh vòng import). */
    subscriptionId: uuid('subscription_id'),
    /** Cộng sự đã giới thiệu (affiliate_accounts.id, không FK để tránh vòng import). */
    referredByAffiliateId: uuid('referred_by_affiliate_id'),
    source: text('source').$type<MemberSource>().notNull().default('direct'),
    lifetimeValueCents: money('lifetime_value_cents').notNull().default(0),
    lastPaymentAt: ts('last_payment_at'),
    nextRenewalAt: ts('next_renewal_at'),
    lastActiveAt: ts('last_active_at'),
    level: integer('level').notNull().default(1),
    joinedAt: ts('joined_at').notNull().defaultNow(),
    bannedAt: ts('banned_at'),
    churnedAt: ts('churned_at'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('community_members_uq').on(t.communityId, t.userId),
    index('community_members_user_idx').on(t.userId),
    index('community_members_status_idx').on(t.communityId, t.status),
    index('community_members_affiliate_idx').on(t.referredByAffiliateId),
  ],
);

export const communityJoinQuestions = pgTable(
  'community_join_questions',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    required: boolean('required').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('community_join_questions_idx').on(t.communityId)],
);

export const memberJoinAnswers = pgTable(
  'member_join_answers',
  {
    id: id(),
    memberId: uuid('member_id').notNull().references(() => communityMembers.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id').notNull().references(() => communityJoinQuestions.id, { onDelete: 'cascade' }),
    answer: text('answer').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('member_join_answers_uq').on(t.memberId, t.questionId)],
);

export const communityPlugins = pgTable(
  'community_plugins',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    pluginKey: text('plugin_key').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('community_plugins_uq').on(t.communityId, t.pluginKey)],
);

export const userCommunityPrefs = pgTable(
  'user_community_prefs',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    pinned: boolean('pinned').notNull().default(false),
    hidden: boolean('hidden').notNull().default(false),
    notificationLevel: text('notification_level').$type<'all' | 'mentions' | 'off'>().notNull().default('all'),
  },
  (t) => [uniqueIndex('user_community_prefs_uq').on(t.userId, t.communityId)],
);

export const communityInvites = pgTable(
  'community_invites',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    email: text('email'),
    token: text('token').notNull(),
    role: text('role').$type<MemberRole>().notNull().default('member'),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id),
    expiresAt: ts('expires_at').notNull(),
    acceptedAt: ts('accepted_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('community_invites_token_uq').on(t.token), index('community_invites_community_idx').on(t.communityId)],
);
