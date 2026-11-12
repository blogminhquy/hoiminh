// Gói Hội Mình (kế hoạch 11/11/2026): bốn gói, mỗi gói cho một hội, hai chu kỳ (3 tháng, 1 năm), không dùng thử.
// Phần này là hàm thuần dùng chung cho API và Web, để giá, số ngày tặng và luật mua chỉ viết một lần.
import { z } from 'zod';

export const PLAN_KEYS = ['free', 'starter', 'pro', 'unlimited'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export const planKeySchema = z.enum(PLAN_KEYS);
/** Gói mua được (gói Miễn phí không bán). */
export const paidPlanKeySchema = z.enum(['starter', 'pro', 'unlimited']);

/** Tính năng trả phí mà quản trị bật tắt theo gói. Bán hàng và thu tiền có ở mọi gói nên không nằm ở đây. */
export const PLAN_FEATURES = ['automation', 'custom_domain', 'affiliate', 'api'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];
export const planFeatureSchema = z.enum(PLAN_FEATURES);
export const PLAN_FEATURE_LABEL: Record<PlanFeature, string> = {
  automation: 'Tự động hóa',
  custom_domain: 'Tên miền riêng',
  affiliate: 'Affiliate',
  api: 'API',
};

/** Hai chu kỳ duy nhất. 3 tháng = 3 lần giá tháng, 90 ngày. 1 năm = 10 lần giá tháng, 365 ngày. */
export const PLAN_CYCLES = ['quarterly', 'yearly'] as const;
export type PlanCycle = (typeof PLAN_CYCLES)[number];
export const planCycleSchema = z.enum(PLAN_CYCLES);
export const PLAN_CYCLE: Record<PlanCycle, { days: number; priceMonths: number; months: number; label: string }> = {
  quarterly: { days: 90, priceMonths: 3, months: 3, label: '3 tháng' },
  yearly: { days: 365, priceMonths: 10, months: 12, label: '1 năm' },
};

export interface PlanDef {
  key: PlanKey;
  name: string;
  /** Giá mỗi tháng, đồng. Gói Miễn phí luôn là 0. */
  monthlyMinor: number;
  /** Trần thành viên; null là không giới hạn. */
  memberCap: number | null;
  features: PlanFeature[];
}

/** Bảng gói mặc định, dùng khi database chưa có dòng nào cho một gói. Quản trị sửa giá, trần và tính năng ở Hệ thống. */
export const PLAN_DEFAULTS: readonly PlanDef[] = [
  { key: 'free', name: 'Miễn phí', monthlyMinor: 0, memberCap: 100, features: [] },
  { key: 'starter', name: 'Khởi đầu', monthlyMinor: 99_000, memberCap: 500, features: [] },
  { key: 'pro', name: 'Chuyên nghiệp', monthlyMinor: 299_000, memberCap: 5_000, features: ['automation', 'custom_domain', 'affiliate', 'api'] },
  { key: 'unlimited', name: 'Không giới hạn', monthlyMinor: 799_000, memberCap: null, features: ['automation', 'custom_domain', 'affiliate', 'api'] },
];

/** Thứ bậc gói: số lớn hơn là gói cao hơn. Khóa lạ (gói cũ) xếp ngang Miễn phí. */
export function planRank(key: string): number {
  const i = (PLAN_KEYS as readonly string[]).indexOf(key);
  return i < 0 ? 0 : i;
}

export const isPlanKey = (key: string): key is PlanKey => (PLAN_KEYS as readonly string[]).includes(key);

/** Tiền phải trả cho một chu kỳ. */
export function planPrice(monthlyMinor: number, cycle: PlanCycle): number {
  return monthlyMinor * PLAN_CYCLE[cycle].priceMonths;
}

/** Giá quy ra mỗi tháng của một chu kỳ (trả 1 năm chỉ tính 10 tháng nên rẻ hơn giá niêm yết). */
export function planPerMonth(monthlyMinor: number, cycle: PlanCycle): number {
  return Math.round(planPrice(monthlyMinor, cycle) / PLAN_CYCLE[cycle].months);
}

const DAY_MS = 86_400_000;

/** Số ngày còn lại tới một mốc, làm tròn lên; đã qua thì 0. */
export function planDaysLeft(end: Date | string | null | undefined, now: Date): number {
  if (!end) return 0;
  const ms = new Date(end).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / DAY_MS) : 0;
}

