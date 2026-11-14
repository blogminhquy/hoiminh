// Quản trị hệ thống: tổng quan, hội, người dùng, cổng thanh toán, đối soát (ghép thủ công), nhật ký và webhook.
import { decryptJson, encryptJson, isLocalEnv, providersWithDefaultSecrets } from '@hoiminh/config';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '@hoiminh/contracts';
import { and, desc, eq, ilike, isNull, ne, or, sql } from 'drizzle-orm';
import { auditLogs, communities, emailLogs, orders, payments, providerAccounts, reconciliationItems, users, webhookEvents, workspaces } from '@hoiminh/db';
import { emailProviderLabel, sendImmediately, templates } from '@hoiminh/email';
import { actorUserId, type Ctx } from '../context';
import { raw } from '../lib/db';
import { isOwnerPayee } from '../lib/payee';
import { envWithProviderAccounts, paymentsFor } from '../lib/payment-accounts';
import { invalidState, notFound } from '../errors';
import { requireSuperAdmin } from '../permissions';
import { audit } from './audit';
import { confirmPayment } from './payments';
import { planOfCommunity, planTable } from './plans';
import { platformAvailability, platformPaymentMethods } from './platform-methods';

export interface ConfigWarning {
  key: string;
  label: string;
  detail: string;
  severity: 'error' | 'warn';
}

/**
 * Hạ tầng chưa cấu hình xong. Những thứ này không làm app sập ngay mà hỏng âm thầm
 * (tải ảnh lỗi, email không ai nhận), nên phải hiện ra chứ không để phát hiện qua khiếu nại.
 */
export async function configWarnings(ctx: Ctx): Promise<ConfigWarning[]> {
  const out: ConfigWarning[] = [];
  const prod = ctx.env.APP_ENV === 'production';
  if (ctx.media.kind === 'local') {
    out.push({ key: 'r2', label: 'Chưa nối R2', detail: prod ? 'Tải ảnh và tệp đang hỏng: Worker không có hệ tệp. Deploy API với binding FILES ([[r2_buckets]] trong wrangler.toml, bucket hoiminh-files) là đủ, không cần secret.' : 'Đang lưu tệp trên đĩa máy này. Lên production cần R2.', severity: prod ? 'error' : 'warn' });
  }
  if (!ctx.env.RESEND_API_KEY) {
    out.push({ key: 'resend', label: 'Chưa cấu hình email', detail: `Email xác minh, mời thành viên và nhắc sự kiện chỉ được ghi vào nhật ký, không ai nhận được. Ở Resend: xác minh tên miền của địa chỉ gửi (${ctx.env.EMAIL_FROM}) bằng bản ghi DNS, tạo API key rồi dán vào Hệ thống · Hạ tầng.`, severity: prod ? 'error' : 'warn' });
  }
  if (!isLocalEnv(ctx.env.APP_ENV)) {
    const locked = providersWithDefaultSecrets(await envWithProviderAccounts(ctx));
    const NAMES = { sepay: 'SePay', momo: 'MoMo', vnpay: 'VNPAY' } as const;
    if (locked.length) out.push({ key: 'payments', label: `Cổng đang khóa: ${locked.map((p) => NAMES[p]).join(', ')}`, detail: 'Cổng còn dùng bí mật mặc định nên không nhận thanh toán và từ chối mọi webhook. Nhập credential thật ở Thanh toán, hoặc đặt secret trên Worker API.', severity: prod ? 'error' : 'warn' });
  }
  return out;
}

/** Hạ tầng đang dùng thật sự, đọc từ provider đã khởi tạo chứ không từ biến môi trường. */
export function infraStatus(ctx: Ctx) {
  return {
    email: emailProviderLabel(ctx.email),
    emailFrom: ctx.env.EMAIL_FROM,
    media: ctx.media.label,
    mediaKind: ctx.media.kind,
    env: ctx.env.APP_ENV,
  };
}

/**
 * Gửi một email thử tới chính quản trị đang đăng nhập. Kết quả trả về ngay (sent / failed /
 * logged kèm lỗi của Resend) để biết RESEND_API_KEY và tên miền gửi có đúng không.
 */
