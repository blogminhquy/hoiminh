// Doanh thu chủ hội (không phí giao dịch, cột Nợ cộng sự), Cài đặt · Tổng quan, Cài đặt · Thanh toán (nhận tiền).
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { communities, communityMembers, onboardingProgress, orders, payments, posts, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { requireCommunityPermission } from '../permissions';

function since(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/** Màn Doanh thu: 4 ô số + bảng giao dịch có cột hoa hồng cộng sự (chủ hội tự chuyển). */
export async function revenue(ctx: Ctx, communityId: string, q: { days?: number; limit?: number }) {
  await requireCommunityPermission(ctx, communityId, 'revenue.read');
  const from = since(q.days ?? 30, ctx.now());
  const r = await raw(ctx.db, sql`
    select
      (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status in ('paid','refunded') and paid_at >= ${from}) as gross,
      (select count(*)::int from orders where community_id = ${communityId} and status in ('paid','refunded') and paid_at >= ${from}) as tx_count,
      (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status = 'paid' and paid_at >= ${from}) as net,
      (select coalesce(sum(r.amount_minor),0)::bigint from refunds r join orders o on o.id = r.order_id where o.community_id = ${communityId} and r.created_at >= ${from}) as refunded,
      (select count(*)::int from refunds r join orders o on o.id = r.order_id where o.community_id = ${communityId} and r.created_at >= ${from}) as refund_count,
      (select coalesce(sum(c.amount_minor),0)::bigint from affiliate_commissions c join affiliate_programs p on p.id = c.program_id where p.community_id = ${communityId} and c.status in ('pending','available')) as owed,
      (select count(*)::int from orders where community_id = ${communityId} and status = 'paid' and affiliate_account_id is not null and paid_at >= ${from}) as referred_count`);
  const s = r[0] as Record<string, string | number>;
  const rows = await ctx.db.select({ o: orders, p: payments, u: { name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor }, commission: sql<string>`coalesce((select sum(amount_minor) from affiliate_commissions c where c.order_id = ${orders.id} and c.status <> 'reversed'),0)`, reversed: sql<string>`coalesce((select sum(amount_minor) from affiliate_commissions c where c.order_id = ${orders.id} and c.status = 'reversed'),0)` }).from(orders).leftJoin(payments, eq(payments.orderId, orders.id)).innerJoin(users, eq(users.id, orders.customerUserId)).where(and(eq(orders.communityId, communityId), gte(orders.createdAt, from))).orderBy(desc(orders.createdAt)).limit(q.limit ?? 50);
  return {
    stats: { grossMinor: Number(s.gross), txCount: Number(s.tx_count), netMinor: Number(s.net), refundedMinor: Number(s.refunded), refundCount: Number(s.refund_count), owedToAffiliatesMinor: Number(s.owed), referredCount: Number(s.referred_count) },
    items: rows.map((r) => ({ orderId: r.o.id, at: r.o.paidAt ?? r.o.createdAt, customer: r.u, title: (r.o.metadata as { title?: string }).title ?? r.o.targetType, method: r.p?.paymentMethod ?? '', provider: r.p?.provider ?? '', amountMinor: r.o.totalMinor, commissionMinor: Number(r.commission), reversedCommissionMinor: Number(r.reversed), status: r.o.status })),
  };
}

/** Cài đặt · Tổng quan: số liệu kỳ, doanh thu theo ngày, checklist hoàn thiện, hoạt động gần đây. */
export async function settingsOverview(ctx: Ctx, communityId: string, q: { days?: number }) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  const days = q.days ?? 30;
  const now = ctx.now();
  const from = since(days, now);
  const prevFrom = since(days * 2, now);
  const r = await raw(ctx.db, sql`
    select
      (select count(*)::int from community_members where community_id = ${communityId} and joined_at >= ${from} and status = 'active') as new_members,
      (select count(*)::int from community_members where community_id = ${communityId} and joined_at >= ${prevFrom} and joined_at < ${from}) as new_members_prev,
      (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status = 'paid' and paid_at >= ${from}) as revenue,
      (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status = 'paid' and paid_at >= ${prevFrom} and paid_at < ${from}) as revenue_prev,
      (select count(*)::int from community_members m join community_tiers t on t.id = m.tier_id where m.community_id = ${communityId} and m.status in ('active','cancelling') and t.key <> 'standard') as paying,
      (select count(*)::int from community_members m join community_tiers t on t.id = m.tier_id where m.community_id = ${communityId} and m.status in ('active','cancelling') and t.key = 'premium') as premium,
      (select count(*)::int from community_members m join community_tiers t on t.id = m.tier_id where m.community_id = ${communityId} and m.status in ('active','cancelling') and t.key = 'vip') as vip,
      (select count(*)::int from community_members where community_id = ${communityId} and (churned_at >= ${from} or (status = 'cancelling'))) as churned,
      (select count(*)::int from posts where community_id = ${communityId} and created_at >= ${from} and deleted_at is null) as posts_count`);
  const s = r[0] as Record<string, string | number>;
  const daily = await raw(ctx.db, sql`select to_char(paid_at, 'YYYY-MM-DD') as d, sum(total_minor)::bigint as v from orders where community_id = ${communityId} and status = 'paid' and paid_at >= ${from} group by 1 order by 1`);
  const community = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId) });
  const done = await ctx.db.query.onboardingProgress.findMany({ where: eq(onboardingProgress.communityId, communityId) });
  const doneKeys = new Set(done.map((d) => d.stepKey));
  const [postsAny] = await ctx.db.select({ c: sql<number>`count(*)::int` }).from(posts).where(eq(posts.communityId, communityId));
  const welcome = await raw(ctx.db, sql`select enabled from community_plugins where community_id = ${communityId} and plugin_key = 'welcome_dm'`);
  const courseCount = Number(((await raw(ctx.db, sql`select count(*)::int as c from courses where community_id = ${communityId} and deleted_at is null`))[0] as { c: number }).c);
  const checklist = [
    { key: 'logo', label: 'Thêm logo và mô tả', done: doneKeys.has('logo') || Boolean(community?.logoUrl) || (community?.shortDescription?.length ?? 0) > 0 },
    { key: 'first_post', label: 'Tạo bài viết đầu tiên', done: doneKeys.has('first_post') || (postsAny?.c ?? 0) > 0 },
    { key: 'first_course', label: 'Tạo khóa học đầu tiên', done: doneKeys.has('first_course') || courseCount > 0 },
    { key: 'payout_connected', label: 'Kết nối nhận tiền', done: doneKeys.has('payout_connected') },
    { key: 'invite_5', label: 'Mời 5 thành viên', done: (community?.memberCount ?? 0) >= 6 },
    { key: 'welcome_dm', label: 'Bật tin nhắn chào tự động', done: Boolean((welcome[0] as { enabled: boolean } | undefined)?.enabled) },
  ];
  const activity = await raw(ctx.db, sql`
    (select 'payment' as kind, u.name as actor, u.id as actor_id, o.metadata->>'title' as what, o.paid_at as at from orders o join users u on u.id = o.customer_user_id where o.community_id = ${communityId} and o.status = 'paid' order by o.paid_at desc limit 3)
    union all (select 'post', u.name, u.id, p.title, p.created_at from posts p join users u on u.id = p.author_user_id where p.community_id = ${communityId} and p.deleted_at is null order by p.created_at desc limit 3)
    union all (select 'join', u.name, u.id, null, m.joined_at from community_members m join users u on u.id = m.user_id where m.community_id = ${communityId} order by m.joined_at desc limit 3)
    order by at desc limit 6`);
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
  return {
    stats: { newMembers: Number(s.new_members), newMembersDeltaPct: pct(Number(s.new_members), Number(s.new_members_prev)), revenueMinor: Number(s.revenue), revenueDeltaPct: pct(Number(s.revenue), Number(s.revenue_prev)), paying: Number(s.paying), premium: Number(s.premium), vip: Number(s.vip), churned: Number(s.churned), churnRatePct: community?.memberCount ? Math.round((Number(s.churned) / community.memberCount) * 1000) / 10 : 0, posts: Number(s.posts_count) },
    daily: (daily as Array<{ d: string; v: string }>).map((x) => ({ date: x.d, amountMinor: Number(x.v) })),
    checklist, activity: activity,
  };
}

