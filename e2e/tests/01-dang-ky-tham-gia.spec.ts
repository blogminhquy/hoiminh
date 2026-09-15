// Luồng 1: đăng ký với mã cộng sự → xác minh email (OTP test 482913) → trang giới thiệu → tham gia Freemium → Bảng tin có dữ liệu.
import { expect, test } from '@playwright/test';
import { uniqueEmail } from '../helpers';

test('đăng ký, xác minh, tham gia hội miễn phí và thấy Bảng tin', async ({ page }) => {
  const email = uniqueEmail('member');
  await page.goto('/minhquy?ref=hv8k2');
  await expect(page.getByText('Kinh Doanh Online Cùng AI').first()).toBeVisible();
  await page.getByRole('button', { name: /Tham gia miễn phí/ }).first().click();
  await expect(page).toHaveURL(/dang-ky/);

  await page.getByPlaceholder('Nguyễn Minh Quý').fill('Thành viên E2E');
  await page.getByPlaceholder('ban@email.com').fill(email);
  await page.locator('input[type="password"]').fill('matkhau-e2e-123');
  await page.getByText(/Tôi đồng ý với/).click();
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

  await expect(page).toHaveURL(/xac-minh-email/);
  await page.getByLabel('Số thứ 1').click();
  await page.keyboard.type('482913');
  // Trang tự gọi xác minh ngay khi đủ 6 số, nên chỉ chờ chuyển trang; bấm nút ở đây sẽ đua với lần tự gọi đó.
  await expect(page).not.toHaveURL(/xac-minh-email/, { timeout: 20_000 });

  await page.goto('/minhquy');
  await page.getByRole('button', { name: /Tham gia miễn phí/ }).first().click();
  const modal = page.getByRole('dialog').or(page.locator('.modal'));
  await expect(modal.first()).toBeVisible();
  await modal.locator('textarea').first().fill('Bán phụ kiện điện thoại trên Shopee');
  await modal.getByRole('button', { name: /Tham gia|Gửi|Xác nhận/ }).last().click();

  await expect(page).toHaveURL(/\/minhquy\/bang-tin/);
  await expect(page.getByText('Lộ trình Funnel Money Model 2026').first()).toBeVisible();
});

test('đăng nhập sai mật khẩu báo lỗi, đúng thì vào được', async ({ page }) => {
  await page.goto('/dang-nhap');
  await page.getByPlaceholder('ban@email.com').fill('minhquy@gmail.com');
  await page.locator('input[type="password"]').fill('sai-mat-khau');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText(/không đúng|sai|Unauthorized|unauthorized/i).first()).toBeVisible();
  await page.locator('input[type="password"]').fill('hoiminh123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/dang-nhap/);
});
