// Gói Hội Mình (kế hoạch 11/11/2026): bốn gói, mỗi gói cho một hội, hai chu kỳ 3 tháng và 1 năm, không dùng thử.
// Mua, gia hạn, nâng gói (tặng ngày còn lại), nhắc hạn 7/3/1 ngày, hết hạn thì hội về gói Miễn phí, không xóa dữ liệu.
import { BUSINESS } from '@hoiminh/config';
import { PLAN_CYCLE, PLAN_DEFAULTS, PLAN_KEYS, planDaysLeft, planPerMonth, planQuote, planRank, effectivePlanKey, type PlanCycle, type PlanDef, type PlanKey, type SavePlansInput } from '@hoiminh/contracts';
import { templates } from '@hoiminh/email';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { communities, platformSubscriptions, plans, users, workspaces } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { invalid, notFound } from '../errors';
import { requireCommunityPermission, requireSuperAdmin } from '../permissions';
import { audit } from './audit';
import { grant } from './entitlements';
import { planOfCommunity, planTable } from './plans';
import { platformPaymentMethods } from './platform-methods';

/** Bảng gói công khai (trang giá, trang chọn gói): luôn đủ bốn gói theo thứ bậc. */
export async function listPlans(ctx: Ctx): Promise<PlanDef[]> {
  return planTable(ctx);
}

/** Trang "Gói cho hội": gói đang dùng, số thành viên so với trần, bảng gói để chọn. */
export async function communityPlanStatus(ctx: Ctx, communityId: string) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  const c = await ctx.db.query.communities.findFirst({ where: and(eq(communities.id, communityId), isNull(communities.deletedAt)) });
  if (!c) throw notFound('Hội không tồn tại');
  const [table, sub, ws] = await Promise.all([
    planTable(ctx),
    ctx.db.query.platformSubscriptions.findFirst({ where: eq(platformSubscriptions.communityId, c.id) }),
    ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, c.workspaceId), columns: { ownerUserId: true } }),
  ]);
  const plan = planOfCommunity(c, table, ctx.now());
  const isOwner = ctx.actor.type === 'user' && (ctx.actor.userId === ws?.ownerUserId);
  return {
    community: { id: c.id, name: c.name, slug: c.slug, memberCount: c.memberCount, status: c.status, isFreeSlot: c.isFreeSlot },
    plan: { ...plan, daysLeft: planDaysLeft(plan.endsAt, ctx.now()) },
    cycle: sub?.status === 'active' ? sub.billingCycle : null,
    plans: table,
    /** Chỉ chủ workspace mua được gói; quản trị viên chỉ xem. */
    canBuy: isOwner,
    /** Cách trả tiền gói: chỉ cổng quản trị đang bật và đã cài khóa thật, cổng mặc định chọn sẵn. */
    payment: isOwner ? await platformPaymentMethods(ctx, c.workspaceId) : { methods: [], defaultMethod: null },
  };
}

/**
 * Sau payment.succeeded cho gói: kích hoạt, gia hạn hoặc nâng gói cho hội.
 * Ngày hết hạn mới = (ngày hết hạn cũ nếu còn hạn, không thì lúc kích hoạt) + số ngày của chu kỳ. Nhờ vậy gia hạn thì
 * nối tiếp, còn nâng gói thì số ngày còn lại của gói cũ được tặng sang gói mới.
 */
