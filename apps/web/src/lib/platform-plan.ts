// Gói Hội Mình ở phía web (kế hoạch 11/11/2026, sửa 21/11/2026): bốn gói, mỗi gói cho một hội, bốn kỳ trả tiền
// (1 tháng, 3 tháng, 6 tháng, 1 năm) với giá riêng từng kỳ. Kỳ nào có giá 0 thì không bán và không hiện ở đây.
// Hàm thuần dựng dữ liệu hiển thị cho thẻ ở Hội của tôi, trang chọn gói và màn nâng gói. Luật giá và ngày tặng
// nằm ở @hoiminh/contracts (API dùng chung), ở đây chỉ đổi kết quả đó ra chữ.
import { PLAN_CYCLE, PLAN_FEATURES, PLAN_FEATURE_LABEL, lowestPlanWith, planCyclesOf, planLowestPerMonth, planPerMonth, planPrice, planQuote, planRank, planSaving, planSells, soldCycles, type PlanCycle, type PlanDef, type PlanFeature, type PlanKey, type PlanQuote } from '@hoiminh/contracts';
import { fmtDate, money } from './format';

/** Số đầy đủ kiểu Việt Nam (5.000), không viết tắt thành 5k: trần thành viên phải đọc được chính xác. */
export const num = (n: number) => n.toLocaleString('vi-VN');

/** Gói đang có hiệu lực của một hội, như API trả về (ngày là chuỗi ISO). */
export interface HoiPlan {
  key: PlanKey;
  name: string;
  memberCap: number | null;
  features: PlanFeature[];
  endsAt: string | null;
  daysLeft: number;
  /** Gói đã mua gần nhất, kể cả khi đã hết hạn. */
  boughtKey: PlanKey;
  boughtEndsAt: string | null;
  isFreeSlot: boolean;
  /** Hội thứ hai trở đi mà chưa có gói trả phí còn hạn. */
  needsPlan: boolean;
  full: boolean;
}

export const cycleLabel = (c: PlanCycle) => PLAN_CYCLE[c].label;

/** Một kỳ của một gói rẻ hơn bao nhiêu so với kỳ ngắn nhất gói đang bán: "tiết kiệm 17%", hoặc rỗng. Luôn ghi phần trăm. */
export function savingText(plan: Pick<PlanDef, 'prices'>, cycle: PlanCycle): string {
  const s = planSaving(plan, cycle);
  return s ? `tiết kiệm ${s.percent}%` : '';
}

/**
 * Lời mời ghi cạnh tab của một kỳ, tính trên các gói trả phí đang bán kỳ đó: mọi gói lợi như nhau thì ghi đúng mức đó
 * ("tiết kiệm 17%"), khác nhau thì ghi mức cao nhất ("tiết kiệm tới 20%"), không gói nào lợi thì rỗng.
 */
export function cycleSaving(plans: PlanDef[], cycle: PlanCycle): string {
  const selling = plans.filter((p) => p.key !== 'free' && planSells(p, cycle));
  const texts = selling.map((p) => savingText(p, cycle));
  if (!texts.length || texts.every((t) => !t)) return '';
  if (texts.every((t) => t === texts[0])) return texts[0]!;
  const best = Math.max(...selling.map((p) => {
    const base = planCyclesOf(p)[0]!;
    return Math.round((1 - planPerMonth(p, cycle) / planPerMonth(p, base)) * 100);
  }));
  return best >= 1 ? `tiết kiệm tới ${best}%` : '';
}

/** Dòng chữ dưới các tab kỳ hạn: kỳ đang chọn trả thế nào, và kỳ dài nhất lợi hơn ra sao. */
export function cycleHint(plans: PlanDef[], cycle: PlanCycle): string {
  const here = cycleSaving(plans, cycle);
  const longest = soldCycles(plans).at(-1);
  const there = longest && longest !== cycle ? cycleSaving(plans, longest) : '';
  return `Trả ${cycleLabel(cycle)} một lần${here ? `, ${here}` : ''}.${there && longest ? ` Chọn ${cycleLabel(longest)}: ${there}.` : ''}`;
}

/** Giá của một gói ghi gọn trong một câu: "từ 82.500đ mỗi tháng" (nhiều kỳ, giá mỗi tháng khác nhau) hoặc "99.000đ mỗi tháng". */
export function priceLine(plan: Pick<PlanDef, 'prices'>): string {
  const low = planLowestPerMonth(plan);
  if (low === null) return '';
  const varied = planCyclesOf(plan).some((c) => planPerMonth(plan, c) !== low);
  return `${varied ? 'từ ' : ''}${money(low)} mỗi tháng`;
}

