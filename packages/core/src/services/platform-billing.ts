// Gói nền tảng (mục 202): một gói, tháng/năm, dùng thử 14 ngày, nhắc 7/3/1 ngày, hết hạn khóa tạo nội dung không xóa dữ liệu.
import { BUSINESS } from '@hoiminh/config';
import { templates } from '@hoiminh/email';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { platformSubscriptions, plans, users, workspaces } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { notFound } from '../errors';
import { periodEnd } from '../lib/money';
import { requireSuperAdmin, requireWorkspaceRole } from '../permissions';
import { audit } from './audit';
import { grant } from './entitlements';

/** Gói đang bán (một gói duy nhất ở V1, bảng plans vẫn mở rộng được). */
export async function listPlans(ctx: Ctx) {
  return ctx.db.query.plans.findMany({ where: eq(plans.isActive, true), orderBy: (t, { asc }) => asc(t.sortOrder) });
}

/** Sau payment.succeeded cho platform: kích hoạt/gia hạn subscription nền tảng, mở khóa workspace. */
export async function activatePlatformPurchase(ctx: Ctx, p: { workspaceId: string; orderId: string; cycle: 'monthly' | 'yearly'; paidAt: Date; provider: string; userId: string }) {
  const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, p.workspaceId) });
  if (!ws) throw notFound();
  const sub = await ctx.db.query.platformSubscriptions.findFirst({ where: eq(platformSubscriptions.workspaceId, ws.id) });
  const base = sub && sub.currentPeriodEnd > p.paidAt && sub.status === 'active' ? sub.currentPeriodEnd : p.paidAt;
  const end = periodEnd(base, p.cycle)!;
  if (sub) await ctx.db.update(platformSubscriptions).set({ status: 'active', billingCycle: p.cycle, currentPeriodStart: p.paidAt, currentPeriodEnd: end, cancelAtPeriodEnd: false, provider: p.provider, lastOrderId: p.orderId, remindersSent: [], updatedAt: ctx.now() }).where(eq(platformSubscriptions.id, sub.id));
  else await ctx.db.insert(platformSubscriptions).values({ workspaceId: ws.id, planKey: ws.planKey, status: 'active', billingCycle: p.cycle, currentPeriodStart: p.paidAt, currentPeriodEnd: end, provider: p.provider, lastOrderId: p.orderId });
  await ctx.db.update(workspaces).set({ status: 'active', contentLockedAt: null, updatedAt: ctx.now() }).where(eq(workspaces.id, ws.id));
  await grant(ctx, { userId: ws.ownerUserId, workspaceId: ws.id, communityId: null, resourceType: 'platform_plan', resourceId: ws.planKey, sourceType: 'purchase', sourceId: p.orderId, expiresAt: end });
  await ctx.events.emit('platform.subscription_activated', { workspaceId: ws.id, cycle: p.cycle, periodEnd: end.toISOString() });
  await audit(ctx, { action: 'platform.subscription_activated', resourceType: 'workspace', resourceId: ws.id, workspaceId: ws.id, metadata: { cycle: p.cycle, periodEnd: end.toISOString() } });
}

/** Trạng thái gói của workspace (màn Hội của tôi, banner nhắc). */
export async function platformStatus(ctx: Ctx, workspaceId: string) {
  await requireWorkspaceRole(ctx, workspaceId, ['owner', 'admin', 'editor']);
  const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) throw notFound();
  const sub = await ctx.db.query.platformSubscriptions.findFirst({ where: eq(platformSubscriptions.workspaceId, workspaceId) });
  const plan = await ctx.db.query.plans.findFirst({ where: eq(plans.key, ws.planKey) });
  const end = sub?.currentPeriodEnd ?? ws.trialEndsAt ?? null;
  const daysLeft = end ? Math.ceil((end.getTime() - ctx.now().getTime()) / 86_400_000) : null;
  return { workspace: ws, subscription: sub, plan, daysLeft, locked: Boolean(ws.contentLockedAt), trial: sub?.status === 'trialing' || ws.status === 'trial' };
}

