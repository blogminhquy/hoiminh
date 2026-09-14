// Affiliate Engine hai tầng: click → attribution 30 ngày → conversion → hoa hồng pending → available sau hold → ví (sổ cái bất biến).
import { BUSINESS, sha256Hex, randomCode } from '@hoiminh/config';
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { affiliateAccounts, affiliateAttributions, affiliateClicks, affiliateCommissions, affiliateConversions, affiliateLinks, affiliatePrograms, affiliateWalletEntries, communities, communityMembers, orders, payments, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { raw } from '../lib/db';
import { forbidden, notFound } from '../errors';
import { commissionOf } from '../lib/money';
import { requireCommunityPermission, requireUser, resolveCommunityAccess } from '../permissions';
import { audit } from './audit';

/** Số dư ví từ sổ cái: credit + release + adjustment − hold − debit. */
export async function walletBalance(ctx: Ctx, affiliateAccountId: string): Promise<{ available: number; credited: number; held: number; debited: number }> {
  const r = await raw(ctx.db, sql`
    select coalesce(sum(case when entry_type in ('credit','release','adjustment') then amount_minor else 0 end),0)::bigint as credited,
           coalesce(sum(case when entry_type = 'hold' then amount_minor else 0 end),0)::bigint as held,
           coalesce(sum(case when entry_type = 'debit' then amount_minor else 0 end),0)::bigint as debited
    from affiliate_wallet_entries where affiliate_account_id = ${affiliateAccountId}`);
  const row = r[0] as { credited: string; held: string; debited: string };
  const credited = Number(row.credited), held = Number(row.held), debited = Number(row.debited);
  return { available: credited - held - debited, credited, held, debited };
}

/** Ghi bút toán với idempotency_key UNIQUE; ghi trùng thì bỏ qua. */
export async function ledgerEntry(ctx: Ctx, e: { affiliateAccountId: string; entryType: 'credit' | 'hold' | 'release' | 'debit' | 'adjustment'; amountMinor: number; idempotencyKey: string; commissionId?: string | null; withdrawalId?: string | null; note?: string | null }): Promise<boolean> {
  const rows = await ctx.db.insert(affiliateWalletEntries).values({ affiliateAccountId: e.affiliateAccountId, entryType: e.entryType, amountMinor: e.amountMinor, idempotencyKey: e.idempotencyKey, commissionId: e.commissionId ?? null, withdrawalId: e.withdrawalId ?? null, note: e.note ?? null }).onConflictDoNothing().returning({ id: affiliateWalletEntries.id });
  return rows.length > 0;
}

/** Tài khoản cộng sự của user trong chương trình (tạo nếu chưa có, chương trình phải đang bật). */
export async function ensureAccount(ctx: Ctx, userId: string, programId: string) {
  const existing = await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, userId), eq(affiliateAccounts.programId, programId)) });
  if (existing) return existing;
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, programId) });
  if (!program) throw notFound('Chương trình cộng sự không tồn tại');
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId), columns: { handle: true } });
  let code = `${(user?.handle ?? 'hm').replace(/-/g, '').slice(0, 6)}${randomCode(3).toLowerCase()}`;
  for (let i = 0; i < 5; i++) {
    const taken = await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.affiliateCode, code), columns: { id: true } });
    if (!taken) break;
    code = `${code.slice(0, 6)}${randomCode(3).toLowerCase()}`;
  }
  const [acc] = await ctx.db.insert(affiliateAccounts).values({ userId, programId, affiliateCode: code, status: 'active', approvedAt: ctx.now() }).returning();
  const dest = program.scopeType === 'platform' ? `${ctx.env.APP_URL}/tao-hoi?ref=${code}` : `${ctx.env.APP_URL}/${(await ctx.db.query.communities.findFirst({ where: eq(communities.id, program.communityId!), columns: { slug: true } }))?.slug}?ref=${code}`;
  await ctx.db.insert(affiliateLinks).values({ affiliateAccountId: acc!.id, targetType: program.scopeType === 'platform' ? 'platform_signup' : 'community', targetId: program.communityId, slug: code, destinationUrl: dest });
  return acc!;
}

