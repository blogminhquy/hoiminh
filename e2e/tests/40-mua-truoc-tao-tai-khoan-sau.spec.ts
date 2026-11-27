// Luồng 40: mua trước, tạo tài khoản sau (27/11/2026). Người lạ bấm "Tham gia" ở hội thu phí → thanh toán bằng tên và
// email, không đăng ký trước → ngân hàng của chủ hội báo có → đặt mật khẩu ngay trên màn đơn hàng → vào thẳng hội.
import { expect, test } from '@playwright/test';
import { ownerBankWebhook, readOrder, uniqueEmail } from '../helpers';

test('người lạ mua gói Premium bằng email, trả xong đặt mật khẩu là vào hội', async ({ page }) => {
  const email = uniqueEmail('muatruoc');
  await page.goto('/minhquy/thanh-toan?tier=premium&cycle=monthly');
  await expect(page.getByRole('heading', { name: 'Thông tin của bạn' })).toBeVisible();
  const pay = page.getByRole('button', { name: /Lấy mã QR chuyển khoản/ });
  // Chưa điền tên và email thì chưa bấm được.
  await expect(pay).toBeDisabled();
  await page.getByLabel('Tên của bạn').fill('Khách Mua Trước');
  await page.getByLabel('Email').fill(email);
  await pay.click();

  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}\?g=[0-9a-f]{40}/);
  await expect(page.getByText(/bạn đặt mật khẩu ngay trên trang này/)).toBeVisible();
  const { reference, amountMinor } = await readOrder(page);
  expect(await ownerBankWebhook(page.request, `KHACH ck ${reference}`, amountMinor)).toBe(200);

  await expect(page.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(email).first()).toBeVisible();
  await page.getByLabel('Đặt mật khẩu').fill('matkhau-e2e-123');
  await page.getByRole('button', { name: 'Tạo tài khoản và vào hội' }).click();
  await expect(page).toHaveURL(/\/minhquy\/khoa-hoc/, { timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Nâng cấp để mở' })).toHaveCount(0);
});
