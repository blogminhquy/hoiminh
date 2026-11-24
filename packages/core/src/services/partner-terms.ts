// Điều khoản riêng của đối tác chính thức (affiliate nền tảng): thời hạn nhận hoa hồng. % riêng nằm ở
// affiliate_accounts.commission_rate_bps nên chỗ tính hoa hồng đọc thẳng ở đó. Tách riêng file này để chỗ tính hoa
// hồng (affiliate.ts), danh sách chương trình của tôi (affiliate-links.ts) và trang quản lý đối tác (partners.ts) cùng
// đọc một luật, không import vòng.
import { and, eq } from 'drizzle-orm';
import { platformPartners, type PartnerDurationMode } from '@hoiminh/db';
import type { Ctx } from '../context';

export interface PartnerTerms { durationMode: PartnerDurationMode; commissionDurationMonths: number | null }

/** Đối tác đang hợp tác của một tài khoản affiliate, hoặc null. Đối tác đã kết thúc thì không còn điều khoản riêng. */
export async function activePartnerOf(ctx: Ctx, affiliateAccountId: string) {
  return (await ctx.db.query.platformPartners.findFirst({ where: and(eq(platformPartners.affiliateAccountId, affiliateAccountId), eq(platformPartners.status, 'active')) })) ?? null;
}

/**
 * Thời hạn nhận hoa hồng thực tế (số tháng tính từ lần đầu người được giới thiệu trả tiền; null là trọn đời).
 * Không phải đối tác, hoặc đối tác để "theo mức chung", thì dùng mức của chương trình.
 */
export function effectiveDurationMonths(programMonths: number | null, partner: PartnerTerms | null): number | null {
  if (!partner || partner.durationMode === 'program') return programMonths;
  if (partner.durationMode === 'lifetime') return null;
  return partner.commissionDurationMonths ?? programMonths;
}
