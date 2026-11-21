import { describe, expect, it } from 'vitest';
import { afterComplete, certificateFileName, certificatePath, courseSummary, fitText, fmtCertificateDate, formatCertificateCode, shortUrl, wantsCelebration, type Measure } from './certificate';

// Đo giả: mỗi ký tự rộng 0,6 cỡ chữ, cộng giãn chữ. Đủ để kiểm quy tắc co cỡ và ngắt dòng mà không cần trình duyệt.
const measure: Measure = (text, s) => [...text].length * s.size * (0.6 + (s.tracking ?? 0));
const widest = (lines: string[], size: number, weight = 800) => Math.max(...lines.map((l) => measure(l, { size, weight })));

describe('bấm hoàn thành bài xong thì đi đâu', () => {
  const ctx = { percentBefore: 91, courseId: 'c1', userId: 'u1' };

  it('khóa vừa đạt 100% và có chứng nhận: tới trang chứng nhận ở chế độ chúc mừng', () => {
    expect(afterComplete({ percent: 100, nextLessonId: null, courseCompleted: true, certificateEnabled: true }, ctx)).toEqual({ kind: 'certificate', to: '/chung-nhan/c1/u1?chuc-mung=1' });
  });

  it('bài làm khóa xong không phải bài cuối giáo trình: vẫn chúc mừng chứ không sang bài tiếp', () => {
    expect(afterComplete({ percent: 100, nextLessonId: 'l9', courseCompleted: true, certificateEnabled: true }, ctx).kind).toBe('certificate');
  });

  it('khóa tắt chứng nhận: mở bảng chúc mừng tại chỗ, không dẫn tới chứng nhận', () => {
    expect(afterComplete({ percent: 100, nextLessonId: null, courseCompleted: true, certificateEnabled: false }, ctx)).toEqual({ kind: 'congrats' });
  });

  it('khóa đã xong từ trước, bấm hoàn thành lại một bài: không chúc mừng lại', () => {
    expect(afterComplete({ percent: 100, nextLessonId: null, courseCompleted: false, certificateEnabled: true }, { ...ctx, percentBefore: 100 })).toEqual({ kind: 'stay' });
    expect(afterComplete({ percent: 100, nextLessonId: 'l2', courseCompleted: false, certificateEnabled: true }, { ...ctx, percentBefore: 100 })).toEqual({ kind: 'next', lessonId: 'l2' });
  });

  it('chưa xong khóa: sang bài kế nếu có, không thì ở yên', () => {
    expect(afterComplete({ percent: 50, nextLessonId: 'l2', courseCompleted: false }, ctx)).toEqual({ kind: 'next', lessonId: 'l2' });
    expect(afterComplete({ percent: 50, nextLessonId: null, courseCompleted: false }, ctx)).toEqual({ kind: 'stay' });
  });

  it('máy chủ bản cũ không gửi cờ: so tiến độ trước và sau, chứng nhận lấy theo thông tin của bài học', () => {
    expect(afterComplete({ percent: 100, nextLessonId: null }, { ...ctx, percentBefore: 91, certificateEnabled: true }).kind).toBe('certificate');
    expect(afterComplete({ percent: 100, nextLessonId: null }, { ...ctx, percentBefore: 91 })).toEqual({ kind: 'congrats' });
    expect(afterComplete({ percent: 100, nextLessonId: null }, { ...ctx, percentBefore: 100, certificateEnabled: true })).toEqual({ kind: 'stay' });
    expect(afterComplete({ percent: 100, nextLessonId: null }, { ...ctx, percentBefore: null, certificateEnabled: true }).kind).toBe('certificate');
  });

  it('chưa biết người dùng là ai thì không dựng được link chứng nhận: chúc mừng tại chỗ', () => {
    expect(afterComplete({ percent: 100, nextLessonId: null, courseCompleted: true, certificateEnabled: true }, { ...ctx, userId: null })).toEqual({ kind: 'congrats' });
  });
});

