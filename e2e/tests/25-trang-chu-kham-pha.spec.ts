// Trang chủ "/" chính là trang Khám phá, không còn địa chỉ /kham-pha riêng. Khách thấy Khám phá ngay ở "/";
// người đã đăng nhập vừa mở app thì vào thẳng hội của mình, bấm logo trong app thì xem Khám phá ở "/".
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

const HERO = 'Học cùng những người đi trước, trong hội của mình.';
const pathAndQuery = (page: Page) => { const u = new URL(page.url()); return u.pathname + u.search; };

test('khách: Khám phá hiện ngay ở trang chủ, địa chỉ cũ /kham-pha chuyển về trang chủ', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: HERO })).toBeVisible();
  expect(pathAndQuery(page)).toBe('/');
  // Logo và mục Khám phá ở đầu trang đều trỏ về trang chủ.
  const header = page.locator('header');
  await expect(header.getByRole('link', { name: 'Hội Mình', exact: true })).toHaveAttribute('href', '/');
  await expect(header.getByRole('link', { name: 'Khám phá', exact: true })).toHaveAttribute('href', '/');
  // Lọc danh mục và tìm kiếm vẫn ở trang chủ.
  await page.getByRole('button', { name: 'Kinh doanh', exact: true }).click();
  await expect(page).toHaveURL(/\/\?danh-muc=/);
  await expect(page.getByRole('heading', { name: HERO })).toBeVisible();
  // Link cũ (đã lưu, đã chia sẻ) chuyển về trang chủ và giữ bộ lọc.
  await page.goto('/kham-pha?q=AI');
  await expect(page.getByText('Kết quả cho “AI”')).toBeVisible();
  expect(pathAndQuery(page)).toBe('/?q=AI');
  await page.goto('/kham-pha');
  await expect(page.getByRole('heading', { name: HERO })).toBeVisible();
  expect(pathAndQuery(page)).toBe('/');
});

test('thành viên: mở app thì vào hội của mình, bấm logo thì xem Khám phá ở trang chủ', async ({ page }) => {
  await login(page, USERS.member2);
  await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
  // Gõ địa chỉ trang chủ hoặc mở từ biểu tượng màn hình chính: về thẳng trang Hôm nay của hội.
  await page.goto('/');
  await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
  await page.goto('/?nguon=man-hinh-chinh');
  await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
  // Bấm logo trong app: xem Khám phá ngay ở trang chủ, tải lại trang vẫn ở đó.
  await page.locator('aside.app-sidebar').getByRole('link', { name: /^Hội Mình/ }).click();
  await expect(page.getByRole('heading', { name: HERO })).toBeVisible();
  expect(pathAndQuery(page)).toBe('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: HERO })).toBeVisible();
  expect(pathAndQuery(page)).toBe('/');
  // Link Khám phá có sẵn bộ lọc mở đúng danh sách đó, không bị đưa về hội.
  await page.goto('/?q=AI');
  await expect(page.getByText('Kết quả cho “AI”')).toBeVisible();
  // Địa chỉ cũ vẫn mở được Khám phá.
  await page.goto('/kham-pha');
  await expect(page.getByRole('heading', { name: HERO })).toBeVisible();
  expect(pathAndQuery(page)).toBe('/');
});
