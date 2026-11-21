import { describe, expect, it } from 'vitest';
import type { Measure } from './certificate';
import { CERT_H, CERT_W, buildCertificateScene, mixHex, type CertificateData, type SceneNode } from './certificate-scene';

// Đo giả rộng tay hơn phông thật một chút (0,62 cỡ chữ mỗi ký tự) để kết luận "không tràn" còn đúng với phông thật.
const measure: Measure = (text, s) => [...text].length * s.size * (0.62 + (s.tracking ?? 0));

const base: CertificateData = {
  code: '4A3507446405',
  learnerName: 'Nguyễn Minh Quý',
  courseTitle: 'Funnel Money Model 2026',
  lessonCount: 11,
  totalDurationSeconds: 3 * 3600 + 20 * 60,
  instructor: 'Minh Quý',
  community: { name: 'Kinh Doanh Online Cùng AI', logoMark: 'KD', logoColor: '#D4593A', logoUrl: null },
  completedAt: '2026-11-22T03:00:00.000Z',
  verifyUrl: 'https://hoiminh.com/chung-nhan/cc61f366-be19-48e8-8913-1610f042fd1d/47a8dbc9-0532-4a6f-a9be-4a65f404ab15',
};
const long: CertificateData = {
  ...base,
  learnerName: 'Công Tằng Tôn Nữ Nguyễn Phúc Huyền Trân Bảo Ngọc Thiên Kim Anh',
  courseTitle: 'Lộ trình xây dựng thương hiệu cá nhân và kinh doanh nội dung số bền vững đa nền',
  instructor: 'Phó Giáo sư Tiến sĩ Nguyễn Hoàng Thiên Phúc An',
  community: { ...base.community!, name: 'Cộng đồng Khởi nghiệp Kinh doanh Online và Tiếp thị Số Việt Nam' },
};

type TextNode = Extract<SceneNode, { t: 'text' }>;
const texts = (nodes: SceneNode[]) => nodes.filter((n): n is TextNode => n.t === 'text');
/** Mép trái và phải của một dòng chữ không xoay. */
function span(n: TextNode): [number, number] {
  const w = measure(n.text, { size: n.size, weight: n.weight, italic: n.italic, tracking: n.tracking });
  if (n.anchor === 'middle') return [n.x - w / 2, n.x + w / 2];
  return n.anchor === 'end' ? [n.x - w, n.x] : [n.x, n.x + w];
}
// Khung trong của tấm: đường kẻ mảnh nằm cách mép 88, chữ phải nằm gọn bên trong.
const INNER = 96;

