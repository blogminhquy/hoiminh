import { describe, expect, it } from 'vitest';
import { Avatar } from './primitives';

// Avatar là hàm thuần trả về phần tử React, nên đọc thẳng props.style, không cần dựng DOM.
const styleOf = (props: Parameters<typeof Avatar>[0]) => (Avatar(props).props as { style: Record<string, unknown> }).style;

describe('Avatar', () => {
  it('vẽ ảnh bằng background-image, không dùng background rút gọn', () => {
    // `background: url(...)` rút gọn đặt lại background-size/position về mặc định, xóa mất `cover`/`center`
    // của .avatar: ảnh 1254px hiện nguyên cỡ trong vòng tròn 40px và chỉ thấy góc trên-trái của ảnh.
    const style = styleOf({ name: 'Minh Quý', src: 'https://api.hoiminh.com/files/public/avatar/a.png', size: 40 });
    expect(style.backgroundImage).toBe('url("https://api.hoiminh.com/files/public/avatar/a.png")');
    expect(style).not.toHaveProperty('background');
    expect(style).not.toHaveProperty('backgroundSize');
    expect(style).not.toHaveProperty('backgroundPosition');
  });

  it('đặt URL trong dấu nháy để đường dẫn có khoảng trắng hay ngoặc không làm hỏng CSS', () => {
    const style = styleOf({ name: 'A', src: 'https://x.test/a b(1)"z.png' });
    expect(style.backgroundImage).toBe('url("https://x.test/a b(1)%22z.png")');
  });

  it('không có ảnh thì hiện chữ cái đầu trên nền màu', () => {
    const el = Avatar({ name: 'Minh Quý', color: '#D4593A', size: 40 });
    const style = (el.props as { style: Record<string, unknown> }).style;
    expect(style.backgroundColor).toBe('#D4593A');
    expect(style).not.toHaveProperty('backgroundImage');
    expect((el.props as { children: unknown }).children).toBe('MQ');
  });

  it('style truyền vào ghi đè được mặc định', () => {
    expect(styleOf({ name: 'A', src: 'https://x.test/a.png', style: { backgroundPosition: 'top' } }).backgroundPosition).toBe('top');
  });
});
