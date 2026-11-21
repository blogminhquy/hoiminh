// Bảng lọc khoảng ngày dùng chung (Tiền, Bàn điều khiển của chủ hội, Tổng quan hệ thống): tính khoảng ngày từ mốc
// bấm nhanh, đọc và viết ngày kiểu dd/mm/yyyy, dựng lưới lịch tháng, gom doanh thu theo ngày thành các cột của biểu đồ.
// Hàm thuần để test được. Ngày là ngày lịch giờ Việt Nam dạng YYYY-MM-DD, khoảng ngày tính cả hai đầu.
import { daySpan, isDay, shiftDay, weekdayMon, type DayRange } from '@hoiminh/contracts';

export type { DayRange };

export type PresetKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'lastMonth' | 'weekToDate' | 'monthToDate' | 'allTime';

/** Các mốc bấm nhanh, theo đúng thứ tự hiện trong bảng lọc. */
export const PRESETS: ReadonlyArray<{ key: PresetKey; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: 'last7', label: '7 ngày qua' },
  { key: 'last30', label: '30 ngày qua' },
  { key: 'last90', label: '90 ngày qua' },
  { key: 'lastMonth', label: 'Tháng trước' },
  { key: 'weekToDate', label: 'Đầu tuần đến nay' },
  { key: 'monthToDate', label: 'Đầu tháng đến nay' },
  { key: 'allTime', label: 'Từ trước đến nay' },
];

/** Ngày 01 của tháng chứa `day`. */
const monthStart = (day: string) => `${day.slice(0, 8)}01`;

/**
 * Khoảng ngày của một mốc, tính từ `today` (ngày hôm nay giờ Việt Nam).
 * "N ngày qua" tính cả hôm nay; "Tháng trước" là trọn tháng trước; tuần bắt đầu từ thứ Hai;
 * "Từ trước đến nay" không có ngày đầu.
 */
export function presetRange(key: PresetKey, today: string): DayRange {
  switch (key) {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const y = shiftDay(today, -1); return { from: y, to: y }; }
    case 'last7': return { from: shiftDay(today, -6), to: today };
    case 'last30': return { from: shiftDay(today, -29), to: today };
    case 'last90': return { from: shiftDay(today, -89), to: today };
    case 'lastMonth': { const last = shiftDay(monthStart(today), -1); return { from: monthStart(last), to: last }; }
    case 'weekToDate': return { from: shiftDay(today, -weekdayMon(today)), to: today };
    case 'monthToDate': return { from: monthStart(today), to: today };
    case 'allTime': return { from: null, to: today };
  }
}

/** Lựa chọn đang áp dụng: một mốc bấm nhanh (tính lại theo ngày hôm nay mỗi lần dùng), hoặc khoảng ngày tự chọn. */
export type RangeChoice = { preset: PresetKey } | { preset: null; from: string; to: string };

export function choiceRange(choice: RangeChoice, today: string): DayRange {
  return choice.preset ? presetRange(choice.preset, today) : { from: choice.from, to: choice.to };
}

/** 2026-10-08 thành 08/10/2026. */
export function fmtDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}
/** 2026-10-08 thành 08/10. */
export function fmtDayShort(day: string): string {
  return fmtDay(day).slice(0, 5);
}

/** Chữ trên nút mở bảng lọc: tên mốc, hoặc "08/10/2026 đến 20/11/2026" (một ngày thì chỉ "20/11/2026"). */
export function choiceLabel(choice: RangeChoice): string {
  if (choice.preset) return PRESETS.find((p) => p.key === choice.preset)?.label ?? '';
  return choice.from === choice.to ? fmtDay(choice.from) : `${fmtDay(choice.from)} đến ${fmtDay(choice.to)}`;
}

/** Chữ của một khoảng ngày bất kỳ: "08/10 đến 20/11", "20/11", hoặc "đến 20/11" khi không có ngày đầu. */
export function rangeLabelShort(range: DayRange): string {
  if (!range.from) return `đến ${fmtDayShort(range.to)}`;
  return range.from === range.to ? fmtDayShort(range.to) : `${fmtDayShort(range.from)} đến ${fmtDayShort(range.to)}`;
}

