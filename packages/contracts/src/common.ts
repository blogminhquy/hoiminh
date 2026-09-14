// Kiểu và schema dùng chung: id, phân trang cursor, lỗi chuẩn, tiền tệ.
import { z } from 'zod';

export const idSchema = z.string().uuid();
export const slugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Chỉ dùng chữ thường, số và dấu gạch ngang');
export const handleSchema = z.string().min(3).max(32).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
export const emailSchema = z.string().trim().toLowerCase().email();
export const currencySchema = z.enum(['VND', 'USD']);
export const amountMinorSchema = z.number().int().nonnegative();

/** Tham số phân trang theo cursor. */
export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

/** Kết quả phân trang. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Lỗi chuẩn của API: { code, message }. */
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const ERROR_CODES = [
  'unauthorized', 'forbidden', 'not_found', 'validation_error', 'conflict', 'rate_limited',
  'payment_error', 'insufficient_balance', 'invalid_state', 'plan_locked', 'internal_error',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Chu kỳ thanh toán. */
export const billingCycleSchema = z.enum(['monthly', 'yearly', 'one_time']);
export type BillingCycle = z.infer<typeof billingCycleSchema>;

/** Cổng thanh toán được hỗ trợ. */
export const paymentProviderSchema = z.enum(['sepay', 'momo', 'vnpay', 'paypal']);
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

/** Trạng thái thanh toán chuẩn hóa nội bộ (mục 34D). */
export const paymentStatusSchema = z.enum([
  'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded', 'expired',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/** Nhà cung cấp video nhúng ngoài. */
export const videoProviderSchema = z.enum(['youtube', 'tiktok', 'facebook', 'loom', 'vimeo', 'bunny']);
export type VideoProvider = z.infer<typeof videoProviderSchema>;

/** Chuẩn hóa chuỗi thành slug tiếng Việt không dấu. */
export function toSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
