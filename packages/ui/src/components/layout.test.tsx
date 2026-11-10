import { describe, expect, it } from 'vitest';
import { T } from '../tokens';
import { Logo } from './layout';

// Logo là hàm thuần trả về phần tử React, nên đọc thẳng props.style, không cần dựng DOM.
const colorOf = (props: Parameters<typeof Logo>[0]) => (Logo(props).props as { style: { color: string } }).style.color;

describe('Logo', () => {
  it('trên nền thường dùng màu chữ chính, tự đổi theo giao diện sáng và tối', () => {
    expect(colorOf({})).toBe(T.ink);
  });

  it('trên nền luôn tối (light) dùng màu chữ sáng ở cả hai giao diện', () => {
    // T.surface ở giao diện tối là màu tối: chữ "Hội Mình" từng chìm vào nền tối của trang Tạo hội và Đăng nhập.
    expect(colorOf({ light: true })).toBe(T.invertInk);
    expect(colorOf({ light: true })).not.toBe(T.surface);
  });
});
