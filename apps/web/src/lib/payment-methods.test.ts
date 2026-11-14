import { describe, expect, it } from 'vitest';
import { buyerSummary, initialMethod, ownerRows, type GatewayState, type MethodsSetup } from './payment-methods';

const gw = (provider: GatewayState['provider'], over: Partial<GatewayState> = {}): GatewayState => ({ provider, configured: true, complete: true, missing: [], enabled: true, mode: 'production', summary: {}, webhookUrl: 'http://api/webhooks/hoi/x', lastWebhookAt: null, updatedAt: null, ...over });
const none = (p: GatewayState['provider']) => gw(p, { configured: false, complete: false, enabled: false, webhookUrl: null });
const setup = (over: Partial<MethodsSetup> = {}): MethodsSetup => ({ account: null, gateways: [none('momo'), none('vnpay'), none('paypal'), none('stripe')], methods: [], defaultMethod: null, ...over });
const states = (s: MethodsSetup) => Object.fromEntries(ownerRows(s).map((r) => [r.key, r.state]));

describe('sáu cách nhận tiền của chủ hội', () => {
  it('chưa cài gì: cả sáu hàng đều "chưa cài", không có mặc định', () => {
    const rows = ownerRows(setup());
    expect(rows.map((r) => r.key)).toEqual(['bank', 'sepay_auto', 'momo', 'vnpay', 'paypal', 'stripe']);
    expect(rows.every((r) => r.state === 'off_unset' && !r.isDefault)).toBe(true);
    expect(buyerSummary(setup())).toBe('');
  });

  it('hai cách chuyển khoản dùng chung tài khoản: mỗi lúc bật một cách theo cách xác nhận', () => {
    const manual = setup({ account: { enabled: true, confirmMode: 'manual', lastWebhookAt: null }, methods: ['sepay'], defaultMethod: 'sepay' });
    expect(states(manual)).toMatchObject({ bank: 'on', sepay_auto: 'off' });
    expect(ownerRows(manual).find((r) => r.key === 'bank')?.isDefault).toBe(true);
    const auto = setup({ account: { enabled: true, confirmMode: 'auto', lastWebhookAt: null }, methods: ['sepay'], defaultMethod: 'sepay' });
    expect(states(auto)).toMatchObject({ bank: 'off', sepay_auto: 'on' });
    expect(ownerRows(auto).find((r) => r.key === 'sepay_auto')?.isDefault).toBe(true);
    const offBoth = setup({ account: { enabled: false, confirmMode: 'auto', lastWebhookAt: null } });
    expect(states(offBoth)).toMatchObject({ bank: 'off', sepay_auto: 'off' });
  });

  it('cổng còn thiếu bước webhook là "chưa xong"; cổng tắt là "đang tắt"; mặc định chỉ đánh dấu cổng đang bật', () => {
    const s = setup({
      account: { enabled: true, confirmMode: 'manual', lastWebhookAt: null },
      gateways: [gw('momo'), gw('vnpay', { enabled: false }), gw('paypal', { complete: false, missing: ['Webhook ID'] }), none('stripe')],
      methods: ['sepay', 'momo'],
      defaultMethod: 'momo',
    });
    expect(states(s)).toEqual({ bank: 'on', sepay_auto: 'off', momo: 'on', vnpay: 'off', paypal: 'incomplete', stripe: 'off_unset' });
    expect(ownerRows(s).filter((r) => r.isDefault).map((r) => r.key)).toEqual(['momo']);
    expect(buyerSummary(s)).toBe('Chuyển khoản QR, MoMo (chọn sẵn)');
  });

  it('bước thanh toán chọn sẵn cách mặc định, cách đó không còn thì chọn cách đầu tiên', () => {
    expect(initialMethod(['sepay', 'momo', 'stripe'], 'stripe')).toBe('stripe');
    expect(initialMethod(['sepay', 'momo'], 'stripe')).toBe('sepay');
    expect(initialMethod(['momo'], null)).toBe('momo');
    expect(initialMethod([], 'momo')).toBeNull();
  });
});
