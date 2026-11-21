// Luồng 1: đăng ký với mã affiliate → xác minh email (OTP test 482913) → vào thẳng hội vừa xem (bảng câu hỏi tự mở,
// không phải bấm "Tham gia" lần nữa) → Bảng tin có dữ liệu. Hội không có câu hỏi thì vào luôn Bảng tin.
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
  // Trang tự gửi khi đủ 6 số (useEffect trong VerifyEmail). Đừng bấm nút "Xác minh": nếu bấm trúng
  // lúc đang gửi thì nút đang disabled, rồi điều hướng gỡ luôn phần tử khỏi DOM và click treo hết giờ.
  await expect(page).not.toHaveURL(/xac-minh-email/, { timeout: 20_000 });

  // Đăng ký từ trang của hội thì xong là vào thẳng hội đó: về trang giới thiệu và bảng câu hỏi tham gia tự mở.
  await expect(page).toHaveURL(/\/minhquy(\?|$)/);
  const modal = page.getByRole('dialog').or(page.locator('.modal'));
  await expect(modal.first()).toBeVisible();
  await modal.locator('textarea').first().fill('Bán phụ kiện điện thoại trên Shopee');
  await modal.getByRole('button', { name: /Tham gia|Gửi|Xác nhận/ }).last().click();

  await expect(page).toHaveURL(/\/minhquy\/bang-tin/);
  await expect(page.getByText('Lộ trình Funnel Money Model 2026').first()).toBeVisible();
});

test('bấm "Tham gia hội" trên thanh đầu trang của một hội, đăng ký xong vào thẳng Bảng tin của hội đó', async ({ page }) => {
  await page.goto('/ngoai-ngu-vy');
  await page.getByRole('link', { name: 'Tham gia hội' }).click();
  await expect(page).toHaveURL(/\/dang-ky\?hoi=ngoai-ngu-vy/);

  await page.getByPlaceholder('Nguyễn Minh Quý').fill('Người Mới E2E');
  await page.getByPlaceholder('ban@email.com').fill(uniqueEmail('header'));
  await page.locator('input[type="password"]').fill('matkhau-e2e-123');
  await page.getByText(/Tôi đồng ý với/).click();
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page).toHaveURL(/xac-minh-email/);
  await page.getByLabel('Số thứ 1').click();
  await page.keyboard.type('482913');

  // Hội miễn phí, không có câu hỏi: không dừng ở trang giới thiệu, không rơi về màn Tạo hội.
  await expect(page).toHaveURL(/\/ngoai-ngu-vy\/bang-tin/, { timeout: 20_000 });
});

test('thành viên bấm "Đăng nhập" trên thanh đầu trang của hội thì vào Bảng tin của hội đó', async ({ page }) => {
  await page.goto('/minhquy');
  await page.getByRole('link', { name: 'Đăng nhập' }).first().click();
  await page.getByPlaceholder('ban@email.com').fill('congtran@gmail.com');
  await page.locator('input[type="password"]').fill('hoiminh123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/minhquy\/bang-tin/, { timeout: 20_000 });
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