export async function activatePlatformPurchase(ctx: Ctx, p: { communityId: string; planKey: PlanKey; cycle: PlanCycle; orderId: string; paidAt: Date; provider: string; userId: string }) {
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, p.communityId) });
  if (!c) throw notFound('Hội không tồn tại');
  const table = await planTable(ctx);
  const target = table.find((t) => t.key === p.planKey);
  if (!target || target.key === 'free') throw invalid('Gói không hợp lệ');
  // Mốc tính là lúc gói được kích hoạt, không phải giờ giao dịch ngân hàng: tiền chuyển khoản có thể được ghi nhận muộn
  // (webhook trễ, quản trị đối soát tay), và chủ hội không nên mất những ngày chờ đó.
  const now = ctx.now();
  const currentKey = effectivePlanKey(c.planKey, c.planEndsAt, now);
  const q = planQuote({ now, current: { key: currentKey, endsAt: c.planEndsAt }, target, cycle: p.cycle, members: c.memberCount });
  // Checkout đã chặn mua gói thấp hơn gói đang còn hạn. Nếu tiền của một đơn cũ vẫn về sau khi hội đã lên gói cao hơn,
  // khách không bị thiệt: giữ gói cao hơn và cộng thêm số ngày đã trả.
  const planKey = planRank(p.planKey) < planRank(currentKey) ? currentKey : p.planKey;
  const end = q.endsAt;
  // Hội thứ hai được tạo ở trạng thái chờ thanh toán: tiền về thì mở.
  const opening = c.status === 'draft' && c.lockedReason === 'plan_required';
  await ctx.db.update(communities).set({ planKey, planEndsAt: end, ...(opening ? { status: 'active' as const, lockedReason: null } : {}), updatedAt: ctx.now() }).where(eq(communities.id, c.id));
  const values = { planKey, status: 'active' as const, billingCycle: p.cycle, currentPeriodStart: now, currentPeriodEnd: end, cancelAtPeriodEnd: false, provider: p.provider, lastOrderId: p.orderId, remindersSent: [] as string[], updatedAt: ctx.now() };
  await ctx.db.insert(platformSubscriptions).values({ workspaceId: c.workspaceId, communityId: c.id, ...values }).onConflictDoUpdate({ target: platformSubscriptions.communityId, set: values });
  await grant(ctx, { userId: p.userId, workspaceId: c.workspaceId, communityId: c.id, resourceType: 'platform_plan', resourceId: planKey, sourceType: 'purchase', sourceId: p.orderId, expiresAt: end });
  await ctx.events.emit('platform.subscription_activated', { workspaceId: c.workspaceId, communityId: c.id, planKey, cycle: p.cycle, periodEnd: end.toISOString() });
  await audit(ctx, { action: 'platform.subscription_activated', resourceType: 'community', resourceId: c.id, workspaceId: c.workspaceId, communityId: c.id, metadata: { planKey, fromPlanKey: currentKey, action: q.action, cycle: p.cycle, carryDays: q.carryDays, periodEnd: end.toISOString() } });
  return { planKey, endsAt: end, action: q.action, carryDays: q.carryDays };
}

/** Cron hằng ngày: nhắc gia hạn trước 7/3/1 ngày; tới hạn thì đánh dấu hết hạn (hội tự về gói Miễn phí) và báo chủ hội một lần. */
export async function runPlatformBillingCron(ctx: Ctx): Promise<{ reminded: number; expired: number }> {
  const now = ctx.now();
  const subs = await ctx.db.query.platformSubscriptions.findMany({ where: eq(platformSubscriptions.status, 'active') });
  if (!subs.length) return { reminded: 0, expired: 0 };
  const table = await planTable(ctx);
  let reminded = 0, expired = 0;
  for (const sub of subs) {
    const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, sub.communityId), columns: { id: true, name: true, slug: true, workspaceId: true, deletedAt: true } });
    if (!c || c.deletedAt) continue;
    const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, c.workspaceId), columns: { ownerUserId: true } });
    const owner = ws ? await ctx.db.query.users.findFirst({ where: eq(users.id, ws.ownerUserId), columns: { email: true, name: true } }) : null;
    const planName = table.find((t) => t.key === sub.planKey)?.name ?? 'trả phí';
    const url = `${ctx.env.APP_URL}/admin/goi?hoi=${c.slug}`;
    const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000);
    if (sub.currentPeriodEnd.getTime() <= now.getTime()) {
      await ctx.db.update(platformSubscriptions).set({ status: 'expired', updatedAt: now }).where(eq(platformSubscriptions.id, sub.id));
      if (owner) await ctx.email.send(templates.planReminder(owner.email, owner.name, c.name, planName, 0, url));
      await ctx.events.emit('platform.plan_expired', { workspaceId: c.workspaceId, communityId: c.id, planKey: sub.planKey });
      expired++;
      continue;
    }
    for (const d of BUSINESS.planReminderDays) {
      const key = `d${d}`;
      const lower = BUSINESS.planReminderDays.find((x) => x < d) ?? 0;
      if (daysLeft <= d && daysLeft > lower && !sub.remindersSent.includes(key)) {
        if (owner) await ctx.email.send(templates.planReminder(owner.email, owner.name, c.name, planName, daysLeft, url));
        await ctx.db.update(platformSubscriptions).set({ remindersSent: [...sub.remindersSent, key] }).where(eq(platformSubscriptions.id, sub.id));
        reminded++;
        break;
      }
    }
  }
  return { reminded, expired };
}

/**
 * Super admin lưu bảng gói: giá mỗi tháng, trần thành viên, tính năng của từng gói. Giá 3 tháng và 1 năm tự tính
 * (3 lần và 10 lần giá tháng). Tên gói, số gói và hai chu kỳ là luật cố định, không sửa ở đây.
 */
