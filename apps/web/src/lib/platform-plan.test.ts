import { describe, expect, it } from 'vitest';
import { externalPayUrl, payCycles, pickPlan, planView, priceLabel, yearlySaving, type PlanInput } from './platform-plan';

// Giữa trưa UTC: ngày hiển thị giống nhau ở mọi múi giờ từ UTC-11 tới UTC+11.
const now = new Date('2026-11-10T12:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const sub = (over: Partial<NonNullable<PlanInput['sub']>> = {}): NonNullable<PlanInput['sub']> => ({ status: 'active', billingCycle: 'monthly', currentPeriodEnd: inDays(20), cancelAtPeriodEnd: false, ...over });
const view = (over: Partial<PlanInput>) => planView({ sub: null, trialEndsAt: null, locked: false, now, ...over });
const plan = { key: 'hoiminh', name: 'Hội Mình', monthlyMinor: 499_000, yearlyMinor: 4_990_000 };

describe('planView', () => {
  it('đang dùng thử: nêu số ngày còn lại và ngày hết, cần thanh toán', () => {
    const v = view({ sub: sub({ status: 'trialing', currentPeriodEnd: inDays(10) }) });
    expect(v).toMatchObject({ state: 'trial', name: 'Dùng thử', badge: 'Còn 10 ngày', when: 'đến 20/11/2026', warn: null, needsPayment: true });
  });

  it('dùng thử còn từ 7 ngày trở xuống thì kèm lời nhắc chọn gói', () => {
    expect(view({ sub: sub({ status: 'trialing', currentPeriodEnd: inDays(3) }) }).warn).toContain('Chọn gói');
  });

  it('chưa có bản ghi gói thì tính theo ngày hết dùng thử của workspace', () => {
    expect(view({ trialEndsAt: inDays(5) })).toMatchObject({ state: 'trial', badge: 'Còn 5 ngày', cycle: 'monthly' });
    expect(view({})).toMatchObject({ state: 'trial', badge: 'Đang dùng thử', when: '' });
  });

  it('ngày hết đã qua mà chưa bị khóa: không còn ghi "dùng thử đến" một ngày trong quá khứ', () => {
    const v = view({ sub: sub({ status: 'trialing', currentPeriodEnd: inDays(-41) }) });
    expect(v).toMatchObject({ state: 'overdue', badge: 'Đã hết hạn', when: 'hết hạn 30/09/2026', needsPayment: true });
    expect(v.warn).toContain('không bị khóa');
  });

  it('gói đang chạy: tên theo chu kỳ, còn xa thì không nhắc', () => {
    expect(view({ sub: sub() })).toMatchObject({ state: 'active', name: 'Gói tháng', badge: 'Đang hoạt động', when: 'dùng đến 30/11/2026', warn: null, needsPayment: false });
    expect(view({ sub: sub({ billingCycle: 'yearly', currentPeriodEnd: inDays(200) }) })).toMatchObject({ name: 'Gói năm', cycle: 'yearly' });
  });

  it('gói đang chạy còn từ 7 ngày trở xuống thì nhắc gia hạn', () => {
    expect(view({ sub: sub({ currentPeriodEnd: inDays(2) }) })).toMatchObject({ state: 'active', badge: 'Còn 2 ngày' });
    expect(view({ sub: sub({ currentPeriodEnd: inDays(2) }) }).warn).toContain('Gia hạn');
  });

  it('đã hủy gia hạn thì báo ngày kết thúc', () => {
    expect(view({ sub: sub({ cancelAtPeriodEnd: true }) })).toMatchObject({ state: 'ending', badge: 'Sắp kết thúc', when: 'kết thúc 30/11/2026' });
    expect(view({ sub: sub({ status: 'cancelled' }) }).state).toBe('ending');
  });

  it('bị khóa, hết hạn hoặc quá hạn thanh toán đều báo đang tạm khóa', () => {
    for (const v of [view({ sub: sub(), locked: true }), view({ sub: sub({ status: 'expired' }) }), view({ sub: sub({ status: 'past_due' }) })]) {
      expect(v).toMatchObject({ state: 'locked', badge: 'Đã hết hạn', needsPayment: true });
      expect(v.warn).toContain('tạm khóa');
    }
  });
});

describe('giá gói', () => {
  it('ghi giá theo chu kỳ', () => {
    expect(priceLabel(plan, 'monthly')).toBe('499.000đ/tháng');
    expect(priceLabel(plan, 'yearly')).toBe('4.990.000đ/năm');
  });

  it('lợi của gói năm tính từ giá thật, không ghi cứng', () => {
    expect(yearlySaving(plan)).toBe('2 tháng miễn phí');
    expect(yearlySaving({ ...plan, yearlyMinor: 5_000_000 })).toBe('Tiết kiệm 988.000đ');
    expect(yearlySaving({ ...plan, yearlyMinor: 499_000 * 12 })).toBeNull();
    expect(yearlySaving({ ...plan, monthlyMinor: 0 })).toBeNull();
  });

  it('chọn đúng gói của workspace, không có thì lấy gói đầu, danh sách rỗng thì null', () => {
    const other = { ...plan, key: 'khac' };
    expect(pickPlan([other, plan], 'hoiminh')).toBe(plan);
    expect(pickPlan([other, plan], 'la')).toBe(other);
    expect(pickPlan([], 'hoiminh')).toBeNull();
    expect(pickPlan(undefined, 'hoiminh')).toBeNull();
  });
});

describe('gói thu tiền bằng link ngoài', () => {
  const who = { workspaceId: 'ws-123', email: 'vy+test@gmail.com' };
  const link = { ...plan, paymentMode: 'link' as const, monthlyPayUrl: 'https://pay.example.com/thang?ref={workspace_id}&email={email}&ky={cycle}', yearlyPayUrl: null };

  it('thanh toán trong Hội Mình thì bán cả hai chu kỳ và không có link ngoài', () => {
    expect(payCycles(plan)).toEqual(['monthly', 'yearly']);
    expect(payCycles({ ...plan, paymentMode: 'gateway', monthlyPayUrl: 'https://pay.example.com' })).toEqual(['monthly', 'yearly']);
    expect(externalPayUrl(plan, 'monthly', who)).toBeNull();
  });

  it('link ngoài chỉ bán chu kỳ đã cài link', () => {
    expect(payCycles(link)).toEqual(['monthly']);
    expect(payCycles({ ...link, yearlyPayUrl: 'https://pay.example.com/nam' })).toEqual(['monthly', 'yearly']);
    expect(payCycles({ ...link, monthlyPayUrl: null })).toEqual([]);
    expect(externalPayUrl(link, 'yearly', who)).toBeNull();
  });

  it('điền mã hội, email, chu kỳ vào chỗ trống, có mã hóa ký tự đặc biệt', () => {
    expect(externalPayUrl(link, 'monthly', who)).toBe('https://pay.example.com/thang?ref=ws-123&email=vy%2Btest%40gmail.com&ky=monthly');
  });

  it('link không ghi mã hội thì tự thêm hm_ws và hm_cycle, giữ tham số sẵn có', () => {
    const url = externalPayUrl({ ...link, yearlyPayUrl: 'https://pay.example.com/nam?utm=hm' }, 'yearly', who);
    expect(url).toBe('https://pay.example.com/nam?utm=hm&hm_ws=ws-123&hm_cycle=yearly');
    expect(url).not.toContain('gmail');
  });
});
