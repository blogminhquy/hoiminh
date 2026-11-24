// Đối tác chính thức của Hội Mình (Hệ thống · Đối tác; chủ dự án chốt ngày 24/11/2026). Đối tác là một người làm
// affiliate nền tảng được quản trị chọn, có % hoa hồng riêng và thời hạn nhận hoa hồng riêng, kèm ghi chú (thỏa thuận,
// kênh của họ). Trang quản lý cho thêm đối tác bằng email, sửa điều khoản, kết thúc hợp tác, và xem mỗi đối tác mang về
// bao nhiêu chủ hội, bao nhiêu tiền.
// Chưa có: tặng gói cho hội của đối tác (chủ dự án để sau).
import type { PartnerDurationMode } from '@hoiminh/db';
import { affiliateAccounts, platformPartners, users } from '@hoiminh/db';
import { and, eq, sql } from 'drizzle-orm';
import type { Ctx } from '../context';
import { invalid, notFound } from '../errors';
import { raw } from '../lib/db';
import { actorUserId } from '../context';
import { requireSuperAdmin } from '../permissions';
import { ensureAccount } from './affiliate';
import { platformProgram } from './affiliate-links';
import { audit } from './audit';
import { effectiveDurationMonths } from './partner-terms';

export interface PartnerInput {
  /** % hoa hồng riêng, tính bằng phần vạn (5000 = 50%). null là theo mức chung của chương trình. */
  commissionRateBps: number | null;
  durationMode: PartnerDurationMode;
  /** Bắt buộc khi durationMode là 'months'. */
  commissionDurationMonths?: number | null;
  note?: string | null;
}

const MAX_RATE_BPS = 9_000;

function checkTerms(input: PartnerInput) {
  if (input.commissionRateBps !== null && (!Number.isInteger(input.commissionRateBps) || input.commissionRateBps < 0 || input.commissionRateBps > MAX_RATE_BPS)) throw invalid('Hoa hồng riêng phải từ 0% đến 90%');
  if (input.durationMode === 'months' && (!input.commissionDurationMonths || input.commissionDurationMonths < 1 || input.commissionDurationMonths > 120)) throw invalid('Thời hạn riêng phải từ 1 đến 120 tháng');
}

const monthsOf = (input: PartnerInput) => (input.durationMode === 'months' ? input.commissionDurationMonths ?? null : null);
const noteOf = (note: string | null | undefined) => (note?.trim() ? note.trim().slice(0, 1000) : null);

interface PartnerRow {
  id: string; status: 'active' | 'ended'; duration_mode: PartnerDurationMode; commission_duration_months: number | null; note: string | null; started_at: string; ended_at: string | null;
  account_id: string; affiliate_code: string; account_rate_bps: number | null; click_count: number; signup_count: number;
  user_id: string; name: string; email: string; handle: string | null; avatar_url: string | null; cover_color: string | null;
  paid_customers: string; gross_minor: string; commission_minor: string;
}

/** Danh sách đối tác (đang hợp tác trước, rồi đã kết thúc), kèm số liệu mang về và mức chung để so. */
export async function listPartners(ctx: Ctx) {
  requireSuperAdmin(ctx);
  const program = await platformProgram(ctx);
  const rows = await raw<PartnerRow>(ctx.db, sql`
    select p.id, p.status, p.duration_mode, p.commission_duration_months, p.note, p.started_at, p.ended_at,
           a.id as account_id, a.affiliate_code, a.commission_rate_bps as account_rate_bps, a.click_count, a.signup_count,
           u.id as user_id, u.name, u.email, u.handle, u.avatar_url, u.cover_color,
           (select count(distinct c.customer_user_id) from affiliate_conversions c where c.affiliate_account_id = a.id and c.status = 'confirmed') as paid_customers,
           (select coalesce(sum(c.gross_minor), 0) from affiliate_conversions c where c.affiliate_account_id = a.id and c.status = 'confirmed') as gross_minor,
           (select coalesce(sum(m.amount_minor), 0) from affiliate_commissions m where m.affiliate_account_id = a.id and m.status <> 'reversed') as commission_minor
    from platform_partners p
    join affiliate_accounts a on a.id = p.affiliate_account_id
    join users u on u.id = a.user_id
    order by (p.status = 'active') desc, p.started_at desc`);
  const items = rows.map((r) => {
    const terms = { durationMode: r.duration_mode, commissionDurationMonths: r.commission_duration_months };
    return {
      id: r.id, status: r.status, note: r.note, startedAt: r.started_at, endedAt: r.ended_at,
      user: { id: r.user_id, name: r.name, email: r.email, handle: r.handle, avatarUrl: r.avatar_url, coverColor: r.cover_color },
      affiliateAccountId: r.account_id, code: r.affiliate_code,
      commissionRateBps: r.account_rate_bps, effectiveRateBps: r.account_rate_bps ?? program.commissionRateBps,
      durationMode: r.duration_mode, commissionDurationMonths: r.commission_duration_months, effectiveDurationMonths: effectiveDurationMonths(program.commissionDurationMonths, terms),
      stats: { clicks: Number(r.click_count), signups: Number(r.signup_count), paidCustomers: Number(r.paid_customers), grossMinor: Number(r.gross_minor), commissionMinor: Number(r.commission_minor) },
    };
  });
  return { program: { commissionRateBps: program.commissionRateBps, commissionDurationMonths: program.commissionDurationMonths }, items };
}

