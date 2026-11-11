// Luồng 6: chủ hội đang dùng thử bấm "Thanh toán gói" → trang /admin/goi → chọn tab tháng → khung thanh toán bật lên → trả qua QR → webhook → thẻ gói đổi sang "gói tháng".
import { expect, test } from '@playwright/test';
import { USERS, login, readOrder, sepayWebhook } from '../helpers';

test('thanh toán gói nền tảng từ dùng thử', async ({ page, request }) => {
  await login(page, USERS.trialOwner);
  await page.goto('/admin');
  await expect(page.getByText('Gói nền tảng của bạn')).toBeVisible();
  await expect(page.getByText(/dùng thử/i).first()).toBeVisible();
  await page.getByRole('link', { name: 'Thanh toán gói' }).click();

  // Trang gói riêng, một cột: hai tab chu kỳ đổi giá trên thẻ gói.
  await expect(page).toHaveURL(/\/admin\/goi$/);
  await expect(page.getByRole('heading', { name: 'Gói Hội Mình' })).toBeVisible();
  await expect(page.getByText('Còn 3 ngày')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Theo tháng' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Theo năm' }).click();
  await expect(page.getByText('4.990.000đ', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Theo tháng' }).click();
  await expect(page.getByText('499.000đ', { exact: true })).toBeVisible();

  // Bấm nút trên thẻ thì khung thanh toán bật lên; cách thanh toán là ô chọn một.
  await page.getByRole('button', { name: 'Thanh toán gói tháng' }).click();
  const pay = page.getByRole('dialog');
  await expect(pay.getByText('Gói theo tháng')).toBeVisible();
  await pay.getByRole('button', { name: 'MoMo' }).click();
  await pay.getByRole('button', { name: 'Chuyển khoản QR' }).click();
  await pay.getByRole('button', { name: /^Thanh toán \d/ }).click();

  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  const { reference, amountMinor } = await readOrder(page);
  expect(await sepayWebhook(request, `VY ENGLISH ${reference}`, amountMinor)).toBe(200);
  await expect(page.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });

  await page.goto('/admin');
  await expect(page.getByText(/Hội Mình · gói tháng/)).toBeVisible();
});
