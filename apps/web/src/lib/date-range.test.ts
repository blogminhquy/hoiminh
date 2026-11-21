import { daySpan, isDay, resolveDayRange, shiftDay, vnDay, vnDayStart, weekdayMon } from '@hoiminh/contracts';
import { describe, expect, it } from 'vitest';
import { PRESETS, choiceLabel, choiceRange, dailySeries, dayAriaLabel, fmtDay, maskDayInput, monthLabel, monthOf, monthWeeks, parseDayInput, presetRange, rangeFileSuffix, rangeLabelShort, rangeQuery, shiftMonth, type PresetKey } from './date-range';

describe('ngày lịch giờ Việt Nam', () => {
  it('đổi ngày đúng lúc 00:00 giờ Việt Nam (17:00 UTC hôm trước)', () => {
    expect(vnDay('2026-11-20T16:59:59Z')).toBe('2026-11-20');
    expect(vnDay('2026-11-20T17:00:00Z')).toBe('2026-11-21');
    expect(vnDay(new Date('2025-12-31T17:00:00Z'))).toBe('2026-01-01');
    expect(vnDayStart('2026-11-21').toISOString()).toBe('2026-11-20T17:00:00.000Z');
  });
  it('cộng trừ ngày qua ranh giới tháng, năm và năm nhuận', () => {
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftDay('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('số ngày của khoảng tính cả hai đầu', () => {
    expect(daySpan('2026-11-21', '2026-11-21')).toBe(1);
    expect(daySpan('2026-10-08', '2026-11-20')).toBe(44);
  });
  it('thứ trong tuần bắt đầu từ thứ Hai', () => {
    expect(weekdayMon('2026-11-16')).toBe(0); // thứ Hai
    expect(weekdayMon('2026-11-21')).toBe(5); // thứ Bảy
    expect(weekdayMon('2026-11-22')).toBe(6); // Chủ nhật
  });
  it('chỉ nhận ngày có thật', () => {
    expect(isDay('2026-11-21')).toBe(true);
    expect(isDay('2024-02-29')).toBe(true);
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('21/11/2026')).toBe(false);
    expect(isDay('2026-1-1')).toBe(false);
  });
});