/** Ghi click (từ ?ref= hoặc /r/:code) và trả về id cookie attribution. */
export async function trackClick(ctx: Ctx, code: string, meta: { visitorId: string; ip?: string; userAgent?: string; landingUrl?: string; referrer?: string }) {
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.affiliateCode, code), eq(affiliateAccounts.status, 'active')) });
  if (!acc) return null;
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, acc.programId) });
  if (!program || program.status !== 'active') return null;
  const link = await ctx.db.query.affiliateLinks.findFirst({ where: eq(affiliateLinks.affiliateAccountId, acc.id) });
  const [click] = await ctx.db.insert(affiliateClicks).values({ affiliateAccountId: acc.id, linkId: link?.id ?? null, visitorId: meta.visitorId, ipHash: meta.ip ? await sha256Hex(meta.ip) : null, userAgentHash: meta.userAgent ? await sha256Hex(meta.userAgent) : null, landingUrl: meta.landingUrl ?? null, referrer: meta.referrer ?? null }).returning();
  await ctx.db.update(affiliateAccounts).set({ clickCount: sql`${affiliateAccounts.clickCount} + 1` }).where(eq(affiliateAccounts.id, acc.id));
  const expiresAt = new Date(ctx.now().getTime() + program.cookieDays * 86_400_000);
  await ctx.db.insert(affiliateAttributions).values({ affiliateAccountId: acc.id, programId: program.id, visitorId: meta.visitorId, sourceClickId: click!.id, expiresAt });
  await ctx.events.emit('affiliate.clicked', { affiliateAccountId: acc.id, visitorId: meta.visitorId });
  return { affiliateAccountId: acc.id, programId: program.id, destinationUrl: link?.destinationUrl ?? ctx.env.APP_URL, cookieDays: program.cookieDays, communityId: program.communityId };
}

/** Gắn attribution của visitor vào user vừa đăng ký (last click wins). */
export async function attachAttribution(ctx: Ctx, userId: string, visitorId: string | null, ref: string | null): Promise<void> {
  if (ref) {
    const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.affiliateCode, ref), eq(affiliateAccounts.status, 'active')) });
    if (acc && acc.userId !== userId) {
      const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, acc.programId) });
      if (program?.status === 'active') await ctx.db.insert(affiliateAttributions).values({ affiliateAccountId: acc.id, programId: program.id, visitorId, userId, expiresAt: new Date(ctx.now().getTime() + program.cookieDays * 86_400_000) });
    }
  }
  if (visitorId) await ctx.db.update(affiliateAttributions).set({ userId }).where(and(eq(affiliateAttributions.visitorId, visitorId), sql`${affiliateAttributions.userId} is null`));
  const affs = await ctx.db.query.affiliateAttributions.findMany({ where: and(eq(affiliateAttributions.userId, userId), sql`${affiliateAttributions.expiresAt} > now()`) });
  for (const a of affs) await ctx.db.update(affiliateAccounts).set({ signupCount: sql`${affiliateAccounts.signupCount} + 1` }).where(eq(affiliateAccounts.id, a.affiliateAccountId));
}

