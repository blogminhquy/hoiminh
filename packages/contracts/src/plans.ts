// Gói Hội Mình (kế hoạch 11/11/2026, sửa ngày 21/11/2026): bốn gói, mỗi gói cho một hội, không dùng thử.
// Bốn kỳ trả tiền (1 tháng, 3 tháng, 6 tháng, 1 năm), mỗi kỳ của mỗi gói có giá riêng do quản trị nhập.
// Kỳ nào để giá 0 thì gói không bán kỳ đó và trang mua gói không hiện.
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

/** Bốn kỳ trả tiền, xếp từ ngắn tới dài. Giá của từng kỳ do quản trị nhập riêng cho từng gói. */
export const PLAN_CYCLES = ['monthly', 'quarterly', 'semiannual', 'yearly'] as const;
export type PlanCycle = (typeof PLAN_CYCLES)[number];
export const planCycleSchema = z.enum(PLAN_CYCLES);
export const PLAN_CYCLE: Record<PlanCycle, { days: number; months: number; label: string }> = {
  monthly: { days: 30, months: 1, label: '1 tháng' },
  quarterly: { days: 90, months: 3, label: '3 tháng' },
  semiannual: { days: 180, months: 6, label: '6 tháng' },
  yearly: { days: 365, months: 12, label: '1 năm' },
};

/** Giá của một gói theo từng kỳ, đồng. 0 là không bán kỳ đó. */
export type PlanPrices = Record<PlanCycle, number>;
export const NO_PRICES: PlanPrices = { monthly: 0, quarterly: 0, semiannual: 0, yearly: 0 };

export interface PlanDef {
  key: PlanKey;
  name: string;
  /** Giá từng kỳ, đồng. 0 là không bán kỳ đó. Gói Miễn phí luôn là 0 ở mọi kỳ. */
  prices: PlanPrices;
  /** Trần thành viên; null là không giới hạn. */
  memberCap: number | null;
  features: PlanFeature[];
}

/**
 * Bảng gói mặc định, dùng khi database chưa có dòng nào cho một gói. Quản trị sửa giá, trần và tính năng ở Hệ thống.
 * Mặc định chỉ bán 3 tháng và 1 năm (như trước ngày 21/11/2026); 1 tháng và 6 tháng để 0 cho tới khi quản trị nhập giá.
 */
export const PLAN_DEFAULTS: readonly PlanDef[] = [
  { key: 'free', name: 'Miễn phí', prices: { ...NO_PRICES }, memberCap: 100, features: [] },
  { key: 'starter', name: 'Khởi đầu', prices: { monthly: 0, quarterly: 297_000, semiannual: 0, yearly: 990_000 }, memberCap: 500, features: [] },
  { key: 'pro', name: 'Chuyên nghiệp', prices: { monthly: 0, quarterly: 897_000, semiannual: 0, yearly: 2_990_000 }, memberCap: 5_000, features: ['automation', 'affiliate', 'api'] },
  { key: 'unlimited', name: 'Không giới hạn', prices: { monthly: 0, quarterly: 2_397_000, semiannual: 0, yearly: 7_990_000 }, memberCap: null, features: ['automation', 'custom_domain', 'affiliate', 'api'] },
];

/** Thứ bậc gói: số lớn hơn là gói cao hơn. Khóa lạ (gói cũ) xếp ngang Miễn phí. */
export function planRank(key: string): number {
  const i = (PLAN_KEYS as readonly string[]).indexOf(key);
  return i < 0 ? 0 : i;
}

export const isPlanKey = (key: string): key is PlanKey => (PLAN_KEYS as readonly string[]).includes(key);

type Priced = Pick<PlanDef, 'prices'>;

/** Tiền phải trả cho một kỳ. 0 là gói không bán kỳ đó. */
export function planPrice(plan: Priced, cycle: PlanCycle): number {
  return plan.prices[cycle] ?? 0;
}

/** Gói có bán kỳ này không (giá lớn hơn 0). */
export function planSells(plan: Priced, cycle: PlanCycle): boolean {
  return planPrice(plan, cycle) > 0;
}

/** Các kỳ một gói đang bán, từ ngắn tới dài. */
export function planCyclesOf(plan: Priced): PlanCycle[] {
  return PLAN_CYCLES.filter((c) => planSells(plan, c));
}

/** Các kỳ có ít nhất một gói trả phí đang bán, từ ngắn tới dài: đây là các tab kỳ hạn của trang mua gói. */
export function soldCycles(plans: ReadonlyArray<Pick<PlanDef, 'key' | 'prices'>>): PlanCycle[] {
  return PLAN_CYCLES.filter((c) => plans.some((p) => p.key !== 'free' && planSells(p, c)));
}

/** Chọn một kỳ trong các kỳ đang bán: lấy kỳ đầu tiên trong danh sách ưu tiên còn bán, không có thì kỳ dài nhất. */
export function pickCycle(available: readonly PlanCycle[], ...preferred: Array<PlanCycle | null | undefined>): PlanCycle | null {
  for (const c of preferred) if (c && available.includes(c)) return c;
  return available[available.length - 1] ?? null;
}

/** Giá quy ra mỗi tháng của một kỳ, làm tròn tới đồng. */
export function planPerMonth(plan: Priced, cycle: PlanCycle): number {
  return Math.round(planPrice(plan, cycle) / PLAN_CYCLE[cycle].months);
}