export async function sendTestEmail(ctx: Ctx) {
  requireSuperAdmin(ctx);
  const userId = actorUserId(ctx);
  const me = userId ? await ctx.db.query.users.findFirst({ where: eq(users.id, userId) }) : null;
  if (!me) throw notFound('Không tìm thấy tài khoản');
  const sentAt = ctx.now().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const result = await sendImmediately(ctx.email, templates.testEmail(me.email, me.name, { env: ctx.env.APP_ENV, from: ctx.env.EMAIL_FROM, sentAt }));
  await audit(ctx, { action: 'admin.email_test', resourceType: 'user', resourceId: me.id, metadata: { status: result.status, error: result.error ?? null } });
  return { to: me.email, provider: emailProviderLabel(ctx.email), from: ctx.env.EMAIL_FROM, ...result };
}

/** Tổng quan hệ thống: người dùng, hội, GMV, doanh thu nền tảng, lỗi thanh toán, việc cần xử lý, hội mới. */
export async function overview(ctx: Ctx, days = 30) {
  requireSuperAdmin(ctx);
  const r = await raw(ctx.db, sql`
    select
      (select count(*)::int from users where status <> 'deleted') as users_total,
      (select count(*)::int from users where created_at > now() - make_interval(days => ${days})) as users_new,
      (select count(*)::int from communities where status = 'active' and deleted_at is null) as communities_active,
      (select count(*)::int from communities where created_at > now() - make_interval(days => ${days})) as communities_new,
      (select coalesce(sum(total_minor),0)::bigint from orders where status = 'paid' and target_type <> 'platform' and paid_at > now() - make_interval(days => ${days})) as gmv,
      (select coalesce(sum(total_minor),0)::bigint from orders where status = 'paid' and target_type = 'platform' and paid_at > now() - make_interval(days => ${days})) as platform_revenue,
      (select count(*)::int from payments where status = 'failed' and created_at > now() - make_interval(days => ${days})) as failed_payments,
      (select count(*)::int from payments where created_at > now() - make_interval(days => ${days})) as total_payments,
      (select count(*)::int from reconciliation_items where status not in ('matched')) as unmatched,
      (select count(*)::int from webhook_events where processing_status = 'failed' and created_at > now() - interval '1 day') as webhook_failures,
      (select count(*)::int from communities where locked_reason is not null and status = 'active') as reported,
      (select count(*)::int from platform_subscriptions where status = 'active' and current_period_end > now() and current_period_end < now() + interval '7 days') as plans_ending`);
  const row = r[0] as Record<string, string | number>;
  const daily = await raw(ctx.db, sql`select to_char(paid_at, 'YYYY-MM-DD') as d, sum(total_minor)::bigint as v from orders where status = 'paid' and paid_at > now() - make_interval(days => ${days}) group by 1 order by 1`);
  const byProvider = await raw(ctx.db, sql`select provider, sum(amount_minor)::bigint as v from payments where status = 'succeeded' and paid_at > now() - make_interval(days => ${days}) group by provider`);
  const overviewPlans = await planTable(ctx);
  const recent = await ctx.db.select({ c: communities, owner: { name: users.name } }).from(communities).innerJoin(workspaces, eq(workspaces.id, communities.workspaceId)).innerJoin(users, eq(users.id, workspaces.ownerUserId)).where(isNull(communities.deletedAt)).orderBy(desc(communities.createdAt)).limit(5);
  return { config: await configWarnings(ctx), infra: infraStatus(ctx), totals: { users: Number(row.users_total), usersNew: Number(row.users_new), communities: Number(row.communities_active), communitiesNew: Number(row.communities_new), gmvMinor: Number(row.gmv), platformRevenueMinor: Number(row.platform_revenue), failedPayments: Number(row.failed_payments), totalPayments: Number(row.total_payments) }, todo: { unmatched: Number(row.unmatched), webhookFailures: Number(row.webhook_failures), reported: Number(row.reported), plansEnding: Number(row.plans_ending) }, daily: (daily as Array<{ d: string; v: string }>).map((x) => ({ date: x.d, amountMinor: Number(x.v) })), byProvider: (byProvider as Array<{ provider: string; v: string }>).map((x) => ({ provider: x.provider, amountMinor: Number(x.v) })), recentCommunities: recent.map((x) => { const p = planOfCommunity(x.c, overviewPlans, ctx.now()); return { ...x.c, ownerName: x.owner.name, planName: p.needsPlan ? 'Chưa có gói' : p.name, planKey: p.key }; }) };
}

