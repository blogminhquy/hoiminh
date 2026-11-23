import { describe, expect, it } from 'vitest';
import { lessonEditPath, moduleOfLesson } from './course-edit';

describe('sửa nhanh bài học', () => {
  it('đường dẫn mở khung soạn ở đúng bài', () => {
    expect(lessonEditPath('bep', 'c1', 'l9')).toBe('/bep/khoa-hoc/c1/soan?bai=l9');
    expect(lessonEditPath('bep', 'c1', 'a b')).toBe('/bep/khoa-hoc/c1/soan?bai=a%20b');
  });
  it('tìm module chứa bài', () => {
    const modules = [{ id: 'm1', lessons: [{ id: 'a' }] }, { id: 'm2', lessons: [{ id: 'b' }, { id: 'c' }] }];
    expect(moduleOfLesson(modules, 'c')?.id).toBe('m2');
    expect(moduleOfLesson(modules, 'a')?.id).toBe('m1');
    expect(moduleOfLesson(modules, 'x')).toBeNull();
    expect(moduleOfLesson(modules, null)).toBeNull();
    expect(moduleOfLesson([], 'a')).toBeNull();
  });
});