describe('địa chỉ chứng nhận', () => {
  it('link thường không có tham số, link chúc mừng có ?chuc-mung=1', () => {
    expect(certificatePath('c1', 'u1')).toBe('/chung-nhan/c1/u1');
    expect(certificatePath('c1', 'u1', true)).toBe('/chung-nhan/c1/u1?chuc-mung=1');
  });

  it('nhận ra tham số chúc mừng trên địa chỉ', () => {
    expect(wantsCelebration('?chuc-mung=1')).toBe(true);
    expect(wantsCelebration('?ref=abc&chuc-mung=1')).toBe(true);
    expect(wantsCelebration('')).toBe(false);
    expect(wantsCelebration('?chuc=1')).toBe(false);
  });

  it('địa chỉ in trên tấm bỏ giao thức cho gọn', () => {
    expect(shortUrl('https://hoiminh.com/chung-nhan/a/b')).toBe('hoiminh.com/chung-nhan/a/b');
    expect(shortUrl('https://www.hoiminh.com/chung-nhan/a/b/')).toBe('hoiminh.com/chung-nhan/a/b');
  });
});

describe('định dạng trên chứng chỉ', () => {
  it('ngày viết kiểu "22 tháng 11, 2026" theo giờ Việt Nam', () => {
    expect(fmtCertificateDate('2026-11-22T03:00:00.000Z')).toBe('22 tháng 11, 2026');
    // 18:30 UTC ngày 21 đã là 01:30 ngày 22 ở Việt Nam.
    expect(fmtCertificateDate('2026-11-21T18:30:00.000Z')).toBe('22 tháng 11, 2026');
    expect(fmtCertificateDate(new Date('2026-01-05T05:00:00.000Z'))).toBe('5 tháng 1, 2026');
    expect(fmtCertificateDate('2026-11-21T18:30:00.000Z', 'UTC')).toBe('21 tháng 11, 2026');
  });

  it('ngày hỏng hoặc thiếu thì trả chuỗi rỗng', () => {
    expect(fmtCertificateDate(null)).toBe('');
    expect(fmtCertificateDate('khong-phai-ngay')).toBe('');
  });

  it('mã kiểm tra tách nhóm bốn ký tự, viết hoa', () => {
    expect(formatCertificateCode('4A3507446405')).toBe('4A35 0744 6405');
    expect(formatCertificateCode('4a35 0744 6405')).toBe('4A35 0744 6405');
    expect(formatCertificateCode('ABCDE')).toBe('ABCD E');
    expect(formatCertificateCode('')).toBe('');
  });

  it('tên tệp ảnh không dấu, không ký tự lạ', () => {
    expect(certificateFileName('Nguyễn Minh Quý')).toBe('chung-chi-nguyen-minh-quy.png');
    expect(certificateFileName('Đỗ Thị Đào')).toBe('chung-chi-do-thi-dao.png');
    expect(certificateFileName('  ***  ')).toBe('chung-chi.png');
  });

  it('dòng mô tả: số bài, kèm thời lượng khi có', () => {
    expect(courseSummary(11, 3 * 3600 + 20 * 60)).toBe('11 bài học · 3 giờ 20 phút');
    expect(courseSummary(3, 57 * 60)).toBe('3 bài học · 57 phút');
    expect(courseSummary(8, 2 * 3600)).toBe('8 bài học · 2 giờ');
    expect(courseSummary(1, 0)).toBe('1 bài học');
    expect(courseSummary(1, null)).toBe('1 bài học');
  });
});

