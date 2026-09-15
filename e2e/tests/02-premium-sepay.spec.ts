// Luồng 2: thành viên Tiêu chuẩn bị khóa khóa Premium → checkout QR → webhook SePay báo có → trang tự chuyển → khóa học mở.
import { expect, test } from '@playwright/test';
import { USERS, login, parseMoney, sepayWebhook } from '../helpers';

test('nâng cấp Premium bằng chuyển khoản QR và mở khóa khóa học', async ({ page, request }) => {
  await login(page, USERS.member);
  await page.goto('/minhquy/khoa-hoc');
  await expect(page.getByRole('heading', { name: 'Khóa học' })).toBeVisible();
  await page.getByRole('link', { name: 'Nâng cấp để mở' }).first().click();

  await expect(page).toHaveURL(/\/minhquy\/thanh-toan/);
  await expect(page.getByText('Gói Premium')).toBeVisible();
  await page.getByRole('button', { name: 'Chuyển khoản QR' }).click();
  await page.getByRole('button', { name: /Lấy mã QR chuyển khoản/ }).click();

  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  const content = (await page.getByText(/^HM ?[A-Z0-9]{5,8}$/).first().textContent())?.trim() ?? '';
  expect(content).toMatch(/^HM/);
  const total = parseMoney((await page.locator('.serif', { hasText: 'đ' }).last().textContent()) ?? '0');
  expect(total).toBeGreaterThan(0);

  expect(await sepayWebhook(request, `CONG TRAN ck ${content}`, total)).toBe(200);
  await expect(page.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });

  await page.goto('/minhquy/khoa-hoc');
  await expect(page.getByRole('link', { name: 'Nâng cấp để mở' })).toHaveCount(0);
  await expect(page.getByText('Funnel Money Model 2026').first()).toBeVisible();
});
