// Gói Hội Mình của một workspace: gom trạng thái (dùng thử, đang chạy, sắp kết thúc, quá hạn, bị khóa) thành
// chữ hiển thị. Hàm thuần để test được; thẻ gói ở "Hội của tôi" và trang /admin/goi dùng chung một nguồn.
import { fmtDate, money } from './format';
import { daysLeft } from './owner-todo';

export type Cycle = 'monthly' | 'yearly';
export interface PlanPrice {
  key: string; name: string; monthlyMinor: number; yearlyMinor: number;
  /** 'gateway' (mặc định) = thanh toán trong Hội Mình; 'link' = mở link của hệ thống thanh toán ngoài. */
  paymentMode?: 'gateway' | 'link';
  monthlyPayUrl?: string | null;
  yearlyPayUrl?: string | null;
}
export interface PlanInput {
  sub: { status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'; billingCycle: Cycle; currentPeriodEnd: string; cancelAtPeriodEnd: boolean } | null;
  trialEndsAt: string | null;
  /** Workspace đang bị khóa tạo nội dung (contentLockedAt). */
  locked: boolean;
  now: Date;
}
export interface PlanView {
  state: 'trial' | 'active' | 'ending' | 'overdue' | 'locked';
  /** Chu kỳ đang dùng; đang dùng thử thì coi là theo tháng. */
  cycle: Cycle;
  /** "Dùng thử", "Gói tháng", "Gói năm". */
  name: string;
  /** Nhãn trạng thái ngắn: "Còn 3 ngày", "Đang hoạt động", "Đã hết hạn"... */
  badge: string;
  /** Mốc thời gian, viết thường để ghép được vào giữa câu: "đến 14/11/2026", "hết hạn 01/10/2026". Không có mốc thì rỗng. */
  when: string;
  /** Lời nhắc khi cần chủ hội làm gì đó, null khi mọi thứ ổn. */
  warn: string | null;
  /** Người dùng cần trả tiền ngay (dùng thử, quá hạn, bị khóa) hay chỉ vào xem và gia hạn. */
  needsPayment: boolean;
}

export function planView({ sub, trialEndsAt, locked, now }: PlanInput): PlanView {
  const trial = !sub || sub.status === 'trialing';
  const cycle: Cycle = !trial && sub.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const name = trial ? 'Dùng thử' : cycle === 'yearly' ? 'Gói năm' : 'Gói tháng';
  const end = sub?.currentPeriodEnd ?? trialEndsAt;
  const date = end ? fmtDate(end) : '';
  const base = { cycle, name };

  if (locked || sub?.status === 'expired' || sub?.status === 'past_due') {
    return { ...base, state: 'locked', badge: 'Đã hết hạn', when: date ? `hết hạn ${date}` : '', warn: 'Tạo nội dung đang tạm khóa, dữ liệu vẫn được giữ. Thanh toán để mở lại.', needsPayment: true };
  }
  const passed = end ? new Date(end).getTime() <= now.getTime() : false;
  if (passed) {
    return { ...base, state: 'overdue', badge: 'Đã hết hạn', when: `hết hạn ${date}`, warn: 'Thanh toán để hội không bị khóa tạo nội dung.', needsPayment: true };
  }
  const left = end ? daysLeft(end, now) : null;
  const soon = left !== null && left <= 7;
  if (trial) {
    return { ...base, state: 'trial', badge: left !== null ? `Còn ${left} ngày` : 'Đang dùng thử', when: date ? `đến ${date}` : '', warn: soon ? 'Chọn gói trước ngày này để hội không bị khóa tạo nội dung.' : null, needsPayment: true };
  }
  if (sub.cancelAtPeriodEnd || sub.status === 'cancelled') {
    return { ...base, state: 'ending', badge: 'Sắp kết thúc', when: `kết thúc ${date}`, warn: 'Gói sẽ không gia hạn. Thanh toán để dùng tiếp sau ngày này.', needsPayment: false };
  }
  return { ...base, state: 'active', badge: soon ? `Còn ${left} ngày` : 'Đang hoạt động', when: `dùng đến ${date}`, warn: soon ? 'Gia hạn sớm để hội chạy liên tục, thời hạn được cộng nối.' : null, needsPayment: false };
}

/** "499.000đ/tháng" hoặc "4.990.000đ/năm". */
export function priceLabel(plan: PlanPrice, cycle: Cycle): string {
  return cycle === 'yearly' ? `${money(plan.yearlyMinor)}/năm` : `${money(plan.monthlyMinor)}/tháng`;
}

/** Lợi của gói năm so với trả 12 tháng: "2 tháng miễn phí" khi chia chẵn, không thì số tiền tiết kiệm. Không lợi thì null. */
export function yearlySaving(plan: PlanPrice): string | null {
  const saving = plan.monthlyMinor * 12 - plan.yearlyMinor;
  if (plan.monthlyMinor <= 0 || saving <= 0) return null;
  const months = saving / plan.monthlyMinor;
  return Number.isInteger(months) ? `${months} tháng miễn phí` : `Tiết kiệm ${money(saving)}`;
}

/** Gói mà máy chủ sẽ tính tiền cho workspace này (theo planKey), không phải gói đầu danh sách. */
export function pickPlan<P extends PlanPrice>(plans: P[] | undefined, planKey: string | undefined): P | null {
  if (!plans?.length) return null;
  return plans.find((p) => p.key === planKey) ?? plans[0] ?? null;
}

/** Chu kỳ đang bán: thanh toán trong Hội Mình thì cả hai; link ngoài thì chỉ chu kỳ nào quản trị đã cài link. */
export function payCycles(plan: PlanPrice): Cycle[] {
  if (plan.paymentMode !== 'link') return ['monthly', 'yearly'];
  const out: Cycle[] = [];
  if (plan.monthlyPayUrl) out.push('monthly');
  if (plan.yearlyPayUrl) out.push('yearly');
  return out;
}

/**
 * Link thanh toán ngoài của một chu kỳ, đã điền `{workspace_id}`, `{email}`, `{cycle}`. Link không ghi `{workspace_id}`
 * thì tự thêm `hm_ws` và `hm_cycle` vào cuối, để hệ thống ngoài luôn biết hội nào trả. Gói không ở chế độ link
 * hoặc chu kỳ chưa có link thì trả null.
 */
export function externalPayUrl(plan: PlanPrice, cycle: Cycle, who: { workspaceId: string; email: string }): string | null {
  if (plan.paymentMode !== 'link') return null;
  const template = cycle === 'yearly' ? plan.yearlyPayUrl : plan.monthlyPayUrl;
  if (!template) return null;
  const values: Record<string, string> = { workspace_id: who.workspaceId, email: who.email, cycle };
  const filled = template.replace(/\{(workspace_id|email|cycle)\}/g, (_, k: string) => encodeURIComponent(values[k] ?? ''));
  if (template.includes('{workspace_id}')) return filled;
  try {
    const url = new URL(filled);
    url.searchParams.set('hm_ws', who.workspaceId);
    url.searchParams.set('hm_cycle', cycle);
    return url.toString();
  } catch {
    return filled;
  }
}
