import { ORDER_VIEW_STATUSES, ORDER_VIEW_STATUS_LABEL } from '@hoiminh/contracts';
import { describe, expect, it } from 'vitest';
import { ORDER_AFFILIATE_FILTERS, ORDER_STATUS_FILTERS, ORDER_STATUS_ORDER, ORDER_STATUS_TONE, ORDER_TABS, commissionOf, orderCsvRows, orderMethod, orderTabOf, ordersQuery, type OrderItem } from './orders';

const order = (over: Partial<OrderItem> = {}): OrderItem => ({
  orderId: 'o1', reference: 'HM 8K2QX', createdAt: '2026-11-20T02:00:00.000Z', paidAt: '2026-11-20T02:05:00.000Z',
  customer: { name: 'Điền Phạm Ngọc', handle: 'dien', avatarUrl: null, coverColor: null },
  title: 'Premium · tháng', targetType: 'tier', method: 'sepay', provider: 'sepay', amountMinor: 249_000,
  status: 'paid', buyerSaysPaid: false, canConfirm: false, hasAffiliate: true, affiliateName: 'Hoàng Vũ', commissionMinor: 124_500, reversedCommissionMinor: 0, ...over,
});

describe('tab của trang Quản lý đơn hàng', () => {
  it('có hai tab, mặc định là Thống kê, tên lạ trên địa chỉ cũng về Thống kê', () => {
    expect(ORDER_TABS.map((t) => t.label)).toEqual(['Thống kê', 'Tất cả đơn hàng']);
    expect(orderTabOf(null)).toBe('thong-ke');
    expect(orderTabOf('thong-ke')).toBe('thong-ke');
    expect(orderTabOf('don-hang')).toBe('don-hang');
    expect(orderTabOf('la')).toBe('thong-ke');
  });
});

describe('bộ lọc đơn hàng', () => {
  it('ô trạng thái có Tất cả và đúng các trạng thái đang dùng, tên tiếng Việt', () => {
    expect(ORDER_STATUS_FILTERS.map((f) => f.label)).toEqual(['Tất cả trạng thái', 'Chờ xác nhận', 'Chờ thanh toán', 'Đã thanh toán', 'Hết hạn', 'Đã hoàn tiền']);
    expect(ORDER_AFFILIATE_FILTERS.map((f) => f.key)).toEqual(['', 'with', 'without']);
  });
  it('mọi trạng thái của API đều có tên, màu và chỗ trong thứ tự hiển thị', () => {
    for (const s of ORDER_VIEW_STATUSES) {
      expect(ORDER_VIEW_STATUS_LABEL[s], s).toBeTruthy();
      expect(ORDER_STATUS_TONE[s], s).toBeTruthy();
      expect(ORDER_STATUS_ORDER, s).toContain(s);
    }
  });
  it('query chỉ mang bộ lọc đang bật; từ trước đến nay thì không có from', () => {
    const none = { status: '', affiliate: '', q: '' } as const;
    expect(ordersQuery({ from: '2026-08-24', to: '2026-11-21' }, none)).toBe('from=2026-08-24&to=2026-11-21');
    expect(ordersQuery({ from: null, to: '2026-11-21' }, none)).toBe('to=2026-11-21');
    expect(ordersQuery({ from: null, to: '2026-11-21' }, { status: 'paid', affiliate: 'with', q: '  Thu Lan ' }, { limit: 30, cursor: 'abc' })).toBe('to=2026-11-21&status=paid&affiliate=with&q=Thu+Lan&limit=30&cursor=abc');
    expect(ordersQuery({ from: '2026-11-21', to: '2026-11-21' }, { status: 'awaiting_confirmation', affiliate: 'without', q: '' })).toBe('from=2026-11-21&to=2026-11-21&status=awaiting_confirmation&affiliate=without');
  });
});

describe('một dòng đơn', () => {
  it('tên phương thức thanh toán', () => {
    expect(orderMethod({ provider: 'sepay', method: 'sepay' })).toBe('Chuyển khoản');
    expect(orderMethod({ provider: 'momo', method: 'momo' })).toBe('MoMo');
    expect(orderMethod({ provider: 'cong-la', method: 'Ví lạ' })).toBe('Ví lạ');
    expect(orderMethod({ provider: '', method: '' })).toBe('Khác');
  });
  it('hoa hồng: đơn đã hoàn mà hoa hồng bị đảo thì báo số bị đảo', () => {
    expect(commissionOf(order())).toEqual({ minor: 124_500, reversed: false });
    expect(commissionOf(order({ status: 'refunded', commissionMinor: 0, reversedCommissionMinor: 124_500 }))).toEqual({ minor: 124_500, reversed: true });
    expect(commissionOf(order({ status: 'refunded', commissionMinor: 0, reversedCommissionMinor: 0 }))).toEqual({ minor: 0, reversed: false });
  });
  it('CSV có đủ cột, đơn chưa trả để trống ngày trả, đơn không qua affiliate để trống người giới thiệu', () => {
    const rows = orderCsvRows([order(), order({ orderId: 'o2', reference: 'HM M7ZP3', paidAt: null, status: 'awaiting_confirmation', hasAffiliate: false, affiliateName: null, commissionMinor: 0 })], (iso) => `[${iso.slice(0, 10)}]`);
    expect(rows[0]).toEqual(['Mã đơn', 'Ngày đặt', 'Ngày trả', 'Người mua', 'Sản phẩm', 'Phương thức', 'Số tiền', 'Người giới thiệu', 'Hoa hồng', 'Trạng thái']);
    expect(rows[1]).toEqual(['HM 8K2QX', '[2026-11-20]', '[2026-11-20]', 'Điền Phạm Ngọc', 'Premium · tháng', 'Chuyển khoản', '249000', 'Hoàng Vũ', '124500', 'Đã thanh toán']);
    expect(rows[2]).toEqual(['HM M7ZP3', '[2026-11-20]', '', 'Điền Phạm Ngọc', 'Premium · tháng', 'Chuyển khoản', '249000', '', '0', 'Chờ xác nhận']);
    expect(rows.every((r) => r.length === 10)).toBe(true);
  });
});
