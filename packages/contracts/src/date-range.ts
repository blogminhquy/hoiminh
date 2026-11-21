// Khoảng ngày của các bộ lọc số liệu (Tiền, Bàn điều khiển của chủ hội, Tổng quan hệ thống).
// Ngày là ngày lịch theo giờ Việt Nam (UTC+7, không có giờ mùa hè), viết dạng YYYY-MM-DD, và khoảng ngày tính cả hai đầu.
// Hàm thuần dùng chung cho web (dựng bảng lọc) và máy chủ (đổi khoảng ngày thành mốc thời gian để truy vấn).
import { z } from 'zod';

export const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

/** Mốc UTC 00:00 của một ngày lịch (chỉ để làm phép tính ngày, chưa đổi sang giờ Việt Nam). */
function dayMs(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Chuỗi có đúng là một ngày lịch có thật dạng YYYY-MM-DD không (2026-02-30 là không). */
export function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = dayMs(value);
  return !Number.isNaN(ms) && dayOf(ms) === value;
}

/** Ngày lịch (YYYY-MM-DD) theo giờ Việt Nam của một thời điểm. */
export function vnDay(at: Date | string | number): string {
  return dayOf(new Date(at).getTime() + VN_OFFSET_MS);
}

/** Thời điểm 00:00 giờ Việt Nam của một ngày lịch. */
export function vnDayStart(day: string): Date {
  return new Date(dayMs(day) - VN_OFFSET_MS);
}

/** Cộng (hoặc trừ) số ngày vào một ngày lịch. */
export function shiftDay(day: string, n: number): string {
  return dayOf(dayMs(day) + n * DAY_MS);
}

/** Số ngày của khoảng, tính cả hai đầu: 2026-11-20 đến 2026-11-21 là 2 ngày. */
export function daySpan(from: string, to: string): number {
  return Math.round((dayMs(to) - dayMs(from)) / DAY_MS) + 1;
}

/** Thứ trong tuần, tuần bắt đầu từ thứ Hai: 0 là thứ Hai, 6 là Chủ nhật. */
export function weekdayMon(day: string): number {
  return (new Date(dayMs(day)).getUTCDay() + 6) % 7;
}

export const daySchema = z.string().refine(isDay, 'Ngày phải viết dạng YYYY-MM-DD, ví dụ 2026-11-21');

/** Ba tham số khoảng ngày, để các query khác (đơn hàng, doanh thu) ghép thêm bộ lọc riêng. */
export const dateRangeShape = {
  /** Ngày đầu (tính cả ngày này). Có `to` mà không có `from` là "từ trước đến nay". */
  from: daySchema.optional(),
  /** Ngày cuối (tính cả ngày này). Bỏ trống là hôm nay. */
  to: daySchema.optional(),
  /** Tham số cũ: N ngày gần nhất tính cả hôm nay. Chỉ dùng khi không gửi `from` và `to`. */
  days: z.coerce.number().int().min(1).max(3660).optional(),
};
/** Ngày đầu không được sau ngày cuối. Dùng với `.refine(isRangeOrdered, RANGE_ORDER_ISSUE)`. */
export const isRangeOrdered = (q: { from?: string; to?: string }) => !q.from || !q.to || q.from <= q.to;
export const RANGE_ORDER_ISSUE = { message: 'Ngày bắt đầu phải trước hoặc trùng ngày kết thúc', path: ['from'] };

/** Query của các API số liệu theo kỳ: `?from=2026-10-08&to=2026-11-20`, `?to=2026-11-20` (từ trước đến nay), hoặc `?days=30` (cũ). */
export const dateRangeQuerySchema = z.object(dateRangeShape).refine(isRangeOrdered, RANGE_ORDER_ISSUE);
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

/** Query của số liệu doanh thu: khoảng ngày kèm số dòng giao dịch gần đây muốn lấy (mặc định 50). */
export const revenueQuerySchema = z.object({ ...dateRangeShape, limit: z.coerce.number().int().min(1).max(5000).optional() }).refine(isRangeOrdered, RANGE_ORDER_ISSUE);
export type RevenueQuery = z.infer<typeof revenueQuerySchema>;

/** Khoảng ngày đã chốt. `from` là null khi lấy từ trước đến nay. */
export interface DayRange {
  from: string | null;
  to: string;
}

/** Số ngày mặc định khi không gửi tham số nào (giữ như trước: 30 ngày). */
export const DEFAULT_RANGE_DAYS = 30;

/**
 * Chốt khoảng ngày từ query. Thứ tự ưu tiên: `from`/`to` trước, rồi `days` cũ, không có gì thì 30 ngày gần nhất.
 * `days = N` là N ngày lịch gần nhất tính cả hôm nay, nên `days = 1` là đúng ngày hôm nay theo giờ Việt Nam.
 */
export function resolveDayRange(q: DateRangeQuery, now: Date): DayRange {
  const today = vnDay(now);
  if (q.from || q.to) return { from: q.from ?? null, to: q.to ?? today };
  return { from: shiftDay(today, -((q.days ?? DEFAULT_RANGE_DAYS) - 1)), to: today };
}
