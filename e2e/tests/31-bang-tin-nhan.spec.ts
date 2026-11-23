// Luồng 31: bấm nút Tin nhắn ở đầu trang thì bảng tin nhắn mở ngay tại chỗ (không nhảy sang /tin-nhan), cùng kiểu bảng
// Thông báo. Esc đóng bảng và trả tiêu điểm về nút; mở chuông thì bảng tin nhắn tự đóng; "Xem tất cả tin nhắn" dẫn tới
// trang Tin nhắn. Điện thoại: bảng trượt từ đáy, rộng hết màn hình, đóng bằng nút X.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

const buttonOf = (page: Page) => page.locator('.notif-wrap > button[aria-haspopup="dialog"][aria-label^="Tin nhắn"]');
const panelOf = (page: Page) => page.getByRole('dialog', { name: 'Tin nhắn' });

test('nút Tin nhắn mở bảng tại chỗ, Esc đóng, chuông đóng bảng, có lối sang trang Tin nhắn', async ({ page }) => {
  await login(page, USERS.owner);
  const button = buttonOf(page);
  const url = page.url();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  const panel = panelOf(page);
  await expect(panel).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(page.url()).toBe(url);
  // Có ô tìm và hai mục lọc như bảng Thông báo.
  await expect(panel.getByRole('searchbox', { name: 'Tìm hội thoại theo tên' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Tất cả', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: /^Chưa đọc/ })).toBeVisible();

  // Esc đóng bảng, tiêu điểm về lại nút.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(button).toBeFocused();

  // Mở chuông thì bảng tin nhắn đóng: mỗi lúc chỉ một bảng nổi.
  await button.click();
  await expect(panel).toBeVisible();
  await page.locator('.notif-wrap > button[aria-label^="Thông báo"]').click();
  await expect(page.getByRole('dialog', { name: 'Thông báo' })).toBeVisible();
  await expect(panel).toBeHidden();
  await page.keyboard.press('Escape');

  // "Xem tất cả tin nhắn" sang trang Tin nhắn và đóng bảng.
  await button.click();
  await panel.getByRole('link', { name: 'Xem tất cả tin nhắn' }).click();
  await expect(page).toHaveURL(/\/tin-nhan$/);
  await expect(panel).toBeHidden();
});

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('bảng tin nhắn trượt từ đáy, rộng hết màn hình, đóng bằng nút X', async ({ page }) => {
    await login(page, USERS.owner);
    await buttonOf(page).click();
    const panel = panelOf(page);
    await expect(panel).toBeVisible();
    await expect.poll(async () => { const b = (await panel.boundingBox())!; return Math.round(b.y + b.height); }).toBe(844);
    const box = (await panel.boundingBox())!;
    expect(box.x).toBe(0);
    expect(Math.round(box.width)).toBe(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await panel.getByRole('button', { name: 'Đóng tin nhắn' }).click();
    await expect(panel).toBeHidden();
    await expect(buttonOf(page)).toBeFocused();
  });
});
