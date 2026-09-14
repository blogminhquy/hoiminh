// Thương mại: sản phẩm, combo, trang bán chuẩn, offer, giá, mã giảm, đơn hàng, thanh toán, hoàn tiền, subscription, hóa đơn.
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, money, timestamps, ts } from './_helpers';
import { courses } from './learning';
import { communities, workspaces } from './tenant';
import { users } from './users';

export type ProductKind = 'course' | 'bundle' | 'digital';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'expired';
export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'cancelled' | 'expired';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelling' | 'cancelled' | 'expired';
export interface ProductFaq {
  q: string;
  a: string;
}

export const products = pgTable(
  'products',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<ProductKind>().notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    shortDescription: text('short_description').notNull().default(''),
    coverUrl: text('cover_url'),
    coverColor: text('cover_color').notNull().default('#D4593A'),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    digitalFileIds: jsonb('digital_file_ids').$type<string[]>().notNull().default([]),
    priceMinor: money('price_minor').notNull(),
    compareAtMinor: money('compare_at_minor'),
    currency: text('currency').notNull().default('VND'),
    status: text('status').$type<'draft' | 'published' | 'archived'>().notNull().default('published'),
    salesCount: integer('sales_count').notNull().default(0),
    ratingAvg: integer('rating_avg_x10').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    launchDiscountEndsAt: ts('launch_discount_ends_at'),
    deletedAt: ts('deleted_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('products_slug_uq').on(t.communityId, t.slug), index('products_community_idx').on(t.communityId, t.status), index('products_course_idx').on(t.courseId)],
);

export const bundleItems = pgTable(
  'bundle_items',
  {
    id: id(),
    bundleProductId: uuid('bundle_product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    itemProductId: uuid('item_product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('bundle_items_uq').on(t.bundleProductId, t.itemProductId)],
);

export const productPages = pgTable('product_pages', {
  id: id(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }).unique(),
  headline: text('headline').notNull().default(''),
  subheadline: text('subheadline').notNull().default(''),
  shortDescription: text('short_description').notNull().default(''),
  coverImageUrl: text('cover_image_url'),
  introVideoUrl: text('intro_video_url'),
  benefits: jsonb('benefits_json').$type<string[]>().notNull().default([]),
  faq: jsonb('faq_json').$type<ProductFaq[]>().notNull().default([]),
  instructor: jsonb('instructor_json').$type<{ name: string; bio: string } | null>(),
  ctaText: text('cta_text').notNull().default('Mua ngay'),
  guarantee: text('guarantee').notNull().default(''),
  salesMode: text('sales_mode').$type<'native' | 'external_landing'>().notNull().default('native'),
  externalLandingUrl: text('external_landing_url'),
  externalCheckoutMode: text('external_checkout_mode'),
  status: text('status').notNull().default('published'),
  ...timestamps(),
});

/** Offer: một cách bán của một tài nguyên (tier hội theo tháng/năm, sản phẩm một lần, gói nền tảng). */
export const offers = pgTable(
  'offers',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').$type<'tier' | 'product' | 'platform_plan'>().notNull(),
    resourceId: text('resource_id').notNull(),
    name: text('name').notNull(),
    cycle: text('cycle').$type<'monthly' | 'yearly' | 'one_time'>().notNull(),
    status: text('status').notNull().default('active'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('offers_uq').on(t.resourceType, t.resourceId, t.cycle), index('offers_community_idx').on(t.communityId)],
);

export const prices = pgTable(
  'prices',
  {
    id: id(),
    offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
    amountMinor: money('amount_minor').notNull(),
    compareAtMinor: money('compare_at_minor'),
    currency: text('currency').notNull().default('VND'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('prices_offer_idx').on(t.offerId, t.isActive)],
);

export const coupons = pgTable(
  'coupons',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    percentOff: integer('percent_off'),
    amountOffMinor: money('amount_off_minor'),
    appliesTo: text('applies_to').notNull().default('all'),
    maxRedemptions: integer('max_redemptions'),
    redemptionCount: integer('redemption_count').notNull().default(0),
    expiresAt: ts('expires_at'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('coupons_uq').on(t.communityId, t.code)],
);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    communityId: uuid('community_id').references(() => communities.id),
    customerUserId: uuid('customer_user_id').notNull().references(() => users.id),
    /** Loại đích: tier hội, sản phẩm, gói nền tảng. */
    targetType: text('target_type').$type<'tier' | 'product' | 'platform'>().notNull(),
    targetId: text('target_id').notNull(),
    offerId: uuid('offer_id').references(() => offers.id),
    couponId: uuid('coupon_id').references(() => coupons.id),
    subtotalMinor: money('subtotal_minor').notNull(),
    discountMinor: money('discount_minor').notNull().default(0),
    totalMinor: money('total_minor').notNull(),
    currency: text('currency').notNull().default('VND'),
    status: text('status').$type<OrderStatus>().notNull().default('pending'),
    /** Mã tham chiếu thanh toán, dùng làm nội dung chuyển khoản: HM XXXXX. */
    reference: text('reference').notNull(),
    affiliateAccountId: uuid('affiliate_account_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    paidAt: ts('paid_at'),
    refundedAt: ts('refunded_at'),
    expiresAt: ts('expires_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('orders_reference_uq').on(t.reference), index('orders_customer_idx').on(t.customerUserId, t.createdAt), index('orders_community_idx').on(t.communityId, t.createdAt), index('orders_status_idx').on(t.status)],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    name: text('name').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitMinor: money('unit_minor').notNull(),
    totalMinor: money('total_minor').notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    communityId: uuid('community_id').references(() => communities.id),
    orderId: uuid('order_id').notNull().references(() => orders.id),
    customerUserId: uuid('customer_user_id').notNull().references(() => users.id),
    provider: text('provider').notNull(),
    providerPaymentId: text('provider_payment_id'),
    providerRawStatus: text('provider_raw_status'),
    amountMinor: money('amount_minor').notNull(),
    currency: text('currency').notNull().default('VND'),
    status: text('status').$type<PaymentStatus>().notNull().default('pending'),
    paymentMethod: text('payment_method').notNull(),
    /** Luôn bằng 0 ở V1 (không thu phí giao dịch, mục 202). */
    platformFeeCents: money('platform_fee_cents').notNull().default(0),
    refundedMinor: money('refunded_minor').notNull().default(0),
    reference: text('reference').notNull(),
    instruction: jsonb('instruction').$type<Record<string, unknown>>().notNull().default({}),
    paidAt: ts('paid_at'),
    ...timestamps(),
  },
  (t) => [index('payments_order_idx').on(t.orderId), index('payments_reference_idx').on(t.reference), index('payments_provider_idx').on(t.provider, t.providerPaymentId), index('payments_community_idx').on(t.communityId, t.createdAt)],
);

export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: id(),
    paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    status: text('status').notNull(),
    request: jsonb('request').$type<Record<string, unknown>>().notNull().default({}),
    response: jsonb('response').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('payment_attempts_payment_idx').on(t.paymentId)],
);