/** Sau payment.succeeded: tạo conversion + hoa hồng pending (UNIQUE payment_id + rule_version chống trùng). */
export async function createCommissionForPayment(ctx: Ctx, p: { paymentId: string; orderId: string; userId: string; communityId: string | null; workspaceId: string | null; amountMinor: number; targetType: 'tier' | 'product' | 'platform'; affiliateAccountId: string | null }): Promise<string | null> {
  let program: typeof affiliatePrograms.$inferSelect | undefined;
  let accountId = p.affiliateAccountId;
  if (p.targetType === 'platform') {
    program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.scopeType, 'platform') });
    if (!program) return null;
    const attr = await ctx.db.query.affiliateAttributions.findFirst({ where: and(eq(affiliateAttributions.userId, p.userId), eq(affiliateAttributions.programId, program.id)), orderBy: desc(affiliateAttributions.attributedAt) });
    accountId = attr?.affiliateAccountId ?? null;
    if (accountId && program.commissionDurationMonths) {
      const first = await ctx.db.query.affiliateConversions.findFirst({ where: and(eq(affiliateConversions.customerUserId, p.userId), eq(affiliateConversions.programId, program.id)), orderBy: (t, { asc }) => asc(t.convertedAt) });
      if (first && ctx.now().getTime() - first.convertedAt.getTime() > program.commissionDurationMonths * 30.5 * 86_400_000) return null;
    }
  } else if (p.communityId) {
    program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.communityId, p.communityId) });
  }
  if (!program || program.status !== 'active' || !accountId) return null;
  const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, accountId) });
  if (!acc || acc.status !== 'active') return null;
  if (acc.userId === p.userId && !program.allowSelfReferral) return null;
  const rate = acc.commissionRateBps ?? program.commissionRateBps;
  if (rate <= 0) return null;
  const amount = commissionOf(p.amountMinor, rate);
  const [conv] = await ctx.db.insert(affiliateConversions).values({ affiliateAccountId: acc.id, programId: program.id, customerUserId: p.userId, orderId: p.orderId, conversionType: p.targetType === 'platform' ? 'platform_subscription' : p.targetType === 'tier' ? 'community_purchase' : 'offer_purchase', grossMinor: p.amountMinor, status: 'confirmed' }).returning();
  const availableAt = new Date(ctx.now().getTime() + program.holdDays * 86_400_000);
  const rows = await ctx.db.insert(affiliateCommissions).values({ conversionId: conv!.id, affiliateAccountId: acc.id, programId: program.id, paymentId: p.paymentId, orderId: p.orderId, ruleVersion: 1, baseMinor: p.amountMinor, rateBps: rate, amountMinor: amount, status: 'pending', availableAt }).onConflictDoNothing().returning();
  if (!rows.length) return null;
  await ctx.db.update(affiliateAccounts).set({ paidCount: sql`${affiliateAccounts.paidCount} + 1` }).where(eq(affiliateAccounts.id, acc.id));
  if (p.communityId) await ctx.db.update(communityMembers).set({ referredByAffiliateId: acc.id }).where(and(eq(communityMembers.communityId, p.communityId), eq(communityMembers.userId, p.userId), sql`${communityMembers.referredByAffiliateId} is null`));
  await ctx.events.emit('affiliate.commission_created', { commissionId: rows[0]!.id, affiliateAccountId: acc.id, amountMinor: amount });
  return rows[0]!.id;
}

/** Hoàn tiền trong thời gian giữ → reversed; đã vào ví → bút toán adjustment âm. */
export async function reverseCommissionForPayment(ctx: Ctx, paymentId: string): Promise<void> {
  const rows = await ctx.db.query.affiliateCommissions.findMany({ where: eq(affiliateCommissions.paymentId, paymentId) });
  for (const c of rows) {
    if (c.status === 'reversed') continue;
    if (c.status === 'pending') {
      await ctx.db.update(affiliateCommissions).set({ status: 'reversed', reversedAt: ctx.now(), note: 'Hoàn tiền trong thời gian giữ' }).where(eq(affiliateCommissions.id, c.id));
    } else {
      await ledgerEntry(ctx, { affiliateAccountId: c.affiliateAccountId, entryType: 'adjustment', amountMinor: -c.amountMinor, idempotencyKey: `commission-reverse:${c.id}`, commissionId: c.id, note: 'Hoàn tiền sau khi hoa hồng đã vào ví' });
      await ctx.db.update(affiliateCommissions).set({ status: 'reversed', reversedAt: ctx.now(), note: 'Hoàn tiền, đã điều chỉnh ví' }).where(eq(affiliateCommissions.id, c.id));
    }
    if (c.conversionId) await ctx.db.update(affiliateConversions).set({ status: 'reversed' }).where(eq(affiliateConversions.id, c.conversionId));
  }
}

