// Đường dẫn hệ thống mà hội không được lấy. Web có route `/:slug` cho hội, nên trang hệ thống nào thiếu tên ở đây
// thì một hội đặt trùng tên sẽ tranh mất địa chỉ đó.
import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS } from './index';

describe('RESERVED_SLUGS', () => {
  it('giữ chỗ hai trang pháp lý: Điều khoản sử dụng và Chính sách quyền riêng tư', () => {
    expect(RESERVED_SLUGS.has('dieu-khoan')).toBe(true);
    expect(RESERVED_SLUGS.has('quyen-rieng-tu')).toBe(true);
  });

  it('vẫn giữ chỗ các trang hệ thống đã có', () => {
    for (const slug of ['tao-hoi', 'dang-ky', 'dang-nhap', 'tai-khoan', 'he-thong', 'admin', 'thanh-toan']) expect(RESERVED_SLUGS.has(slug), slug).toBe(true);
  });

  it('chỉ chứa tên viết thường, không dấu, không khoảng trắng (cùng dạng với đường dẫn hội)', () => {
    for (const slug of RESERVED_SLUGS) expect(slug, slug).toMatch(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
  });
});
