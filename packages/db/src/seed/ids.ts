// Id ổn định cho dữ liệu mẫu, để test E2E và tài liệu tham chiếu được.
import { stableId } from '@hoiminh/config';

const cache = new Map<string, string>();

/** Trả về uuid ổn định cho một khóa ("user:minhquy", "course:fmm"...). */
export async function sid(key: string): Promise<string> {
  let v = cache.get(key);
  if (!v) {
    v = await stableId(key);
    cache.set(key, v);
  }
  return v;
}

/** Tạo sẵn nhiều id cùng lúc. */
export async function sids<const K extends string>(keys: readonly K[]): Promise<Record<K, string>> {
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = await sid(k);
  return out;
}

/** Ngày lệch so với mốc, tính bằng ngày (có thể lẻ) + giờ tùy chọn. */
export function daysFrom(base: Date, days: number, hour?: number, minute = 0): Date {
  const d = new Date(base.getTime() + days * 86_400_000);
  if (hour !== undefined) d.setHours(hour, minute, 0, 0);
  return d;
}

/** Mốc thời gian seed: đầu ngày hôm nay theo giờ máy. */
export function seedBase(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Mật khẩu mặc định cho mọi tài khoản mẫu. */
export const SEED_PASSWORD = 'hoiminh123';