/** Cron hằng ngày: pending quá hold → available + bút toán credit, phát affiliate.commission_available. */
export async function releaseDueCommissions(ctx: Ctx): Promise<number> {
  const due = await ctx.db.query.affiliateCommissions.findMany({ where: and(eq(affiliateCommissions.status, 'pending'), lte(affiliateCommissions.availableAt, ctx.now())) });
  let n = 0;
  for (const c of due) {
    const pay = c.paymentId ? await ctx.db.query.payments.findFirst({ where: eq(payments.id, c.paymentId), columns: { status: true } }) : null;
    if (pay && (pay.status === 'refunded')) {
      await ctx.db.update(affiliateCommissions).set({ status: 'reversed', reversedAt: ctx.now(), note: 'Đơn đã hoàn tiền' }).where(eq(affiliateCommissions.id, c.id));
      continue;
    }
    const written = await ledgerEntry(ctx, { affiliateAccountId: c.affiliateAccountId, entryType: 'credit', amountMinor: c.amountMinor, idempotencyKey: `commission-credit:${c.id}`, commissionId: c.id, note: 'Hoa hồng hết hạn giữ' });
    await ctx.db.update(affiliateCommissions).set({ status: 'available', releasedAt: ctx.now() }).where(eq(affiliateCommissions.id, c.id));
    if (written) {
      const acc = await ctx.db.query.affiliateAccounts.findFirst({ where: eq(affiliateAccounts.id, c.affiliateAccountId) });
      if (acc) await ctx.events.emit('affiliate.commission_available', { commissionId: c.id, affiliateAccountId: c.affiliateAccountId, amountMinor: c.amountMinor, userId: acc.userId, programId: c.programId });
    }
    n++;
  }
  return n;
}

/** Cài đặt · Cộng sự của chủ hội. */
export async function programSettings(ctx: Ctx, communityId: string) {
  await requireCommunityPermission(ctx, communityId, 'affiliates.manage');
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.communityId, communityId) });
  if (!program) throw notFound('Chưa có chương trình cộng sự');
  const stats = await programStats(ctx, program.id);
  return { program, stats };
}
export async function updateProgram(ctx: Ctx, communityId: string, input: { enabled: boolean; commissionRateBps: number; holdDays: number; minWithdrawalMinor: number; leaderboardVisibility: 'members' | 'affiliates_only' | 'hidden'; leaderboardShowMoney: boolean }) {
  await requireCommunityPermission(ctx, communityId, 'affiliates.manage');
  const [row] = await ctx.db.update(affiliatePrograms).set({ status: input.enabled ? 'active' : 'paused', commissionRateBps: input.commissionRateBps, holdDays: input.holdDays, minWithdrawalMinor: input.minWithdrawalMinor, leaderboardVisibility: input.leaderboardVisibility, leaderboardShowMoney: input.leaderboardShowMoney, updatedAt: ctx.now() }).where(eq(affiliatePrograms.communityId, communityId)).returning();
  await audit(ctx, { action: 'affiliate.update_program', resourceType: 'affiliate_program', resourceId: row!.id, communityId, metadata: input });
  return row!;
}

/** Thống kê chương trình: cộng sự có phát sinh tháng này, % doanh thu từ giới thiệu, đã trả / chờ / đang giữ. */
export async function programStats(ctx: Ctx, programId: string) {
  const r = await raw(ctx.db, sql`
    select
      (select count(distinct affiliate_account_id)::int from affiliate_conversions where program_id = ${programId} and date_trunc('month', converted_at) = date_trunc('month', now())) as active_affiliates,
      (select coalesce(sum(amount_minor),0)::bigint from affiliate_commissions where program_id = ${programId} and status = 'paid' and date_trunc('month', paid_at) = date_trunc('month', now())) as paid_this_month,
      (select coalesce(sum(amount_minor),0)::bigint from affiliate_withdrawal_requests where program_id = ${programId} and status in ('requested','reviewing')) as awaiting_transfer,
      (select count(*)::int from affiliate_withdrawal_requests where program_id = ${programId} and status in ('requested','reviewing')) as awaiting_count,
      (select coalesce(sum(amount_minor),0)::bigint from affiliate_commissions where program_id = ${programId} and status = 'pending') as holding,
      (select coalesce(sum(amount_minor),0)::bigint from affiliate_commissions where program_id = ${programId} and status = 'available') as available_unrequested,
      (select coalesce(sum(gross_minor),0)::bigint from affiliate_conversions where program_id = ${programId} and status = 'confirmed' and date_trunc('month', converted_at) = date_trunc('month', now())) as referred_revenue,
      (select count(*)::int from affiliate_commissions where program_id = ${programId} and status = 'paid' and date_trunc('month', paid_at) = date_trunc('month', now())) as paid_count`);
  const row = r[0] as Record<string, string | number>;
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, programId) });
  const total = program?.communityId ? await raw(ctx.db, sql`select coalesce(sum(total_minor),0)::bigint as t from orders where community_id = ${program.communityId} and status = 'paid' and date_trunc('month', paid_at) = date_trunc('month', now())`) : null;
  const totalRevenue = Number((total?.[0] as { t: string } | undefined)?.t ?? 0);
  const referred = Number(row.referred_revenue);
  return { activeAffiliates: Number(row.active_affiliates), paidThisMonthMinor: Number(row.paid_this_month), awaitingTransferMinor: Number(row.awaiting_transfer), awaitingCount: Number(row.awaiting_count), holdingMinor: Number(row.holding), availableUnrequestedMinor: Number(row.available_unrequested), owedMinor: Number(row.awaiting_transfer) + Number(row.available_unrequested), referredRevenueShare: totalRevenue ? Math.round((referred / totalRevenue) * 100) : 0, paidCountThisMonth: Number(row.paid_count) };
}

