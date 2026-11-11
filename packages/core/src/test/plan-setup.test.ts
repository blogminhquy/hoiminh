// Thiết lập gói từ màn quản trị khi database chưa có gói nào (database thật từng ở trạng thái này: bảng plans trống
// nên chủ hội thấy giá "…" và quản trị không có gì để sửa).
import { platformSubscriptions, plans } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as platformBilling from '../services/platform-billing';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
  // Đăng ký gói trỏ tới gói bằng khóa ngoại, nên phải gỡ trước (database thật lúc trống gói cũng không có đăng ký nào).
  await app.ctx.db.delete(platformSubscriptions);
  await app.ctx.db.delete(plans);
}, 180_000);
afterAll(async () => {
  await app.close();
});

const BASE = { name: 'Hội Mình', monthlyMinor: 499_000, yearlyMinor: 4_990_000, trialDays: 14 };

describe('thiết lập gói khi chưa có gói nào', () => {
  it('chưa có gói: bảng giá rỗng, số liệu quản trị không có gói', async () => {
    expect(await platformBilling.listPlans(app.system())).toEqual([]);
    expect((await platformBilling.planStats(await app.as('admin'))).plan).toBeUndefined();
  });

  it('chỉ quản trị hệ thống tạo được gói', async () => {
    await expect(platformBilling.updatePlan(await app.as('minhquy'), 'hoiminh', BASE)).rejects.toThrow();
    expect(await platformBilling.listPlans(app.system())).toEqual([]);
  });

  it('thiếu tên hoặc giá, giá không dương, ngày dùng thử ngoài khoảng thì không tạo', async () => {
    const admin = await app.as('admin');
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { name: 'Hội Mình', monthlyMinor: 499_000 })).rejects.toThrow(/đủ tên, giá tháng và giá năm/);
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { ...BASE, name: '   ' })).rejects.toThrow(/Tên gói/);
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { ...BASE, monthlyMinor: 0 })).rejects.toThrow(/Giá tháng/);
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { ...BASE, yearlyMinor: -1 })).rejects.toThrow(/Giá năm/);
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { ...BASE, monthlyMinor: 499_000.5 })).rejects.toThrow(/Giá tháng/);
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { ...BASE, trialDays: 400 })).rejects.toThrow(/dùng thử/);
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { ...BASE, paymentMode: 'link' })).rejects.toThrow(/ít nhất một link/);
    expect(await platformBilling.listPlans(app.system())).toEqual([]);
  });

  it('không tạo được gói thứ hai với khóa khác', async () => {
    await expect(platformBilling.updatePlan(await app.as('admin'), 'goi-khac', BASE)).rejects.toThrow();
    expect(await platformBilling.listPlans(app.system())).toEqual([]);
  });

  it('tạo gói: chủ hội thấy giá ngay, quản trị thấy gói để sửa tiếp', async () => {
    const admin = await app.as('admin');
    const created = await platformBilling.updatePlan(admin, 'hoiminh', { ...BASE, name: '  Hội Mình ' });
    expect(created).toMatchObject({ key: 'hoiminh', name: 'Hội Mình', monthlyMinor: 499_000, yearlyMinor: 4_990_000, trialDays: 14, paymentMode: 'gateway', isActive: true });
    expect(await platformBilling.listPlans(app.system())).toHaveLength(1);
    expect((await platformBilling.planStats(admin)).plan).toMatchObject({ key: 'hoiminh', monthlyMinor: 499_000 });
  });

  it('gói đã có thì lần lưu sau là sửa, không tạo trùng; giá sai vẫn bị từ chối', async () => {
    const admin = await app.as('admin');
    const saved = await platformBilling.updatePlan(admin, 'hoiminh', { monthlyMinor: 599_000 });
    expect(saved).toMatchObject({ monthlyMinor: 599_000, yearlyMinor: 4_990_000 });
    await expect(platformBilling.updatePlan(admin, 'hoiminh', { yearlyMinor: 0 })).rejects.toThrow(/Giá năm/);
    expect(await platformBilling.listPlans(app.system())).toHaveLength(1);
  });

  it('tạo gói kèm luôn link thanh toán ngoài', async () => {
    const admin = await app.as('admin');
    await app.ctx.db.delete(plans);
    const created = await platformBilling.updatePlan(admin, 'hoiminh', { ...BASE, paymentMode: 'link', monthlyPayUrl: 'https://pay.example.com/thang' });
    expect(created).toMatchObject({ paymentMode: 'link', monthlyPayUrl: 'https://pay.example.com/thang', yearlyPayUrl: null });
  });
});
