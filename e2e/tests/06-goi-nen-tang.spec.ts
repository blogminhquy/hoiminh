// Luồng 6: chủ hội đang dùng thử bấm "Thanh toán gói" → trang /admin/goi → trả theo tháng qua QR → webhook → thẻ gói đổi sang "gói tháng".
import { expect, test } from '@playwright/test';
import { USERS, login, readOrder, sepayWebhook } from '../helpers';

test('thanh toán gói nền tảng từ dùng thử', async ({ page, request }) => {
  await login(page, USERS.trialOwner);
  await page.goto('/admin');
  await expect(page.getByText('Gói nền tảng của bạn')).toBeVisible();
  await expect(page.getByText(/dùng thử/i).first()).toBeVisible();
  await page.getByRole('link', { name: 'Thanh toán gói' }).click();

  // Trang gói riêng: gói đang dùng bên trái, thanh toán bên phải; mặc định theo tháng.
  await expect(page).toHaveURL(/\/admin\/goi$/);
  await expect(page.getByRole('heading', { name: 'Gói Hội Mình' })).toBeVisible();
  await expect(page.getByText('Còn 3 ngày')).toBeVisible();
  await page.getByRole('button', { name: /^Thanh toán \d/ }).click();

  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  const { reference, amountMinor } = await readOrder(page);
  expect(await sepayWebhook(request, `VY ENGLISH ${reference}`, amountMinor)).toBe(200);
  await expect(page.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });

  await page.goto('/admin');
  await expect(page.getByText(/Hội Mình · gói tháng/)).toBeVisible();
});