export interface PlanBadge { label: string; tone: 'gold' | 'accent' | 'teal' | 'muted'; note: string }

/** Nhãn trạng thái gói của một hội: dùng vĩnh viễn, còn N ngày, tới ngày nào, chờ thanh toán, đã hết hạn. */
export function planBadge(p: HoiPlan): PlanBadge {
  if (p.needsPlan) {
    return p.boughtKey !== 'free'
      ? { label: 'Gói đã hết hạn', tone: 'accent', note: 'Hội này cần gói trả phí để chạy tiếp. Thành viên và dữ liệu vẫn được giữ.' }
      : { label: 'Chờ thanh toán', tone: 'accent', note: 'Hội được mở ngay khi tiền gói về.' };
  }
  if (p.key === 'free') {
    const expired = p.boughtKey !== 'free';
    return { label: 'Dùng vĩnh viễn', tone: 'muted', note: expired ? `Gói trả phí đã hết hạn${p.boughtEndsAt ? ` ngày ${fmtDate(p.boughtEndsAt)}` : ''}, hội đang ở gói Miễn phí.` : '' };
  }
  if (p.daysLeft <= 7) return { label: p.daysLeft <= 0 ? 'Hết hạn hôm nay' : `Còn ${p.daysLeft} ngày`, tone: 'gold', note: 'Gia hạn trước ngày hết hạn thì số ngày mới được nối tiếp, không mất ngày nào.' };
  return { label: `Tới ${fmtDate(p.endsAt)}`, tone: 'teal', note: '' };
}

export interface CapView { text: string; percent: number; left: number | null; full: boolean; note: string }

/** Số thành viên so với trần của gói. */
export function capView(members: number, cap: number | null): CapView {
  if (cap === null) return { text: `${num(members)} thành viên`, percent: 0, left: null, full: false, note: 'Gói này không giới hạn thành viên.' };
  const left = Math.max(cap - members, 0);
  const full = members >= cap;
  return {
    text: `${num(members)} trên ${num(cap)}`,
    percent: Math.min(100, Math.round((members / cap) * 100)),
    left,
    full,
    note: full ? `Hội đã đủ ${num(cap)} thành viên. Người mới vẫn gửi yêu cầu được và nằm ở hàng chờ cho tới khi hội nâng gói.` : `Còn ${num(left)} chỗ. Đủ ${num(cap)} thì hội chưa nhận thêm người mới cho tới khi nâng gói.`,
  };
}

/** Tên tính năng đặt giữa câu: viết thường chữ đầu, trừ tên viết hoa toàn bộ như API. */
export function featureInline(f: PlanFeature): string {
  const label = PLAN_FEATURE_LABEL[f];
  return label === label.toLocaleUpperCase('vi') ? label : label.charAt(0).toLocaleLowerCase('vi') + label.slice(1);
}

/** Dòng thành viên trên thẻ bảng giá trang tạo hội: "Giới hạn 5.000 thành viên" đi cặp với "Không giới hạn thành viên". */
export const capHeadline = (cap: number | null) => (cap === null ? 'Không giới hạn thành viên' : `Giới hạn ${num(cap)} thành viên`);

export const capLabel = (cap: number | null) => (cap === null ? 'Không giới hạn thành viên' : `Tối đa ${num(cap)} thành viên`);

export interface TierFeature { text: string; on: boolean }
export interface TierCard {
  key: PlanKey;
  name: string;
  price: string;
  per: string;
  sub: string;
  cap: string;
  popular: boolean;
  /** 'current' = gói đang dùng (gói Miễn phí, không có gì để mua); 'buy' = mua, gia hạn hoặc nâng lên được; 'blocked' = chưa mua được. */
  state: 'current' | 'buy' | 'blocked';
  cta: string;
  /** Vì sao chưa mua được (state = blocked). */
  reason: string;
  features: TierFeature[];
}

