// Quản lý đơn hàng của hội: trạng thái hiển thị của một đơn và bộ lọc của danh sách đơn.
import { z } from 'zod';
import { RANGE_ORDER_ISSUE, dateRangeShape, isRangeOrdered } from './date-range';

/**
 * Trạng thái của một đơn như chủ hội nhìn thấy, gộp từ trạng thái đơn (`orders.status`) và trạng thái thanh toán:
 * - `awaiting_confirmation`: đơn chuyển khoản vào tài khoản chủ hội, đang chờ chủ hội bấm "Đã nhận tiền" (hoặc dịch vụ báo có gọi về).
 * - `awaiting_payment`: đơn qua cổng thanh toán, người mua chưa trả xong.
 * - `paid`, `refunded`, `expired`, `cancelled`: như tên.
 */
export const ORDER_VIEW_STATUSES = ['awaiting_payment', 'awaiting_confirmation', 'paid', 'expired', 'refunded', 'cancelled'] as const;
export const orderViewStatusSchema = z.enum(ORDER_VIEW_STATUSES);
export type OrderViewStatus = z.infer<typeof orderViewStatusSchema>;

/** Tên tiếng Việt của từng trạng thái, dùng chung cho web, CSV và MCP. */
export const ORDER_VIEW_STATUS_LABEL: Record<OrderViewStatus, string> = {
  awaiting_payment: 'Chờ thanh toán',
  awaiting_confirmation: 'Chờ xác nhận',
  paid: 'Đã thanh toán',
  expired: 'Hết hạn',
  refunded: 'Đã hoàn tiền',
  cancelled: 'Đã hủy',
};

/** Lọc theo người giới thiệu: `with` là đơn có affiliate, `without` là đơn không có. */
export const orderAffiliateFilterSchema = z.enum(['with', 'without']);
export type OrderAffiliateFilter = z.infer<typeof orderAffiliateFilterSchema>;

/**
 * Query của danh sách đơn hàng: khoảng ngày đặt đơn (giờ Việt Nam, tính cả hai đầu; chỉ `to` là từ trước đến nay),
 * trạng thái, có affiliate hay không, ô tìm (tên người mua, sản phẩm, mã đơn), số dòng mỗi trang và con trỏ trang kế.
 */
export const ordersQuerySchema = z
  .object({
    ...dateRangeShape,
    status: orderViewStatusSchema.optional(),
    affiliate: orderAffiliateFilterSchema.optional(),
    q: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(5000).default(30),
    cursor: z.string().max(200).optional(),
  })
  .refine(isRangeOrdered, RANGE_ORDER_ISSUE);
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
