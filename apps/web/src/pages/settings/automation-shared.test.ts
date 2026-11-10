import { describe, expect, it } from 'vitest';
import { fieldChoices, normalizeTag, splitTags } from './automation-shared';

describe('normalizeTag', () => {
  it('cho ra đúng tên máy chủ sẽ lưu', () => {
    expect(normalizeTag(' Paid ')).toBe('paid');
    expect(normalizeTag('Order Placed')).toBe('order_placed');
    expect(normalizeTag('Đã thanh toán')).toBe('da_thanh_toan');
    expect(normalizeTag('!!!')).toBe('');
  });
});

describe('splitTags', () => {
  it('tách theo dấu phẩy, bỏ trùng và bỏ thẻ rỗng', () => {
    expect(splitTags('paid, Paid; order placed,,')).toEqual(['paid', 'order_placed']);
    expect(splitTags('   ')).toEqual([]);
  });
});

describe('fieldChoices', () => {
  it('gộp phần tử mảng về trường cha để chọn cả danh sách thẻ', () => {
    expect(fieldChoices({ 'data.email': 'a@example.com', 'data.tags.0': 'paid', 'data.tags.1': 'vip' })).toEqual([
      { path: 'data.email', sample: 'a@example.com' },
      { path: 'data.tags', sample: 'paid, vip' },
    ]);
  });
  it('cắt ngắn giá trị mẫu quá dài', () => {
    expect(fieldChoices({ note: 'x'.repeat(80) })[0]!.sample).toHaveLength(49);
  });
});