function tierFeatures(plans: PlanDef[], p: PlanDef): TierFeature[] {
  const i = planRank(p.key);
  const below = plans[i - 1];
  const out: TierFeature[] = [];
  if (p.key === 'free') out.push({ text: 'Bán khóa học, sự kiện, sản phẩm và thu tiền', on: true });
  else if (below) out.push({ text: `Mọi thứ của gói ${below.name}`, on: true });
  out.push({ text: 'Không phí trên doanh thu', on: true });
  for (const f of PLAN_FEATURES) {
    const label = PLAN_FEATURE_LABEL[f];
    if (p.features.includes(f)) {
      // Gói dưới đã có thì đã nằm trong dòng "Mọi thứ của gói ...", không lặp lại.
      if (!below?.features.includes(f)) out.push({ text: label, on: true });
    } else {
      const from = lowestPlanWith(plans, f);
      out.push({ text: from ? `Có từ gói ${from.name}: ${featureInline(f)}` : label, on: false });
    }
  }
  return out;
}

/**
 * Các thẻ gói của trang chọn gói, theo kỳ đang chọn và tình trạng của hội. Gói trả phí không bán kỳ đang chọn
 * (giá của kỳ đó là 0) thì không có thẻ.
 */
export function tierCards(plans: PlanDef[], current: HoiPlan, members: number, cycle: PlanCycle, now: Date): TierCard[] {
  const popularKey = plans.find((p) => p.key === 'pro') ? 'pro' : null;
  return plans.filter((p) => p.key === 'free' || planSells(p, cycle)).map((p) => {
    const free = p.key === 'free';
    const q = planQuote({ now, current: { key: current.key, endsAt: current.endsAt }, target: p, cycle, members });
    const total = planPrice(p, cycle);
    const saving = savingText(p, cycle);
    const isCurrent = p.key === current.key && !current.needsPlan;
    let state: TierCard['state'] = 'buy';
    let cta = q.action === 'renew' ? `Gia hạn gói ${p.name}` : q.action === 'upgrade' ? `Nâng lên ${p.name}` : `Chọn gói ${p.name}`;
    let reason = '';
    if (free) {
      state = isCurrent ? 'current' : 'blocked';
      cta = isCurrent ? 'Gói đang dùng' : 'Gói Miễn phí';
      if (!isCurrent) reason = current.needsPlan ? 'Tài khoản đã dùng hội miễn phí cho một hội khác.' : 'Hội tự về gói Miễn phí khi gói trả phí hết hạn.';
    } else if (q.blocked === 'cap') {
      state = 'blocked';
      cta = 'Chưa mua được';
      reason = `Tối đa ${num(p.memberCap ?? 0)} thành viên, hội đang có ${num(members)}.`;
    } else if (q.blocked === 'lower') {
      state = 'blocked';
      cta = 'Chưa mua được';
      reason = `Hội đang ở gói ${current.name} và còn hạn. Mua được gói thấp hơn khi hết kỳ đang trả.`;
    }
    return {
      key: p.key,
      name: p.name,
      price: money(planPerMonth(p, cycle)),
      per: free ? 'mãi mãi' : 'mỗi tháng',
      sub: free ? 'Không cần thẻ, không hết hạn.' : `Trả ${money(total)} cho ${cycleLabel(cycle)}${saving ? `, ${saving}` : ''}.`,
      cap: capLabel(p.memberCap),
      popular: p.key === popularKey,
      state,
      cta,
      reason,
      features: tierFeatures(plans, p),
    };
  });
}

/** Một dòng tính năng trên thẻ gói của bảng giá. `from`: gói thấp nhất có tính năng đang khóa (null khi đã mở hoặc không gói nào có). */
export interface PlanFeatureRow { text: string; on: boolean; from: string | null }

/**
 * Danh sách tính năng trên thẻ gói ở bảng giá trang tạo hội. Thẻ nào cũng cùng các dòng, cùng thứ tự, cùng chữ; chỉ khác
 * dòng nào mở (dấu tích) và dòng nào khóa (ổ khóa). Nhờ vậy bốn thẻ đặt cạnh nhau thì từng dòng thẳng hàng, nhìn ngang là so được.
 */
export function planFeatureRows(plans: PlanDef[], p: PlanDef): PlanFeatureRow[] {
  const rows: PlanFeatureRow[] = [
    { text: 'Bán khóa học, sự kiện, sản phẩm và thu tiền', on: true, from: null },
    { text: 'Không phí trên doanh thu', on: true, from: null },
  ];
  for (const f of PLAN_FEATURES) {
    const on = p.features.includes(f);
    rows.push({ text: PLAN_FEATURE_LABEL[f], on, from: on ? null : lowestPlanWith(plans, f)?.name ?? null });
  }
  return rows;
}