/** Danh sách hội toàn hệ thống với bộ lọc và GMV 30 ngày. */
export async function listCommunities(ctx: Ctx, q: { status?: 'active' | 'draft' | 'archived' | 'locked' | 'reported'; q?: string; limit?: number }) {
  requireSuperAdmin(ctx);
  const conds = [isNull(communities.deletedAt)];
  // "Bị báo cáo" = đang hoạt động nhưng có lý do khóa chờ xử lý (cùng định nghĩa với ô "hội bị báo cáo" ở Tổng quan).
  if (q.status === 'reported') conds.push(eq(communities.status, 'active'), sql`${communities.lockedReason} is not null`);
  else if (q.status) conds.push(eq(communities.status, q.status));
  if (q.q) conds.push(or(ilike(communities.name, `%${q.q}%`), ilike(communities.slug, `%${q.q}%`), ilike(users.name, `%${q.q}%`))!);
  const rows = await ctx.db.select({ c: communities, owner: { id: users.id, name: users.name, email: users.email }, ws: { id: workspaces.id }, gmv: sql<string>`coalesce((select sum(total_minor) from orders o where o.community_id = ${communities.id} and o.status = 'paid' and o.paid_at > now() - interval '30 days'),0)`, cycle: sql<string | null>`(select billing_cycle from platform_subscriptions ps where ps.community_id = ${communities.id} and ps.status = 'active' and ps.current_period_end > now() limit 1)` }).from(communities).innerJoin(workspaces, eq(workspaces.id, communities.workspaceId)).innerJoin(users, eq(users.id, workspaces.ownerUserId)).where(and(...conds)).orderBy(desc(sql`coalesce((select sum(total_minor) from orders o where o.community_id = ${communities.id} and o.status = 'paid' and o.paid_at > now() - interval '30 days'),0)`)).limit(q.limit ?? 50);
  const counts = await ctx.db.select({ status: communities.status, c: sql<number>`count(*)::int` }).from(communities).where(isNull(communities.deletedAt)).groupBy(communities.status);
  const [reported] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(communities).where(and(isNull(communities.deletedAt), eq(communities.status, 'active'), sql`${communities.lockedReason} is not null`));
  const table = await planTable(ctx);
  const now = ctx.now();
  const planView = (c: typeof communities.$inferSelect) => {
    const p = planOfCommunity(c, table, now);
    return { planKey: p.key, planName: p.name, planEndsAt: p.endsAt, needsPlan: p.needsPlan };
  };
  return { items: rows.map((r) => ({ ...r.c, owner: r.owner, gmv30Minor: Number(r.gmv), planCycle: r.cycle, ...planView(r.c) })), counts: { ...(Object.fromEntries(counts.map((c) => [c.status, c.c])) as Record<string, number>), reported: reported?.c ?? 0 } };
}

/** Khóa / mở khóa / lưu trữ hội (bị báo cáo). */
export async function communityAction(ctx: Ctx, communityId: string, action: 'lock' | 'unlock' | 'archive', reason: string) {
  requireSuperAdmin(ctx);
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId) });
  if (!c) throw notFound();
  const status = action === 'lock' ? 'locked' : action === 'unlock' ? 'active' : 'archived';
  await ctx.db.update(communities).set({ status, lockedReason: action === 'unlock' ? null : reason || c.lockedReason, discoverable: action === 'unlock' ? c.discoverable : false, updatedAt: ctx.now() }).where(eq(communities.id, communityId));
  await audit(ctx, { action: `community.${action}`, resourceType: 'community', resourceId: communityId, communityId, metadata: { reason } });
}