describe('co cỡ chữ theo độ dài tên', () => {
  const name = { maxWidth: 1500, maxSize: 124, minSize: 58, maxLines: 2, weight: 800 };

  it('tên ngắn giữ cỡ lớn nhất trên một dòng', () => {
    expect(fitText('An Lê', name, measure)).toEqual({ size: 124, lines: ['An Lê'], truncated: false });
  });

  it('tên vừa phải co cỡ nhưng vẫn một dòng', () => {
    const f = fitText('Nguyễn Hoàng Thiên Phúc', name, measure);
    expect(f.lines).toHaveLength(1);
    expect(f.size).toBeLessThan(124);
    expect(f.size).toBeGreaterThanOrEqual(124 * 0.7);
    expect(widest(f.lines, f.size)).toBeLessThanOrEqual(1500);
  });

  it('tên rất dài (60 ký tự) ngắt thành hai dòng cân nhau, không tràn', () => {
    const long = 'Công Tằng Tôn Nữ Nguyễn Phúc Huyền Trân Bảo Ngọc Thiên Kim Anh';
    const f = fitText(long, name, measure);
    expect(f.lines).toHaveLength(2);
    expect(f.truncated).toBe(false);
    expect(f.lines.join(' ')).toBe(long);
    expect(widest(f.lines, f.size)).toBeLessThanOrEqual(1500);
    expect(f.size).toBeGreaterThanOrEqual(58);
    // Hai dòng cân nhau: không có dòng nào chỉ lẻ một từ.
    expect(Math.abs(f.lines[0]!.length - f.lines[1]!.length)).toBeLessThan(12);
  });

  it('chữ xuống nhiều dòng thì cỡ không vượt mức cho khối nhiều dòng', () => {
    const f = fitText('Lộ trình xây dựng thương hiệu cá nhân bền vững', { ...name, maxWidth: 900 }, measure);
    expect(f.lines.length).toBe(2);
    expect(f.size).toBeLessThanOrEqual(Math.round(124 * 0.78));
  });

  it('một từ dài không ngắt được: co tới cỡ nhỏ nhất rồi cắt kèm dấu ba chấm, vẫn không tràn', () => {
    const f = fitText('Nguyenthiminhkhaihoangthuyduonganhtuyetnhungphuonglinhchi', name, measure);
    expect(f.size).toBe(58);
    expect(f.truncated).toBe(true);
    expect(f.lines).toHaveLength(1);
    expect(f.lines[0]!.endsWith('…')).toBe(true);
    expect(widest(f.lines, f.size)).toBeLessThanOrEqual(1500);
  });

  it('quá dài cho cả hai dòng ở cỡ nhỏ nhất: dòng cuối cắt bớt, mọi dòng vẫn trong bề ngang', () => {
    const f = fitText(Array.from({ length: 40 }, (_, i) => `từ${i}`).join(' '), { ...name, maxWidth: 600 }, measure);
    expect(f.truncated).toBe(true);
    expect(f.lines.length).toBeLessThanOrEqual(2);
    expect(widest(f.lines, f.size)).toBeLessThanOrEqual(600);
  });

  it('chỉ cho một dòng thì không bao giờ ngắt', () => {
    const f = fitText('Phó Giáo sư Tiến sĩ Nguyễn Hoàng Thiên Phúc An', { maxWidth: 420, maxSize: 38, minSize: 22, maxLines: 1, weight: 600 }, measure);
    expect(f.lines).toHaveLength(1);
    expect(widest(f.lines, f.size, 600)).toBeLessThanOrEqual(420);
  });

  it('gộp khoảng trắng thừa và chịu được chuỗi rỗng', () => {
    expect(fitText('  An   Lê  ', name, measure).lines).toEqual(['An Lê']);
    expect(fitText('   ', name, measure)).toEqual({ size: 124, lines: [''], truncated: false });
  });

  it('giãn chữ được tính vào bề ngang', () => {
    const plain = fitText('CHỨNG NHẬN HOÀN THÀNH KHÓA HỌC', { maxWidth: 800, maxSize: 60, minSize: 10, maxLines: 1, weight: 700 }, measure);
    const spaced = fitText('CHỨNG NHẬN HOÀN THÀNH KHÓA HỌC', { maxWidth: 800, maxSize: 60, minSize: 10, maxLines: 1, weight: 700, tracking: 0.3 }, measure);
    expect(spaced.size).toBeLessThan(plain.size);
  });
});