/** Thẻ bảng giá: dòng đã mở (dấu tích) lên đầu, dòng khóa xuống cuối; trong mỗi nhóm giữ thứ tự gốc. */
export function openRowsFirst<R extends { on: boolean }>(rows: readonly R[]): R[] {
  return [...rows.filter((r) => r.on), ...rows.filter((r) => !r.on)];
}

export interface CompareRow { label: string; cells: Array<{ text: string; tone: 'on' | 'off' | 'plain' }> }

/** Bảng so sánh đầy đủ bốn gói. Mỗi kỳ đang bán một dòng giá; gói không bán kỳ đó thì ghi "Không bán". */
export function compareRows(plans: PlanDef[]): CompareRow[] {
  const plain = (text: string) => ({ text, tone: 'plain' as const });
  const rows: CompareRow[] = [
    { label: 'Thành viên tối đa', cells: plans.map((p) => plain(p.memberCap === null ? 'Không giới hạn' : num(p.memberCap))) },
    ...soldCycles(plans).map((c) => ({ label: `Trả ${cycleLabel(c)}`, cells: plans.map((p) => (p.key === 'free' ? plain(money(0)) : planSells(p, c) ? plain(money(planPrice(p, c))) : { text: 'Không bán', tone: 'off' as const })) })),
    { label: 'Bán hàng và thu tiền', cells: plans.map(() => ({ text: 'Có', tone: 'on' as const })) },
    { label: 'Phí trên doanh thu', cells: plans.map(() => plain('0%')) },
  ];
  for (const f of PLAN_FEATURES) rows.push({ label: PLAN_FEATURE_LABEL[f], cells: plans.map((p) => (p.features.includes(f) ? { text: 'Có', tone: 'on' as const } : { text: 'Khóa', tone: 'off' as const })) });
  return rows;
}

export interface UpgradeSummary {
  quote: PlanQuote;
  title: string;
  buyLabel: string;
  buyDays: string;
  /** Dòng ngày cộng thêm từ gói đang dùng; rỗng khi không có. */
  carryLabel: string;
  carryHint: string;
  carryDays: string;
  totalDays: string;
  endDate: string;
  price: string;
  note: string;
}

/** Màn nâng gói: số ngày mua, số ngày tặng từ gói cũ, tổng số ngày, ngày hết hạn, số tiền. */
export function upgradeSummary(current: HoiPlan, target: PlanDef, members: number, cycle: PlanCycle, now: Date): UpgradeSummary {
  const quote = planQuote({ now, current: { key: current.key, endsAt: current.endsAt }, target, cycle, members });
  const renew = quote.action === 'renew';
  const upgrade = quote.action === 'upgrade';
  const cap = target.memberCap === null ? 'Không giới hạn thành viên' : `Trần thành viên là ${num(target.memberCap)}`;
  return {
    quote,
    title: renew ? `Gia hạn gói ${target.name}` : upgrade ? `Nâng hội lên gói ${target.name}` : `Chọn gói ${target.name} cho hội`,
    buyLabel: `Gói ${target.name}, ${cycleLabel(cycle)}`,
    buyDays: `${quote.days} ngày`,
    carryLabel: quote.carryDays > 0 ? (renew ? `Nối tiếp: số ngày còn lại của kỳ đang trả` : `Tặng: số ngày còn lại của gói ${current.name}`) : '',
    carryHint: renew ? 'Gia hạn sớm không mất ngày nào' : 'Phần thưởng nâng gói, không quy thành tiền',
    carryDays: `+ ${quote.carryDays} ngày`,
    totalDays: `${quote.totalDays} ngày`,
    endDate: fmtDate(quote.endsAt),
    price: money(quote.amountMinor),
    note: renew
      ? 'Thời hạn mới được cộng nối vào ngày hết hạn hiện tại.'
      : `Gói mới có hiệu lực ngay khi tiền về. ${cap}${target.features.length ? `, các tính năng của gói ${target.name} mở khóa ngay` : ''}.`,
  };
}

/** Tên gói thấp nhất có một tính năng, để ghi trên ô bị khóa. */
export function featureFrom(plans: PlanDef[] | undefined, feature: PlanFeature): string {
  return (plans ? lowestPlanWith(plans, feature)?.name : null) ?? 'Chuyên nghiệp';
}