describe('khoảng ngày của từng mốc', () => {
  // Thứ Bảy 21/11/2026.
  const today = '2026-11-21';
  it('một ngày thường giữa tháng, giữa tuần', () => {
    expect(presetRange('today', today)).toEqual({ from: '2026-11-21', to: '2026-11-21' });
    expect(presetRange('yesterday', today)).toEqual({ from: '2026-11-20', to: '2026-11-20' });
    expect(presetRange('last7', today)).toEqual({ from: '2026-11-15', to: '2026-11-21' });
    expect(presetRange('last30', today)).toEqual({ from: '2026-10-23', to: '2026-11-21' });
    expect(presetRange('last90', today)).toEqual({ from: '2026-08-24', to: '2026-11-21' });
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('weekToDate', today)).toEqual({ from: '2026-11-16', to: '2026-11-21' });
    expect(presetRange('monthToDate', today)).toEqual({ from: '2026-11-01', to: '2026-11-21' });
    expect(presetRange('allTime', today)).toEqual({ from: null, to: '2026-11-21' });
  });
  it('"N ngày qua" tính cả hôm nay nên có đúng N ngày', () => {
    for (const [key, n] of [['last7', 7], ['last30', 30], ['last90', 90]] as Array<[PresetKey, number]>) {
      const r = presetRange(key, today);
      expect(daySpan(r.from!, r.to), key).toBe(n);
    }
  });
  it('thứ Hai: đầu tuần đến nay là riêng ngày hôm đó', () => {
    expect(presetRange('weekToDate', '2026-11-16')).toEqual({ from: '2026-11-16', to: '2026-11-16' });
  });
  it('Chủ nhật: đầu tuần đến nay là trọn tuần, từ thứ Hai', () => {
    expect(presetRange('weekToDate', '2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-22' });
  });
  it('ngày đầu tháng (Chủ nhật 01/11/2026)', () => {
    const first = '2026-11-01';
    expect(presetRange('monthToDate', first)).toEqual({ from: '2026-11-01', to: '2026-11-01' });
    expect(presetRange('lastMonth', first)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('yesterday', first)).toEqual({ from: '2026-10-31', to: '2026-10-31' });
    // Tuần vắt qua hai tháng: thứ Hai là 26/10.
    expect(presetRange('weekToDate', first)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(presetRange('last7', first)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
  });
  it('ngày đầu năm (thứ Năm 01/01/2026)', () => {
    const newYear = '2026-01-01';
    expect(presetRange('yesterday', newYear)).toEqual({ from: '2025-12-31', to: '2025-12-31' });
    expect(presetRange('lastMonth', newYear)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(presetRange('monthToDate', newYear)).toEqual({ from: '2026-01-01', to: '2026-01-01' });
    expect(presetRange('weekToDate', newYear)).toEqual({ from: '2025-12-29', to: '2026-01-01' });
    expect(presetRange('last7', newYear)).toEqual({ from: '2025-12-26', to: '2026-01-01' });
    expect(presetRange('last30', newYear)).toEqual({ from: '2025-12-03', to: '2026-01-01' });
  });
  it('tháng trước là trọn tháng trước, kể cả tháng Hai và khi hôm nay là ngày 31', () => {
    expect(presetRange('lastMonth', '2024-03-01')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(presetRange('lastMonth', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('lastMonth', '2026-12-31')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
  it('mốc tính lại theo ngày hôm nay mỗi lần dùng; khoảng tự chọn thì đứng yên', () => {
    expect(choiceRange({ preset: 'today' }, '2026-11-21')).toEqual({ from: '2026-11-21', to: '2026-11-21' });
    expect(choiceRange({ preset: 'today' }, '2026-11-22')).toEqual({ from: '2026-11-22', to: '2026-11-22' });
    expect(choiceRange({ preset: null, from: '2026-10-08', to: '2026-11-20' }, '2026-11-22')).toEqual({ from: '2026-10-08', to: '2026-11-20' });
  });
  it('mốc khớp với cách máy chủ hiểu tham số `days` cũ', () => {
    const now = new Date('2026-11-21T05:00:00Z');
    expect(resolveDayRange({ days: 1 }, now)).toEqual(presetRange('today', today));
    expect(resolveDayRange({ days: 30 }, now)).toEqual(presetRange('last30', today));
    expect(resolveDayRange({}, now)).toEqual(presetRange('last30', today));
    expect(resolveDayRange({ to: today }, now)).toEqual(presetRange('allTime', today));
  });
});

describe('chữ hiển thị và query', () => {
  it('có đủ 9 mốc, đúng thứ tự', () => {
    expect(PRESETS.map((p) => p.label)).toEqual(['Hôm nay', 'Hôm qua', '7 ngày qua', '30 ngày qua', '90 ngày qua', 'Tháng trước', 'Đầu tuần đến nay', 'Đầu tháng đến nay', 'Từ trước đến nay']);
  });
  it('nút mở hiện tên mốc hoặc khoảng ngày', () => {
    expect(choiceLabel({ preset: 'last30' })).toBe('30 ngày qua');
    expect(choiceLabel({ preset: 'allTime' })).toBe('Từ trước đến nay');
    expect(choiceLabel({ preset: null, from: '2026-10-08', to: '2026-11-20' })).toBe('08/10/2026 đến 20/11/2026');
    expect(choiceLabel({ preset: null, from: '2026-11-20', to: '2026-11-20' })).toBe('20/11/2026');
  });
  it('không dùng gạch ngang dài ở bất kỳ nhãn nào', () => {
    const texts = [...PRESETS.map((p) => p.label), choiceLabel({ preset: null, from: '2026-10-08', to: '2026-11-20' }), rangeLabelShort({ from: '2026-10-08', to: '2026-11-20' }), rangeLabelShort({ from: null, to: '2026-11-20' }), monthLabel('2026-11'), dayAriaLabel('2026-11-21')];
    for (const t of texts) expect(t).not.toMatch(new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']'));
  });
  it('khoảng ngày viết ngắn', () => {
    expect(rangeLabelShort({ from: '2026-10-08', to: '2026-11-20' })).toBe('08/10 đến 20/11');
    expect(rangeLabelShort({ from: '2026-11-20', to: '2026-11-20' })).toBe('20/11');
    expect(rangeLabelShort({ from: null, to: '2026-11-20' })).toBe('đến 20/11');
  });
  it('query gửi API: từ trước đến nay thì không có from', () => {
    expect(rangeQuery({ from: '2026-10-08', to: '2026-11-20' })).toBe('from=2026-10-08&to=2026-11-20');
    expect(rangeQuery({ from: null, to: '2026-11-20' })).toBe('to=2026-11-20');
  });
  it('đuôi tên tệp xuất ra theo khoảng đang chọn', () => {
    expect(rangeFileSuffix({ from: '2026-10-08', to: '2026-11-20' })).toBe('2026-10-08-den-2026-11-20');
    expect(rangeFileSuffix({ from: null, to: '2026-11-20' })).toBe('tu-truoc-den-2026-11-20');
  });
});

describe('ô nhập ngày dd/mm/yyyy', () => {
  it('đọc ngày người dùng gõ', () => {
    expect(parseDayInput('08/10/2026')).toBe('2026-10-08');
    expect(parseDayInput('8/10/2026')).toBe('2026-10-08');
    expect(parseDayInput(' 08-10-2026 ')).toBe('2026-10-08');
    expect(parseDayInput('08.10.2026')).toBe('2026-10-08');
    expect(parseDayInput('29/02/2024')).toBe('2024-02-29');
  });
  it('sai dạng hoặc ngày không có thật thì trả null', () => {
    for (const bad of ['', '08/10', '08/10/26', '31/11/2026', '29/02/2026', '2026-10-08', 'abc', '00/10/2026', '08/13/2026']) expect(parseDayInput(bad), bad).toBeNull();
  });
  it('gõ liền số (bàn phím số của điện thoại) tự chen dấu gạch chéo', () => {
    expect(maskDayInput('0')).toBe('0');
    expect(maskDayInput('08')).toBe('08');
    expect(maskDayInput('081')).toBe('08/1');
    expect(maskDayInput('0810')).toBe('08/10');
    expect(maskDayInput('08102')).toBe('08/10/2');
    expect(maskDayInput('08102026')).toBe('08/10/2026');
    expect(maskDayInput('081020269')).toBe('08/10/2026');
  });
  it('gõ có dấu thì giữ nguyên ý người gõ, xóa lùi không bị kẹt', () => {
    expect(maskDayInput('8/10/2026')).toBe('8/10/2026');
    expect(maskDayInput('8-10-2026')).toBe('8/10/2026');
    expect(maskDayInput('08/')).toBe('08/');
    expect(maskDayInput('08/10/')).toBe('08/10/');
    expect(maskDayInput('08/10/2026/')).toBe('08/10/2026');
    expect(maskDayInput('')).toBe('');
    expect(maskDayInput('/')).toBe('');
  });
  it('gõ xong thì đọc lại được đúng ngày', () => {
    expect(parseDayInput(maskDayInput('08102026'))).toBe('2026-10-08');
    expect(fmtDay(parseDayInput(maskDayInput('21112026'))!)).toBe('21/11/2026');
  });
});

describe('lưới lịch tháng', () => {
  it('tháng 11/2026: ngày 01 là Chủ nhật nên nằm cuối hàng đầu, tháng có 6 hàng', () => {
    const weeks = monthWeeks('2026-11');
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks[1]![0]).toBe('2026-11-02');
    expect(weeks[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
  it('tháng 2/2026 bắt đầu Chủ nhật và có 28 ngày; tháng 2/2024 có 29 ngày', () => {
    expect(monthWeeks('2026-02').flat().filter(Boolean)).toHaveLength(28);
    expect(monthWeeks('2024-02').flat().filter(Boolean)).toHaveLength(29);
  });
  it('tháng bắt đầu đúng thứ Hai thì không có ô trống ở đầu', () => {
    // 01/06/2026 là thứ Hai.
    expect(weekdayMon('2026-06-01')).toBe(0);
    expect(monthWeeks('2026-06')[0]![0]).toBe('2026-06-01');
  });
  it('lùi và tới tháng qua ranh giới năm', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-11', -12)).toBe('2025-11');
    expect(shiftMonth('2026-11', 12)).toBe('2027-11');
    expect(monthOf('2026-11-21')).toBe('2026-11');
    expect(monthLabel('2026-11')).toBe('Tháng 11, 2026');
  });
  it('ô ngày có tên đọc lên đầy đủ', () => {
    expect(dayAriaLabel('2026-11-21')).toBe('Thứ Bảy, 21/11/2026');
    expect(dayAriaLabel('2026-11-22')).toBe('Chủ nhật, 22/11/2026');
  });
});

describe('cột biểu đồ doanh thu theo kỳ', () => {
  it('kỳ ngắn: mỗi ngày một cột, ngày không có doanh thu là 0', () => {
    const s = dailySeries([{ date: '2026-11-19', amountMinor: 100 }, { date: '2026-11-21', amountMinor: 300 }], { from: '2026-11-18', to: '2026-11-21' });
    expect(s).toEqual({ values: [0, 100, 0, 300], bucketDays: 1, from: '2026-11-18', to: '2026-11-21' });
  });
  it('bỏ qua ngày nằm ngoài kỳ', () => {
    const s = dailySeries([{ date: '2026-11-17', amountMinor: 1 }, { date: '2026-11-22', amountMinor: 2 }, { date: '2026-11-21', amountMinor: 5 }], { from: '2026-11-20', to: '2026-11-21' });
    expect(s.values).toEqual([0, 5]);
  });
  it('kỳ dài: gom nhiều ngày vào một cột, tổng không đổi, cột cuối kết thúc ở ngày cuối', () => {
    const range = presetRange('last90', '2026-11-21');
    const daily = [{ date: range.from!, amountMinor: 7 }, { date: '2026-11-19', amountMinor: 10 }, { date: '2026-11-20', amountMinor: 20 }, { date: '2026-11-21', amountMinor: 40 }];
    const s = dailySeries(daily, range);
    expect(s.bucketDays).toBe(3);
    expect(s.values).toHaveLength(30);
    expect(s.values[29]).toBe(70);
    expect(s.values[0]).toBe(7);
    expect(s.values.reduce((a, b) => a + b, 0)).toBe(77);
  });
  it('từ trước đến nay: bắt đầu từ ngày có doanh thu đầu tiên; chưa có doanh thu thì một cột 0', () => {
    const s = dailySeries([{ date: '2026-11-10', amountMinor: 5 }, { date: '2026-11-12', amountMinor: 6 }], { from: null, to: '2026-11-13' });
    expect(s).toEqual({ values: [5, 0, 6, 0], bucketDays: 1, from: '2026-11-10', to: '2026-11-13' });
    expect(dailySeries([], { from: null, to: '2026-11-13' })).toEqual({ values: [0], bucketDays: 1, from: '2026-11-13', to: '2026-11-13' });
  });
  it('không bao giờ quá số cột tối đa', () => {
    const s = dailySeries([{ date: '2020-01-01', amountMinor: 1 }], { from: null, to: '2026-11-21' });
    expect(s.values.length).toBeLessThanOrEqual(31);
    expect(s.values.reduce((a, b) => a + b, 0)).toBe(1);
  });
});
