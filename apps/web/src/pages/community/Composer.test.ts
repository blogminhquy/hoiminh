import { describe, expect, it } from 'vitest';
import { pickDefaultSpace, type ComposerSpace } from './Composer';
import { lessonLabel } from './LessonParts';

const space = (id: string, name: string, postPermission = 'everyone'): ComposerSpace => ({ id, name, colorKey: 'neutral', postPermission });
const spaces = [space('tb', 'Thông báo', 'admins_only'), space('hd', 'Hỏi đáp'), space('cs', 'Chia sẻ'), space('vip', 'Góc Premium', 'premium')];
const member = { canModerate: false, premium: false };

describe('pickDefaultSpace: chuyên mục chọn sẵn khi đăng bài', () => {
  it('ưu tiên mục đang lọc ở bảng tin', () => {
    expect(pickDefaultSpace(spaces, { ...member, preferred: 'hd', last: 'cs' })).toBe('hd');
  });
  it('không có mục đang lọc thì lấy mục đăng lần trước', () => {
    expect(pickDefaultSpace(spaces, { ...member, last: 'hd' })).toBe('hd');
  });
  it('chưa đăng lần nào thì lấy "Chia sẻ"', () => {
    expect(pickDefaultSpace(spaces, member)).toBe('cs');
  });
  it('không chọn sẵn mục mà người này không đăng được', () => {
    expect(pickDefaultSpace(spaces, { ...member, preferred: 'tb', last: 'vip' })).toBe('cs');
    expect(pickDefaultSpace([space('tb', 'Thông báo', 'admins_only')], member)).toBe('');
  });
  it('Premium đăng được mục Premium, người kiểm duyệt đăng được mọi mục', () => {
    expect(pickDefaultSpace(spaces, { canModerate: false, premium: true, preferred: 'vip' })).toBe('vip');
    expect(pickDefaultSpace(spaces, { canModerate: true, premium: false, preferred: 'tb' })).toBe('tb');
  });
  it('hội không có mục "Chia sẻ" thì lấy mục đầu tiên đăng được', () => {
    expect(pickDefaultSpace([space('tb', 'Thông báo', 'admins_only'), space('nk', 'Nhật ký')], member)).toBe('nk');
  });
});

describe('lessonLabel: số thứ tự bài', () => {
  it('thêm số khi tên bài chưa có', () => {
    expect(lessonLabel('Ba con số quyết định lãi', '1.2')).toBe('1.2 Ba con số quyết định lãi');
  });
  it('không lặp số khi tên bài đã tự đánh số', () => {
    expect(lessonLabel('1.2 Ba con số quyết định lãi', '1.2')).toBe('1.2 Ba con số quyết định lãi');
    expect(lessonLabel('1. Mở đầu', '1.1')).toBe('1. Mở đầu');
  });
  it('tên bài mở đầu bằng con số thường vẫn được đánh số', () => {
    expect(lessonLabel('3 bước làm funnel', '2.1')).toBe('2.1 3 bước làm funnel');
    expect(lessonLabel('2026 có gì mới', '1.1')).toBe('1.1 2026 có gì mới');
  });
  it('không truyền số thì giữ nguyên tên', () => {
    expect(lessonLabel('Ba con số')).toBe('Ba con số');
  });
});
