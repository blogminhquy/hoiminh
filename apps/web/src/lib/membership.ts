// Giá gói thành viên phía trình duyệt: giá mở đầu (kỳ hạn ngắn nhất) và từng lựa chọn kỳ hạn, đã trừ khuyến mãi.
// Số tiền thật vẫn do máy chủ tính lại khi tạo đơn, ở đây chỉ để hiển thị.
import { applyPromo, termSavingPercent, termUnit, type PricingPromo, type TierTerm } from '@hoiminh/contracts';

export interface PremiumPricing { terms: TierTerm[]; promo: PricingPromo | null; oneTimeMinor: number | null }

export interface TermChoice {
  /** null là trả một lần, trọn đời. */
  months: number | null;
  /** Giá niêm yết. */
  listMinor: number;
  /** Giá phải trả sau khuyến mãi. */
  payMinor: number;
  /** Phần trăm khuyến mãi đang trừ, 0 khi không có. */
  percentOff: number;
  /** Đơn vị ghi sau giá: "tháng", "3 tháng", "năm", "trọn đời". */
  unit: string;
  /** Phần trăm rẻ hơn so với kỳ ngắn nhất (mua dài thì lợi hơn). */
  savingPercent: number;
}

/** Mọi lựa chọn mua của gói, kỳ ngắn trước. `oneTime` bật thì thêm lựa chọn trọn đời ở cuối. */
export function termChoices(p: PremiumPricing | null | undefined, opts: { oneTime?: boolean; termsOff?: boolean } = {}, now: Date = new Date()): TermChoice[] {
  if (!p) return [];
  const out: TermChoice[] = [];
  if (!opts.termsOff) {
    for (const t of p.terms) {
      const promo = applyPromo(t.amountMinor, p.promo, now);
      out.push({ months: t.months, listMinor: t.amountMinor, payMinor: promo.payMinor, percentOff: promo.percentOff, unit: termUnit(t.months), savingPercent: termSavingPercent(p.terms, t.months) });
    }
  }
  if (opts.oneTime && p.oneTimeMinor) {
    const promo = applyPromo(p.oneTimeMinor, p.promo, now);
    out.push({ months: null, listMinor: p.oneTimeMinor, payMinor: promo.payMinor, percentOff: promo.percentOff, unit: 'trọn đời', savingPercent: 0 });
  }
  return out;
}

/**
 * Lựa chọn đang bán theo kiểu thu phí của hội: hội "Trả một lần" bán gói trọn đời, các kiểu còn lại bán theo kỳ hạn.
 * Kiểu đang chọn chưa có giá thì lấy kiểu kia, để nút mua không rỗng.
 */
export function modeChoices(p: PremiumPricing | null | undefined, pricingMode: string, now: Date = new Date()): TermChoice[] {
  const terms = termChoices(p, {}, now);
  const once = termChoices(p, { oneTime: true, termsOff: true }, now);
  if (pricingMode === 'one_time') return once.length ? once : terms;
  return terms.length ? terms : once;
}

/** Giá mở đầu của gói: số tiền nhỏ nhất để vào (kỳ hạn ngắn nhất). */
export function entryChoice(p: PremiumPricing | null | undefined, pricingMode: string, now: Date = new Date()): TermChoice | null {
  return modeChoices(p, pricingMode, now)[0] ?? null;
}

/** Tham số đường dẫn sang trang thanh toán cho một lựa chọn. */
export function checkoutQuery(choice: TermChoice | null): string {
  if (!choice) return 'tier=premium';
  if (choice.months === null) return 'tier=premium&cycle=one_time';
  return `tier=premium&cycle=${choice.months === 12 ? 'yearly' : 'monthly'}&months=${choice.months}`;
}

/** Ngày hết khuyến mãi dạng "20/11", hoặc null khi không hẹn ngày. */
export function promoEndLabel(promo: PricingPromo | null | undefined): string | null {
  if (!promo?.endsAt) return null;
  const d = new Date(promo.endsAt);
  return Number.isNaN(d.getTime()) ? null : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
