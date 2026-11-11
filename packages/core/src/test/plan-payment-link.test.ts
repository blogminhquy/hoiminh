// Gói nền tảng thu tiền bằng link ngoài: quản trị bật được, link phải là https, và khi đang ở chế độ link
// thì không tạo được đơn thanh toán gói qua cổng trong Hội Mình.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as checkout from '../services/checkout';
import * as platformBilling from '../services/platform-billing';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

const LINK = 'https://pay.example.com/hoi-minh-thang?ref={workspace_id}&email={email}';

describe('cleanPayUrl', () => {
  it('giữ nguyên link https kể cả chỗ điền sẵn, rỗng thì là null', () => {
    expect(platformBilling.cleanPayUrl(`  ${LINK} `)).toBe(LINK);
    expect(platformBilling.cleanPayUrl('')).toBeNull();
    expect(platformBilling.cleanPayUrl(null)).toBeNull();
  });

  it('từ chối link không phải https hoặc không phải địa chỉ', () => {
    expect(() => platformBilling.cleanPayUrl('http://pay.example.com/x')).toThrow(/https/);
    expect(() => platformBilling.cleanPayUrl('javascript:alert(1)')).toThrow(/https/);
    expect(() => platformBilling.cleanPayUrl('khong phai link')).toThrow(/không hợp lệ/);
    expect(() => platformBilling.cleanPayUrl(`https://pay.example.com/${'a'.repeat(500)}`)).toThrow(/500/);
  });
});

describe('gói nền tảng thu tiền bằng link ngoài', () => {
  it('mặc định là thanh toán trong Hội Mình', async () => {
    const [plan] = await platformBilling.listPlans(app.system());
    expect(plan).toMatchObject({ key: 'hoiminh', paymentMode: 'gateway', monthlyPayUrl: null, yearlyPayUrl: null });
  });

  it('chỉ quản trị hệ thống được đổi', async () => {
    await expect(platformBilling.updatePlan(await app.as('minhquy'), 'hoiminh', { paymentMode: 'link', monthlyPayUrl: LINK })).rejects.toThrow();
  });

  it('chọn link ngoài mà không có link nào thì bị từ chối, gói giữ nguyên', async () => {
    const admin = await app.as('admin');
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { paymentMode: 'link' })).rejects.toThrow(/ít nhất một link/);
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { paymentMode: 'link', monthlyPayUrl: 'http://pay.example.com' })).rejects.toThrow(/https/);
    expect((await platformBilling.listPlans(app.system()))[0]?.paymentMode).toBe('gateway');
  });

  it('bật link ngoài: bảng giá trả về link, đơn qua cổng bị chặn; tắt đi thì thanh toán lại được', async () => {
    const admin = await app.as('admin');
    const owner = await app.as('minhquy');
    const workspaceId = await app.ids('workspace:minhquy');
    const target = { type: 'platform' as const, workspaceId, cycle: 'monthly' as const };

    const saved = await platformBilling.updatePlan(admin, 'hoiminh', { paymentMode: 'link', monthlyPayUrl: ` ${LINK} `, yearlyPayUrl: '' });
    expect(saved).toMatchObject({ paymentMode: 'link', monthlyPayUrl: LINK, yearlyPayUrl: null });
    expect((await platformBilling.listPlans(app.system()))[0]).toMatchObject({ paymentMode: 'link', monthlyPayUrl: LINK });
    await expect(checkout.createCheckout(owner, { target, provider: 'sepay' })).rejects.toThrow(/link ngoài/);

    // Xóa nốt link cuối khi vẫn ở chế độ link thì cũng bị từ chối.
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { monthlyPayUrl: null })).rejects.toThrow(/ít nhất một link/);

    await platformBilling.updatePlan(admin, 'hoiminh', { paymentMode: 'gateway' });
    const session = await checkout.createCheckout(owner, { target, provider: 'sepay' });
    expect(session.orderId).toBeTruthy();
  });
});