/** Ví của tôi cho một chương trình (Tài khoản → Cộng sự): link + 3 số + 4 ô ví + hoa hồng gần đây. */
export async function myWallet(ctx: Ctx, programId: string) {
  const userId = requireUser(ctx);
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.id, programId) });
  if (!program) throw notFound();
  if (program.scopeType === 'community' && program.communityId) {
    const access = await resolveCommunityAccess(ctx, program.communityId);
    if (!access.permissions.has('community.read')) throw forbidden('Tham gia hội để làm cộng sự');
  }
  const acc = await ensureAccount(ctx, userId, programId);
  const link = await ctx.db.query.affiliateLinks.findFirst({ where: eq(affiliateLinks.affiliateAccountId, acc.id) });
  const bal = await walletBalance(ctx, acc.id);
  const sums = await raw(ctx.db, sql`
    select (select coalesce(sum(amount_minor),0)::bigint from affiliate_commissions where affiliate_account_id = ${acc.id} and status = 'pending') as pending,
           (select coalesce(sum(amount_minor),0)::bigint from affiliate_withdrawal_requests where affiliate_account_id = ${acc.id} and status in ('requested','reviewing')) as requested,
           (select coalesce(sum(amount_minor),0)::bigint from affiliate_withdrawal_requests where affiliate_account_id = ${acc.id} and status = 'paid') as paid`);
  const s = sums[0] as { pending: string; requested: string; paid: string };
  const recent = await ctx.db.select({ c: affiliateCommissions, customer: { name: users.name, handle: users.handle, avatarUrl: users.avatarUrl, coverColor: users.coverColor }, order: orders }).from(affiliateCommissions).innerJoin(affiliateConversions, eq(affiliateConversions.id, affiliateCommissions.conversionId)).innerJoin(users, eq(users.id, affiliateConversions.customerUserId)).leftJoin(orders, eq(orders.id, affiliateCommissions.orderId)).where(eq(affiliateCommissions.affiliateAccountId, acc.id)).orderBy(desc(affiliateCommissions.createdAt)).limit(20);
  const community = program.communityId ? await ctx.db.query.communities.findFirst({ where: eq(communities.id, program.communityId), columns: { name: true, slug: true } }) : null;
  const payer = program.payerUserId ? await ctx.db.query.users.findFirst({ where: eq(users.id, program.payerUserId), columns: { name: true } }) : null;
  const profile = await raw(ctx.db, sql`select masked_account, bank_code from affiliate_payout_profiles where affiliate_account_id = ${acc.id}`);
  const pr = profile[0] as { masked_account: string; bank_code: string } | undefined;
  return {
    programId, programName: program.name, scope: program.scopeType, communityName: community?.name ?? 'Hội Mình', communitySlug: community?.slug ?? null, payerName: payer?.name ?? 'Hội Mình', affiliateAccountId: acc.id, affiliateCode: acc.affiliateCode, link: link?.destinationUrl ?? '',
    commissionRateBps: acc.commissionRateBps ?? program.commissionRateBps, holdDays: program.holdDays, minWithdrawalMinor: program.minWithdrawalMinor,
    pendingMinor: Number(s.pending), availableMinor: Math.max(0, bal.available), requestedMinor: Number(s.requested), paidMinor: Number(s.paid), clicks: acc.clickCount, signups: acc.signupCount, paid: acc.paidCount,
    maskedAccount: pr?.masked_account ?? null, bankCode: pr?.bank_code ?? null,
    recentCommissions: recent.map((r) => ({ id: r.c.id, customer: r.customer, title: (r.order?.metadata as { title?: string } | null)?.title ?? '', baseMinor: r.c.baseMinor, amountMinor: r.c.amountMinor, status: r.c.status, availableAt: r.c.availableAt, reversedAt: r.c.reversedAt, paidAt: r.c.paidAt })),
  };
}