describe('cảnh tấm chứng chỉ', () => {
  it('khổ A4 ngang', () => {
    const s = buildCertificateScene(base, measure);
    expect([s.width, s.height]).toEqual([CERT_W, CERT_H]);
    expect(CERT_W / CERT_H).toBeCloseTo(1.414, 2);
  });

  it('có đủ nội dung: tên hội, dòng chứng nhận, tên học viên, tên khóa, mô tả, ngày, giảng viên, mã, địa chỉ kiểm tra', () => {
    const all = texts(buildCertificateScene(base, measure).nodes).map((n) => n.text);
    for (const t of ['Kinh Doanh Online Cùng AI', 'CHỨNG NHẬN HOÀN THÀNH', 'Nguyễn Minh Quý', 'Funnel Money Model 2026', '11 bài học · 3 giờ 20 phút', '22 tháng 11, 2026', 'NGÀY HOÀN THÀNH', 'Minh Quý', 'GIẢNG VIÊN', '4A35 0744 6405', 'hoiminh.com']) expect(all).toContain(t);
    expect(all.some((t) => t.includes('hoiminh.com/chung-nhan/cc61f366'))).toBe(true);
    // Vòng chữ con dấu đặt từng ký tự theo cung tròn.
    expect(texts(buildCertificateScene(base, measure).nodes).filter((n) => n.rotate !== undefined).map((n) => n.text).join('')).toBe('ĐÃHOÀNTHÀNHHỘIMÌNH');
  });

  it.each([['tên thường', base], ['tên rất dài', long], ['tên một chữ', { ...base, learnerName: 'An', courseTitle: 'SEO', community: { ...base.community!, name: 'A' } }]])('%s: không dòng chữ nào tràn khỏi khung', (_, data) => {
    const s = buildCertificateScene(data, measure);
    for (const n of texts(s.nodes).filter((x) => x.rotate === undefined)) {
      const [l, r] = span(n);
      expect(l, `"${n.text}" tràn mép trái`).toBeGreaterThanOrEqual(INNER);
      expect(r, `"${n.text}" tràn mép phải`).toBeLessThanOrEqual(CERT_W - INNER);
      expect(n.y - n.size, `"${n.text}" tràn mép trên`).toBeGreaterThanOrEqual(INNER);
      expect(n.y, `"${n.text}" tràn mép dưới`).toBeLessThanOrEqual(CERT_H - INNER);
    }
  });

  it('tên rất dài: tên học viên và tên khóa xuống hai dòng, khối chữ giữa không chạm hàng chữ ký', () => {
    const s = buildCertificateScene(long, measure);
    const all = texts(s.nodes);
    const learner = all.filter((n) => n.weight === 800 && n.rotate === undefined && n.size > 50);
    expect(learner).toHaveLength(2);
    expect(learner.map((n) => n.text).join(' ')).toBe(long.learnerName);
    const summary = all.find((n) => n.text.includes('bài học'))!;
    const sealTop = 1086 - 124;
    expect(summary.y).toBeLessThanOrEqual(sealTop);
    // Các dòng trong cột giữa xếp từ trên xuống, không dòng nào đè lên dòng trước.
    const column = all.filter((n) => n.rotate === undefined && Math.abs(n.x - CERT_W / 2) < 12 && n.y <= summary.y).sort((a, b) => a.y - b.y);
    for (let i = 1; i < column.length; i++) expect(column[i]!.y - column[i]!.size * 0.8, `"${column[i]!.text}" đè lên "${column[i - 1]!.text}"`).toBeGreaterThanOrEqual(column[i - 1]!.y - 2);
  });

  it('khóa không có giảng viên: cột chữ ký ghi tên hội dưới nhãn "ĐƠN VỊ CẤP"', () => {
    const nodes = texts(buildCertificateScene({ ...base, instructor: null }, measure).nodes);
    const all = nodes.map((n) => n.text);
    expect(all).toContain('ĐƠN VỊ CẤP');
    expect(all).not.toContain('GIẢNG VIÊN');
    // Chữ ký viết nghiêng; tên dài có thể xuống hai dòng trong cột.
    expect(nodes.filter((n) => n.italic).map((n) => n.text).join(' ')).toBe('Kinh Doanh Online Cùng AI');
  });

  it('khóa không thuộc hội nào: dùng dấu Hội Mình, không có nút logo', () => {
    const s = buildCertificateScene({ ...base, community: null, instructor: null }, measure);
    expect(s.nodes.some((n) => n.t === 'logo')).toBe(false);
    expect(texts(s.nodes).map((n) => n.text)).toContain('Hội Mình');
  });

  it('logo hội: mang địa chỉ ảnh, chữ viết tắt và màu để bên vẽ tự thay thế khi không tải được ảnh', () => {
    const s = buildCertificateScene({ ...base, community: { ...base.community!, logoUrl: 'https://api.hoiminh.com/files/public/logo.webp', logoMark: '' } }, measure);
    const logo = s.nodes.find((n) => n.t === 'logo');
    expect(logo).toMatchObject({ url: 'https://api.hoiminh.com/files/public/logo.webp', mark: 'KA', color: '#D4593A' });
  });

  it('mô tả cho trình đọc màn hình nêu đủ ai, khóa nào, ngày nào, mã nào', () => {
    const { alt } = buildCertificateScene(base, measure);
    for (const t of ['Nguyễn Minh Quý', 'Funnel Money Model 2026', '22 tháng 11, 2026', '4A35 0744 6405', 'Minh Quý']) expect(alt).toContain(t);
  });

  it('không dùng gạch ngang dài trong chữ in trên tấm', () => {
    const longDashes = [0x2013, 0x2014].map((c) => String.fromCharCode(c));
    for (const n of texts(buildCertificateScene(long, measure).nodes)) for (const d of longDashes) expect(n.text.includes(d)).toBe(false);
  });

  it('trộn màu hệ thống ra màu nền giấy', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#000000');
    expect(mixHex('#FBF0D2', '#FFFFFF', 0.5)).toBe('#FDF8E9');
  });
});