/** Người dùng toàn hệ thống. */
export async function listUsers(ctx: Ctx, q: { q?: string; status?: 'active' | 'suspended'; limit?: number }) {
  requireSuperAdmin(ctx);
  const conds = [sql`${users.status} <> 'deleted'`];
  if (q.status) conds.push(eq(users.status, q.status));
  if (q.q) conds.push(or(ilike(users.name, `%${q.q}%`), ilike(users.email, `%${q.q}%`), ilike(users.handle, `%${q.q}%`))!);
  const rows = await ctx.db.select({ u: users, memberships: sql<number>`(select count(*)::int from community_members m where m.user_id = ${users.id} and m.status = 'active')`, owned: sql<number>`(select count(*)::int from workspaces w where w.owner_user_id = ${users.id})`, spent: sql<string>`coalesce((select sum(total_minor) from orders o where o.customer_user_id = ${users.id} and o.status = 'paid'),0)` }).from(users).where(and(...conds)).orderBy(desc(users.createdAt)).limit(q.limit ?? 50);
  const [total] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(users).where(sql`${users.status} <> 'deleted'`);
  return { items: rows.map((r) => ({ id: r.u.id, name: r.u.name, email: r.u.email, handle: r.u.handle, status: r.u.status, isSuperAdmin: r.u.isSuperAdmin, avatarUrl: r.u.avatarUrl, coverColor: r.u.coverColor, createdAt: r.u.createdAt, lastSeenAt: r.u.lastSeenAt, memberships: r.memberships, ownedWorkspaces: r.owned, spentMinor: Number(r.spent) })), total: total?.c ?? 0 };
}

export async function userAction(ctx: Ctx, userId: string, action: 'suspend' | 'activate' | 'make_super_admin' | 'remove_super_admin', reason: string) {
  requireSuperAdmin(ctx);
  const u = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) throw notFound();
  if (action === 'suspend') await ctx.db.update(users).set({ status: 'suspended', updatedAt: ctx.now() }).where(eq(users.id, userId));
  if (action === 'activate') await ctx.db.update(users).set({ status: 'active', updatedAt: ctx.now() }).where(eq(users.id, userId));
  if (action === 'make_super_admin') await ctx.db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, userId));
  if (action === 'remove_super_admin') await ctx.db.update(users).set({ isSuperAdmin: false }).where(eq(users.id, userId));
  await audit(ctx, { action: `user.${action}`, resourceType: 'user', resourceId: userId, metadata: { reason } });
}

/** Cổng thanh toán: trạng thái, sức khỏe webhook, bật/tắt, sandbox/production, credential mã hóa (không hiện lại). */
export async function listProviders(ctx: Ctx) {
  requireSuperAdmin(ctx);
  const rows = await ctx.db.query.providerAccounts.findMany({ where: eq(providerAccounts.scopeType, 'platform') });
  const router = await paymentsFor(ctx);
  // Cổng nào đang hiện cho chủ hội mua gói, cổng nào không và vì sao; cổng mặc định là cổng được chọn sẵn.
  const { states } = await platformAvailability(ctx, null);
  const { defaultMethod } = await platformPaymentMethods(ctx, null);
  const out = [];
  for (const p of PAYMENT_PROVIDERS) {
    const row = rows.find((r) => r.provider === p);
    const stats = await raw(ctx.db, sql`select count(*)::int as total, count(*) filter (where processing_status = 'failed')::int as failed, max(created_at) as last from webhook_events where provider = ${p} and created_at > date_trunc('month', now())`);
    const s = stats[0] as { total: number; failed: number; last: string | null };
    const adapter = router.get(p);
    out.push({ provider: p, enabled: row?.enabled ?? true, mode: row?.mode ?? adapter.mode, health: row?.lastHealthStatus ?? 'unknown', lastHealthAt: row?.lastHealthAt ?? null, consecutiveFailures: Number(row?.consecutiveFailures ?? 0), webhooksThisMonth: Number(s.total), webhookFailuresThisMonth: Number(s.failed), lastWebhookAt: s.last, hasCredentials: Boolean(row?.credentialsEncrypted), configuration: row?.configuration ?? {}, availability: states[p], isDefault: defaultMethod === p });
  }
  return out;
}