/** Các chương trình mà tôi có thể làm cộng sự (nền tảng + hội đang tham gia có bật). */
export async function myPrograms(ctx: Ctx) {
  const userId = requireUser(ctx);
  const platform = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.scopeType, 'platform') });
  const rows = await ctx.db.select({ p: affiliatePrograms, c: { id: communities.id, name: communities.name, slug: communities.slug, logoMark: communities.logoMark, logoColor: communities.logoColor } }).from(communityMembers).innerJoin(affiliatePrograms, eq(affiliatePrograms.communityId, communityMembers.communityId)).innerJoin(communities, eq(communities.id, communityMembers.communityId)).where(and(eq(communityMembers.userId, userId), inArray(communityMembers.status, ['active', 'cancelling']), eq(affiliatePrograms.status, 'active')));
  return [...(platform ? [{ id: platform.id, name: 'Nền tảng Hội Mình', scope: 'platform' as const, community: null, rateBps: platform.commissionRateBps }] : []), ...rows.map((r) => ({ id: r.p.id, name: r.c.name, scope: 'community' as const, community: r.c, rateBps: r.p.commissionRateBps }))];
}

/** Xếp hạng cộng sự từ snapshot (mục 200) + dòng "bạn" + cột phải. */
export async function leaderboard(ctx: Ctx, communityId: string, period: 'month' | 'quarter' | 'all') {
  const access = await resolveCommunityAccess(ctx, communityId);
  if (!access.permissions.has('community.read')) throw forbidden();
  const program = await ctx.db.query.affiliatePrograms.findFirst({ where: eq(affiliatePrograms.communityId, communityId) });
  if (!program) throw notFound();
  const userId = ctx.actor.type === 'user' ? ctx.actor.userId : null;
  const myAcc = userId ? await ctx.db.query.affiliateAccounts.findFirst({ where: and(eq(affiliateAccounts.userId, userId), eq(affiliateAccounts.programId, program.id)) }) : null;
  if (program.leaderboardVisibility === 'hidden' && !access.permissions.has('affiliates.manage')) throw forbidden('Bảng xếp hạng đã tắt');
  if (program.leaderboardVisibility === 'affiliates_only' && !myAcc && !access.permissions.has('affiliates.manage')) throw forbidden('Lấy link cộng sự để xem bảng xếp hạng');
  const now = ctx.now();
  const periodType = period === 'all' ? 'all_time' : period;
  const periodKey = period === 'all' ? 'all' : period === 'month' ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` : `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  const rows = await raw(ctx.db, sql`select s.*, u.name, u.handle, u.avatar_url, u.cover_color, a.user_id from affiliate_leaderboard_snapshots s join affiliate_accounts a on a.id = s.affiliate_account_id join users u on u.id = a.user_id where s.community_id = ${communityId} and s.period_type = ${periodType} and s.period_key = ${periodKey} order by s.rank asc limit 100`);
  const showMoney = program.leaderboardShowMoney || access.permissions.has('affiliates.manage');
  const items = (rows as Array<Record<string, unknown>>).map((r) => ({ rank: Number(r.rank), affiliateAccountId: String(r.affiliate_account_id), user: { id: String(r.user_id), name: String(r.name), handle: String(r.handle), avatarUrl: (r.avatar_url as string | null) ?? null, coverColor: (r.cover_color as string | null) ?? null }, referrals: Number(r.referrals_count), paid: Number(r.paid_count), revenueMinor: showMoney ? Number(r.revenue_cents) : null, commissionMinor: showMoney ? Number(r.commission_cents) : null, rankDelta: Number(r.rank_delta), isMe: r.user_id === userId }));
  const computedAt = (rows[0] as { computed_at?: string } | undefined)?.computed_at ?? null;
  const stats = await programStats(ctx, program.id);
  const me = myAcc ? { affiliateCode: myAcc.affiliateCode, link: (await ctx.db.query.affiliateLinks.findFirst({ where: eq(affiliateLinks.affiliateAccountId, myAcc.id) }))?.destinationUrl ?? '', clicks: myAcc.clickCount, signups: myAcc.signupCount, paid: myAcc.paidCount, rank: items.find((i) => i.isMe)?.rank ?? null } : null;
  return { items, computedAt, period, program: { id: program.id, commissionRateBps: program.commissionRateBps, holdDays: program.holdDays, minWithdrawalMinor: program.minWithdrawalMinor, showMoney, enabled: program.status === 'active' }, me, stats: { activeAffiliates: stats.activeAffiliates, referredRevenueShare: stats.referredRevenueShare } };
}

