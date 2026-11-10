// Thẻ và quy tắc tự động: liên hệ (người để lại email ở landing, chưa cần tài khoản), thẻ, nguồn đồng bộ nhận dữ liệu
// từ bên ngoài (Webcake...), nhật ký nhận, quy tắc "KHI gắn thẻ X THÌ ...", quyền chờ kích hoạt theo email.
// Mọi bảng thuộc về workspace: thẻ dùng chung cho các hội của cùng một chủ.
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps, ts } from './_helpers';
import { communities, workspaces } from './tenant';
import { users } from './users';

/** Trường nào trong dữ liệu gửi về là email, tên, số điện thoại, thẻ. Để trống thì tự dò theo tên trường quen thuộc. */
export interface InboundMapping {
  emailPath: string;
  namePath: string;
  phonePath: string;
  tagPath: string;
  removeTagPath: string;
  /** Thẻ luôn gắn cho mọi lượt gửi từ nguồn này, kể cả khi dữ liệu không có trường thẻ. */
  defaultTags: string[];
}

export type AutomationAction =
  | { type: 'grant_membership'; communityId: string; tierKey: 'standard' | 'premium' | 'vip'; durationDays: number | null }
  | { type: 'grant_course'; courseId: string }
  | { type: 'send_email'; subject: string; body: string };

export interface AutomationActionResult {
  type: AutomationAction['type'] | 'activation_email';
  status: 'done' | 'pending' | 'skipped' | 'failed' | 'revoked';
  detail: string;
}

export type InboundEventStatus = 'processed' | 'ignored' | 'failed';
export type AutomationGrantStatus = 'pending' | 'applied' | 'revoked' | 'expired' | 'skipped';
export type AutomationTrigger = 'tag_added' | 'tag_removed' | 'expired';

export const contacts = pgTable(
  'contacts',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Luôn viết thường. */
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    phone: text('phone').notNull().default(''),
    /** Tài khoản Hội Mình trùng email (nếu đã có). Tên cột không phải user_id để policy RLS chỉ mở theo workspace. */
    linkedUserId: uuid('linked_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Khóa trong link "ngừng nhận email". */
    unsubscribeToken: text('unsubscribe_token').notNull(),
    unsubscribedAt: ts('unsubscribed_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('contacts_workspace_email_uq').on(t.workspaceId, t.email), index('contacts_email_idx').on(t.email), uniqueIndex('contacts_unsubscribe_uq').on(t.unsubscribeToken)],
);

export const tags = pgTable(
  'tags',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Tên thẻ đã chuẩn hóa: chữ thường không dấu, số, gạch dưới, gạch nối (ví dụ `paid`, `order_placed`). */
    name: text('name').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tags_workspace_name_uq').on(t.workspaceId, t.name)],
);

export const contactTags = pgTable(
  'contact_tags',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
    source: text('source').$type<'inbound' | 'manual'>().notNull().default('inbound'),
    /** inbound_events.id khi thẻ đến từ nguồn đồng bộ. */
    sourceId: text('source_id'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('contact_tags_uq').on(t.contactId, t.tagId), index('contact_tags_tag_idx').on(t.tagId)],
);

export const inboundSources = pgTable(
  'inbound_sources',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Khóa bí mật nằm trong địa chỉ nhận /webhooks/in/<token>. */
    token: text('token').notNull(),
    status: text('status').$type<'active' | 'paused'>().notNull().default('active'),
    mapping: jsonb('mapping').$type<InboundMapping>().notNull().default({ emailPath: '', namePath: '', phonePath: '', tagPath: '', removeTagPath: '', defaultTags: [] }),
    receivedCount: integer('received_count').notNull().default(0),
    lastReceivedAt: ts('last_received_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('inbound_sources_token_uq').on(t.token), index('inbound_sources_workspace_idx').on(t.workspaceId)],
);

export const inboundEvents = pgTable(
  'inbound_events',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id').notNull().references(() => inboundSources.id, { onDelete: 'cascade' }),
    status: text('status').$type<InboundEventStatus>().notNull(),
    detail: text('detail').notNull().default(''),
    /** Dữ liệu thô nhận được, để chủ hội xem và chọn trường. */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    email: text('email'),
    tagsAdded: jsonb('tags_added').$type<string[]>().notNull().default([]),
    tagsRemoved: jsonb('tags_removed').$type<string[]>().notNull().default([]),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('inbound_events_source_idx').on(t.sourceId, t.createdAt)],
);

export const automationRules = pgTable(
  'automation_rules',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Thẻ kích hoạt: quy tắc chạy khi liên hệ được gắn thẻ này lần đầu. */
    tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
    actions: jsonb('actions').$type<AutomationAction[]>().notNull().default([]),
    enabled: boolean('enabled').notNull().default(true),
    /** Gỡ thẻ thì thu hồi quyền quy tắc này đã cấp. */
    revokeOnTagRemoved: boolean('revoke_on_tag_removed').notNull().default(true),
    runCount: integer('run_count').notNull().default(0),
    lastRunAt: ts('last_run_at'),
    ...timestamps(),
  },
  (t) => [index('automation_rules_workspace_idx').on(t.workspaceId), index('automation_rules_tag_idx').on(t.tagId)],
);

export const automationRuns = pgTable(
  'automation_runs',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    ruleId: uuid('rule_id').notNull().references(() => automationRules.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    trigger: text('trigger').$type<AutomationTrigger>().notNull(),
    results: jsonb('results').$type<AutomationActionResult[]>().notNull().default([]),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('automation_runs_rule_idx').on(t.ruleId, t.createdAt), index('automation_runs_contact_idx').on(t.contactId)],
);

/**
 * Quyền một quy tắc cấp cho một liên hệ. `pending`: giữ theo email, chờ khách bấm link kích hoạt (chưa có tài khoản
 * hoặc email chưa xác minh). `applied`: đã cấp vào tài khoản (entitlement nguồn `automation`, source_id = id dòng này).
 */
export const automationGrants = pgTable(
  'automation_grants',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Xóa quy tắc không thu hồi quyền đã cấp: dòng này ở lại (rule_id thành null) để hạn dùng vẫn được xử lý. */
    ruleId: uuid('rule_id').references(() => automationRules.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<'membership' | 'course'>().notNull(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }),
    /** community_tiers.id với membership, courses.id với course. */
    resourceId: uuid('resource_id').notNull(),
    durationDays: integer('duration_days'),
    status: text('status').$type<AutomationGrantStatus>().notNull().default('pending'),
    detail: text('detail').notNull().default(''),
    /** Tài khoản đã nhận quyền. Không đặt tên user_id để policy RLS chỉ mở theo workspace. */
    grantedUserId: uuid('granted_user_id').references(() => users.id, { onDelete: 'set null' }),
    appliedAt: ts('applied_at'),
    expiresAt: ts('expires_at'),
    revokedAt: ts('revoked_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('automation_grants_uq').on(t.ruleId, t.contactId, t.kind, t.resourceId), index('automation_grants_contact_idx').on(t.contactId), index('automation_grants_expiry_idx').on(t.status, t.expiresAt)],
);

/** Link kích hoạt gửi qua email: bấm vào là chứng minh được quyền sở hữu email. Chỉ lưu bản băm. */
export const contactClaims = pgTable(
  'contact_claims',
  {
    id: id(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('contact_claims_token_uq').on(t.tokenHash), index('contact_claims_contact_idx').on(t.contactId)],
);