export async function updateProvider(ctx: Ctx, provider: PaymentProvider, input: { enabled?: boolean; mode?: 'sandbox' | 'production'; credentials?: Record<string, string>; isDefault?: true }) {
  requireSuperAdmin(ctx);
  const existing = await ctx.db.query.providerAccounts.findFirst({ where: and(eq(providerAccounts.provider, provider), eq(providerAccounts.scopeType, 'platform')) });
  const values = { provider, scopeType: 'platform' as const, enabled: input.enabled ?? existing?.enabled ?? true, mode: input.mode ?? existing?.mode ?? 'sandbox', credentialsEncrypted: input.credentials ? await encryptJson(await mergeCredentials(ctx, existing?.credentialsEncrypted ?? null, input.credentials), ctx.env.ENCRYPTION_KEY, ctx.env.ENCRYPTION_KEY_VERSION) : (existing?.credentialsEncrypted ?? null), configuration: { ...(existing?.configuration ?? {}), ...(input.isDefault ? { isDefault: true } : {}) }, updatedAt: ctx.now() };
  const [row] = existing ? await ctx.db.update(providerAccounts).set(values).where(eq(providerAccounts.id, existing.id)).returning() : await ctx.db.insert(providerAccounts).values(values).returning();
  if (input.isDefault) {
    // Chỉ một cổng mặc định: bỏ dấu ở các cổng còn lại.
    const others = await ctx.db.query.providerAccounts.findMany({ where: and(eq(providerAccounts.scopeType, 'platform'), ne(providerAccounts.provider, provider)) });
    for (const o of others) if ((o.configuration as { isDefault?: unknown }).isDefault) await ctx.db.update(providerAccounts).set({ configuration: { ...o.configuration, isDefault: false }, updatedAt: ctx.now() }).where(eq(providerAccounts.id, o.id));
  }
  await audit(ctx, { action: 'provider.update', resourceType: 'provider_account', resourceId: provider, metadata: { enabled: values.enabled, mode: values.mode, credentialsChanged: Boolean(input.credentials), ...(input.isDefault ? { isDefault: true } : {}) } });
  return { provider: row!.provider, enabled: row!.enabled, mode: row!.mode };
}

/** Ô để trống trong form nghĩa là "giữ nguyên": gộp với credential đã lưu thay vì ghi đè mất. */
async function mergeCredentials(ctx: Ctx, stored: string | null, incoming: Record<string, string>): Promise<Record<string, string>> {
  const next = Object.fromEntries(Object.entries(incoming).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  if (!stored) return next;
  const prev = await decryptJson<Record<string, string>>(stored, ctx.env.ENCRYPTION_KEY).catch(() => ({}));
  return { ...prev, ...next };
}

/** Bảng đối soát chuyển khoản. */
export async function reconciliation(ctx: Ctx, q: { status?: 'matched' | 'unmatched'; limit?: number }) {
  requireSuperAdmin(ctx);
  const conds = q.status === 'matched' ? [eq(reconciliationItems.status, 'matched')] : q.status === 'unmatched' ? [sql`${reconciliationItems.status} <> 'matched'`] : [];
  const rows = await ctx.db.query.reconciliationItems.findMany({ where: conds.length ? and(...conds) : undefined, orderBy: desc(reconciliationItems.transactionAt), limit: q.limit ?? 50 });
  const counts = await ctx.db.select({ status: reconciliationItems.status, c: sql<number>`count(*)::int` }).from(reconciliationItems).groupBy(reconciliationItems.status);
  const [pendingPayouts] = await ctx.db.select({ c: sql<number>`count(*)::int`, sum: sql<string>`coalesce(sum(amount_minor),0)` }).from(sql`affiliate_withdrawal_requests`).where(sql`status in ('requested','reviewing')`);
  const [holding] = await ctx.db.select({ sum: sql<string>`coalesce(sum(amount_minor),0)` }).from(sql`affiliate_commissions`).where(sql`status = 'pending'`);
  return { items: rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.c])) as Record<string, number>, pendingPayouts: { count: pendingPayouts?.c ?? 0, amountMinor: Number(pendingPayouts?.sum ?? 0) }, holdingMinor: Number(holding?.sum ?? 0) };
}

