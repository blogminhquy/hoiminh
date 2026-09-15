// Luồng 6: chủ hội đang dùng thử thanh toán gói nền tảng theo tháng qua QR → webhook → thẻ gói đổi sang "gói tháng".
import { expect, test } from '@playwright/test';
import { USERS, login, parseMoney, sepayWebhook } from '../helpers';

test('thanh toán gói nền tảng từ dùng thử', async ({ page, request }) => {
  await login(page, USERS.trialOwner);
  await page.goto('/admin');
  await expect(page.getByText('Gói nền tảng của bạn')).toBeVisible();
  await expect(page.getByText(/dùng thử/i).first()).toBeVisible();
  await page.getByRole('button', { name: /Thanh toán gói/ }).first().click();
  await page.getByRole('button', { name: /^Thanh toán \d/ }).click();

  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  const content = (await page.getByText(/^HM ?[A-Z0-9]{5,8}$/).first().textContent())?.trim() ?? '';
  const total = parseMoney((await page.locator('.serif', { hasText: 'đ' }).last().textContent()) ?? '0');
  expect(await sepayWebhook(request, `VY ENGLISH ${content}`, total)).toBe(200);
  await expect(page.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });

  await page.goto('/admin');
  await expect(page.getByText(/Hội Mình · gói tháng/)).toBeVisible();
});
