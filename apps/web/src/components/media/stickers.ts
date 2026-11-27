// Danh sách nhãn dán (tải một lần, dùng chung cho mọi ô bình luận và ô chat) và gợi ý nhãn theo chữ đang gõ (như Zalo).
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Sticker, StickerList } from './types';

export const STICKERS_KEY = ['stickers'] as const;

export function useStickers() {
  const { user } = useAuth();
  return useQuery({ queryKey: STICKERS_KEY, queryFn: () => api.get<StickerList>('/v1/stickers'), enabled: Boolean(user), staleTime: 10 * 60_000 });
}

/** Chữ thường, bỏ dấu tiếng Việt, bỏ dấu câu ở hai đầu, gộp khoảng trắng: "Cảm ơn!!" và "cam on" so khớp được với nhau. */
export function normalizeKeyword(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s?]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chữ dài quá thì không gợi ý: người ta đang viết câu, không phải đang tìm nhãn. */
const MAX_TEXT = 30;

/**
 * Nhãn gợi ý cho chữ đang gõ: chữ trùng hẳn một từ khóa, hoặc kết thúc bằng một từ khóa (gõ "ok" hay "thôi ok" đều ra
 * nhãn OK). Khớp trọn từ, không khớp nửa chữ ("hoc" không ra nhãn "học" khi đang gõ "học sinh" dở dang... trừ khi
 * "học" là từ cuối). Nhãn khớp trọn câu xếp trước.
 */
export function suggestStickers(text: string, all: Sticker[], limit = 8): Sticker[] {
  const t = normalizeKeyword(text);
  if (!t || t.length > MAX_TEXT) return [];
  const exact: Sticker[] = [];
  const tail: Sticker[] = [];
  for (const s of all) {
    let hit: 'exact' | 'tail' | null = null;
    for (const k of s.keywords) {
      const n = normalizeKeyword(k);
      if (!n) continue;
      if (t === n) { hit = 'exact'; break; }
      if (t.endsWith(` ${n}`)) hit = 'tail';
    }
    if (hit === 'exact') exact.push(s);
    else if (hit === 'tail') tail.push(s);
  }
  return [...exact, ...tail].slice(0, limit);
}
