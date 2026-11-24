import { describe, expect, it } from 'vitest';
import { DURATION_CHOICES, choiceOf, durationChoiceLabel, parseRatePercent, partnerTermsText, programTermsText, ratePercentText, termsOfChoice } from './partners';

describe('đối tác: chữ điều khoản', () => {
  it('mức chung và điều khoản của từng đối tác', () => {
    expect(programTermsText({ commissionRateBps: 4000, commissionDurationMonths: 12 })).toBe('40% trong 12 tháng đầu');
    expect(programTermsText({ commissionRateBps: 4000, commissionDurationMonths: null })).toBe('40% trọn đời');
    expect(partnerTermsText({ effectiveRateBps: 5000, effectiveDurationMonths: null })).toBe('50% · trọn đời');
    expect(partnerTermsText({ effectiveRateBps: 4500, effectiveDurationMonths: 24 })).toBe('45% · 24 tháng đầu');
  });

  it('ô chọn thời hạn đi qua đi lại không mất gì', () => {
    for (const c of DURATION_CHOICES) {
      const t = termsOfChoice(c);
      expect(choiceOf(t.durationMode, t.commissionDurationMonths)).toBe(c);
    }
    expect(durationChoiceLabel('program', 12)).toBe('Theo mức chung (12 tháng đầu)');
    expect(durationChoiceLabel('lifetime', 12)).toBe('Trọn đời');
    expect(durationChoiceLabel('24', 12)).toBe('24 tháng đầu');
  });

  it('ô % riêng: trống là mức chung, có phẩy thập phân, ngoài 0-90 thì báo lỗi', () => {
    expect(parseRatePercent('')).toEqual({ ok: true, bps: null });
    expect(parseRatePercent('50')).toEqual({ ok: true, bps: 5000 });
    expect(parseRatePercent('37,5')).toEqual({ ok: true, bps: 3750 });
    expect(parseRatePercent('95').ok).toBe(false);
    expect(parseRatePercent('abc').ok).toBe(false);
    expect(ratePercentText(3750)).toBe('37.5');
    expect(ratePercentText(null)).toBe('');
  });
});