/**
 * Thêm đối tác theo email tài khoản Hội Mình. Người đó chưa làm affiliate nền tảng thì mở ví cho họ luôn.
 * Đã từng là đối tác (đã kết thúc) thì mở lại hợp tác với điều khoản mới; đang là đối tác thì báo trùng.
 */
export async function addPartner(ctx: Ctx, input: PartnerInput & { email: string }) {
  requireSuperAdmin(ctx);
  checkTerms(input);
  const email = input.email.trim().toLowerCase();
  const user = await ctx.db.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}`, columns: { id: true, name: true } });
  if (!user) throw invalid('Email này chưa có tài khoản Hội Mình. Nhờ người đó đăng ký trước, rồi thêm lại.');
  const program = await platformProgram(ctx);
  const account = await ensureAccount(ctx, user.id, program.id);
  const existing = await ctx.db.query.platformPartners.findFirst({ where: eq(platformPartners.affiliateAccountId, account.id) });
  if (existing?.status === 'active') throw invalid(`${user.name} đã là đối tác`);
  const values = { status: 'active' as const, durationMode: input.durationMode, commissionDurationMonths: monthsOf(input), note: noteOf(input.note), createdByUserId: actorUserId(ctx), startedAt: ctx.now(), endedAt: null, updatedAt: ctx.now() };
  const [row] = existing
    ? await ctx.db.update(platformPartners).set(values).where(eq(platformPartners.id, existing.id)).returning()
    : await ctx.db.insert(platformPartners).values({ affiliateAccountId: account.id, ...values }).returning();
  await ctx.db.update(affiliateAccounts).set({ commissionRateBps: input.commissionRateBps, status: 'active', updatedAt: ctx.now() }).where(eq(affiliateAccounts.id, account.id));
  await audit(ctx, { action: 'platform_partner.add', resourceType: 'platform_partner', resourceId: row!.id, metadata: { userId: user.id, commissionRateBps: input.commissionRateBps, durationMode: input.durationMode, commissionDurationMonths: monthsOf(input) } });
  return row!;
}

/** Sửa % riêng, thời hạn riêng, ghi chú của một đối tác đang hợp tác. Hoa hồng đã ghi trước đó không đổi. */
export async function updatePartner(ctx: Ctx, partnerId: string, input: PartnerInput) {
  requireSuperAdmin(ctx);
  checkTerms(input);
  const partner = await ctx.db.query.platformPartners.findFirst({ where: and(eq(platformPartners.id, partnerId), eq(platformPartners.status, 'active')) });
  if (!partner) throw notFound('Không tìm thấy đối tác đang hợp tác');
  const [row] = await ctx.db.update(platformPartners).set({ durationMode: input.durationMode, commissionDurationMonths: monthsOf(input), note: noteOf(input.note), updatedAt: ctx.now() }).where(eq(platformPartners.id, partnerId)).returning();
  await ctx.db.update(affiliateAccounts).set({ commissionRateBps: input.commissionRateBps, updatedAt: ctx.now() }).where(eq(affiliateAccounts.id, partner.affiliateAccountId));
  await audit(ctx, { action: 'platform_partner.update', resourceType: 'platform_partner', resourceId: partnerId, metadata: { commissionRateBps: input.commissionRateBps, durationMode: input.durationMode, commissionDurationMonths: monthsOf(input) } });
  return row!;
}

/**
 * Kết thúc hợp tác: % và thời hạn trở về mức chung cho những lần trả tiền sau đó. Người đó vẫn là affiliate nền tảng,
 * link cũ vẫn chạy; hoa hồng đã ghi và ví giữ nguyên.
 */
export async function endPartner(ctx: Ctx, partnerId: string) {
  requireSuperAdmin(ctx);
  const partner = await ctx.db.query.platformPartners.findFirst({ where: and(eq(platformPartners.id, partnerId), eq(platformPartners.status, 'active')) });
  if (!partner) throw notFound('Không tìm thấy đối tác đang hợp tác');
  const [row] = await ctx.db.update(platformPartners).set({ status: 'ended', endedAt: ctx.now(), updatedAt: ctx.now() }).where(eq(platformPartners.id, partnerId)).returning();
  await ctx.db.update(affiliateAccounts).set({ commissionRateBps: null, updatedAt: ctx.now() }).where(eq(affiliateAccounts.id, partner.affiliateAccountId));
  await audit(ctx, { action: 'platform_partner.end', resourceType: 'platform_partner', resourceId: partnerId });
  return row!;
}
