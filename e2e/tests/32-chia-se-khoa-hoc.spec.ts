// Luồng 32: thành viên chia sẻ khóa học ngay ở thư viện khóa học. Thẻ khóa có dòng nhỏ "Nhận ... khi chia sẻ" ghi số
// tiền (không ghi phần trăm); bấm vào mở bảng hai lựa chọn: giới thiệu khóa học này (link trang bán lẻ) và giới thiệu
// vào hội (link trang hội), link nào cũng kèm mã giới thiệu. Điện thoại: bảng không làm trang tràn ngang.
// Người không phải thành viên không có dòng chia sẻ: kiểm ở packages/core/src/test/course-share.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { login, USERS } from '../helpers';

/** Dòng chia sẻ của một khóa bán lẻ (ghi tiền mỗi đơn, không có "/tháng"). */
const retailLine = (page: Page) => page.getByRole('button', { name: /^Nhận [\d.]+đ khi chia sẻ/ }).first();

test('thẻ khóa có dòng chia sẻ ghi số tiền; bảng chia sẻ có link khóa và link hội kèm mã', async ({ page }) => {
  await login(page, USERS.member);
  await page.goto('/minhquy/khoa-hoc');
  const line = retailLine(page);
  await expect(line).toBeVisible();
  await expect(line).not.toContainText('%');
  await line.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Giới thiệu khóa học này' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Giới thiệu vào hội' })).toBeVisible();
  const courseUrl = (await dialog.getByTestId('share-url-course').textContent()) ?? '';
  const communityUrl = (await dialog.getByTestId('share-url-community').textContent()) ?? '';
  expect(courseUrl).toMatch(/\/minhquy\/cua-hang\/[^?]+\?ref=[a-z0-9]+$/);
  expect(communityUrl).toMatch(/\/minhquy\?ref=[a-z0-9]+$/);
  // Cùng một mã cho cả hai link, và đúng mã hiện ở cuối bảng.
  const code = courseUrl.split('?ref=')[1]!;
  expect(communityUrl.endsWith(`?ref=${code}`)).toBe(true);
  await expect(dialog.getByText(code, { exact: true })).toBeVisible();
  await expect(dialog).not.toContainText('%');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('bảng chia sẻ vừa màn hình, không làm trang tràn ngang', async ({ page }) => {
    await login(page, USERS.member);
    await page.goto('/minhquy/khoa-hoc');
    await retailLine(page).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('share-url-course')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