/** Query gửi API: `from=...&to=...`, hoặc chỉ `to=...` khi lấy từ trước đến nay. */
export function rangeQuery(range: DayRange): string {
  return range.from ? `from=${range.from}&to=${range.to}` : `to=${range.to}`;
}

/** Phần đuôi tên tệp xuất ra: "2026-10-08-den-2026-11-20", hoặc "tu-truoc-den-2026-11-20". */
export function rangeFileSuffix(range: DayRange): string {
  return `${range.from ?? 'tu-truoc'}-den-${range.to}`;
}

const PART_LENGTHS = [2, 2, 4] as const;

/**
 * Chỉnh chữ đang gõ trong ô ngày về dạng dd/mm/yyyy. Bàn phím số của điện thoại không có dấu "/",
 * nên gõ liền 08102026 cũng ra 08/10/2026; gõ 8/10/2026 thì giữ nguyên.
 */
export function maskDayInput(text: string): string {
  const tokens = text.split(/\D+/);
  const endsWithSeparator = /\D$/.test(text);
  const parts: string[] = [];
  for (const token of tokens) {
    let rest = token;
    while (rest && parts.length < PART_LENGTHS.length) {
      const max = PART_LENGTHS[parts.length]!;
      parts.push(rest.slice(0, max));
      rest = rest.slice(max);
    }
  }
  const out = parts.join('/');
  return endsWithSeparator && parts.length > 0 && parts.length < PART_LENGTHS.length ? `${out}/` : out;
}

/** Đọc ngày người dùng gõ (8/10/2026, 08-10-2026, 08.10.2026) thành 2026-10-08. Sai dạng hoặc ngày không có thật thì trả null. */
export function parseDayInput(text: string): string | null {
  const m = /^(\d{1,2})\D+(\d{1,2})\D+(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return isDay(day) ? day : null;
}

/** Tháng (YYYY-MM) chứa một ngày. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}
/** Cộng (hoặc trừ) số tháng: 2026-01 lùi 1 là 2025-12. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}
/** 2026-11 thành "Tháng 11, 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `Tháng ${m}, ${y}`;
}

/** Tên cột của lưới lịch, tuần bắt đầu từ thứ Hai. */
export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

/** Lưới lịch của một tháng: mỗi hàng là một tuần từ thứ Hai tới Chủ nhật, ô ngoài tháng là null. */
export function monthWeeks(month: string): Array<Array<string | null>> {
  const first = `${month}-01`;
  const days = daySpan(first, shiftDay(`${shiftMonth(month, 1)}-01`, -1));
  const cells: Array<string | null> = Array.from({ length: weekdayMon(first) }, () => null);
  for (let i = 0; i < days; i++) cells.push(shiftDay(first, i));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** "Thứ Bảy, 21/11/2026": tên đọc lên của một ô ngày. */
export function dayAriaLabel(day: string): string {
  const names = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
  return `${names[weekdayMon(day)]}, ${fmtDay(day)}`;
}

/**
 * Các cột của biểu đồ doanh thu trong một khoảng ngày. Khoảng ngắn thì mỗi cột một ngày; khoảng dài thì gom
 * `bucketDays` ngày liền nhau vào một cột để không quá `maxBars` cột (cột cuối luôn kết thúc ở ngày cuối của kỳ).
 * Lấy từ trước đến nay thì bắt đầu từ ngày có doanh thu đầu tiên.
 */
export function dailySeries(daily: ReadonlyArray<{ date: string; amountMinor: number }>, range: DayRange, maxBars = 31): { values: number[]; bucketDays: number; from: string; to: string } {
  const to = range.to;
  const earliest = daily.reduce<string | null>((min, x) => (min === null || x.date < min ? x.date : min), null);
  const start = range.from ?? earliest ?? to;
  const from = start > to ? to : start;
  const span = daySpan(from, to);
  const bucketDays = Math.ceil(span / maxBars);
  const values = Array.from({ length: Math.ceil(span / bucketDays) }, () => 0);
  for (const x of daily) {
    if (x.date < from || x.date > to) continue;
    const index = values.length - 1 - Math.floor((daySpan(x.date, to) - 1) / bucketDays);
    values[index] = (values[index] ?? 0) + x.amountMinor;
  }
  return { values, bucketDays, from, to };
}
