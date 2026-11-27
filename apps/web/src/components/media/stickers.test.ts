import { describe, expect, it } from 'vitest';
import { normalizeKeyword, suggestStickers } from './stickers';
import type { Sticker } from './types';

const s = (id: string, keywords: string[]): Sticker => ({ id, url: `/${id}.svg`, keywords });
const all = [s('chao', ['chào', 'xin chào', 'hello']), s('cam-on', ['cảm ơn', 'thanks']), s('ok', ['ok', 'được']), s('hoc', ['học', 'học bài']), s('hoi', ['hả?', 'ủa'])];

describe('gợi ý nhãn theo chữ đang gõ', () => {
  it('bỏ dấu, chữ hoa, dấu câu để so khớp', () => {
    expect(normalizeKeyword('  Cảm   ơn!! ')).toBe('cam on');
    expect(normalizeKeyword('Đợi xíu')).toBe('doi xiu');
  });

  it('khớp trọn câu, kể cả gõ không dấu', () => {
    expect(suggestStickers('Cảm ơn!', all).map((x) => x.id)).toEqual(['cam-on']);
    expect(suggestStickers('cam on', all).map((x) => x.id)).toEqual(['cam-on']);
    expect(suggestStickers('HELLO', all).map((x) => x.id)).toEqual(['chao']);
  });

  it('khớp từ cuối câu ngắn; khớp trọn câu xếp trước', () => {
    expect(suggestStickers('thôi ok', all).map((x) => x.id)).toEqual(['ok']);
    expect(suggestStickers('xin chào', [s('a', ['chào']), s('b', ['xin chào'])]).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('không gợi ý giữa câu, không khớp nửa chữ, không gợi ý câu dài', () => {
    expect(suggestStickers('ok để mình xem', all)).toEqual([]);
    expect(suggestStickers('học sinh', all)).toEqual([]);
    expect(suggestStickers('o', all)).toEqual([]);
    expect(suggestStickers('hôm nay trời đẹp quá mọi người ơi, cảm ơn', all)).toEqual([]);
    expect(suggestStickers('', all)).toEqual([]);
  });

  it('dấu hỏi trong từ khóa vẫn khớp', () => {
    expect(suggestStickers('Hả?', all).map((x) => x.id)).toEqual(['hoi']);
  });
});
