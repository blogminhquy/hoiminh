import { describe, expect, it } from 'vitest';
import { checkoutQuery, entryChoice, modeChoices, promoEndLabel, termChoices } from './membership';

const NOW = new Date('2026-11-12T03:00:00Z');
const TERMS = [{ months: 1, amountMinor: 149_000 }, { months: 3, amountMinor: 399_000 }, { months: 12, amountMinor: 1_290_000 }];
const PROMO = { percentOff: 20, endsAt: '2026-11-20T16:59:59.000Z' };

describe('lựa chọn kỳ hạn hiển thị cho người mua', () => {
  it('mỗi kỳ hạn một lựa chọn, kỳ ngắn trước, ghi phần tiết kiệm so với kỳ ngắn nhất', () => {
    const list = termChoices({ terms: TERMS, promo: null, oneTimeMinor: null }, {}, NOW);
    expect(list.map((c) => [c.months, c.payMinor, c.unit, c.savingPercent])).toEqual([[1, 149_000, 'tháng', 0], [3, 399_000, '3 tháng', 11], [12, 1_290_000, 'năm', 28]]);
  });

  it('khuyến mãi đang chạy thì có giá gốc và giá phải trả; hết hạn thì như không có', () => {
    const on = termChoices({ terms: TERMS, promo: PROMO, oneTimeMinor: null }, {}, NOW)[1]!;
    expect(on).toMatchObject({ listMinor: 399_000, payMinor: 319_200, percentOff: 20 });
    const off = termChoices({ terms: TERMS, promo: { ...PROMO, endsAt: '2026-11-01T00:00:00.000Z' }, oneTimeMinor: null }, {}, NOW)[1]!;
    expect(off).toMatchObject({ listMinor: 399_000, payMinor: 399_000, percentOff: 0 });
  });

  it('hội trả một lần bán gói trọn đời, các kiểu khác bán theo kỳ hạn', () => {
    const p = { terms: TERMS, promo: null, oneTimeMinor: 2_990_000 };
    expect(modeChoices(p, 'one_time', NOW).map((c) => c.months)).toEqual([null]);
    expect(modeChoices(p, 'freemium', NOW).map((c) => c.months)).toEqual([1, 3, 12]);
    expect(modeChoices({ ...p, terms: [] }, 'subscription', NOW).map((c) => c.unit)).toEqual(['trọn đời']);
    expect(entryChoice(p, 'subscription', NOW)).toMatchObject({ months: 1, payMinor: 149_000 });
    expect(entryChoice(null, 'subscription', NOW)).toBeNull();
  });

  it('đường dẫn thanh toán mang đúng số tháng', () => {
    const [m1, m3, m12] = termChoices({ terms: TERMS, promo: null, oneTimeMinor: null }, {}, NOW);
    expect(checkoutQuery(m1!)).toBe('tier=premium&cycle=monthly&months=1');
    expect(checkoutQuery(m3!)).toBe('tier=premium&cycle=monthly&months=3');
    expect(checkoutQuery(m12!)).toBe('tier=premium&cycle=yearly&months=12');
    expect(checkoutQuery(modeChoices({ terms: [], promo: null, oneTimeMinor: 5 }, 'one_time', NOW)[0]!)).toBe('tier=premium&cycle=one_time');
  });

  it('ngày hết khuyến mãi ghi gọn', () => {
    expect(promoEndLabel({ percentOff: 10, endsAt: null })).toBeNull();
    expect(promoEndLabel({ percentOff: 10, endsAt: '2026-11-20T05:00:00.000Z' })).toMatch(/^\d{2}\/11$/);
  });
});
