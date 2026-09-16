// Token thiết kế lấy nguyên từ design/build.mjs: bảng màu giấy ấm, nhấn cam đất và xanh ngọc, 8 nền status.
//
// HEX = giá trị thật của giao diện sáng. Chỉ dùng khi màu phải là một chuỗi màu thật:
// giá trị lưu vào database (coverColor của hội, khóa học, sự kiện) và thuộc tính SVG
// (fill/stroke không hiểu var()).
export const HEX = {
  bg: '#F7F3EC',
  surface: '#FFFDF9',
  ink: '#1F1B17',
  ink2: '#5C554D',
  ink3: '#8C8478',
  line: '#E8E1D6',
  line2: '#E3DCD0',
  accent: '#D4593A',
  accentSoft: '#FBE9E2',
  accentText: '#9C3A21',
  teal: '#0E8E96',
  tealSoft: '#DDF1F1',
  tealText: '#0B6F75',
  side: '#25201B',
  sideDark: '#14110E',
  sideText: '#CFC6B8',
  sideMuted: '#8C8478',
  gold: '#C89B3C',
  goldSoft: '#F8EFD9',
  goldText: '#8A6A1E',
  goldDark: '#5C4A16',
  player: '#171310',
} as const;

/**
 * T = cùng bộ token nhưng trỏ tới biến CSS, nên mọi `style={{ color: T.ink }}` tự đổi
 * theo giao diện sáng/tối mà không phải sửa 1.100 chỗ dùng. Biến được khai báo ở
 * styles.css cho cả hai giao diện.
 */
export const T = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  ink: 'var(--ink)',
  ink2: 'var(--ink2)',
  ink3: 'var(--ink3)',
  line: 'var(--line)',
  line2: 'var(--line2)',
  accent: 'var(--accent)',
  accentSoft: 'var(--accent-soft)',
  accentText: 'var(--accent-text)',
  teal: 'var(--teal)',
  tealSoft: 'var(--teal-soft)',
  tealText: 'var(--teal-text)',
  side: 'var(--side)',
  sideDark: 'var(--side-dark)',
  sideText: 'var(--side-text)',
  sideMuted: 'var(--side-muted)',
  gold: 'var(--gold)',
  goldSoft: 'var(--gold-soft)',
  goldText: 'var(--gold-text)',
  goldDark: 'var(--gold-dark)',
  player: 'var(--player)',
  /** Nền và chữ của thẻ nhấn nền tối: tối/sáng cố định ở cả hai giao diện. */
  invertBg: 'var(--invert-bg)',
  /** Chữ đặt trên nền màu cố định (ảnh bìa, badge accent, sidebar, player) — luôn gần trắng. */
  invertInk: 'var(--invert-ink)',
} as const;

/** Ba lựa chọn giao diện; 'system' theo cài đặt của máy. */
export type ThemeChoice = 'light' | 'dark' | 'system';
export const THEME_KEY = 'hm_theme';

/** Gắn giao diện lên thẻ <html>. Gọi sớm (trước khi React render) để không bị nháy sáng. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/** Đọc lựa chọn đã lưu; hỏng hoặc chưa có thì theo hệ thống. */
export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export const FONT_DISPLAY = "Montserrat, 'Segoe UI', Arial, sans-serif";
export const FONT_SANS = "'Open Sans', 'Segoe UI', system-ui, sans-serif";

/** 8 nền màu cho status ngắn (< 130 ký tự, không ảnh). */
export const STATUS_BGS = [
  { key: 'dat', css: 'linear-gradient(135deg, #D4593A 0%, #B23A6E 100%)', fg: '#FFFDF9' },
  { key: 'ngoc', css: 'linear-gradient(135deg, #0E8E96 0%, #1F4E79 100%)', fg: '#FFFDF9' },
  { key: 'nau', css: '#25201B', fg: '#F2C46B' },
  { key: 'vang', css: 'linear-gradient(135deg, #E0B458 0%, #D4593A 100%)', fg: '#1F1B17' },
  { key: 'tim', css: 'linear-gradient(135deg, #5C3E7A 0%, #3E5C7A 100%)', fg: '#FFFDF9' },
  { key: 'la', css: 'linear-gradient(135deg, #5C7A3E 0%, #0E8E96 100%)', fg: '#FFFDF9' },
  { key: 'giay', css: 'radial-gradient(#DDD4C4 1.2px, transparent 1.2px) 0 0 / 18px 18px, #F7F3EC', fg: '#1F1B17' },
  { key: 'hoang', css: 'linear-gradient(160deg, #F2C46B 0%, #D4593A 55%, #6B2D3A 100%)', fg: '#FFFDF9' },
] as const;
export type StatusBgKey = (typeof STATUS_BGS)[number]['key'];

export function statusBg(key: string | null | undefined) {
  return STATUS_BGS.find((b) => b.key === key) ?? null;
}

/** Màu thẻ chuyên mục theo colorKey. */
export const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  accent: { bg: T.accentSoft, fg: T.accentText },
  teal: { bg: T.tealSoft, fg: T.tealText },
  gold: { bg: T.goldSoft, fg: T.goldText },
  neutral: { bg: T.bg, fg: T.ink2 },
};

/** Màu avatar mặc định khi người dùng chưa có ảnh (bảng màu demo). */
export const AVATAR_COLORS = ['#7A5C3E', '#3E5C7A', '#5C7A3E', '#5C3E7A', '#0E8E96', '#D4593A', '#C89B3C', '#1F1B17'];

export function avatarColor(seed: string | null | undefined, fallback?: string | null): string {
  if (fallback) return fallback;
  let h = 0;
  for (const ch of seed ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

/** Chữ cái đầu cho avatar: "Điền Phạm Ngọc" → "ĐN". */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
