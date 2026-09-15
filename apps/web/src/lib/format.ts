// Định dạng ngày giờ và số cho giao diện tiếng Việt, hiển thị theo múi giờ người dùng (lưu UTC).
export { money } from '@hoiminh/ui';

const tz = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Asia/Ho_Chi_Minh'; }
};

export function d(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const v = input instanceof Date ? input : new Date(input);
  return Number.isNaN(v.getTime()) ? null : v;
}

/** 13/09/2026 */
export function fmtDate(input: string | Date | null | undefined): string {
  const v = d(input);
  return v ? v.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz() }) : '';
}
/** 13/09 */
export function fmtDayMonth(input: string | Date | null | undefined): string {
  const v = d(input);
  return v ? v.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: tz() }) : '';
}
/** 20:00 */
export function fmtTime(input: string | Date | null | undefined): string {
  const v = d(input);
  return v ? v.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: tz() }) : '';
}
/** 13/09, 09:12 */
export function fmtDateTime(input: string | Date | null | undefined): string {
  const v = d(input);
  return v ? `${fmtDayMonth(v)}, ${fmtTime(v)}` : '';
}
/** Thứ tư, 17 tháng 9, 2026 */
export function fmtLongDate(input: string | Date | null | undefined): string {
  const v = d(input);
  if (!v) return '';
  const s = v.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz() });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** 40 phút trước · Hôm qua · 3 ngày · 01/09 */
export function timeAgo(input: string | Date | null | undefined, short = false): string {
  const v = d(input);
  if (!v) return '';
  const diff = Date.now() - v.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return short ? `${m} phút` : `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return short ? `${h} giờ` : `${h} giờ trước`;
  const days = Math.round(h / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 7) return short ? `${days} ngày` : `${days} ngày trước`;
  return fmtDayMonth(v);
}
/** Số ngày còn lại tới mốc. */
export function daysUntil(input: string | Date | null | undefined): number | null {
  const v = d(input);
  return v ? Math.ceil((v.getTime() - Date.now()) / 86_400_000) : null;
}
/** 12:41 hoặc 1 giờ 24 phút */
export function fmtDuration(seconds: number | null | undefined, long = false): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (long) return h ? `${h} giờ ${m} phút` : `${m} phút`;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
/** 1,2k · 234 */
export function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')}k`;
  return String(n);
}
/** 18,7tr */
export function fmtShortMoney(amountMinor: number): string {
  if (amountMinor >= 1_000_000_000) return `${(amountMinor / 1e9).toFixed(2).replace('.', ',')} tỷ`;
  if (amountMinor >= 1_000_000) return `${(amountMinor / 1e6).toFixed(1).replace('.0', '').replace('.', ',')}tr`;
  return `${amountMinor.toLocaleString('vi-VN')}đ`;
}
export function pct(a: number, b: number): number {
  return b ? Math.round((a / b) * 100) : 0;
}
/** 1,4 MB · 820 KB */
export function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '';
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1).replace('.0', '').replace('.', ',')} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