/** Giá quy ra mỗi tháng thấp nhất trong các kỳ đang bán (để ghi "từ ... mỗi tháng"); null khi gói không bán kỳ nào. */
export function planLowestPerMonth(plan: Priced): number | null {
  const sold = planCyclesOf(plan);
  return sold.length ? Math.min(...sold.map((c) => planPerMonth(plan, c))) : null;
}

export type PlanSaving = { kind: 'months'; months: number } | { kind: 'percent'; percent: number };

/**
 * Một kỳ rẻ hơn bao nhiêu so với kỳ ngắn nhất mà gói đang bán (tính theo giá mỗi tháng). Số tháng được lợi là số
 * nguyên thì ghi "tặng N tháng", không thì ghi phần trăm. Kỳ ngắn nhất, kỳ không bán, hoặc không rẻ hơn thì null.
 */
export function planSaving(plan: Priced, cycle: PlanCycle): PlanSaving | null {
  const base = planCyclesOf(plan)[0];
  if (!base || base === cycle || !planSells(plan, cycle)) return null;
  const months = PLAN_CYCLE[cycle].months, baseMonths = PLAN_CYCLE[base].months;
  if (months <= baseMonths) return null;
  const price = planPrice(plan, cycle), basePrice = planPrice(plan, base);
  // Số tháng trả tiền nếu tính theo giá của kỳ ngắn nhất = price * baseMonths / basePrice.
  const paid = price * baseMonths;
  if (paid >= months * basePrice) return null;
  if (paid % basePrice === 0 && months - paid / basePrice >= 1) return { kind: 'months', months: months - paid / basePrice };
  const percent = Math.round((1 - paid / (months * basePrice)) * 100);
  return percent >= 1 ? { kind: 'percent', percent } : null;
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
/** `unsold`: gói không bán kỳ đã chọn (giá của kỳ đó là 0). */
export type PlanBlock = 'free' | 'unsold' | 'lower' | 'cap';

export interface PlanQuoteInput {
  now: Date;
  /** Gói đang có hiệu lực của hội và ngày hết hạn (Miễn phí thì endsAt là null). */
  current: { key: PlanKey; endsAt: Date | string | null };
  target: { key: PlanKey; prices: PlanPrices; memberCap: number | null };
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
 * - Không mua được kỳ mà gói không bán (giá của kỳ đó là 0).
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
  else if (!planSells(i.target, i.cycle)) blocked = 'unsold';
  else if (active && planRank(i.target.key) < planRank(i.current.key)) blocked = 'lower';
  else if (i.target.memberCap !== null && i.members > i.target.memberCap) blocked = 'cap';
  return {
    ok: blocked === null,
    blocked,
    action,
    amountMinor: planPrice(i.target, i.cycle),
    days,
    carryDays,
    totalDays: days + carryDays,
    endsAt: new Date(base.getTime() + days * DAY_MS),
  };
}

/** Gói trả phí còn bán ít nhất một kỳ. Bảng gói không kèm giá (dữ liệu cũ) thì coi như đang bán. */
const onSale = (p: { prices?: PlanPrices }) => !p.prices || planCyclesOf({ prices: p.prices }).length > 0;

/** Gói thấp nhất đang bán có một tính năng (để ghi "Có từ gói ..."). */
export function lowestPlanWith(plans: ReadonlyArray<Pick<PlanDef, 'key' | 'name' | 'features'> & { prices?: PlanPrices }>, feature: PlanFeature): { key: PlanKey; name: string } | null {
  const hit = [...plans].sort((a, b) => planRank(a.key) - planRank(b.key)).find((p) => p.key !== 'free' && onSale(p) && p.features.includes(feature));
  return hit ? { key: hit.key, name: hit.name } : null;
}

/** Gói thấp nhất đang bán, chứa được số thành viên cho trước và cao hơn gói đang dùng (gợi ý khi chạm trần). */
export function nextPlanFor(plans: ReadonlyArray<Pick<PlanDef, 'key' | 'name' | 'memberCap'> & { prices?: PlanPrices }>, currentKey: PlanKey, members: number): { key: PlanKey; name: string } | null {
  const hit = [...plans].sort((a, b) => planRank(a.key) - planRank(b.key)).find((p) => planRank(p.key) > planRank(currentKey) && onSale(p) && (p.memberCap === null || p.memberCap > members));
  return hit ? { key: hit.key, name: hit.name } : null;
}

const priceSchema = z.number().int().min(0).max(1_000_000_000);
export const planPricesSchema = z.object({ monthly: priceSchema, quarterly: priceSchema, semiannual: priceSchema, yearly: priceSchema });

/** Quản trị lưu cả bảng gói một lần. Giá kỳ nào bằng 0 là không bán kỳ đó. */
export const savePlansSchema = z.object({
  plans: z.array(z.object({
    key: planKeySchema,
    prices: planPricesSchema,
    memberCap: z.number().int().min(1).max(10_000_000).nullable(),
    features: z.array(planFeatureSchema).max(PLAN_FEATURES.length),
  })).min(1).max(PLAN_KEYS.length),
});
export type SavePlansInput = z.infer<typeof savePlansSchema>;