/** Cài đặt · Thanh toán: số dư (tổng đã vào, đang giữ 14 ngày với chuyển khoản), lịch sử rút của chủ hội (tiền vào tài khoản Hội Mình rồi chủ hội rút). */
export async function payoutSettings(ctx: Ctx, communityId: string) {
  const access = await requireCommunityPermission(ctx, communityId, 'billing.manage');
  const c = await ctx.db.query.communities.findFirst({ where: eq(communities.id, communityId) });
  const r = await raw(ctx.db, sql`
    select (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status = 'paid' and paid_at < now() - interval '14 days') as available,
           (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status = 'paid' and paid_at >= now() - interval '14 days') as holding,
           (select coalesce(sum(a.amount_minor),0)::bigint from affiliate_withdrawal_requests a join affiliate_programs p on p.id = a.program_id where p.community_id = ${communityId} and a.status in ('requested','reviewing')) as affiliate_pending,
           (select count(*)::int from affiliate_withdrawal_requests a join affiliate_programs p on p.id = a.program_id where p.community_id = ${communityId} and a.status in ('requested','reviewing')) as affiliate_pending_count`);
  const s = r[0] as Record<string, string | number>;
  const ownerRow = await raw(ctx.db, sql`select owner_user_id from workspaces where id = ${access.workspaceId}`);
  const ownerId = (ownerRow[0] as { owner_user_id: string }).owner_user_id;
  const owner = await ctx.db.query.users.findFirst({ where: eq(users.id, ownerId) });
  const providers = (['sepay', 'momo', 'vnpay', 'paypal'] as const).map((p) => ({ provider: p, enabled: c?.enabledProviders.includes(p) ?? false, platformEnabled: true }));
  return { availableMinor: Number(s.available), holdingMinor: Number(s.holding), withdrawnThisMonthMinor: 0, affiliatePendingMinor: Number(s.affiliate_pending), affiliatePendingCount: Number(s.affiliate_pending_count), providers, ownerName: owner?.name ?? '', enabledProviders: c?.enabledProviders ?? [] };
}

/** Bật/tắt cách khách thanh toán cho hội. */
export async function updateEnabledProviders(ctx: Ctx, communityId: string, enabledProviders: string[]) {
  await requireCommunityPermission(ctx, communityId, 'billing.manage');
  await ctx.db.update(communities).set({ enabledProviders, updatedAt: ctx.now() }).where(eq(communities.id, communityId));
  return enabledProviders;
}

export { communityMembers };