/** Gói đang có hiệu lực của một hội: gói trả phí còn hạn thì tính gói đó, hết hạn hoặc chưa mua thì là Miễn phí. */
export function effectivePlanKey(planKey: string, planEndsAt: Date | string | null | undefined, now: Date): PlanKey {
  if (!isPlanKey(planKey) || planKey === 'free' || !planEndsAt) return 'free';
  return new Date(planEndsAt).getTime() > now.getTime() ? planKey : 'free';
}

export type PlanAction = 'buy' | 'renew' | 'upgrade';
export type PlanBlock = 'free' | 'lower' | 'cap';

export interface PlanQuoteInput {
  now: Date;
  /** Gói đang có hiệu lực của hội và ngày hết hạn (Miễn phí thì endsAt là null). */
  current: { key: PlanKey; endsAt: Date | string | null };
  target: { key: PlanKey; monthlyMinor: number; memberCap: number | null };
  cycle: PlanCycle;
  /** Số thành viên hiện tại của hội. */
  members: number;
}

export interface PlanQuote {
  /** Mua được không. Không mua được thì `blocked` nói vì sao. */
  ok: boolean;
  blocked: PlanBlock | null;
  action: PlanAction;
  amountMinor: number;
  /** Số ngày của chu kỳ mua. */
  days: number;
  /** Ngày còn lại của gói đang dùng, cộng vào gói mới: được tặng khi nâng gói, nối tiếp khi gia hạn. */
  carryDays: number;
  totalDays: number;
  endsAt: Date;
}

/**
 * Tính một lần mua gói cho hội.
 * - Gia hạn cùng gói: nối tiếp vào ngày hết hạn hiện tại.
 * - Nâng lên gói cao hơn: gói mới có hiệu lực ngay, số ngày còn lại của gói cũ được tặng sang gói mới.
 * - Không mua được gói thấp hơn gói đang còn hạn, và không mua được gói có trần thấp hơn số thành viên hiện có.
 */
export function planQuote(i: PlanQuoteInput): PlanQuote {
  const days = PLAN_CYCLE[i.cycle].days;
  const curEnd = i.current.key !== 'free' && i.current.endsAt ? new Date(i.current.endsAt) : null;
  const active = curEnd !== null && curEnd.getTime() > i.now.getTime();
  const base = active ? curEnd : i.now;
  const carryDays = active ? planDaysLeft(curEnd, i.now) : 0;
  const action: PlanAction = !active ? 'buy' : i.target.key === i.current.key ? 'renew' : 'upgrade';
  let blocked: PlanBlock | null = null;
  if (i.target.key === 'free') blocked = 'free';
  else if (active && planRank(i.target.key) < planRank(i.current.key)) blocked = 'lower';
  else if (i.target.memberCap !== null && i.members > i.target.memberCap) blocked = 'cap';
  return {
    ok: blocked === null,
    blocked,
    action,
    amountMinor: planPrice(i.target.monthlyMinor, i.cycle),
    days,
    carryDays,
    totalDays: days + carryDays,
    endsAt: new Date(base.getTime() + days * DAY_MS),
  };
}

/** Gói thấp nhất có một tính năng (để ghi "Có từ gói ..."). */
export function lowestPlanWith(plans: ReadonlyArray<Pick<PlanDef, 'key' | 'name' | 'features'>>, feature: PlanFeature): { key: PlanKey; name: string } | null {
  const hit = [...plans].sort((a, b) => planRank(a.key) - planRank(b.key)).find((p) => p.key !== 'free' && p.features.includes(feature));
  return hit ? { key: hit.key, name: hit.name } : null;
}

/** Gói thấp nhất chứa được số thành viên cho trước và cao hơn gói đang dùng (gợi ý khi chạm trần). */
export function nextPlanFor(plans: ReadonlyArray<Pick<PlanDef, 'key' | 'name' | 'memberCap'>>, currentKey: PlanKey, members: number): { key: PlanKey; name: string } | null {
  const hit = [...plans].sort((a, b) => planRank(a.key) - planRank(b.key)).find((p) => planRank(p.key) > planRank(currentKey) && (p.memberCap === null || p.memberCap > members));
  return hit ? { key: hit.key, name: hit.name } : null;
}

/** Quản trị lưu cả bảng gói một lần. */
export const savePlansSchema = z.object({
  plans: z.array(z.object({
    key: planKeySchema,
    monthlyMinor: z.number().int().min(0).max(100_000_000),
    memberCap: z.number().int().min(1).max(10_000_000).nullable(),
    features: z.array(planFeatureSchema).max(PLAN_FEATURES.length),
  })).min(1).max(PLAN_KEYS.length),
});
export type SavePlansInput = z.infer<typeof savePlansSchema>;
