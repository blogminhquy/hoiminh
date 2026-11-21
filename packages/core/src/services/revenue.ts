// Doanh thu chủ hội (không phí giao dịch, cột Nợ affiliate), danh sách đơn hàng của hội, Cài đặt · Tổng quan, Cài đặt · Thanh toán (nhận tiền).
import { ORDER_VIEW_STATUSES, type DateRangeQuery, type OrderViewStatus, type OrdersQuery, type RevenueQuery } from '@hoiminh/contracts';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { communities, communityMembers, onboardingProgress, orders, payments, posts, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { inSpan, resolvePeriod } from '../lib/period';
import { forbidden, invalid, notFound } from '../errors';
import { requireCommunityPermission, resolveCommunityAccess } from '../permissions';
import { OWNER_CONFIRM_DAYS, paymentsReady, payoutSetup } from './owner-payout';

/**
 * Màn Doanh thu: 4 ô số + bảng giao dịch có cột hoa hồng affiliate (chủ hội tự chuyển).
 * Kỳ là khoảng ngày lịch theo giờ Việt Nam, tính cả hai đầu (`from`, `to`); chỉ có `to` là từ trước đến nay;
 * `days` cũ là N ngày gần nhất tính cả hôm nay. "Nợ affiliate" là số đang nợ lúc này, không theo kỳ.
 */
export async function revenue(ctx: Ctx, communityId: string, q: RevenueQuery = {}) {
  await requireCommunityPermission(ctx, communityId, 'revenue.read');
  const period = resolvePeriod(q, ctx.now());
  const paid = inSpan(sql`paid_at`, period);
  const refundedAt = inSpan(sql`r.created_at`, period);
  const r = await raw(ctx.db, sql`
    select
      (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status in ('paid','refunded') and ${paid}) as gross,
      (select count(*)::int from orders where community_id = ${communityId} and status in ('paid','refunded') and ${paid}) as tx_count,
      (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status = 'paid' and ${paid}) as net,
      (select coalesce(sum(r.amount_minor),0)::bigint from refunds r join orders o on o.id = r.order_id where o.community_id = ${communityId} and ${refundedAt}) as refunded,
      (select count(*)::int from refunds r join orders o on o.id = r.order_id where o.community_id = ${communityId} and ${refundedAt}) as refund_count,
      (select coalesce(sum(c.amount_minor),0)::bigint from affiliate_commissions c join affiliate_programs p on p.id = c.program_id where p.community_id = ${communityId} and c.status in ('pending','available')) as owed,
      (select count(*)::int from orders where community_id = ${communityId} and status = 'paid' and affiliate_account_id is not null and ${paid}) as referred_count,
      (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status = 'paid' and affiliate_account_id is not null and ${paid}) as referred`);
  const s = r[0] as Record<string, string | number>;
  // Số đơn theo trạng thái: tính trên các đơn được đặt trong kỳ (tiền ở trên thì tính theo ngày trả).
  const byStatus = await raw<{ view_status: OrderViewStatus; n: number }>(ctx.db, sql`select v.view_status, count(*)::int as n from (${ordersView(communityId, ctx.now())}) v where ${inSpan(sql`v.created_at`, period)} group by 1`);
  const ordersByStatus = Object.fromEntries(ORDER_VIEW_STATUSES.map((k) => [k, byStatus.find((b) => b.view_status === k)?.n ?? 0])) as Record<OrderViewStatus, number>;
  // Bảng giao dịch lọc và xếp theo đúng ngày đang hiện ở cột Ngày: ngày trả tiền, đơn chưa trả thì ngày tạo.
  const at = sql`coalesce(${orders.paidAt}, ${orders.createdAt})`;
  const rows = await ctx.db.select({ o: orders, p: payments, u: { name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor }, commission: sql<string>`coalesce((select sum(amount_minor) from affiliate_commissions c where c.order_id = ${orders.id} and c.status <> 'reversed'),0)`, reversed: sql<string>`coalesce((select sum(amount_minor) from affiliate_commissions c where c.order_id = ${orders.id} and c.status = 'reversed'),0)` }).from(orders).leftJoin(payments, eq(payments.orderId, orders.id)).innerJoin(users, eq(users.id, orders.customerUserId)).where(and(eq(orders.communityId, communityId), inSpan(at, period))).orderBy(desc(at)).limit(q.limit ?? 50);
  return {
    range: { from: period.from, to: period.to },
    stats: { grossMinor: Number(s.gross), txCount: Number(s.tx_count), netMinor: Number(s.net), refundedMinor: Number(s.refunded), refundCount: Number(s.refund_count), owedToAffiliatesMinor: Number(s.owed), referredCount: Number(s.referred_count), referredMinor: Number(s.referred) },
    /** Số đơn đặt trong kỳ theo từng trạng thái hiển thị. */
    ordersByStatus,
    items: rows.map((r) => ({ orderId: r.o.id, at: r.o.paidAt ?? r.o.createdAt, customer: r.u, title: (r.o.metadata as { title?: string }).title ?? r.o.targetType, method: r.p?.paymentMethod ?? '', provider: r.p?.provider ?? '', amountMinor: r.o.totalMinor, commissionMinor: Number(r.commission), reversedCommissionMinor: Number(r.reversed), status: r.o.status })),
  };
}

/**
 * Mọi đơn của một hội kèm người mua, thanh toán mới nhất và trạng thái hiển thị (`view_status`). Là nguồn chung của
 * danh sách đơn hàng và của số đơn theo trạng thái, để hai nơi không bao giờ đếm lệch nhau.
 * "Chờ xác nhận" dùng đúng điều kiện của khối "Đơn chờ bạn xác nhận" (owner-payout.pendingRows): đơn chuyển khoản vào
 * tài khoản chủ hội, chưa trả, tạo trong OWNER_CONFIRM_DAYS ngày, kể cả khi đã quá hạn giữ chỗ (chủ hội vẫn bấm
 * "Đã nhận tiền" được). Đơn chờ thanh toán đã quá hạn giữ chỗ thì coi là hết hạn ngay, không chờ bộ quét.
 */
function ordersView(communityId: string, now: Date): SQL {
  const confirmSince = new Date(now.getTime() - OWNER_CONFIRM_DAYS * 86_400_000);
  return sql`
    select o.id, o.reference, o.created_at, o.paid_at, o.total_minor, o.target_type, o.affiliate_account_id,
      coalesce(o.metadata->>'title', o.target_type) as title,
      coalesce(p.provider, '') as provider, coalesce(p.payment_method, '') as method, coalesce(p.status = 'processing', false) as buyer_says_paid,
      case
        when o.status in ('paid', 'refunded', 'cancelled') then o.status
        when p.provider = 'sepay' and p.instruction->>'payee' = 'owner' and p.status in ('pending', 'processing', 'expired') and o.created_at >= ${confirmSince} then 'awaiting_confirmation'
        when o.status = 'expired' or (o.expires_at is not null and o.expires_at < ${now}) then 'expired'
        else 'awaiting_payment'
      end as view_status,
      u.name as buyer_name, u.handle as buyer_handle, u.avatar_url as buyer_avatar, u.cover_color as buyer_color
    from orders o
    join users u on u.id = o.customer_user_id
    left join lateral (select provider, payment_method, status, instruction from payments where order_id = o.id order by created_at desc limit 1) p on true
    where o.community_id = ${communityId}`;
}

interface OrderRow {
  id: string; reference: string; created_at: Date; paid_at: Date | null; total_minor: string | number; target_type: string; affiliate_account_id: string | null; title: string; provider: string; method: string;
  buyer_says_paid: boolean; view_status: OrderViewStatus; buyer_name: string; buyer_handle: string; buyer_avatar: string | null; buyer_color: string | null;
  created_key: string; affiliate_name: string | null; commission: string | number; reversed: string | number;
}

// Con trỏ trang kế: thời điểm đặt đơn giữ đủ phần triệu giây của database (Date của JavaScript chỉ tới phần nghìn giây,
// hai đơn tạo sát nhau sẽ bị lặp hoặc sót) kèm id của đơn cuối trang.
const CURSOR_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const CURSOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encodeOrderCursor = (row: OrderRow) => btoa(`${row.created_key}|${row.id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function decodeOrderCursor(cursor: string): { at: string; id: string } {
  try {
    const [at, id] = atob(cursor.replace(/-/g, '+').replace(/_/g, '/')).split('|');
    if (at && id && CURSOR_AT.test(at) && CURSOR_ID.test(id)) return { at, id };
  } catch { /* chuỗi không phải base64: báo lỗi chung bên dưới */ }
  throw invalid('Con trỏ trang không hợp lệ, hãy tải lại danh sách từ đầu');
}

/**
 * Quản lý đơn hàng: mọi đơn của hội, mới đặt nhất trước, lọc theo khoảng ngày đặt (giờ Việt Nam, tính cả hai đầu; chỉ
 * có `to` là từ trước đến nay), trạng thái, có người giới thiệu hay không, và ô tìm theo tên người mua, sản phẩm
 * hoặc mã đơn. Trả từng trang kèm con trỏ trang kế, và tổng số đơn, tổng tiền của cả kết quả đang lọc.
 * Dùng chung quyền `revenue.read` với màn Doanh thu: chủ hội và quản trị của hội; thành viên thường bị từ chối.
 */
export async function listOrders(ctx: Ctx, communityId: string, q: OrdersQuery) {
  await requireCommunityPermission(ctx, communityId, 'revenue.read');
  const now = ctx.now();
  const period = resolvePeriod(q, now);
  const conds: SQL[] = [inSpan(sql`v.created_at`, period)];
  if (q.status) conds.push(sql`v.view_status = ${q.status}`);
  if (q.affiliate === 'with') conds.push(sql`v.affiliate_account_id is not null`);
  if (q.affiliate === 'without') conds.push(sql`v.affiliate_account_id is null`);
  if (q.q) {
    const like = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`;
    conds.push(sql`(v.buyer_name ilike ${like} or v.title ilike ${like} or v.reference ilike ${like})`);
  }
  const where = sql.join(conds, sql` and `);
  const view = ordersView(communityId, now);
  const [sum] = await raw<{ total: number; total_minor: string }>(ctx.db, sql`select count(*)::int as total, coalesce(sum(v.total_minor),0)::bigint as total_minor from (${view}) v where ${where}`);
  const cursor = q.cursor ? decodeOrderCursor(q.cursor) : null;
  const after = cursor ? sql`and (v.created_at, v.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : sql``;
  const rows = await raw<OrderRow>(ctx.db, sql`
    select v.*, to_char(v.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_key,
      (select u2.name from affiliate_accounts a join users u2 on u2.id = a.user_id where a.id = v.affiliate_account_id) as affiliate_name,
      coalesce((select sum(c.amount_minor) from affiliate_commissions c where c.order_id = v.id and c.status <> 'reversed'),0)::bigint as commission,
      coalesce((select sum(c.amount_minor) from affiliate_commissions c where c.order_id = v.id and c.status = 'reversed'),0)::bigint as reversed
    from (${view}) v
    where ${where} ${after}
    order by v.created_at desc, v.id desc
    limit ${q.limit + 1}`);
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  return {
    range: { from: period.from, to: period.to },
    /** Tổng số đơn và tổng giá trị đơn của cả kết quả đang lọc, không chỉ trang này. */
    total: Number(sum?.total ?? 0),
    totalMinor: Number(sum?.total_minor ?? 0),
    items: page.map((r) => ({
      orderId: r.id, reference: r.reference, createdAt: r.created_at, paidAt: r.paid_at,
      customer: { name: r.buyer_name, handle: r.buyer_handle, avatarUrl: r.buyer_avatar, coverColor: r.buyer_color },
      title: r.title, targetType: r.target_type, method: r.method, provider: r.provider, amountMinor: Number(r.total_minor),
      status: r.view_status,
      /** Người mua đã bấm "Tôi đã chuyển khoản". */
      buyerSaysPaid: r.buyer_says_paid,
      /** Đơn đang chờ chủ hội bấm "Đã nhận tiền" (cần quyền billing.manage để bấm). */
      canConfirm: r.view_status === 'awaiting_confirmation',
      /** Đơn có người giới thiệu (cột `orders.affiliate_account_id`), tên người đó và hoa hồng chủ hội phải trả cho đơn này. */
      hasAffiliate: r.affiliate_account_id !== null, affiliateName: r.affiliate_name, commissionMinor: Number(r.commission), reversedCommissionMinor: Number(r.reversed),
    })),
    nextCursor: rows.length > q.limit && last ? encodeOrderCursor(last) : null,
  };
}

/**
 * Một đơn của hội, cho người quản lý tiền của hội xem (API key và MCP). `checkout.orderStatus` chỉ trả đơn của chính
 * người mua, nên chủ hội không tra được đơn của khách bằng đường đó.
 */
export async function communityOrder(ctx: Ctx, communityId: string, orderId: string) {
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has('revenue.read') && !access.permissions.has('billing.manage')) throw forbidden();
  const [row] = await ctx.db.select({ o: orders, buyer: { id: users.id, name: users.name, email: users.email, handle: users.handle } }).from(orders).innerJoin(users, eq(users.id, orders.customerUserId)).where(and(eq(orders.id, orderId), eq(orders.communityId, communityId)));
  if (!row) throw notFound('Đơn không tồn tại');
  const p = await ctx.db.query.payments.findFirst({ where: eq(payments.orderId, orderId), orderBy: desc(payments.createdAt) });
  const o = row.o;
  const expired = o.status === 'pending' && o.expiresAt !== null && o.expiresAt.getTime() < ctx.now().getTime();
  return {
    orderId: o.id, reference: o.reference, title: (o.metadata as { title?: string }).title ?? o.targetType, targetType: o.targetType, status: expired ? 'expired' : o.status,
    amountMinor: o.totalMinor, currency: o.currency, createdAt: o.createdAt, paidAt: o.paidAt, buyer: row.buyer,
    payment: p ? { provider: p.provider, method: p.paymentMethod, status: p.status, refundedMinor: p.refundedMinor } : null,
  };
}

/**
 * Cài đặt · Tổng quan: số liệu kỳ, doanh thu theo ngày, checklist hoàn thiện, hoạt động gần đây.
 * Kỳ tính như màn Doanh thu. Phần trăm tăng giảm so với kỳ liền trước có cùng số ngày; lấy từ trước đến nay thì
 * không có kỳ trước nên hai số tăng giảm là null.
 */
export async function settingsOverview(ctx: Ctx, communityId: string, q: DateRangeQuery = {}) {
  await requireCommunityPermission(ctx, communityId, 'settings.manage');
  const period = resolvePeriod(q, ctx.now());
  const prev = period.prev;
  const r = await raw(ctx.db, sql`
    select
      (select count(*)::int from community_members where community_id = ${communityId} and ${inSpan(sql`joined_at`, period)} and status = 'active') as new_members,
      ${prev ? sql`(select count(*)::int from community_members where community_id = ${communityId} and ${inSpan(sql`joined_at`, prev)})` : sql`0`} as new_members_prev,
      (select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status = 'paid' and ${inSpan(sql`paid_at`, period)}) as revenue,
      ${prev ? sql`(select coalesce(sum(total_minor),0)::bigint from orders where community_id = ${communityId} and status = 'paid' and ${inSpan(sql`paid_at`, prev)})` : sql`0`} as revenue_prev,
      (select count(*)::int from community_members m join community_tiers t on t.id = m.tier_id where m.community_id = ${communityId} and m.status in ('active','cancelling') and t.key <> 'standard') as paying,
      (select count(*)::int from community_members m join community_tiers t on t.id = m.tier_id where m.community_id = ${communityId} and m.status in ('active','cancelling') and t.key = 'premium') as premium,
      (select count(*)::int from community_members m join community_tiers t on t.id = m.tier_id where m.community_id = ${communityId} and m.status in ('active','cancelling') and t.key = 'vip') as vip,
      (select count(*)::int from community_members where community_id = ${communityId} and ((${inSpan(sql`churned_at`, period)}) or (status = 'cancelling'))) as churned,
      (select count(*)::int from posts where community_id = ${communityId} and ${inSpan(sql`created_at`, period)} and deleted_at is null) as posts_count`);
  const s = r[0] as Record<string, string | number>;
  // Gom theo ngày lịch giờ Việt Nam, khớp với ranh giới của kỳ (đơn trả lúc 00:30 sáng giờ Việt Nam thuộc ngày mới).
  const daily = await raw(ctx.db, sql`select to_char(paid_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as d, sum(total_minor)::bigint as v from orders where community_id = ${communityId} and status = 'paid' and ${inSpan(sql`paid_at`, period)} group by 1 order by 1`);
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
    { key: 'payout_connected', label: 'Cài tài khoản nhận tiền', done: await paymentsReady(ctx, communityId) },
    { key: 'invite_5', label: 'Mời 5 thành viên', done: (community?.memberCount ?? 0) >= 6 },
    { key: 'welcome_dm', label: 'Bật tin nhắn chào tự động', done: Boolean((welcome[0] as { enabled: boolean } | undefined)?.enabled) },
  ];
  const activity = await raw(ctx.db, sql`
    (select 'payment' as kind, u.name as actor, u.id as actor_id, o.metadata->>'title' as what, o.paid_at as at from orders o join users u on u.id = o.customer_user_id where o.community_id = ${communityId} and o.status = 'paid' order by o.paid_at desc limit 3)
    union all (select 'post', u.name, u.id, p.title, p.created_at from posts p join users u on u.id = p.author_user_id where p.community_id = ${communityId} and p.deleted_at is null order by p.created_at desc limit 3)
    union all (select 'join', u.name, u.id, null, m.joined_at from community_members m join users u on u.id = m.user_id where m.community_id = ${communityId} order by m.joined_at desc limit 3)
    order by at desc limit 6`);
  const pct = (a: number, b: number) => (prev && b ? Math.round(((a - b) / b) * 100) : null);
  return {
    range: { from: period.from, to: period.to, days: period.days },
    stats: { newMembers: Number(s.new_members), newMembersDeltaPct: pct(Number(s.new_members), Number(s.new_members_prev)), revenueMinor: Number(s.revenue), revenueDeltaPct: pct(Number(s.revenue), Number(s.revenue_prev)), paying: Number(s.paying), premium: Number(s.premium), vip: Number(s.vip), churned: Number(s.churned), churnRatePct: community?.memberCount ? Math.round((Number(s.churned) / community.memberCount) * 1000) / 10 : 0, posts: Number(s.posts_count) },
    daily: (daily as Array<{ d: string; v: string }>).map((x) => ({ date: x.d, amountMinor: Number(x.v) })),
    checklist, activity: activity,
  };
}

/**
 * Trang Tiền và Bàn điều khiển của chủ hội: hội đã cài nhận tiền chưa, đã thu bao nhiêu trong 30 ngày, còn bao nhiêu
 * đơn chờ chủ hội xác nhận, và yêu cầu rút của affiliate. Tiền bán hàng về thẳng tài khoản của chủ hội nên không còn
 * "có thể rút" hay "đang giữ 14 ngày".
 */
export async function payoutSettings(ctx: Ctx, communityId: string) {
  const access = await requireCommunityPermission(ctx, communityId, 'billing.manage');
  const setup = await payoutSetup(ctx, communityId);
  const r = await raw(ctx.db, sql`
    select (select coalesce(sum(a.amount_minor),0)::bigint from affiliate_withdrawal_requests a join affiliate_programs p on p.id = a.program_id where p.community_id = ${communityId} and a.status in ('requested','reviewing')) as affiliate_pending,
           (select count(*)::int from affiliate_withdrawal_requests a join affiliate_programs p on p.id = a.program_id where p.community_id = ${communityId} and a.status in ('requested','reviewing')) as affiliate_pending_count`);
  const s = r[0] as Record<string, string | number>;
  const ownerRow = await raw(ctx.db, sql`select owner_user_id from workspaces where id = ${access.workspaceId}`);
  const ownerId = (ownerRow[0] as { owner_user_id: string }).owner_user_id;
  const owner = await ctx.db.query.users.findFirst({ where: eq(users.id, ownerId) });
  return {
    ready: setup.ready,
    /** Chỉ khi chuyển khoản QR đang bật: người mua chuyển thẳng tới tài khoản này. */
    account: setup.account?.enabled ? { bankName: setup.account.bankName, accountNumber: setup.account.accountNumber, accountHolder: setup.account.accountHolder, confirmMode: setup.account.confirmMode } : null,
    /** Các cách người mua đang thấy. */
    methods: setup.methods,
    received30Minor: setup.received30Minor,
    pendingCount: setup.pending.length,
    pendingMinor: setup.pending.reduce((n, p) => n + p.amountMinor, 0),
    affiliatePendingMinor: Number(s.affiliate_pending),
    affiliatePendingCount: Number(s.affiliate_pending_count),
    ownerName: owner?.name ?? '',
  };
}

/** Bật/tắt cách khách thanh toán cho hội. */
export async function updateEnabledProviders(ctx: Ctx, communityId: string, enabledProviders: string[]) {
  await requireCommunityPermission(ctx, communityId, 'billing.manage');
  await ctx.db.update(communities).set({ enabledProviders, updatedAt: ctx.now() }).where(eq(communities.id, communityId));
  return enabledProviders;
}

export { communityMembers };
