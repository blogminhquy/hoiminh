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

  // Thanh dưới: Hội mở Bảng tin, tab con dẫn tới Thành viên (trước đây không có lối vào trên điện thoại).
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await nav.getByRole('link', { name: 'Hội', exact: true }).click();
  await expect(page).toHaveURL(/\/minhquy\/bang-tin$/);
  await page.getByRole('navigation', { name: 'Mục con' }).getByRole('link', { name: 'Thành viên' }).click();
  await expect(page).toHaveURL(/\/minhquy\/thanh-vien$/);
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
  await expect(page.getByRole('navigation', { name: 'Mục con' }).getByRole('link', { name: 'Cửa hàng' })).toBeVisible();
  await page.goto('/minhquy/hom-nay');
  const learn = page.getByRole('link', { name: /^(Học|Học tiếp)$/ }).first();
  if (await learn.count()) {
    await learn.click();
    await expect(page).toHaveURL(/\/minhquy\/bai\/[0-9a-f-]{36}/);
    await expect(page.getByRole('button', { name: /Danh sách bài/ })).toBeVisible();
    // Thanh dưới nhường chỗ cho nút hoàn thành ở trang bài học.
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toHaveCount(0);
    await expectNoSideScroll(page);
  }
});
