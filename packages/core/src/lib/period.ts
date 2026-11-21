// Kỳ số liệu: đổi khoảng ngày lịch (giờ Việt Nam, tính cả hai đầu) thành hai mốc thời gian để lọc trong SQL.
import { daySpan, resolveDayRange, shiftDay, vnDayStart, type DateRangeQuery } from '@hoiminh/contracts';
import { sql, type SQL } from 'drizzle-orm';

/** Nửa khoảng thời gian [start, end): `start` null là không có mốc đầu (từ trước đến nay). */
export interface Span {
  start: Date | null;
  end: Date;
}

export interface Period extends Span {
  /** Ngày đầu của kỳ (YYYY-MM-DD giờ Việt Nam), null khi lấy từ trước đến nay. */
  from: string | null;
  /** Ngày cuối của kỳ, tính cả ngày này. */
  to: string;
  /** Số ngày của kỳ, null khi lấy từ trước đến nay. */
  days: number | null;
  /** Kỳ liền trước có cùng số ngày, để so tăng giảm. Null khi lấy từ trước đến nay: không có gì để so. */
  prev: (Span & { start: Date }) | null;
}

/**
 * Chốt kỳ từ query của API. Kỳ chạy từ 00:00 giờ Việt Nam của ngày đầu tới hết ngày cuối
 * (mốc cuối là 00:00 của ngày kế tiếp, không tính chính mốc đó).
 */
export function resolvePeriod(q: DateRangeQuery, now: Date): Period {
  const { from, to } = resolveDayRange(q, now);
  const end = vnDayStart(shiftDay(to, 1));
  if (!from) return { from, to, days: null, start: null, end, prev: null };
  const days = daySpan(from, to);
  const start = vnDayStart(from);
  return { from, to, days, start, end, prev: { start: vnDayStart(shiftDay(from, -days)), end: start } };
}

/** Điều kiện SQL "cột thời gian nằm trong khoảng". `column` là tên cột viết sẵn trong mã, không nhận từ người dùng. */
export function inSpan(column: SQL, span: Span): SQL {
  return span.start ? sql`${column} >= ${span.start} and ${column} < ${span.end}` : sql`${column} < ${span.end}`;
}
