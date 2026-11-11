// Bàn điều khiển của chủ hội: dựng danh sách "Cần xử lý" từ số liệu thật (yêu cầu rút của cộng sự,
// người chờ duyệt vào hội, bài chờ duyệt, gói của hội sắp hết hạn hoặc đã chạm trần thành viên). Hàm thuần để test được, không gọi API ở đây.
import { money } from './format';

/** Gói đang có hiệu lực của hội đang mở (lấy từ khung hội). */
export interface OwnerPlan { key: string; name: string; endsAt: string | null; memberCap: number | null; needsPlan: boolean; full: boolean }
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

/** Gói của hội thành việc cần làm khi: hội chưa có gói, hội đã chạm trần thành viên, hoặc gói trả phí còn từ 7 ngày trở xuống. */
function planTodo(plan: OwnerPlan, slug: string, now: Date): OwnerTodo | null {
  const to = `/admin/goi?hoi=${slug}`;
  if (plan.needsPlan) return { key: 'plan', title: 'Hội chưa có gói', hint: 'Hội thứ hai trở đi cần gói trả phí để chạy, dữ liệu vẫn được giữ', to, label: 'Chọn gói', urgent: true };
  if (plan.full) return { key: 'plan', title: `Hội đã đủ ${(plan.memberCap ?? 0).toLocaleString('vi-VN')} thành viên của gói ${plan.name}`, hint: 'Người mới đang nằm ở hàng chờ, nâng gói để nhận thêm', to, label: 'Nâng gói', urgent: true };
  if (plan.key === 'free' || !plan.endsAt) return null;
  const left = daysLeft(plan.endsAt, now);
  if (left > 7) return null;
  const when = left === 0 ? 'hôm nay' : `sau ${left} ngày`;
  return { key: 'plan', title: `Gói ${plan.name} hết hạn ${when}`, hint: 'Gia hạn để giữ trần thành viên và tính năng của gói', to, label: 'Gia hạn', urgent: left <= 2 };
}

/** Danh sách việc cần xử lý, việc gấp và việc dính tới tiền lên trước. Rỗng nghĩa là không có gì cần làm. */
export function buildOwnerTodos(input: OwnerTodoInput): OwnerTodo[] {
  const base = `/${input.slug}`;
  const out: OwnerTodo[] = [];
  const plan = input.plan ? planTodo(input.plan, input.slug, input.now) : null;
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
