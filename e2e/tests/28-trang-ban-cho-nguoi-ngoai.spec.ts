// Luồng 28: trang bán của sản phẩm mở cho mọi người. Người lạ (chưa đăng nhập) bấm link sản phẩm của một hội kín thì
// thấy đúng trang bán, không bị đẩy về trang đăng nhập hay trang giới thiệu. Bấm mua thì sang thẳng thanh toán, chỉ cần
// tên và email (mua trước, tạo tài khoản sau, 27/11/2026). Các trang khác của hội kín vẫn đóng với người lạ.
import { expect, test } from '@playwright/test';
import { USERS, login } from '../helpers';

const PRODUCT = '/minhquy/cua-hang/funnel-money-model-2026';

test('người lạ mở link sản phẩm của hội kín: thấy trang bán, bấm mua sang thẳng thanh toán bằng email', async ({ page }) => {
  await page.goto(`${PRODUCT}?ref=hv8k2`);
  await expect(page.getByRole('heading', { level: 1, name: 'Funnel Money Model 2026' })).toBeVisible();
  await expect(page).toHaveURL(/\/minhquy\/cua-hang\/funnel-money-model-2026/);
  // Khung trang công khai: có dải "Sản phẩm của hội", không có thanh bên của hội.
  await expect(page.getByText('Sản phẩm của hội')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem giới thiệu hội' })).toHaveAttribute('href', '/minhquy');
  await expect(page.locator('.app-sidebar')).toHaveCount(0);

  await page.getByRole('link', { name: 'Mua ngay' }).click();
  await expect(page).toHaveURL(/\/minhquy\/thanh-toan\?product=/);
  // Không bắt đăng ký trước: điền tên và email ngay trên trang thanh toán, có lối đăng nhập cho người đã có tài khoản.
  await expect(page.getByRole('heading', { name: 'Thông tin của bạn' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();

  // Cửa hàng và bảng tin của hội kín vẫn đòi đăng nhập.
  await page.goto('/minhquy/cua-hang');
  await expect(page).toHaveURL(/\/dang-nhap/);
  await page.goto('/minhquy/bang-tin');
  await expect(page).toHaveURL(/\/dang-nhap/);
});

test('thành viên mở trang bán vẫn ở trong khung hội như cũ', async ({ page }) => {
  await login(page, USERS.member);
  await page.goto(PRODUCT);
  await expect(page.getByRole('heading', { level: 1, name: 'Funnel Money Model 2026' })).toBeVisible();
  await expect(page.locator('.app-sidebar')).toHaveCount(1);
  await expect(page.getByText('Sản phẩm của hội')).toHaveCount(0);
});