export const paymentEvents = pgTable(
  'payment_events',
  {
    id: id(),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('payment_events_payment_idx').on(t.paymentId, t.createdAt)],
);

export const refunds = pgTable(
  'refunds',
  {
    id: id(),
    paymentId: uuid('payment_id').notNull().references(() => payments.id),
    orderId: uuid('order_id').notNull().references(() => orders.id),
    amountMinor: money('amount_minor').notNull(),
    reason: text('reason').notNull().default(''),
    status: text('status').$type<'pending' | 'succeeded' | 'failed'>().notNull().default('succeeded'),
    providerRefundId: text('provider_refund_id'),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('refunds_payment_idx').on(t.paymentId)],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    communityId: uuid('community_id').references(() => communities.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    tierId: uuid('tier_id'),
    offerId: uuid('offer_id').references(() => offers.id),
    status: text('status').$type<SubscriptionStatus>().notNull().default('active'),
    billingCycle: text('billing_cycle').$type<'monthly' | 'yearly'>().notNull(),
    amountMinor: money('amount_minor').notNull(),
    currency: text('currency').notNull().default('VND'),
    currentPeriodStart: ts('current_period_start').notNull(),
    currentPeriodEnd: ts('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    provider: text('provider'),
    providerSubscriptionId: text('provider_subscription_id'),
    lastOrderId: uuid('last_order_id'),
    cancelledAt: ts('cancelled_at'),
    ...timestamps(),
  },
  (t) => [index('subscriptions_user_idx').on(t.userId), index('subscriptions_community_idx').on(t.communityId, t.status), index('subscriptions_period_idx').on(t.status, t.currentPeriodEnd)],
);

export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    orderId: uuid('order_id').notNull().references(() => orders.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    number: text('number').notNull(),
    amountMinor: money('amount_minor').notNull(),
    currency: text('currency').notNull().default('VND'),
    description: text('description').notNull(),
    issuedAt: ts('issued_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('invoices_number_uq').on(t.number), index('invoices_user_idx').on(t.userId)],
);
