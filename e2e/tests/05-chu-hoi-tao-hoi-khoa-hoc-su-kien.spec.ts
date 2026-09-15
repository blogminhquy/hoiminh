// Luồng 5: chủ hội tạo hội mới (6 bước) → tạo khóa học → soạn module/bài → đăng → tạo sự kiện lặp hằng tuần.
import { expect, test } from '@playwright/test';
import { USERS, login } from '../helpers';

test('tạo hội, khóa học và sự kiện', async ({ page }) => {
  await login(page, USERS.owner);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Hội của tôi' })).toBeVisible();
  await page.getByRole('link', { name: /Tạo hội của bạn/ }).first().click();

  const slug = `hoi-e2e-${Date.now().toString(36)}`;
  await page.getByPlaceholder('Tên hội của bạn').fill('Hội E2E Playwright');
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByPlaceholder('ten-hoi').fill(slug);
  await expect(page.getByRole('button', { name: /Tiếp tục/ })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.locator('textarea').fill('Hội thử nghiệm tự động cho Playwright.');
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByRole('button', { name: /Tạo hội/ }).click();
  await expect(page.getByText('đã sẵn sàng')).toBeVisible();
  await page.getByRole('link', { name: 'Vào hội' }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/bang-tin`));

  await page.goto(`/${slug}/khoa-hoc/moi`);
  await page.getByLabel(/Tên khóa học/).fill('Khóa học E2E');
  await page.getByRole('button', { name: /Tiếp tục: soạn nội dung/ }).click();
  await expect(page).toHaveURL(/\/soan$/);
  await page.getByRole('button', { name: 'Module' }).click();
  await expect(page.getByText('1. Module 1')).toBeVisible();
  await page.getByRole('button', { name: 'Bài', exact: true }).click();
  await expect(page.getByText('Bài mới').first()).toBeVisible();
  await page.getByRole('button', { name: /Đăng khóa học/ }).click();
  await expect(page.getByText('Đã đăng').first()).toBeVisible();

  await page.goto(`/${slug}/su-kien/moi`);
  await page.getByPlaceholder(/Q&A tuần/).fill('Q&A tuần E2E');
  await page.getByRole('button', { name: 'Hằng tuần', exact: true }).click();
  await page.locator('input[placeholder^="https://zoom"]').fill('https://zoom.us/j/1234567890');
  await page.getByRole('button', { name: /Đăng sự kiện/ }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/su-kien/[0-9a-f-]{36}`));
  await expect(page.getByText('Q&A tuần E2E').first()).toBeVisible();
});
