import type { CourseShareOffer } from '@hoiminh/contracts';
import { describe, expect, it } from 'vitest';
import { monthlyTerms, shareAmount, shareLineLabel } from './course-share';

const offer: CourseShareOffer = { enabled: true, programId: 'p1', durationMonths: 12, monthlyCommissionMinor: 39_800, courses: [{ courseId: 'c1', priceMinor: 499_000, commissionMinor: 99_800 }] };

describe('chia sẻ khóa học', () => {
  it('khóa bán lẻ có hoa hồng: tiền mỗi đơn', () => {
    expect(shareAmount(offer, 'c1')).toEqual({ minor: 99_800, perMonth: false });
  });
  it('khóa chỉ nằm trong hội: tiền mỗi tháng khi giới thiệu vào hội', () => {
    expect(shareAmount(offer, 'c2')).toEqual({ minor: 39_800, perMonth: true });
  });
  it('không có gì để nhận thì không hiện dòng chia sẻ', () => {
    expect(shareAmount({ ...offer, monthlyCommissionMinor: null }, 'c2')).toBeNull();
    expect(shareAmount({ ...offer, enabled: false }, 'c1')).toBeNull();
    expect(shareAmount(undefined, 'c1')).toBeNull();
  });
  it('dòng chữ trên thẻ ghi số tiền, không ghi phần trăm', () => {
    expect(shareLineLabel({ minor: 99_800, perMonth: false })).toEqual({ amount: '99.800đ', text: 'Nhận 99.800đ khi chia sẻ' });
    expect(shareLineLabel({ minor: 39_800, perMonth: true }).text).toBe('Nhận 39.800đ/tháng khi chia sẻ');
  });
  it('câu tiền hằng tháng nói rõ số tháng và tổng tối đa', () => {
    expect(monthlyTerms(39_800, 12)).toContain('trong 12 tháng đầu. Tổng tối đa 477.600đ');
    expect(monthlyTerms(39_800, null)).not.toContain('tháng đầu');
  });
});