/** Cron 10 phút: tính lại snapshot tháng và từ đầu cho mọi hội có chương trình bật. */
export async function snapshotLeaderboards(ctx: Ctx, onlyCommunityId?: string): Promise<number> {
  const programs = await ctx.db.query.affiliatePrograms.findMany({ where: onlyCommunityId ? eq(affiliatePrograms.communityId, onlyCommunityId) : and(eq(affiliatePrograms.scopeType, 'community'), eq(affiliatePrograms.status, 'active')) });
  const now = ctx.now();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const quarterKey = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  let n = 0;
  for (const p of programs) {
    if (!p.communityId) continue;
    for (const [periodType, periodKey, since] of [['month', monthKey, new Date(now.getFullYear(), now.getMonth(), 1)], ['quarter', quarterKey, new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)], ['all_time', 'all', new Date(0)]] as const) {
      const rows = await raw(ctx.db, sql`
        select a.id as account_id,
          (select count(*)::int from affiliate_attributions at where at.affiliate_account_id = a.id and at.user_id is not null and at.attributed_at >= ${since}) as referrals,
          (select count(distinct c.customer_user_id)::int from affiliate_conversions c where c.affiliate_account_id = a.id and c.status = 'confirmed' and c.converted_at >= ${since}) as paid,
          (select coalesce(sum(c.gross_minor),0)::bigint from affiliate_conversions c where c.affiliate_account_id = a.id and c.status = 'confirmed' and c.converted_at >= ${since}) as revenue,
          (select coalesce(sum(m.amount_minor),0)::bigint from affiliate_commissions m where m.affiliate_account_id = a.id and m.status in ('available','paid') and m.created_at >= ${since}) as commission
        from affiliate_accounts a where a.program_id = ${p.id} and a.status = 'active'`);
      const ranked = (rows as Array<{ account_id: string; referrals: number; paid: number; revenue: string; commission: string }>).map((r) => ({ ...r, revenue: Number(r.revenue), commission: Number(r.commission) })).filter((r) => r.referrals > 0 || r.paid > 0 || r.commission > 0).sort((x, y) => y.commission - x.commission || y.paid - x.paid || y.referrals - x.referrals);
      const prev = await raw(ctx.db, sql`select affiliate_account_id, rank from affiliate_leaderboard_snapshots where community_id = ${p.communityId} and period_type = ${periodType} and period_key = ${periodKey}`);
      const prevRank = new Map((prev as Array<{ affiliate_account_id: string; rank: number }>).map((r) => [r.affiliate_account_id, Number(r.rank)]));
      await raw(ctx.db, sql`delete from affiliate_leaderboard_snapshots where community_id = ${p.communityId} and period_type = ${periodType} and period_key = ${periodKey}`);
      for (const [i, r] of ranked.entries()) {
        const rank = i + 1;
        const before = prevRank.get(r.account_id);
        await raw(ctx.db, sql`insert into affiliate_leaderboard_snapshots (community_id, period_type, period_key, affiliate_account_id, rank, referrals_count, paid_count, revenue_cents, commission_cents, rank_delta, computed_at) values (${p.communityId}, ${periodType}, ${periodKey}, ${r.account_id}, ${rank}, ${r.referrals}, ${r.paid}, ${r.revenue}, ${r.commission}, ${before ? before - rank : 0}, now())`);
      }
      n += ranked.length;
    }
  }
  return n;
}

export const HOLD_DEFAULTS = { community: BUSINESS.communityHoldDays, platform: BUSINESS.platformHoldDays };
