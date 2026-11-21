// Luồng 24: chủ hội bán gói theo nhiều kỳ hạn và chạy khuyến mãi. Chủ hội thêm kỳ 3 tháng, bật giảm 20% rồi lưu →
// người mua thấy đủ kỳ hạn, giá gốc gạch đi, chọn 3 tháng và nhận mã QR đúng số tiền đã giảm → chủ hội bấm
// "Đã nhận tiền" là người mua được mở quyền. Cuối bài trả giá của hội về như cũ.
import { expect, test } from '@playwright/test';
import { API, USERS, apiJson, apiToken, login, readOrder } from '../helpers';

const SLUG = 'ngoai-ngu-vy';
interface Pricing { pricingMode: string; doorsOpen: boolean; enabledProviders: string[]; tiers: Array<Record<string, unknown> & { key: string }>; promo: unknown }
let before: Pricing | null = null;
let communityId = '';

test.afterAll(async ({ request }) => {
  if (!before || !communityId) return;
  const token = await apiToken(request, USERS.freeOwner);
  await request.put(`${API}/v1/communities/${communityId}/pricing`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, data: JSON.stringify({ pricingMode: before.pricingMode, doorsOpen: before.doorsOpen, enabledProviders: before.enabledProviders, tiers: before.tiers, promo: null }) });
});

test('chủ hội thêm kỳ 3 tháng và giảm 20%; người mua chọn 3 tháng, trả đúng giá đã giảm', async ({ browser, page, request }) => {
  // Chuẩn bị: hội có tài khoản nhận tiền (chủ hội tự bấm đã nhận), ghi lại giá đang có để trả về cuối bài.
  const token = await apiToken(request, USERS.freeOwner);
  communityId = (await apiJson<{ community: { id: string } }>(request, token, 'GET', `/v1/communities/by-slug/${SLUG}/shell`)).community.id;
  await apiJson(request, token, 'PUT', `/v1/communities/${communityId}/payout-account`, { bankCode: 'TCB', accountNumber: '19039998887776', accountHolder: 'NGUYEN THAO VY', confirmMode: 'manual' });
  before = await apiJson<Pricing>(request, token, 'GET', `/v1/communities/${communityId}/pricing`);

  // Chủ hội: thêm kỳ 3 tháng, bật khuyến mãi 20%.
  await login(page, USERS.freeOwner);
  await page.goto(`/${SLUG}/cai-dat/gia`);
  await expect(page.getByRole('heading', { name: 'Giá và gói' })).toBeVisible();
  await expect(page.getByLabel('Giá 1 tháng').first()).toHaveValue('149000');
  await page.getByRole('button', { name: '+ 3 tháng' }).first().click();
  // Dòng mới điền sẵn giá bằng mua lẻ từng tháng (447.000đ), chủ hội hạ xuống để khuyến khích mua dài.
  const price3 = page.getByLabel('Giá 3 tháng').first();
  await expect(price3).toHaveValue('447000');
  await price3.fill('399000');
  await expect(page.getByText(/133\.000đ mỗi tháng/)).toBeVisible();
  await expect(page.getByText('rẻ hơn 11%')).toBeVisible();
  await page.getByRole('switch', { name: 'Bật khuyến mãi' }).click();
  await expect(page.getByLabel('Phần trăm giảm')).toHaveValue('20');
  await expect(page.getByText(/Ví dụ: Premium 1 tháng/)).toContainText('119.200đ');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('button', { name: 'Đã lưu' })).toBeVisible();
  // Tải lại vẫn còn: kỳ hạn và khuyến mãi đã lưu thật.
  await page.reload();
  await expect(page.getByLabel('Giá 3 tháng').first()).toHaveValue('399000');
  await expect(page.getByRole('switch', { name: 'Bật khuyến mãi' })).toHaveAttribute('aria-checked', 'true');

  // Người mua: thấy đủ kỳ hạn, giá gốc gạch đi, chọn 3 tháng.
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await login(buyer, USERS.member2);
  await buyer.goto(`/${SLUG}/thanh-toan?tier=premium`);
  await expect(buyer.getByText('Đang giảm 20%')).toBeVisible();
  const term3 = buyer.getByRole('radiogroup', { name: 'Thời hạn' }).getByRole('radio', { name: /3 tháng/ });
  await expect(term3).toContainText('399.000đ');
  await expect(term3).toContainText('319.200đ');
  await expect(term3).toContainText('Rẻ hơn 11%');
  await expect(buyer.getByRole('radio', { name: /12 tháng/ })).toBeVisible();
  await term3.click();
  await expect(term3).toHaveAttribute('aria-checked', 'true');
  await expect(buyer.getByText('Khuyến mãi 20%')).toBeVisible();
  await buyer.getByRole('button', { name: 'Lấy mã QR chuyển khoản' }).click();
  await expect(buyer).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  expect((await readOrder(buyer)).amountMinor).toBe(319_200);
  await buyer.getByRole('button', { name: 'Tôi đã chuyển khoản' }).click();

  // Chủ hội xác nhận: người mua được mở quyền, gói ghi đúng kỳ 3 tháng.
  await page.goto(`/${SLUG}/cai-dat/nhan-tien`);
  const pending = page.getByRole('region', { name: 'Đơn chờ bạn xác nhận' });
  await expect(pending.getByText('319.200đ')).toBeVisible();
  await pending.getByRole('button', { name: /Đã nhận tiền/ }).click();
  await expect(buyer.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });
  await buyer.goto('/tai-khoan/goi');
  await expect(buyer.getByText(/319\.200đ\/3 tháng/)).toBeVisible();
  await buyerCtx.close();
});
