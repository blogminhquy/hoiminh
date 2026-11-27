// "Gần đây" trong khung chọn nhãn dán, emoji, GIF: lưu trên máy người dùng (mỗi trình duyệt một danh sách).
// Trình duyệt chặn bộ nhớ (chế độ ẩn danh, chặn dữ liệu trang) thì danh sách trống, khung chọn vẫn chạy bình thường.
import type { GifItem, Sticker } from './types';

type Kinds = { emoji: string; sticker: Sticker; gif: GifItem };
const LIMIT: Record<keyof Kinds, number> = { emoji: 24, sticker: 16, gif: 12 };
const key = (k: keyof Kinds) => `hm_recent_${k}`;
const idOf = (v: unknown) => (typeof v === 'string' ? v : (v as { id: string }).id);

export function readRecent<K extends keyof Kinds>(kind: K): Kinds[K][] {
  try {
    const raw = localStorage.getItem(key(kind));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as Kinds[K][]) : [];
  } catch {
    return [];
  }
}

/** Đưa lên đầu danh sách "Gần đây"; trả danh sách mới. */
export function pushRecent<K extends keyof Kinds>(kind: K, item: Kinds[K]): Kinds[K][] {
  const next = [item, ...readRecent(kind).filter((x) => idOf(x) !== idOf(item))].slice(0, LIMIT[kind]);
  try { localStorage.setItem(key(kind), JSON.stringify(next)); } catch { /* bộ nhớ bị chặn: bỏ qua */ }
  return next;
}
