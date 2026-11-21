import { describe, expect, it } from 'vitest';
import { defaultProgramId, earnLine, estimateCommission, filterTargets, ratePercent, type AffiliateProgram, type LinkTarget } from './affiliate-link';

const program = (over: Partial<AffiliateProgram>): AffiliateProgram => ({ id: 'p', name: 'Hội A', scope: 'community', community: null, rateBps: 4000, durationMonths: null, enabled: true, canManage: false, hasAccount: false, ...over });
const platform = program({ id: 'platform', name: 'Nền tảng Hội Mình', scope: 'platform', durationMonths: 12 });

describe('defaultProgramId', () => {
  it('chưa có gì thì mở chương trình nền tảng (đầu danh sách)', () => {
    expect(defaultProgramId([platform, program({ id: 'a' })], null)).toBe('platform');
    expect(defaultProgramId([], null)).toBeNull();
  });
  it('đã có ví trong một hội đang bật thì mở hội đó', () => {
    expect(defaultProgramId([platform, program({ id: 'a' }), program({ id: 'b', hasAccount: true })], null)).toBe('b');
  });
  it('hội đã tắt không được mở sẵn dù còn ví', () => {
    expect(defaultProgramId([platform, program({ id: 'a', hasAccount: true, enabled: false })], null)).toBe('platform');
  });
  it('chương trình mở lần trước thắng, trừ khi không còn trong danh sách', () => {
    const list = [platform, program({ id: 'a', hasAccount: true }), program({ id: 'b' })];
    expect(defaultProgramId(list, 'b')).toBe('b');
    expect(defaultProgramId(list, 'da-roi-hoi')).toBe('a');
  });
});

describe('earnLine', () => {
  it('nền tảng nói rõ số tháng được tính, hoặc trọn đời', () => {
    expect(earnLine(platform)).toBe('Nhận 40% hoa hồng mỗi lần người bạn mời trả tiền gói Hội Mình trong 12 tháng đầu.');
    expect(earnLine({ ...platform, durationMonths: null })).toBe('Nhận 40% hoa hồng mỗi lần người bạn mời trả tiền gói Hội Mình, trọn đời.');
  });
  it('hội nêu tên hội', () => {
    expect(earnLine(program({ rateBps: 5000 }))).toBe('Nhận 50% hoa hồng mỗi lần người bạn mời trả phí trong Hội A.');
  });
});

describe('ratePercent và estimateCommission', () => {
  it('viết phần trăm kiểu Việt', () => {
    expect(ratePercent(4000)).toBe('40%');
    expect(ratePercent(1250)).toBe('12,5%');
  });
  it('làm tròn xuống như máy chủ, sản phẩm miễn phí thì bằng 0', () => {
    expect(estimateCommission(990_000, 4000)).toBe(396_000);
    expect(estimateCommission(99_999, 3333)).toBe(33_329);
    expect(estimateCommission(0, 4000)).toBe(0);
    expect(estimateCommission(null, 4000)).toBe(0);
  });
});

describe('filterTargets', () => {
  const t = (label: string): LinkTarget => ({ key: label, kind: 'product', label, url: '', productKind: 'course', priceMinor: 1, commission: true });
  const list = [t('Trang giới thiệu hội'), t('Khóa Đường Đi AI'), t('Combo khởi nghiệp')];
  it('ô tìm trống thì giữ nguyên', () => {
    expect(filterTargets(list, '  ')).toHaveLength(3);
  });
  it('không phân biệt hoa thường và dấu, kể cả chữ đ', () => {
    expect(filterTargets(list, 'duong di').map((x) => x.label)).toEqual(['Khóa Đường Đi AI']);
    expect(filterTargets(list, 'KHỞI').map((x) => x.label)).toEqual(['Combo khởi nghiệp']);
    expect(filterTargets(list, 'khong co')).toEqual([]);
  });
});