export async function savePlans(ctx: Ctx, input: SavePlansInput): Promise<PlanDef[]> {
  requireSuperAdmin(ctx);
  const current = await planTable(ctx);
  const next = current.map((p) => {
    const patch = input.plans.find((x) => x.key === p.key);
    return patch ? { ...p, monthlyMinor: patch.monthlyMinor, memberCap: patch.memberCap, features: [...patch.features] } : p;
  });
  for (const p of next) {
    if (p.key === 'free') {
      if (p.monthlyMinor !== 0) throw invalid('Gói Miễn phí luôn có giá 0đ');
      if (p.memberCap === null) throw invalid('Gói Miễn phí cần có trần thành viên');
    } else if (!Number.isInteger(p.monthlyMinor) || p.monthlyMinor <= 0) throw invalid(`Giá mỗi tháng của gói ${p.name} phải là số nguyên lớn hơn 0`);
    if (p.memberCap !== null && (!Number.isInteger(p.memberCap) || p.memberCap < 1)) throw invalid(`Trần thành viên của gói ${p.name} phải từ 1 trở lên, hoặc để trống nếu không giới hạn`);
  }
  // Gói cao hơn không được rẻ hơn hay chứa ít người hơn gói thấp hơn, nếu không "nâng gói" mất nghĩa.
  for (let i = 1; i < next.length; i++) {
    const lo = next[i - 1]!, hi = next[i]!;
    if (hi.monthlyMinor < lo.monthlyMinor) throw invalid(`Gói ${hi.name} không được rẻ hơn gói ${lo.name}`);
    if (lo.memberCap === null ? hi.memberCap !== null : hi.memberCap !== null && hi.memberCap < lo.memberCap) throw invalid(`Trần thành viên của gói ${hi.name} không được thấp hơn gói ${lo.name}`);
  }
  for (const p of next) {
    const def = PLAN_DEFAULTS.find((d) => d.key === p.key)!;
    const values = { name: def.name, monthlyMinor: p.monthlyMinor, yearlyMinor: p.monthlyMinor * PLAN_CYCLE.yearly.priceMonths, trialDays: 0, quotas: { members: p.memberCap }, features: p.features, paymentMode: 'gateway' as const, isActive: true, sortOrder: planRank(p.key), updatedAt: ctx.now() };
    await ctx.db.insert(plans).values({ key: p.key, ...values }).onConflictDoUpdate({ target: plans.key, set: values });
  }
  await audit(ctx, { action: 'plan.save', resourceType: 'plan', resourceId: 'all', metadata: { plans: next.map((p) => ({ key: p.key, monthlyMinor: p.monthlyMinor, memberCap: p.memberCap, features: p.features })) } });
  return planTable(ctx);
}

/** Số liệu gói cho màn quản trị: bảng bốn gói kèm số hội đang dùng từng gói và doanh thu quy ra tháng. */
export async function planStats(ctx: Ctx) {
  requireSuperAdmin(ctx);
  const table = await planTable(ctx);
  const rows = await raw<{ plan_key: string; billing_cycle: PlanCycle; n: number }>(ctx.db, sql`
    select s.plan_key, s.billing_cycle, count(*)::int as n
    from platform_subscriptions s join communities c on c.id = s.community_id
    where s.status = 'active' and s.current_period_end > ${ctx.now().toISOString()}::timestamptz and c.deleted_at is null
    group by s.plan_key, s.billing_cycle`);
  const [total] = await raw<{ n: number }>(ctx.db, sql`select count(*)::int as n from communities where deleted_at is null`);
  const count = (key: PlanKey, cycle: PlanCycle) => Number(rows.find((r) => r.plan_key === key && r.billing_cycle === cycle)?.n ?? 0);
  const paidKeys = PLAN_KEYS.filter((k) => k !== 'free');
  const paidTotal = paidKeys.reduce((n, k) => n + count(k, 'quarterly') + count(k, 'yearly'), 0);
  const plansOut = table.map((p) => {
    const quarterly = p.key === 'free' ? 0 : count(p.key, 'quarterly');
    const yearly = p.key === 'free' ? 0 : count(p.key, 'yearly');
    return {
      ...p,
      communities: p.key === 'free' ? Math.max(Number(total?.n ?? 0) - paidTotal, 0) : quarterly + yearly,
      quarterlyCount: quarterly,
      yearlyCount: yearly,
      mrrMinor: quarterly * planPerMonth(p.monthlyMinor, 'quarterly') + yearly * planPerMonth(p.monthlyMinor, 'yearly'),
    };
  });
  return { plans: plansOut, paidCommunities: paidTotal, totalCommunities: Number(total?.n ?? 0), mrrMinor: plansOut.reduce((n, p) => n + p.mrrMinor, 0) };
}