/** Ghép thủ công một giao dịch ngân hàng sai nội dung với đơn theo mã tham chiếu → xác nhận thanh toán. */
export async function matchReconciliation(ctx: Ctx, itemId: string, paymentReference: string) {
  requireSuperAdmin(ctx);
  const item = await ctx.db.query.reconciliationItems.findFirst({ where: eq(reconciliationItems.id, itemId) });
  if (!item) throw notFound();
  if (item.status === 'matched') throw invalidState('Giao dịch đã được ghép');
  const ref = paymentReference.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formatted = `${ref.slice(0, 2)} ${ref.slice(2)}`;
  const payment = await ctx.db.query.payments.findFirst({ where: eq(payments.reference, formatted) });
  if (!payment) throw notFound('Không tìm thấy đơn với mã này');
  if (payment.status === 'succeeded') throw invalidState('Đơn đã được thanh toán trước đó');
  // Giao dịch ở đây là tiền vào tài khoản Hội Mình. Đơn của hội thì phải trả vào tài khoản chủ hội, nên không ghép được.
  if (isOwnerPayee(payment)) throw invalidState('Đơn này trả thẳng vào tài khoản của chủ hội, không ghép với tiền vào tài khoản Hội Mình được. Hoàn lại cho người chuyển nhầm.');
  if (item.amountMinor < payment.amountMinor) throw invalidState(`Số tiền nhận ${item.amountMinor.toLocaleString('vi-VN')}đ nhỏ hơn số tiền đơn ${payment.amountMinor.toLocaleString('vi-VN')}đ`);
  await confirmPayment(ctx, payment.id, { providerPaymentId: item.providerTransactionId, rawStatus: 'manual_match', paidAt: item.transactionAt });
  await ctx.db.update(reconciliationItems).set({ status: 'matched', paymentId: payment.id, orderId: payment.orderId, matchedByUserId: ctx.actor.type === 'user' ? ctx.actor.userId : null, matchedAt: ctx.now(), note: 'Ghép thủ công' }).where(eq(reconciliationItems.id, itemId));
  await audit(ctx, { action: 'reconciliation.manual_match', resourceType: 'reconciliation_item', resourceId: itemId, metadata: { paymentId: payment.id, reference: formatted } });
  return { paymentId: payment.id, orderId: payment.orderId };
}

/** Giao dịch toàn hệ thống. */
export async function listPayments(ctx: Ctx, q: { status?: string; provider?: string; limit?: number }) {
  requireSuperAdmin(ctx);
  const conds = [];
  if (q.status) conds.push(eq(payments.status, q.status as 'pending'));
  if (q.provider) conds.push(eq(payments.provider, q.provider));
  const rows = await ctx.db.select({ p: payments, o: orders, u: { name: users.name, email: users.email }, c: { name: communities.name, slug: communities.slug } }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).innerJoin(users, eq(users.id, payments.customerUserId)).leftJoin(communities, eq(communities.id, payments.communityId)).where(conds.length ? and(...conds) : undefined).orderBy(desc(payments.createdAt)).limit(q.limit ?? 50);
  return rows.map((r) => ({ ...r.p, order: { status: r.o.status, title: (r.o.metadata as { title?: string }).title ?? r.o.targetType, targetType: r.o.targetType }, customer: r.u, community: r.c }));
}

/** Nhật ký và webhook. */
export async function logs(ctx: Ctx, q: { kind?: 'audit' | 'webhook' | 'email'; limit?: number }) {
  requireSuperAdmin(ctx);
  const limit = q.limit ?? 50;
  const want = (k: 'audit' | 'webhook' | 'email') => !q.kind || q.kind === k;
  const [auditRows, webhookRows, emailRows] = await Promise.all([
    want('audit') ? ctx.db.select({ a: auditLogs, actor: { name: users.name, email: users.email } }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).orderBy(desc(auditLogs.createdAt)).limit(limit) : [],
    want('webhook') ? ctx.db.query.webhookEvents.findMany({ orderBy: desc(webhookEvents.createdAt), limit }) : [],
    want('email') ? ctx.db.query.emailLogs.findMany({ orderBy: desc(emailLogs.createdAt), limit }) : [],
  ]);
  return { audit: auditRows.map((r) => ({ ...r.a, actor: r.actor })), webhooks: webhookRows, emails: emailRows };
}
