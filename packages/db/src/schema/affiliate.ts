// Cộng sự hai tầng: chương trình, tài khoản, link, click, attribution, conversion, hoa hồng, sổ cái ví, rút tiền, xếp hạng.
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, money, timestamps, ts } from './_helpers';
import { orders, payments } from './commerce';
import { communities, workspaces } from './tenant';
import { users } from './users';

export type CommissionStatus = 'pending' | 'available' | 'reversed' | 'paid';
export type WalletEntryType = 'credit' | 'hold' | 'release' | 'debit' | 'adjustment';
export type WithdrawalStatus = 'requested' | 'reviewing' | 'paid' | 'rejected' | 'cancelled';

export const affiliatePrograms = pgTable(
  'affiliate_programs',
  {
    id: id(),
    scopeType: text('scope_type').$type<'platform' | 'community'>().notNull(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').$type<'active' | 'paused'>().notNull().default('active'),
    commissionRateBps: integer('commission_rate_bps').notNull().default(4000),
    commissionDurationMonths: integer('commission_duration_months'),
    holdDays: integer('hold_days').notNull().default(14),
    minWithdrawalMinor: money('min_withdrawal_minor').notNull().default(500_000),
    cookieDays: integer('cookie_days').notNull().default(30),
    currency: text('currency').notNull().default('VND'),
    allowSelfReferral: boolean('allow_self_referral').notNull().default(false),
    leaderboardVisibility: text('leaderboard_visibility').$type<'members' | 'affiliates_only' | 'hidden'>().notNull().default('members'),
    leaderboardShowMoney: boolean('leaderboard_show_money').notNull().default(true),
    /** Người chi trả (chủ hội hoặc super admin) nhìn thấy hàng đợi rút. */
    payerUserId: uuid('payer_user_id').references(() => users.id),
    ...timestamps(),
  },
  (t) => [uniqueIndex('affiliate_programs_community_uq').on(t.communityId), index('affiliate_programs_scope_idx').on(t.scopeType)],
);

export const affiliateAccounts = pgTable(
  'affiliate_accounts',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    programId: uuid('program_id').notNull().references(() => affiliatePrograms.id, { onDelete: 'cascade' }),
    affiliateCode: text('affiliate_code').notNull(),
    status: text('status').$type<'pending' | 'active' | 'paused' | 'suspended' | 'banned'>().notNull().default('active'),
    /** Ghi đè tỷ lệ hoa hồng riêng, NULL = dùng mức chung. */
    commissionRateBps: integer('commission_rate_bps'),
    clickCount: integer('click_count').notNull().default(0),
    signupCount: integer('signup_count').notNull().default(0),
    paidCount: integer('paid_count').notNull().default(0),
    approvedAt: ts('approved_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('affiliate_accounts_uq').on(t.userId, t.programId), uniqueIndex('affiliate_accounts_code_uq').on(t.affiliateCode)],
);

export const affiliateLinks = pgTable(
  'affiliate_links',
  {
    id: id(),
    affiliateAccountId: uuid('affiliate_account_id').notNull().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
    targetType: text('target_type').$type<'platform_signup' | 'community' | 'product' | 'checkout'>().notNull(),
    targetId: text('target_id'),
    slug: text('slug').notNull(),
    destinationUrl: text('destination_url').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('affiliate_links_slug_uq').on(t.slug), index('affiliate_links_account_idx').on(t.affiliateAccountId)],
);

export const affiliateClicks = pgTable(
  'affiliate_clicks',
  {
    id: id(),
    affiliateAccountId: uuid('affiliate_account_id').notNull().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
    linkId: uuid('link_id').references(() => affiliateLinks.id, { onDelete: 'set null' }),
    visitorId: text('visitor_id').notNull(),
    ipHash: text('ip_hash'),
    userAgentHash: text('user_agent_hash'),
    landingUrl: text('landing_url'),
    referrer: text('referrer'),
    clickedAt: ts('clicked_at').notNull().defaultNow(),
  },
  (t) => [index('affiliate_clicks_account_idx').on(t.affiliateAccountId, t.clickedAt), index('affiliate_clicks_visitor_idx').on(t.visitorId)],
);

export const affiliateAttributions = pgTable(
  'affiliate_attributions',
  {
    id: id(),
    affiliateAccountId: uuid('affiliate_account_id').notNull().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
    programId: uuid('program_id').notNull().references(() => affiliatePrograms.id, { onDelete: 'cascade' }),
    visitorId: text('visitor_id'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sourceClickId: uuid('source_click_id').references(() => affiliateClicks.id, { onDelete: 'set null' }),
    attributedAt: ts('attributed_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('affiliate_attributions_user_idx').on(t.userId, t.programId), index('affiliate_attributions_visitor_idx').on(t.visitorId, t.programId)],
);

export const affiliateConversions = pgTable(
  'affiliate_conversions',
  {
    id: id(),
    affiliateAccountId: uuid('affiliate_account_id').notNull().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
    programId: uuid('program_id').notNull().references(() => affiliatePrograms.id, { onDelete: 'cascade' }),
    customerUserId: uuid('customer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').references(() => orders.id),
    subscriptionId: uuid('subscription_id'),
    conversionType: text('conversion_type').$type<'signup' | 'platform_subscription' | 'community_purchase' | 'offer_purchase' | 'subscription_renewal'>().notNull(),
    grossMinor: money('gross_minor').notNull().default(0),
    currency: text('currency').notNull().default('VND'),
    status: text('status').$type<'pending' | 'confirmed' | 'reversed'>().notNull().default('confirmed'),
    convertedAt: ts('converted_at').notNull().defaultNow(),
  },
  (t) => [index('affiliate_conversions_account_idx').on(t.affiliateAccountId, t.convertedAt), index('affiliate_conversions_customer_idx').on(t.customerUserId), index('affiliate_conversions_order_idx').on(t.orderId)],
);

export const affiliateCommissions = pgTable(
  'affiliate_commissions',
  {
    id: id(),
    conversionId: uuid('conversion_id').references(() => affiliateConversions.id, { onDelete: 'cascade' }),
    affiliateAccountId: uuid('affiliate_account_id').notNull().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
    programId: uuid('program_id').notNull().references(() => affiliatePrograms.id, { onDelete: 'cascade' }),
    paymentId: uuid('payment_id').references(() => payments.id),
    orderId: uuid('order_id').references(() => orders.id),
    ruleVersion: integer('rule_version').notNull().default(1),
    baseMinor: money('base_minor').notNull(),
    rateBps: integer('rate_bps').notNull(),
    amountMinor: money('amount_minor').notNull(),
    currency: text('currency').notNull().default('VND'),
    status: text('status').$type<CommissionStatus>().notNull().default('pending'),
    availableAt: ts('available_at').notNull(),
    releasedAt: ts('released_at'),
    reversedAt: ts('reversed_at'),
    paidAt: ts('paid_at'),
    note: text('note'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('affiliate_commissions_payment_uq').on(t.paymentId, t.ruleVersion), index('affiliate_commissions_account_idx').on(t.affiliateAccountId, t.status), index('affiliate_commissions_due_idx').on(t.status, t.availableAt)],
);

/** Sổ cái ví bất biến: số dư = SUM(credit + release + adjustment) − SUM(hold + debit). */
export const affiliateWalletEntries = pgTable(
  'affiliate_wallet_entries',
  {
    id: id(),
    affiliateAccountId: uuid('affiliate_account_id').notNull().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
    commissionId: uuid('commission_id').references(() => affiliateCommissions.id),
    withdrawalId: uuid('withdrawal_id'),
    entryType: text('entry_type').$type<WalletEntryType>().notNull(),
    amountMinor: money('amount_minor').notNull(),
    currencyCode: text('currency_code').notNull().default('VND'),
    idempotencyKey: text('idempotency_key').notNull(),
    note: text('note'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('affiliate_wallet_entries_idem_uq').on(t.idempotencyKey), index('affiliate_wallet_entries_account_idx').on(t.affiliateAccountId, t.createdAt)],
);

export const affiliatePayoutProfiles = pgTable('affiliate_payout_profiles', {
  affiliateAccountId: uuid('affiliate_account_id').primaryKey().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
  encryptedPayload: text('encrypted_payload').notNull(),
  keyVersion: integer('key_version').notNull().default(1),
  maskedAccount: text('masked_account').notNull(),
  bankCode: text('bank_code').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const affiliateWithdrawalRequests = pgTable(
  'affiliate_withdrawal_requests',
  {
    id: id(),
    affiliateAccountId: uuid('affiliate_account_id').notNull().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
    programId: uuid('program_id').notNull().references(() => affiliatePrograms.id, { onDelete: 'cascade' }),
    amountMinor: money('amount_minor').notNull(),
    currencyCode: text('currency_code').notNull().default('VND'),
    payoutSnapshotEncrypted: text('payout_snapshot_encrypted').notNull(),
    maskedAccount: text('masked_account').notNull(),
    status: text('status').$type<WithdrawalStatus>().notNull().default('requested'),
    version: integer('version').notNull().default(1),
    transferReference: text('transfer_reference'),
    rejectionReason: text('rejection_reason'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id),
    requestedAt: ts('requested_at').notNull().defaultNow(),
    reviewedAt: ts('reviewed_at'),
    paidAt: ts('paid_at'),
  },
  (t) => [index('affiliate_withdrawals_program_idx').on(t.programId, t.status, t.requestedAt), index('affiliate_withdrawals_account_idx').on(t.affiliateAccountId)],
);

export const affiliateLeaderboardSnapshots = pgTable(
  'affiliate_leaderboard_snapshots',
  {
    id: id(),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    periodType: text('period_type').$type<'month' | 'quarter' | 'all_time'>().notNull(),
    periodKey: text('period_key').notNull(),
    affiliateAccountId: uuid('affiliate_account_id').notNull().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    referralsCount: integer('referrals_count').notNull().default(0),
    paidCount: integer('paid_count').notNull().default(0),
    revenueCents: money('revenue_cents').notNull().default(0),
    commissionCents: money('commission_cents').notNull().default(0),
    rankDelta: integer('rank_delta').notNull().default(0),
    computedAt: ts('computed_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('affiliate_leaderboard_uq').on(t.communityId, t.periodType, t.periodKey, t.affiliateAccountId), index('affiliate_leaderboard_rank_idx').on(t.communityId, t.periodType, t.periodKey, t.rank)],
);

export const affiliateFraudFlags = pgTable('affiliate_fraud_flags', {
  id: id(),
  affiliateAccountId: uuid('affiliate_account_id').notNull().references(() => affiliateAccounts.id, { onDelete: 'cascade' }),
  conversionId: uuid('conversion_id'),
  rule: text('rule').notNull(),
  severity: text('severity').notNull().default('low'),
  status: text('status').notNull().default('open'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: ts('created_at').notNull().defaultNow(),
});