/** Cron hằng ngày: nhắc 7/3/1 ngày và ngày hết hạn; hết hạn (dùng thử hoặc trả phí quá 3 ngày ân hạn) → khóa tạo nội dung. */
export async function runPlatformBillingCron(ctx: Ctx): Promise<{ reminded: number; locked: number }> {
  const now = ctx.now();
  const subs = await ctx.db.query.platformSubscriptions.findMany({ where: inArray(platformSubscriptions.status, ['trialing', 'active', 'past_due']) });
  let reminded = 0, locked = 0;
  for (const sub of subs) {
    const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000);
    const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, sub.workspaceId) });
    if (!ws) continue;
    const owner = await ctx.db.query.users.findFirst({ where: eq(users.id, ws.ownerUserId) });
    const url = `${ctx.env.APP_URL}/admin?goi=1`;
    for (const d of BUSINESS.trialReminderDays) {
      const key = `d${d}`;
      if (daysLeft <= d && daysLeft > (BUSINESS.trialReminderDays.find((x) => x < d) ?? -1) && !sub.remindersSent.includes(key)) {
        if (owner) await ctx.email.send(templates.trialReminder(owner.email, owner.name, Math.max(daysLeft, 0), url));
        await ctx.db.update(platformSubscriptions).set({ remindersSent: [...sub.remindersSent, key] }).where(eq(platformSubscriptions.id, sub.id));
        reminded++;
        break;
      }
    }
    if (daysLeft <= 0) {
      const grace = sub.status === 'trialing' ? 0 : 3;
      if (sub.status === 'active') await ctx.db.update(platformSubscriptions).set({ status: 'past_due', updatedAt: now }).where(eq(platformSubscriptions.id, sub.id));
      if (-daysLeft >= grace && !ws.contentLockedAt) {
        await ctx.db.update(platformSubscriptions).set({ status: 'expired', updatedAt: now }).where(eq(platformSubscriptions.id, sub.id));
        await ctx.db.update(workspaces).set({ status: 'past_due', contentLockedAt: now, updatedAt: now }).where(eq(workspaces.id, ws.id));
        if (owner && !sub.remindersSent.includes('expired')) {
          await ctx.email.send(templates.trialReminder(owner.email, owner.name, 0, url));
          await ctx.db.update(platformSubscriptions).set({ remindersSent: [...sub.remindersSent, 'expired'] }).where(eq(platformSubscriptions.id, sub.id));
        }
        await ctx.events.emit('platform.locked', { workspaceId: ws.id });
        locked++;
      }
    }
  }
  return { reminded, locked };
}

/** Super admin: sửa giá gói. */
export async function updatePlan(ctx: Ctx, key: string, input: { name?: string; monthlyMinor?: number; yearlyMinor?: number; trialDays?: number; description?: string }) {
  requireSuperAdmin(ctx);
  const [row] = await ctx.db.update(plans).set({ ...input, updatedAt: ctx.now() }).where(eq(plans.key, key)).returning();
  if (!row) throw notFound();
  await audit(ctx, { action: 'plan.update', resourceType: 'plan', resourceId: key, metadata: input });
  return row;
}

/** Số liệu gói nền tảng cho màn quản trị. */
export async function planStats(ctx: Ctx) {
  requireSuperAdmin(ctx);
  const r = await raw(ctx.db, sql`
    select
      (select count(*)::int from platform_subscriptions where status = 'active' and billing_cycle = 'monthly') as monthly_count,
      (select count(*)::int from platform_subscriptions where status = 'active' and billing_cycle = 'yearly') as yearly_count,
      (select count(*)::int from platform_subscriptions where status = 'trialing') as trial_count,
      (select count(*)::int from platform_subscriptions where status in ('expired','past_due')) as expired_count,
      (select count(*)::int from platform_subscriptions where status = 'active' and workspace_id in (select workspace_id from platform_subscriptions)) as converted`);
  const row = r[0] as Record<string, number>;
  const plan = await ctx.db.query.plans.findFirst({ where: eq(plans.key, 'hoiminh') });
  const monthly = Number(row.monthly_count), yearly = Number(row.yearly_count), trial = Number(row.trial_count);
  return { plan, monthlyCount: monthly, yearlyCount: yearly, trialCount: trial, expiredCount: Number(row.expired_count), mrrMonthlyMinor: monthly * (plan?.monthlyMinor ?? 0), mrrYearlyMinor: Math.round((yearly * (plan?.yearlyMinor ?? 0)) / 12), conversionRate: monthly + yearly + trial ? Math.round(((monthly + yearly) / (monthly + yearly + trial)) * 100) : 0 };
}

export { lt, and };
