// Quản lý đơn hàng của hội (/:slug/tien): kiểu dữ liệu của API, tên và màu của từng trạng thái, dựng query từ bộ lọc,
// dựng các dòng CSV. Hàm thuần để test được; phần vẽ nằm ở pages/community/Money.tsx và OrdersParts.tsx.
import { ORDER_VIEW_STATUS_LABEL, type OrderAffiliateFilter, type OrderViewStatus } from '@hoiminh/contracts';
import { rangeQuery, type DayRange } from './date-range';

export interface OrderItem {
  orderId: string; reference: string; createdAt: string; paidAt: string | null;
  customer: { name: string; handle: string; avatarUrl: string | null; coverColor: string | null };
  title: string; targetType: string; method: string; provider: string; amountMinor: number;
  status: OrderViewStatus; buyerSaysPaid: boolean; canConfirm: boolean;
  hasAffiliate: boolean; affiliateName: string | null; commissionMinor: number; reversedCommissionMinor: number;
}
export interface OrdersPage { range: DayRange; total: number; totalMinor: number; items: OrderItem[]; nextCursor: string | null }

/** Hai tab của trang, tên nằm trên địa chỉ (`?tab=`) để tải lại hay gửi link vẫn đúng tab. */
export const ORDER_TABS = [{ key: 'thong-ke', label: 'Thống kê' }, { key: 'don-hang', label: 'Tất cả đơn hàng' }] as const;
export type OrderTab = (typeof ORDER_TABS)[number]['key'];
export function orderTabOf(param: string | null): OrderTab {
  return param === 'don-hang' ? 'don-hang' : 'thong-ke';
}

/** Các lựa chọn của ô lọc trạng thái, theo thứ tự việc cần làm trước. Chuỗi rỗng là tất cả. */
export const ORDER_STATUS_FILTERS: ReadonlyArray<{ key: OrderViewStatus | ''; label: string }> = [
  { key: '', label: 'Tất cả trạng thái' },
  ...(['awaiting_confirmation', 'awaiting_payment', 'paid', 'expired', 'refunded'] as const).map((key) => ({ key, label: ORDER_VIEW_STATUS_LABEL[key] })),
];
export const ORDER_AFFILIATE_FILTERS: ReadonlyArray<{ key: OrderAffiliateFilter | ''; label: string }> = [
  { key: '', label: 'Affiliate: tất cả' },
  { key: 'with', label: 'Có người giới thiệu' },
  { key: 'without', label: 'Không có người giới thiệu' },
];

/** Màu nhãn của từng trạng thái: việc đang chờ chủ hội thì nổi nhất. */
export const ORDER_STATUS_TONE: Record<OrderViewStatus, 'accent' | 'teal' | 'gold' | 'neutral' | 'danger'> = {
  awaiting_confirmation: 'accent', awaiting_payment: 'gold', paid: 'teal', expired: 'neutral', refunded: 'danger', cancelled: 'neutral',
};
/** Thứ tự hiện số đơn theo trạng thái ở tab Thống kê. Đơn đã hủy chỉ hiện khi có. */
export const ORDER_STATUS_ORDER: readonly OrderViewStatus[] = ['paid', 'awaiting_confirmation', 'awaiting_payment', 'expired', 'refunded', 'cancelled'];

const METHOD: Record<string, string> = { sepay: 'Chuyển khoản', momo: 'MoMo', vnpay: 'VNPAY', paypal: 'PayPal', stripe: 'Thẻ' };
/** Tên phương thức thanh toán của một đơn. */
export function orderMethod(o: Pick<OrderItem, 'provider' | 'method'>): string {
  return METHOD[o.provider] ?? (o.method || 'Khác');
}

export interface OrderFilters { status: OrderViewStatus | ''; affiliate: OrderAffiliateFilter | ''; q: string }

/** Query gửi API danh sách đơn: khoảng ngày kèm các bộ lọc đang bật, số dòng và con trỏ trang kế. */
export function ordersQuery(range: DayRange, f: OrderFilters, page: { limit?: number; cursor?: string } = {}): string {
  const p = new URLSearchParams(rangeQuery(range));
  if (f.status) p.set('status', f.status);
  if (f.affiliate) p.set('affiliate', f.affiliate);
  if (f.q.trim()) p.set('q', f.q.trim());
  if (page.limit) p.set('limit', String(page.limit));
  if (page.cursor) p.set('cursor', page.cursor);
  return p.toString();
}

/** Số tiền hoa hồng hiện trên một đơn: đơn đã hoàn mà hoa hồng bị đảo thì báo số bị đảo. */
export function commissionOf(o: Pick<OrderItem, 'status' | 'commissionMinor' | 'reversedCommissionMinor'>): { minor: number; reversed: boolean } {
  return o.status === 'refunded' && o.reversedCommissionMinor > 0 ? { minor: o.reversedCommissionMinor, reversed: true } : { minor: o.commissionMinor, reversed: false };
}

/** Các dòng của tệp CSV xuất ra. `when` viết ngày giờ theo cách của giao diện (để hàm này không phụ thuộc múi giờ của máy). */
export function orderCsvRows(items: OrderItem[], when: (iso: string) => string): string[][] {
  return [
    ['Mã đơn', 'Ngày đặt', 'Ngày trả', 'Người mua', 'Sản phẩm', 'Phương thức', 'Số tiền', 'Người giới thiệu', 'Hoa hồng', 'Trạng thái'],
    ...items.map((o) => [o.reference, when(o.createdAt), o.paidAt ? when(o.paidAt) : '', o.customer.name, o.title, orderMethod(o), String(o.amountMinor), o.affiliateName ?? '', String(commissionOf(o).reversed ? 0 : o.commissionMinor), ORDER_VIEW_STATUS_LABEL[o.status]]),
  ];
}
