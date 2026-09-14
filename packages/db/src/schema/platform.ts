// Nền tảng: gói, subscription nền tảng, usage, API key, webhook gửi đi, tệp, audit, feature flag, onboarding, job hẹn giờ, email log.
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, money, timestamps, ts } from './_helpers';
import { communities, workspaces } from './tenant';
import { users } from './users';

export const plans = pgTable('plans', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  monthlyMinor: money('monthly_minor').notNull(),
  yearlyMinor: money('yearly_minor').notNull(),
  trialDays: integer('trial_days').notNull().default(14),
  quotas: jsonb('quotas').$type<Record<string, number | null>>().notNull().default({}),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps(),
});

export const platformSubscriptions = pgTable(
  'platform_subscriptions',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    planKey: text('plan_key').notNull().references(() => plans.key),
    status: text('status').$type<'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'>().notNull().default('trialing'),
    billingCycle: text('billing_cycle').$type<'monthly' | 'yearly'>().notNull().default('monthly'),
    currentPeriodStart: ts('current_period_start').notNull(),
    currentPeriodEnd: ts('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    provider: text('provider'),
    lastOrderId: uuid('last_order_id'),
    remindersSent: jsonb('reminders_sent').$type<string[]>().notNull().default([]),
    ...timestamps(),
  },
  (t) => [uniqueIndex('platform_subscriptions_workspace_uq').on(t.workspaceId), index('platform_subscriptions_period_idx').on(t.status, t.currentPeriodEnd)],
);

export const subscriptionUsage = pgTable(
  'subscription_usage',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    period: text('period').notNull(),
    value: integer('value').notNull().default(0),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('subscription_usage_uq').on(t.workspaceId, t.metric, t.period)],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    status: text('status').$type<'active' | 'revoked'>().notNull().default('active'),
    expiresAt: ts('expires_at'),
    lastUsedAt: ts('last_used_at'),
    revokedAt: ts('revoked_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('api_keys_hash_uq').on(t.keyHash), index('api_keys_workspace_idx').on(t.workspaceId)],
);

export const apiKeyLogs = pgTable(
  'api_key_logs',
  {
    id: id(),
    apiKeyId: uuid('api_key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    path: text('path').notNull(),
    status: integer('status').notNull(),
    requestId: text('request_id'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('api_key_logs_key_idx').on(t.apiKeyId, t.createdAt)],
);

export const webhooks = pgTable(
  'webhooks',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    description: text('description').notNull().default(''),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    secretEncrypted: text('secret_encrypted').notNull(),
    status: text('status').$type<'active' | 'paused'>().notNull().default('active'),
    failureCount: integer('failure_count').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('webhooks_workspace_idx').on(t.workspaceId)],
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: id(),
    webhookId: uuid('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
    eventName: text('event_name').notNull(),
    eventId: text('event_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    attempt: integer('attempt').notNull().default(0),
    status: text('status').$type<'pending' | 'delivered' | 'failed' | 'exhausted'>().notNull().default('pending'),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    nextAttemptAt: ts('next_attempt_at'),
    deliveredAt: ts('delivered_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('webhook_deliveries_pending_idx').on(t.status, t.nextAttemptAt), index('webhook_deliveries_webhook_idx').on(t.webhookId, t.createdAt)],
);

export const files = pgTable(
  'files',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
    objectKey: text('object_key').notNull(),
    url: text('url'),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    originalName: text('original_name').notNull(),
    visibility: text('visibility').$type<'public' | 'private'>().notNull().default('public'),
    width: integer('width'),
    height: integer('height'),
    status: text('status').$type<'pending' | 'ready'>().notNull().default('pending'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('files_object_key_uq').on(t.objectKey), index('files_owner_idx').on(t.ownerUserId)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    workspaceId: uuid('workspace_id'),
    communityId: uuid('community_id'),
    actorUserId: uuid('actor_user_id'),
    actorType: text('actor_type').$type<'user' | 'api_key' | 'system'>().notNull().default('user'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    requestId: text('request_id'),
    ipHash: text('ip_hash'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('audit_logs_workspace_idx').on(t.workspaceId, t.createdAt), index('audit_logs_actor_idx').on(t.actorUserId, t.createdAt), index('audit_logs_resource_idx').on(t.resourceType, t.resourceId)],
);

export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  description: text('description').notNull().default(''),
  enabled: boolean('enabled').notNull().default(false),
  rules: jsonb('rules').$type<{ workspaceIds?: string[]; planKeys?: string[]; percent?: number }>().notNull().default({}),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const onboardingProgress = pgTable(
  'onboarding_progress',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    completedAt: ts('completed_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('onboarding_progress_uq').on(t.workspaceId, t.communityId, t.stepKey)],
);

/** Job hẹn giờ (tin nhắn chào sau N phút, nhắc sự kiện…), cron quét mỗi phút. */
export const scheduledJobs = pgTable(
  'scheduled_jobs',
  {
    id: id(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    dedupeKey: text('dedupe_key'),
    runAt: ts('run_at').notNull(),
    status: text('status').$type<'pending' | 'running' | 'done' | 'failed'>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: ts('created_at').notNull().defaultNow(),
    doneAt: ts('done_at'),
  },
  (t) => [index('scheduled_jobs_due_idx').on(t.status, t.runAt), uniqueIndex('scheduled_jobs_dedupe_uq').on(t.dedupeKey)],
);

export const emailLogs = pgTable(
  'email_logs',
  {
    id: id(),
    toEmail: text('to_email').notNull(),
    template: text('template').notNull(),
    subject: text('subject').notNull(),
    status: text('status').$type<'sent' | 'failed' | 'logged'>().notNull(),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('email_logs_to_idx').on(t.toEmail, t.createdAt)],
);
