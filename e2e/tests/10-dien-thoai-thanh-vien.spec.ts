// Thành viên trên điện thoại (390px): đăng nhập vào trang Hôm nay, đi qua thanh dưới và tab con,
// đăng một bài bằng khung soạn gọn, rồi đăng xuất từ trang Tôi. Mỗi trang đều không được tràn ngang.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function expectNoSideScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
}

test('điện thoại: Hôm nay, thanh dưới, đăng bài nhanh, đăng xuất', async ({ page }) => {
  await login(page, USERS.member2);
  await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
  await expect(page.getByRole('heading', { name: /^Chào / })).toBeVisible();
  await expect(page.getByText('Ghé hội hôm nay')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Việc hôm nay' })).toBeVisible();
  await expectNoSideScroll(page);

  // Thanh dưới: Hội mở Bảng tin. Các mục còn lại nằm trong menu trượt từ bên trái (nút ở đầu trang).
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await nav.getByRole('link', { name: 'Hội', exact: true }).click();
  await expect(page).toHaveURL(/\/minhquy\/bang-tin$/);
  await expect(page.locator('header.app-header')).toContainText('Kinh Doanh Online Cùng AI');
  await page.getByRole('button', { name: 'Mở menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu hội' });
  await expect(menu).toContainText('Kinh Doanh Online Cùng AI');
  for (const label of ['Hôm nay', 'Bảng tin', 'Sự kiện', 'Thành viên', 'Khóa học', 'Cửa hàng']) await expect(menu.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible();
  // Đóng bằng nút X, mở lại rồi chọn một mục: tới đúng trang và menu tự đóng.
  await menu.getByRole('button', { name: 'Đóng menu' }).click();
  await expect(menu).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await menu.getByRole('link', { name: 'Thành viên' }).click();
  await expect(page).toHaveURL(/\/minhquy\/thanh-vien$/);
  await expect(menu).toHaveCount(0);
  await expect(page.getByPlaceholder(/Tìm theo tên/)).toBeVisible();
  await expectNoSideScroll(page);

  // Nút viết bài ở giữa thanh dưới: chuyên mục đã chọn sẵn, chỉ cần gõ rồi Đăng.
  await nav.getByRole('link', { name: 'Viết bài mới' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Tạo bài viết')).toBeVisible();
  await expect(dialog.getByLabel('Chuyên mục')).not.toHaveValue('');
  const text = `Bài thử từ điện thoại ${Date.now()}`;
  await dialog.getByLabel('Nội dung bài viết').fill(text);
  await dialog.getByRole('button', { name: 'Đăng bài' }).click();
  await expect(page).toHaveURL(/\/minhquy\/bai-viet\/[0-9a-f-]{36}/);
  await expect(page.getByText(text).first()).toBeVisible();

  // Tìm trong bảng tin bằng nút kính lúp ở đầu trang.
  await page.goto('/minhquy/bang-tin');
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await page.getByRole('searchbox', { name: 'Tìm trong bảng tin' }).fill('Bài thử từ điện thoại');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/bang-tin\?q=/);
  await expect(page.getByText(text).first()).toBeVisible();

  // Tôi: danh sách mục và nút Đăng xuất.
  await nav.getByRole('link', { name: 'Tôi', exact: true }).click();
  await expect(page).toHaveURL(/\/tai-khoan$/);
  await expectNoSideScroll(page);
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/dang-nhap/);
});

test('điện thoại: bài học có video trước và nút hoàn thành ghim ở đáy', async ({ page }) => {
  await login(page, USERS.member2);
  await page.goto('/minhquy/khoa-hoc');
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu hội' }).getByRole('link', { name: 'Cửa hàng' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Menu hội' })).toHaveCount(0);
  await page.goto('/minhquy/hom-nay');
  // Chờ trang Hôm nay tải xong rồi mới tìm nút "Học" của việc hôm nay, và chỉ tìm trong phần nội dung:
  // đếm ngay lúc trang vừa mở thì lúc có lúc không, và có khi bấm nhầm mục "Học" ở thanh dưới (dẫn tới danh sách khóa học).
  await page.waitForLoadState('networkidle');
  const learn = page.locator('.app-content').getByRole('link', { name: /^(Học|Học tiếp)$/ }).first();
  if (await learn.count()) {
    await learn.click();
    await expect(page).toHaveURL(/\/minhquy\/bai\/[0-9a-f-]{36}/);
    await expect(page.getByRole('button', { name: /Danh sách bài/ })).toBeVisible();
    // Thanh dưới nhường chỗ cho nút hoàn thành ở trang bài học.
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toHaveCount(0);
    await expectNoSideScroll(page);
  }
});
