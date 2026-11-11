import { PLAN_DEFAULTS, type PlanDef } from '@hoiminh/contracts';
import { describe, expect, it } from 'vitest';
import { capView, compareRows, planBadge, tierCards, upgradeSummary, type HoiPlan } from './platform-plan';

const now = new Date('2026-11-11T03:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const plans: PlanDef[] = PLAN_DEFAULTS.map((p) => ({ ...p, features: [...p.features] }));
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

describe('capView', () => {
  it('đếm số chỗ còn lại, chạm trần thì báo đủ, gói không giới hạn thì không có thanh', () => {
    expect(capView(87, 100)).toMatchObject({ text: '87 trên 100', percent: 87, left: 13, full: false });
    expect(capView(87, 100).note).toMatch(/Còn 13 chỗ/);
    expect(capView(100, 100)).toMatchObject({ full: true, percent: 100, left: 0 });
    expect(capView(9_000, null)).toMatchObject({ left: null, full: false });
  });
});

describe('tierCards', () => {
  it('hội Miễn phí, chu kỳ 1 năm: giá quy ra tháng là 10 lần giá tháng chia 12, kèm tổng tiền phải trả', () => {
    const cards = tierCards(plans, free, 87, 'yearly', now);
    expect(cards.map((c) => [c.key, c.state])).toEqual([['free', 'current'], ['starter', 'buy'], ['pro', 'buy'], ['unlimited', 'buy']]);
    expect(cards[1]).toMatchObject({ price: '82.500đ', per: 'mỗi tháng', cta: 'Chọn gói Khởi đầu' });
    expect(cards[1]!.sub).toBe('Trả 990.000đ cho 1 năm, tặng 2 tháng.');
    expect(cards[2]).toMatchObject({ popular: true, cap: 'Tối đa 5.000 thành viên' });
    expect(tierCards(plans, free, 87, 'quarterly', now)[1]).toMatchObject({ price: '99.000đ', sub: 'Trả 297.000đ cho 3 tháng.' });
  });

  it('tính năng trả phí của gói thấp vẫn hiện, ghi rõ có từ gói nào', () => {
    const [f, , pro, unlimited] = tierCards(plans, free, 10, 'yearly', now);
    expect(f!.features).toContainEqual({ text: 'Có từ gói Chuyên nghiệp: tự động hóa', on: false });
    expect(f!.features).toContainEqual({ text: 'Có từ gói Chuyên nghiệp: API', on: false });
    expect(pro!.features.filter((x) => x.on).map((x) => x.text)).toEqual(['Mọi thứ của gói Khởi đầu', 'Không phí trên doanh thu', 'Tự động hóa', 'Tên miền riêng', 'Cộng sự', 'API']);
    expect(unlimited!.features.map((x) => x.text)).toEqual(['Mọi thứ của gói Chuyên nghiệp', 'Không phí trên doanh thu']);
  });

  it('đang ở Chuyên nghiệp với 1.240 thành viên: gói thấp hơn không mua được, cùng gói thì gia hạn, gói trên thì nâng', () => {
    const cards = tierCards(plans, on('pro', 40), 1_240, 'quarterly', now);
    expect(cards.map((c) => c.state)).toEqual(['blocked', 'blocked', 'buy', 'buy']);
    expect(cards[1]!.reason).toMatch(/còn hạn/);
    expect(cards[2]!.cta).toBe('Gia hạn gói Chuyên nghiệp');
    expect(cards[3]!.cta).toBe('Nâng lên Không giới hạn');
    // Hết hạn rồi mà hội vẫn đông hơn trần của gói thấp thì vẫn chưa mua được gói đó.
    const expired = tierCards(plans, { ...free, boughtKey: 'pro', boughtEndsAt: inDays(-1), full: true }, 1_240, 'quarterly', now);
    expect(expired[1]).toMatchObject({ state: 'blocked', reason: 'Tối đa 500 thành viên, hội đang có 1.240.' });
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

describe('compareRows', () => {
  it('có đủ trần, giá hai chu kỳ và bốn tính năng trả phí', () => {
    const rows = compareRows(plans);
    expect(rows.find((r) => r.label === 'Trả 1 năm')!.cells.map((c) => c.text)).toEqual(['0đ', '990.000đ', '2.990.000đ', '7.990.000đ']);
    expect(rows.find((r) => r.label === 'Tự động hóa')!.cells.map((c) => c.text)).toEqual(['Khóa', 'Khóa', 'Có', 'Có']);
  });
});
