// Tính toán tiền: hoa hồng theo bps làm tròn xuống, chu kỳ, mã tham chiếu.
import { randomCode } from '@hoiminh/config';

/** Hoa hồng = base × rate / 10.000, làm tròn xuống (mục 201). */
export function commissionOf(baseMinor: number, rateBps: number): number {
  return Math.floor((baseMinor * rateBps) / 10_000);
}

/** Ngày kết thúc kỳ từ ngày bắt đầu và chu kỳ. */
export function periodEnd(start: Date, cycle: 'monthly' | 'yearly' | 'one_time'): Date | null {
  if (cycle === 'one_time') return null;
  const d = new Date(start);
  if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** Mã tham chiếu thanh toán "HM XXXXX" (5 ký tự không gây nhầm). */
export function newReference(): string {
  return `HM ${randomCode(5)}`;
}

/** Tính giảm giá theo coupon. */
export function applyCoupon(amountMinor: number, coupon: { percentOff: number | null; amountOffMinor: number | null } | null): number {
  if (!coupon) return 0;
  if (coupon.percentOff) return Math.min(amountMinor, Math.floor((amountMinor * coupon.percentOff) / 100));
  if (coupon.amountOffMinor) return Math.min(amountMinor, coupon.amountOffMinor);
  return 0;
}

/** Số ngày giữa hai mốc, làm tròn lên. */
export function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}
