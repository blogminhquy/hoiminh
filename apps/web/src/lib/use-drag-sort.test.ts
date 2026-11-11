import { describe, expect, it } from 'vitest';
import { moveItem, positionAfterMove, slotAt } from './use-drag-sort';

describe('kéo thả đổi thứ tự', () => {
  it('moveItem đưa một phần tử tới vị trí mới, các phần tử khác dồn lại', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('positionAfterMove khớp với moveItem ở mọi cặp vị trí', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    for (let from = 0; from < list.length; from++) {
      for (let to = 0; to < list.length; to++) {
        const moved = moveItem(list, from, to);
        list.forEach((item, i) => expect(positionAfterMove(i, from, to)).toBe(moved.indexOf(item)));
      }
    }
  });

  it('slotAt chọn ô gần con trỏ nhất, kể cả khi con trỏ nằm ở khe giữa hai ô', () => {
    // Lưới 3 cột, 2 hàng, mỗi ô 100 x 56, cách nhau 10.
    const rects = [0, 1, 2, 3, 4].map((i) => { const left = (i % 3) * 110; const top = Math.floor(i / 3) * 66; return { left, top, right: left + 100, bottom: top + 56 }; });
    expect(slotAt(rects, 50, 28)).toBe(0);
    expect(slotAt(rects, 270, 30)).toBe(2);
    expect(slotAt(rects, 160, 95)).toBe(4);
    expect(slotAt(rects, 104, 28)).toBe(0);
    expect(slotAt(rects, 107, 28)).toBe(1);
  });

  it('slotAt trả null khi con trỏ đã ra xa khỏi lưới, để thả ra thì ô về chỗ cũ', () => {
    const rects = [{ left: 0, top: 0, right: 100, bottom: 56 }, { left: 110, top: 0, right: 210, bottom: 56 }];
    expect(slotAt(rects, 105, -200)).toBeNull();
    expect(slotAt(rects, 600, 20)).toBeNull();
    expect(slotAt(rects, 240, 40)).toBe(1);
    expect(slotAt([], 0, 0)).toBeNull();
  });
});
