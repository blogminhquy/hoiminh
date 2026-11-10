// Bàn điều khiển của chủ hội: dựng danh sách "Cần xử lý" từ số liệu thật (yêu cầu rút của cộng sự,
// người chờ duyệt vào hội, bài chờ duyệt, gói Hội Mình sắp hết hạn). Hàm thuần để test được, không gọi API ở đây.
import { money } from './format';

export interface OwnerPlan { status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'; endsAt: string | null; locked: boolean }
export interface OwnerTodoInput {
  slug: string;
  now: Date;
  /** null nghĩa là người xem không có quyền với việc đó (hoặc chưa tải xong), bỏ qua không hiện. */
  affiliatePayouts: { count: number; amountMinor: number } | null;
  pendingMembers: number | null;
  pendingPosts: number | null;
  plan: OwnerPlan | null;
}
export interface OwnerTodo { key: 'plan' | 'payouts' | 'members' | 'posts'; title: string; hint: string; to: string; label: string; urgent: boolean }

/** Số ngày còn lại tới một thời điểm, làm tròn lên. Đã qua thì trả 0. */
export function daysLeft(until: string | Date, now: Date): number {
  return Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / 86_400_000));
}

/** Gói Hội Mình chỉ thành việc cần làm khi đã hết hạn hoặc còn từ 7 ngày trở xuống. */
function planTodo(plan: OwnerPlan, now: Date): OwnerTodo | null {
  const to = '/admin/goi';
  if (plan.locked || plan.status === 'expired' || plan.status === 'past_due') {
    return { key: 'plan', title: 'Gói Hội Mình đã hết hạn', hint: 'Tạo nội dung đang tạm khóa, dữ liệu vẫn được giữ', to, label: 'Thanh toán', urgent: true };
  }
  if (!plan.endsAt || plan.status === 'cancelled') return null;
  const left = daysLeft(plan.endsAt, now);
  if (left > 7) return null;
  const when = left === 0 ? 'hôm nay' : `sau ${left} ngày`;
  if (plan.status === 'trialing') return { key: 'plan', title: `Dùng thử hết ${when}`, hint: 'Chọn gói để hội không bị khóa tạo nội dung', to, label: 'Chọn gói', urgent: left <= 2 };
  return { key: 'plan', title: `Gói Hội Mình hết hạn ${when}`, hint: 'Gia hạn để hội chạy liên tục', to, label: 'Gia hạn', urgent: left <= 2 };
}

/** Danh sách việc cần xử lý, việc gấp và việc dính tới tiền lên trước. Rỗng nghĩa là không có gì cần làm. */
export function buildOwnerTodos(input: OwnerTodoInput): OwnerTodo[] {
  const base = `/${input.slug}`;
  const out: OwnerTodo[] = [];
  const plan = input.plan ? planTodo(input.plan, input.now) : null;
  if (plan) out.push(plan);
  if (input.affiliatePayouts && input.affiliatePayouts.count > 0) {
    out.push({ key: 'payouts', title: `${input.affiliatePayouts.count} yêu cầu rút của cộng sự`, hint: `Cần chuyển ${money(input.affiliatePayouts.amountMinor)}`, to: `${base}/cong-su`, label: 'Xử lý', urgent: true });
  }
  if (input.pendingMembers && input.pendingMembers > 0) {
    out.push({ key: 'members', title: `${input.pendingMembers} người chờ duyệt vào hội`, hint: 'Xem câu trả lời rồi duyệt hoặc từ chối', to: `${base}/thanh-vien?trang-thai=pending`, label: 'Duyệt', urgent: false });
  }
  if (input.pendingPosts && input.pendingPosts > 0) {
    out.push({ key: 'posts', title: `${input.pendingPosts} bài chờ duyệt`, hint: 'Bài của thành viên mới, duyệt xong mới hiện lên bảng tin', to: `${base}/bang-tin`, label: 'Xem', urgent: false });
  }
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}
