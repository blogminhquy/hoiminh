import { PLAN_DEFAULTS, formatBytes, type PlanDef } from '@hoiminh/contracts';
import { describe, expect, it } from 'vitest';
import { capLabel, capView, compareRows, storageView, openRowsFirst, cycleHint, cycleSaving, planBadge, planFeatureRows, priceLine, tierCards, upgradeSummary, type HoiPlan } from './platform-plan';

const now = new Date('2026-11-11T03:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const plans: PlanDef[] = PLAN_DEFAULTS.map((p) => ({ ...p, prices: { ...p.prices }, features: [...p.features] }));
/** Bảng gói sau khi quản trị nhập thêm giá: Khởi đầu bán đủ bốn kỳ, Chuyên nghiệp thêm 6 tháng, Không giới hạn ngừng bán 3 tháng. */
const custom: PlanDef[] = plans.map((p) => (
  p.key === 'starter' ? { ...p, prices: { monthly: 119_000, quarterly: 297_000, semiannual: 549_000, yearly: 990_000 } }
    : p.key === 'pro' ? { ...p, prices: { ...p.prices, semiannual: 1_690_000 } }
      : p.key === 'unlimited' ? { ...p, prices: { ...p.prices, quarterly: 0 } }
        : p
));
const free: HoiPlan = { key: 'free', name: 'Miễn phí', memberCap: 100, features: [], endsAt: null, daysLeft: 0, boughtKey: 'free', boughtEndsAt: null, isFreeSlot: true, needsPlan: false, full: false };
const on = (key: 'starter' | 'pro' | 'unlimited', days: number): HoiPlan => {
  const p = plans.find((x) => x.key === key)!;
  return { ...free, key, name: p.name, memberCap: p.memberCap, features: p.features, endsAt: inDays(days), daysLeft: days, boughtKey: key, boughtEndsAt: inDays(days) };
};

describe('planBadge', () => {
  it('gói Miễn phí dùng vĩnh viễn; gói trả phí ghi ngày hết hạn, còn 7 ngày trở xuống thì đếm ngày', () => {
    expect(planBadge(free)).toMatchObject({ label: 'Dùng vĩnh viễn', tone: 'muted' });
    expect(planBadge(on('pro', 60)).label).toMatch(/^Tới \d{2}\/\d{2}\/\d{4}$/);
    expect(planBadge(on('pro', 5))).toMatchObject({ label: 'Còn 5 ngày', tone: 'gold' });
  });

  it('gói trả phí đã hết hạn: hội miễn phí về gói Miễn phí và có ghi chú; hội thứ hai thì cần gói', () => {
    expect(planBadge({ ...free, boughtKey: 'pro', boughtEndsAt: inDays(-2) }).note).toMatch(/đã hết hạn/);
    expect(planBadge({ ...free, isFreeSlot: false, needsPlan: true, full: true })).toMatchObject({ label: 'Chờ thanh toán', tone: 'accent' });
    expect(planBadge({ ...free, isFreeSlot: false, needsPlan: true, full: true, boughtKey: 'starter', boughtEndsAt: inDays(-2) })).toMatchObject({ label: 'Gói đã hết hạn' });
  });
});

describe('storageView', () => {
  const MB = 1024 * 1024;
  const GB = 1024 * MB;
  it('dung lượng tệp so với trần: chữ đọc được, phần trăm, chạm trần thì báo tệp cũ vẫn giữ', () => {
    expect(formatBytes(850 * MB)).toBe('850 MB');
    expect(formatBytes(1.25 * GB)).toBe('1,3 GB');
    expect(formatBytes(50 * GB)).toBe('50 GB');
    expect(formatBytes(300)).toBe('1 KB');
    expect(storageView(512 * MB, 1 * GB, 20 * MB)).toMatchObject({ text: '512 MB trên 1 GB', percent: 50, full: false });
    expect(storageView(512 * MB, 1 * GB, 20 * MB).note).toContain('Tài liệu tối đa 20 MB mỗi tệp');
    const full = storageView(1 * GB, 1 * GB, 20 * MB);
    expect(full).toMatchObject({ full: true, percent: 100, left: 0 });
    expect(full.note).toContain('vẫn được giữ');
  });
});

describe('capView', () => {
  it('đếm số chỗ còn lại, chạm trần thì báo đủ, gói không giới hạn thì không có thanh', () => {
    expect(capView(87, 100)).toMatchObject({ text: '87 trên 100', percent: 87, left: 13, full: false });
    expect(capView(87, 100).note).toMatch(/Còn 13 chỗ/);
    expect(capView(100, 100)).toMatchObject({ full: true, percent: 100, left: 0 });
    expect(capView(9_000, null)).toMatchObject({ left: null, full: false });
  });
});

describe('tierCards', () => {
  it('hội Miễn phí, chu kỳ 1 năm: giá quy ra tháng là giá 1 năm chia 12, kèm tổng tiền phải trả và mức lợi so với kỳ ngắn nhất', () => {
    const cards = tierCards(plans, free, 87, 'yearly', now);
    expect(cards.map((c) => [c.key, c.state])).toEqual([['free', 'current'], ['starter', 'buy'], ['pro', 'buy'], ['unlimited', 'buy']]);
    expect(cards[1]).toMatchObject({ price: '82.500đ', per: 'mỗi tháng', cta: 'Chọn gói Khởi đầu' });
    expect(cards[1]!.sub).toBe('Trả 990.000đ cho 1 năm, tiết kiệm 17%.');
    expect(cards[2]).toMatchObject({ popular: true, cap: 'Giới hạn 5.000 thành viên' });
    expect(tierCards(plans, free, 87, 'quarterly', now)[1]).toMatchObject({ price: '99.000đ', sub: 'Trả 297.000đ cho 3 tháng.' });
  });

  it('kỳ có giá 0 thì gói không có thẻ ở kỳ đó; gói Miễn phí luôn có thẻ', () => {
    // Bảng mặc định không bán 1 tháng và 6 tháng: chỉ còn thẻ Miễn phí.
    expect(tierCards(plans, free, 10, 'monthly', now).map((c) => c.key)).toEqual(['free']);
    expect(tierCards(custom, free, 10, 'monthly', now).map((c) => c.key)).toEqual(['free', 'starter']);
    expect(tierCards(custom, free, 10, 'semiannual', now).map((c) => c.key)).toEqual(['free', 'starter', 'pro']);
    expect(tierCards(custom, free, 10, 'quarterly', now).map((c) => c.key)).toEqual(['free', 'starter', 'pro']);
    expect(tierCards(custom, free, 10, 'yearly', now).map((c) => c.key)).toEqual(['free', 'starter', 'pro', 'unlimited']);
    expect(tierCards(custom, free, 10, 'monthly', now)[1]).toMatchObject({ price: '119.000đ', sub: 'Trả 119.000đ cho 1 tháng.', state: 'buy' });
    // 6 tháng 549.000đ so với 1 tháng 119.000đ: rẻ hơn 23%.
    expect(tierCards(custom, free, 10, 'semiannual', now)[1]).toMatchObject({ price: '91.500đ', sub: 'Trả 549.000đ cho 6 tháng, tiết kiệm 23%.' });
  });

  it('tính năng trả phí của gói thấp vẫn hiện, ghi rõ có từ gói nào', () => {
    const [f, , pro, unlimited] = tierCards(plans, free, 10, 'yearly', now);
    expect(f!.features).toContainEqual({ text: 'Có từ gói Chuyên nghiệp: tự động hóa', on: false });
    expect(f!.features).toContainEqual({ text: 'Có từ gói Chuyên nghiệp: API', on: false });
    expect(pro!.features.filter((x) => x.on).map((x) => x.text)).toEqual(['Mọi thứ của gói Khởi đầu', 'Không phí trên doanh thu', 'Tự động hóa', 'Affiliate', 'API']);
    expect(unlimited!.features.map((x) => x.text)).toEqual(['Mọi thứ của gói Chuyên nghiệp', 'Không phí trên doanh thu']);
    // Tên miền riêng không thuộc gói nào nữa (gói bổ sung, sắp ra mắt): không thẻ nào nhắc tới.
    for (const card of [f, pro, unlimited]) expect(card!.features.some((x) => /tên miền riêng/i.test(x.text))).toBe(false);
  });

  it('đang ở Chuyên nghiệp với 1.240 thành viên: gói thấp hơn không mua được, cùng gói thì gia hạn, gói trên thì nâng', () => {
    const cards = tierCards(plans, on('pro', 40), 1_240, 'quarterly', now);
    expect(cards.map((c) => c.state)).toEqual(['blocked', 'blocked', 'buy', 'buy']);
    expect(cards[1]!.reason).toMatch(/còn hạn/);
    expect(cards[2]!.cta).toBe('Gia hạn gói Chuyên nghiệp');
    expect(cards[3]!.cta).toBe('Nâng lên Không giới hạn');
    // Hết hạn rồi mà hội vẫn đông hơn trần của gói thấp thì vẫn chưa mua được gói đó.
    const expired = tierCards(plans, { ...free, boughtKey: 'pro', boughtEndsAt: inDays(-1), full: true }, 1_240, 'quarterly', now);
    expect(expired[1]).toMatchObject({ state: 'blocked', reason: 'Giới hạn 500 thành viên, hội đang có 1.240.' });
  });
});

describe('upgradeSummary', () => {
  it('Khởi đầu còn 60 ngày, nâng lên Chuyên nghiệp 3 tháng: 90 + 60 = 150 ngày, trả 897.000đ', () => {
    const u = upgradeSummary(on('starter', 60), plans[2]!, 120, 'quarterly', now);
    expect(u).toMatchObject({ title: 'Nâng hội lên gói Chuyên nghiệp', buyDays: '90 ngày', carryDays: '+ 60 ngày', totalDays: '150 ngày', price: '897.000đ' });
    expect(u.carryLabel).toBe('Tặng: số ngày còn lại của gói Khởi đầu');
    expect(u.quote.endsAt.getTime()).toBe(now.getTime() + 150 * 86_400_000);
  });

  it('gói Miễn phí mua gói đầu tiên thì không có ngày tặng; gia hạn thì nối tiếp', () => {
    expect(upgradeSummary(free, plans[1]!, 10, 'yearly', now)).toMatchObject({ title: 'Chọn gói Khởi đầu cho hội', carryLabel: '', totalDays: '365 ngày', price: '990.000đ' });
    expect(upgradeSummary(on('pro', 10), plans[2]!, 10, 'yearly', now)).toMatchObject({ title: 'Gia hạn gói Chuyên nghiệp', totalDays: '375 ngày' });
  });
});

describe('capLabel', () => {
  it('gói có trần ghi "Giới hạn", gói không trần ghi "Không giới hạn", giống nhau ở mọi màn', () => {
    expect(capLabel(5_000)).toBe('Giới hạn 5.000 thành viên');
    expect(capLabel(100)).toBe('Giới hạn 100 thành viên');
    expect(capLabel(null)).toBe('Không giới hạn thành viên');
  });
});

describe('openRowsFirst', () => {
  it('dòng có dấu tích lên đầu, dòng khóa xuống cuối, giữ thứ tự trong từng nhóm', () => {
    const rows = [{ text: 'A', on: true }, { text: 'B', on: false }, { text: 'C', on: true }, { text: 'D', on: false }, { text: 'E', on: true }];
    expect(openRowsFirst(rows).map((r) => r.text)).toEqual(['A', 'C', 'E', 'B', 'D']);
    expect(rows.map((r) => r.text)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('planFeatureRows', () => {
  it('mọi gói cùng các dòng, cùng thứ tự; chỉ khác mở hay khóa', () => {
    const rows = plans.map((p) => planFeatureRows(plans, p));
    const texts = rows.map((r) => r.map((x) => x.text));
    for (const t of texts) expect(t).toEqual(texts[0]);
    // Tên miền riêng không còn là dòng của bảng gói: nó là gói bổ sung, sắp ra mắt.
    expect(texts[0]).toEqual(['Bán khóa học, sự kiện, sản phẩm và thu tiền', 'Không phí trên doanh thu', 'Tự động hóa', 'Affiliate', 'API']);
    const [freeRows, , proRows, unlimitedRows] = rows;
    expect(freeRows!.map((x) => x.on)).toEqual([true, true, false, false, false]);
    expect(proRows!.every((x) => x.on)).toBe(true);
    expect(unlimitedRows!.every((x) => x.on)).toBe(true);
  });

  it('dòng khóa ghi gói thấp nhất mở được nó, dòng mở thì không', () => {
    const freeRows = planFeatureRows(plans, plans[0]!);
    expect(freeRows.find((x) => x.text === 'API')).toEqual({ text: 'API', on: false, from: 'Chuyên nghiệp' });
    expect(freeRows[0]!.from).toBeNull();
    expect(planFeatureRows(plans, plans[2]!).every((x) => x.from === null)).toBe(true);
    expect(planFeatureRows(plans, plans[3]!).every((x) => x.from === null)).toBe(true);
  });
});

describe('compareRows', () => {
  it('có đủ trần, giá của từng kỳ đang bán và bốn tính năng trả phí', () => {
    const rows = compareRows(plans);
    // Kỳ không gói nào bán thì không có dòng.
    expect(rows.map((r) => r.label).filter((l) => l.startsWith('Trả '))).toEqual(['Trả 3 tháng', 'Trả 1 năm']);
    const more = compareRows(custom);
    expect(more.map((r) => r.label).filter((l) => l.startsWith('Trả '))).toEqual(['Trả 1 tháng', 'Trả 3 tháng', 'Trả 6 tháng', 'Trả 1 năm']);
    expect(more.find((r) => r.label === 'Trả 3 tháng')!.cells.map((c) => c.text)).toEqual(['0đ', '297.000đ', '897.000đ', 'Không bán']);
    expect(more.find((r) => r.label === 'Trả 1 tháng')!.cells.map((c) => c.text)).toEqual(['0đ', '119.000đ', 'Không bán', 'Không bán']);
    expect(rows.find((r) => r.label === 'Trả 1 năm')!.cells.map((c) => c.text)).toEqual(['0đ', '990.000đ', '2.990.000đ', '7.990.000đ']);
    expect(rows.find((r) => r.label === 'Tự động hóa')!.cells.map((c) => c.text)).toEqual(['Khóa', 'Khóa', 'Có', 'Có']);
  });
});

describe('lời mời theo kỳ', () => {
  it('mọi gói lợi như nhau thì ghi đúng mức đó, khác nhau thì ghi mức cao nhất, kỳ ngắn nhất thì không ghi', () => {
    expect(cycleSaving(plans, 'yearly')).toBe('tiết kiệm 17%');
    expect(cycleSaving(plans, 'quarterly')).toBe('');
    expect(cycleSaving(plans, 'monthly')).toBe('');
    // Khởi đầu so với 1 tháng 119.000đ: rẻ hơn 31%; hai gói kia so với 3 tháng: rẻ hơn 17%.
    expect(cycleSaving(custom, 'yearly')).toBe('tiết kiệm tới 31%');
    expect(cycleHint(plans, 'quarterly')).toBe('Trả 3 tháng một lần. Chọn 1 năm: tiết kiệm 17%.');
    expect(cycleHint(plans, 'yearly')).toBe('Trả 1 năm một lần, tiết kiệm 17%.');
  });

  it('giá ghi gọn trong một câu: nhiều kỳ thì ghi "từ", gói không bán kỳ nào thì rỗng', () => {
    expect(priceLine(plans[2]!)).toBe('từ 249.167đ mỗi tháng');
    expect(priceLine({ prices: { monthly: 99_000, quarterly: 0, semiannual: 0, yearly: 0 } })).toBe('99.000đ mỗi tháng');
    expect(priceLine(plans[0]!)).toBe('');
  });
});
