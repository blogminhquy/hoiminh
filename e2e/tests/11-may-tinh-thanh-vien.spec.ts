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
  // Logo Hội Mình ở góc trên trái thanh bên; tên hội đứng ở đầu trang, bấm vào để chuyển hội.
  await expect(side.getByRole('link', { name: /^Hội Mình/ })).toHaveAttribute('href', '/kham-pha');
  const switcher = page.locator('header.app-header').getByRole('button', { name: /chuyển hội$/ });
  await expect(switcher).toContainText('Kinh Doanh Online');
  await switcher.click();
  await expect(page.getByRole('menu').getByRole('menuitem', { name: /Khám phá hội khác/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expectNoSideScroll(page);

  for (const path of ['/minhquy/bang-tin', '/minhquy/khoa-hoc', '/minhquy/su-kien', '/minhquy/thanh-vien', '/tai-khoan/cong-su', '/tin-nhan']) {
    await page.goto(path);
    await expect(side).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectNoSideScroll(page);
  }

  await side.getByRole('link', { name: 'Viết bài' }).click();
  await expect(page.getByRole('dialog').getByText('Tạo bài viết')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Chuyên mục')).not.toHaveText(/Chọn chuyên mục|Đang tải/);
  // Nền màu cho bài ngắn: ô đầu là "Không nền", sau đó 8 màu; chọn màu nào thì ô đó được đánh dấu.
  await page.getByRole('dialog').getByRole('button', { name: /^Thêm/ }).click();
  const bgs = page.getByRole('dialog').getByRole('radiogroup', { name: 'Nền màu' });
  await expect(bgs.getByRole('radio')).toHaveCount(9);
  await expect(bgs.getByRole('radio', { name: 'Không nền' })).toBeChecked();
  await bgs.getByRole('radio', { name: 'Nền Xanh ngọc' }).click();
  await expect(bgs.getByRole('radio', { name: 'Nền Xanh ngọc' })).toBeChecked();
  await expect(bgs.getByRole('radio', { name: 'Không nền' })).not.toBeChecked();
  // Dải màu không nằm trong vùng cuộn: vòng chọn quanh ô không bị mép khung cắt.
  expect(await bgs.evaluate((el) => getComputedStyle(el).overflowX)).toBe('visible');
  await page.keyboard.press('Escape');

  await page.goto('/tai-khoan/goi');
  await page.getByRole('navigation', { name: 'Tài khoản' }).getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/dang-nhap/);
});

test('máy tính: thu gọn thanh menu bên trái còn dải biểu tượng, tải lại vẫn nhớ, mở ra lại như cũ', async ({ page }) => {
  await login(page, USERS.member2);
  await page.goto('/minhquy/bang-tin');
  const side = page.locator('aside.app-sidebar');
  const width = async () => Math.round((await side.boundingBox())!.width);
  await expect(side.getByText('Bảng tin', { exact: true })).toBeVisible();
  expect(await width()).toBe(264);

  await side.getByRole('button', { name: 'Thu gọn menu' }).click();
  await expect.poll(width).toBe(72);
  // Chữ ẩn đi, nhưng mỗi mục vẫn có tên (đọc màn hình, rê chuột) và vẫn bấm được.
  await expect(side.getByText('Bảng tin', { exact: true })).toBeHidden();
  await expect(side.getByRole('link', { name: 'Sự kiện' })).toHaveAttribute('title', 'Sự kiện');
  await expect(side.getByRole('link', { name: 'Viết bài' })).toBeVisible();
  await expectNoSideScroll(page);
  await side.getByRole('link', { name: 'Thành viên' }).click();
  await expect(page).toHaveURL(/\/minhquy\/thanh-vien$/);

  // Lựa chọn được nhớ ở máy: tải lại trang vẫn thu gọn.
  await page.reload();
  await expect(side.getByRole('button', { name: 'Mở rộng menu' })).toBeVisible();
  expect(await width()).toBe(72);

  await side.getByRole('button', { name: 'Mở rộng menu' }).click();
  await expect.poll(width).toBe(264);
  await expect(side.getByText('Bảng tin', { exact: true })).toBeVisible();
});
