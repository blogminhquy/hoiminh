// Gói Hội Mình ở phía web (kế hoạch 11/11/2026): bốn gói, mỗi gói cho một hội, hai chu kỳ 3 tháng và 1 năm.
// Hàm thuần dựng dữ liệu hiển thị cho thẻ ở Hội của tôi, trang chọn gói và màn nâng gói. Luật giá và ngày tặng
// nằm ở @hoiminh/contracts (API dùng chung), ở đây chỉ đổi kết quả đó ra chữ.
import { PLAN_CYCLE, PLAN_FEATURES, PLAN_FEATURE_LABEL, lowestPlanWith, planPerMonth, planPrice, planQuote, planRank, type PlanCycle, type PlanDef, type PlanFeature, type PlanKey, type PlanQuote } from '@hoiminh/contracts';
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

export const CYCLES: PlanCycle[] = ['quarterly', 'yearly'];
export const cycleLabel = (c: PlanCycle) => PLAN_CYCLE[c].label;

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

/** Bốn thẻ gói của trang chọn gói, theo chu kỳ đang chọn và tình trạng của hội. */
export function tierCards(plans: PlanDef[], current: HoiPlan, members: number, cycle: PlanCycle, now: Date): TierCard[] {
  const popularKey = plans.find((p) => p.key === 'pro') ? 'pro' : null;
  return plans.map((p) => {
    const free = p.key === 'free';
    const q = planQuote({ now, current: { key: current.key, endsAt: current.endsAt }, target: p, cycle, members });
    const total = planPrice(p.monthlyMinor, cycle);
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
      price: money(planPerMonth(p.monthlyMinor, cycle)),
      per: free ? 'mãi mãi' : 'mỗi tháng',
      sub: free ? 'Không cần thẻ, không hết hạn.' : cycle === 'yearly' ? `Trả ${money(total)} cho 1 năm, tặng 2 tháng.` : `Trả ${money(total)} cho 3 tháng.`,
      cap: capLabel(p.memberCap),
      popular: p.key === popularKey,
      state,
      cta,
      reason,
      features: tierFeatures(plans, p),
    };
  });
}

export interface CompareRow { label: string; cells: Array<{ text: string; tone: 'on' | 'off' | 'plain' }> }

/** Bảng so sánh đầy đủ bốn gói. */
export function compareRows(plans: PlanDef[]): CompareRow[] {
  const plain = (text: string) => ({ text, tone: 'plain' as const });
  const rows: CompareRow[] = [
    { label: 'Thành viên tối đa', cells: plans.map((p) => plain(p.memberCap === null ? 'Không giới hạn' : num(p.memberCap))) },
    { label: 'Giá niêm yết mỗi tháng', cells: plans.map((p) => plain(money(p.monthlyMinor))) },
    { label: 'Trả 3 tháng', cells: plans.map((p) => plain(money(planPrice(p.monthlyMinor, 'quarterly')))) },
    { label: 'Trả 1 năm', cells: plans.map((p) => plain(money(planPrice(p.monthlyMinor, 'yearly')))) },
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
