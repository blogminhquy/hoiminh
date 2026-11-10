// Thành viên trên máy tính nhỏ (1024px): thanh bên chia nhóm Hôm nay, Hội, Học; nút Viết bài; các trang
// không tràn ngang; đăng xuất từ nav Tài khoản.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

test.use({ viewport: { width: 1024, height: 800 } });

async function expectNoSideScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
}

test('máy tính: thanh bên, viết bài, không tràn ngang, đăng xuất', async ({ page }) => {
  await login(page, USERS.member2);
  await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
  const side = page.locator('aside.app-sidebar');
  // Mục có thể kèm số đếm ("Sự kiện 2", "Khóa học 4%") nên so theo phần đầu của tên.
  for (const label of ['Hôm nay', 'Bảng tin', 'Sự kiện', 'Thành viên', 'Khóa học', 'Cửa hàng']) await expect(side.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible();
  await expectNoSideScroll(page);

  for (const path of ['/minhquy/bang-tin', '/minhquy/khoa-hoc', '/minhquy/su-kien', '/minhquy/thanh-vien', '/tai-khoan/cong-su', '/tin-nhan']) {
    await page.goto(path);
    await expect(side).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectNoSideScroll(page);
  }

  await side.getByRole('link', { name: 'Viết bài' }).click();
  await expect(page.getByRole('dialog').getByText('Tạo bài viết')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Chuyên mục')).not.toHaveValue('');
  await page.keyboard.press('Escape');

  await page.goto('/tai-khoan/goi');
  await page.getByRole('navigation', { name: 'Tài khoản' }).getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/dang-nhap/);
});
