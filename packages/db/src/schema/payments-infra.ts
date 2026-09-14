// Hạ tầng thanh toán: tài khoản cổng, sự kiện webhook (idempotent), đối soát, entitlement.
import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, money, timestamps, ts } from './_helpers';
import { orders, payments } from './commerce';
import { workspaces } from './tenant';
import { users } from './users';

export type ReconciliationStatus = 'matched' | 'unmatched' | 'amount_mismatch' | 'duplicate' | 'manual_review' | 'missing_code' | 'wrong_content';
export type EntitlementResource = 'community' | 'tier' | 'course' | 'product' | 'bundle' | 'digital' | 'platform_plan';
export type EntitlementSource = 'purchase' | 'subscription' | 'community_bundle' | 'manual_grant' | 'coupon' | 'admin' | 'trial' | 'free_tier';

export const providerAccounts = pgTable(
  'provider_accounts',
  {
    id: id(),
    provider: text('provider').notNull(),
    scopeType: text('scope_type').$type<'platform' | 'workspace'>().notNull().default('platform'),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    mode: text('mode').$type<'sandbox' | 'production'>().notNull().default('sandbox'),
    enabled: boolean('enabled').notNull().default(true),
    credentialsEncrypted: text('credentials_encrypted'),
    webhookSecretEncrypted: text('webhook_secret_encrypted'),
    configuration: jsonb('configuration').$type<Record<string, unknown>>().notNull().default({}),
    lastHealthStatus: text('last_health_status').notNull().default('unknown'),
    lastHealthAt: ts('last_health_at'),
    consecutiveFailures: money('consecutive_failures').notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex('provider_accounts_uq').on(t.provider, t.scopeType, t.workspaceId)],
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: id(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    signatureVerified: boolean('signature_verified').notNull().default(false),
    processingStatus: text('processing_status').$type<'received' | 'processed' | 'ignored' | 'failed'>().notNull().default('received'),
    error: text('error'),
    paymentId: uuid('payment_id').references(() => payments.id),
    processedAt: ts('processed_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('webhook_events_provider_event_uq').on(t.provider, t.providerEventId), index('webhook_events_status_idx').on(t.processingStatus, t.createdAt)],
);

export const reconciliationItems = pgTable(
  'reconciliation_items',
  {
    id: id(),
    provider: text('provider').notNull(),
    providerTransactionId: text('provider_transaction_id').notNull(),
    bankContent: text('bank_content').notNull().default(''),
    bankAccount: text('bank_account'),
    referenceCode: text('reference_code'),
    amountMinor: money('amount_minor').notNull(),
    expectedMinor: money('expected_minor'),
    currency: text('currency').notNull().default('VND'),
    status: text('status').$type<ReconciliationStatus>().notNull().default('unmatched'),
    paymentId: uuid('payment_id').references(() => payments.id),
    orderId: uuid('order_id').references(() => orders.id),
    webhookEventId: uuid('webhook_event_id').references(() => webhookEvents.id),
    matchedByUserId: uuid('matched_by_user_id').references(() => users.id),
    note: text('note'),
    transactionAt: ts('transaction_at').notNull().defaultNow(),
    matchedAt: ts('matched_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('reconciliation_provider_tx_uq').on(t.provider, t.providerTransactionId), index('reconciliation_status_idx').on(t.status, t.transactionAt)],
);

/** Entitlement quyết định quyền truy cập, tách khỏi thanh toán (mục 62–63, 144). */
export const entitlements = pgTable(
  'entitlements',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id'),
    resourceType: text('resource_type').$type<EntitlementResource>().notNull(),
    resourceId: text('resource_id').notNull(),
    sourceType: text('source_type').$type<EntitlementSource>().notNull(),
    sourceId: text('source_id'),
    status: text('status').$type<'active' | 'expired' | 'revoked'>().notNull().default('active'),
    startsAt: ts('starts_at').notNull().defaultNow(),
    expiresAt: ts('expires_at'),
    revokedAt: ts('revoked_at'),
    grantedByUserId: uuid('granted_by_user_id'),
    ...timestamps(),
  },
  (t) => [index('entitlements_user_resource_idx').on(t.userId, t.resourceType, t.resourceId, t.status), index('entitlements_source_idx').on(t.sourceType, t.sourceId), index('entitlements_community_idx').on(t.communityId)],
);
