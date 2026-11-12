// Kỳ hạn và khuyến mãi của gói thành viên trong hội (chủ hội cài ở Cài đặt, Giá và gói).
// Hàm thuần dùng chung cho API và Web, để giá, số tiền tiết kiệm và hạn khuyến mãi chỉ tính ở một chỗ.
import { z } from 'zod';
import { amountMinorSchema } from './common';

/** Một kỳ hạn bán: trả một lần cho `months` tháng với giá `amountMinor` đồng. */
export const tierTermSchema = z.object({
  months: z.number().int().min(1).max(36),
  amountMinor: amountMinorSchema,
});
export type TierTerm = z.infer<typeof tierTermSchema>;

/** Số kỳ hạn tối đa của một gói. Nhiều hơn thì người mua khó chọn. */
export const MAX_TIER_TERMS = 6;
/** Các kỳ hạn gợi ý sẵn ở màn cài đặt. Chủ hội vẫn nhập được số tháng khác (1 đến 36). */
export const SUGGESTED_TERM_MONTHS = [1, 3, 6, 12] as const;

/** Khuyến mãi giá gói thành viên: giảm theo phần trăm, có thể kèm ngày hết. Áp cho mọi kỳ hạn và giá trả một lần. */
export const pricingPromoSchema = z.object({
  percentOff: z.number().int().min(1).max(90),
  /** ISO 8601. null là không hẹn ngày hết, chủ hội tự tắt. */
  endsAt: z.string().datetime().nullable().default(null),
});
export type PricingPromo = z.infer<typeof pricingPromoSchema>;

/** Sắp theo số tháng, bỏ kỳ hạn chưa có giá, mỗi số tháng chỉ giữ một dòng (dòng sau thắng). */
export function normalizeTerms(terms: readonly TierTerm[] | null | undefined): TierTerm[] {
  const byMonths = new Map<number, number>();
  for (const t of terms ?? []) {
    if (!Number.isInteger(t.months) || t.months < 1 || t.months > 36) continue;
    if (!Number.isFinite(t.amountMinor) || t.amountMinor <= 0) continue;
    byMonths.set(t.months, Math.round(t.amountMinor));
  }
  return [...byMonths.entries()].sort((a, b) => a[0] - b[0]).map(([months, amountMinor]) => ({ months, amountMinor }));
}

/** Kỳ hạn suy từ hai cột giá cũ (theo tháng, theo năm), cho gói lưu trước khi có kỳ hạn. */
export function termsFromLegacy(monthlyMinor: number | null | undefined, yearlyMinor: number | null | undefined): TierTerm[] {
  return normalizeTerms([
    ...(monthlyMinor ? [{ months: 1, amountMinor: monthlyMinor }] : []),
    ...(yearlyMinor ? [{ months: 12, amountMinor: yearlyMinor }] : []),
  ]);
}

/** Kỳ hạn đang bán của một gói: cột `terms` nếu đã có, không thì suy từ giá tháng và giá năm cũ. */
export function tierTerms(tier: { terms?: readonly TierTerm[] | null; monthlyMinor?: number | null; yearlyMinor?: number | null }): TierTerm[] {
  const own = normalizeTerms(tier.terms);
  return own.length ? own : termsFromLegacy(tier.monthlyMinor, tier.yearlyMinor);
}

/** Giá của đúng một kỳ hạn, hoặc null nếu gói không bán kỳ hạn đó. */
export function termPrice(terms: readonly TierTerm[], months: number): number | null {
  return terms.find((t) => t.months === months)?.amountMinor ?? null;
}

/** "1 tháng", "3 tháng", "12 tháng". */
export function termLabel(months: number): string {
  return `${months} tháng`;
}

/** Đơn vị ghi sau giá của một kỳ hạn: "tháng", "năm", "3 tháng". */
export function termUnit(months: number): string {
  return months === 1 ? 'tháng' : months === 12 ? 'năm' : `${months} tháng`;
}

/** Giá quy ra mỗi tháng, làm tròn tới đồng. */
export function perMonth(term: TierTerm): number {
  return Math.round(term.amountMinor / term.months);
}

/**
 * Phần trăm tiết kiệm của một kỳ hạn so với kỳ hạn ngắn nhất (tính theo giá mỗi tháng), làm tròn.
 * 0 khi chính nó là kỳ ngắn nhất hoặc không rẻ hơn.
 */
export function termSavingPercent(terms: readonly TierTerm[], months: number): number {
  const sorted = normalizeTerms(terms);
  const base = sorted[0];
  const term = sorted.find((t) => t.months === months);
  if (!base || !term || term.months === base.months) return 0;
  const full = (base.amountMinor / base.months) * term.months;
  if (full <= 0 || term.amountMinor >= full) return 0;
  return Math.round((1 - term.amountMinor / full) * 100);
}

/** Kỳ hạn có giá mỗi tháng thấp nhất (để ghi "từ ... mỗi tháng"), hoặc null khi gói chưa có kỳ hạn nào. */
export function cheapestPerMonth(terms: readonly TierTerm[]): TierTerm | null {
  let best: TierTerm | null = null;
  for (const t of normalizeTerms(terms)) if (!best || t.amountMinor / t.months < best.amountMinor / best.months) best = t;
  return best;
}

/** Khuyến mãi có đang chạy ở thời điểm `now` không. */
export function promoActive(promo: PricingPromo | null | undefined, now: Date): promo is PricingPromo {
  if (!promo || !Number.isInteger(promo.percentOff) || promo.percentOff < 1 || promo.percentOff > 90) return false;
  if (!promo.endsAt) return true;
  const end = new Date(promo.endsAt).getTime();
  return Number.isFinite(end) && end > now.getTime();
}

/** Giá sau khuyến mãi. Số tiền giảm làm tròn xuống tới đồng, nên người mua không bao giờ bị tính dư. */
export function applyPromo(amountMinor: number, promo: PricingPromo | null | undefined, now: Date): { payMinor: number; discountMinor: number; percentOff: number } {
  if (!promoActive(promo, now) || amountMinor <= 0) return { payMinor: amountMinor, discountMinor: 0, percentOff: 0 };
  const discountMinor = Math.min(amountMinor, Math.floor((amountMinor * promo.percentOff) / 100));
  return { payMinor: amountMinor - discountMinor, discountMinor, percentOff: promo.percentOff };
}

/** Hai cột giá cũ giữ đồng bộ với kỳ hạn: giá tháng là kỳ 1 tháng, giá năm là kỳ 12 tháng. */
export function legacyPricesOf(terms: readonly TierTerm[]): { monthlyMinor: number | null; yearlyMinor: number | null } {
  return { monthlyMinor: termPrice(terms, 1), yearlyMinor: termPrice(terms, 12) };
}

/** Mã chu kỳ lưu ở đơn, subscription và offer: 12 tháng là "yearly", còn lại là "monthly" (số tháng thật nằm ở `months`). */
export function cycleOfMonths(months: number): 'monthly' | 'yearly' {
  return months === 12 ? 'yearly' : 'monthly';
}

/** Số tháng của một đơn hoặc subscription cũ chỉ có mã chu kỳ. */
export function monthsOfCycle(cycle: string | null | undefined, months?: number | null): number {
  if (Number.isInteger(months) && (months as number) >= 1) return months as number;
  return cycle === 'yearly' ? 12 : 1;
}
