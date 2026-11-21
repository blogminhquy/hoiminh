import { describe, expect, it } from 'vitest';
import { guestCanOpen, guestHome } from './guest';

describe('guestCanOpen', () => {
  it('khách mở được các trang chỉ đọc của hội mở', () => {
    for (const path of ['bang-tin', 'bai-viet/abc', 'khoa-hoc', 'khoa-hoc/abc', 'bai/abc', 'cua-hang', 'cua-hang/ebook', 'su-kien', 'su-kien/abc', 'thanh-vien', 'bang-tin/']) {
      expect(guestCanOpen(`/hoi-a/${path}`, 'hoi-a'), path).toBe(true);
    }
  });

  it('khách không mở được trang của thành viên và trang quản lý', () => {
    for (const path of ['hom-nay', 'xep-hang', 'tien', 'cong-su', 'cai-dat', 'cai-dat/chung', 'bang-tin/moi', 'khoa-hoc/moi', 'khoa-hoc/abc/sua', 'khoa-hoc/abc/soan', 'cua-hang/moi', 'cua-hang/ebook/sua', 'su-kien/moi', 'su-kien/abc/sua']) {
      expect(guestCanOpen(`/hoi-a/${path}`, 'hoi-a'), path).toBe(false);
    }
  });

  it('đường dẫn của hội khác thì không tính', () => {
    expect(guestCanOpen('/hoi-b/bang-tin', 'hoi-a')).toBe(false);
  });
});

describe('guestHome', () => {
  it('vào bảng tin trước, hội tắt bảng tin thì tới tab kế tiếp đang bật', () => {
    expect(guestHome('hoi-a', {})).toBe('/hoi-a/bang-tin');
    expect(guestHome('hoi-a', { feed: false })).toBe('/hoi-a/khoa-hoc');
    expect(guestHome('hoi-a', { feed: false, courses: false })).toBe('/hoi-a/su-kien');
    expect(guestHome('hoi-a', { feed: false, courses: false, events: false })).toBe('/hoi-a/thanh-vien');
    expect(guestHome('hoi-a', { feed: false, courses: false, events: false, members: false })).toBe('/hoi-a');
  });
});
