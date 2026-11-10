// Bảng tin: bấm vào bài (tiêu đề, ảnh, số bình luận) thì bài mở trong khung bật lên có nút X, bình luận ngay tại đó,
// đóng lại là vẫn ở Bảng tin, không phải nhảy qua lại hai trang. Trang riêng của bài vẫn mở được bằng link.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

async function expectNoSideScroll(page: Page, width: number): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test('máy tính: mở bài trong khung, bình luận, đóng bằng X, Esc và nút Quay lại', async ({ page }) => {
  await login(page, USERS.member2);
  await page.goto('/minhquy/bang-tin');
  const firstPost = page.locator('article').first();
  const commentsLink = firstPost.getByRole('link', { name: /bình luận$/ });
  const before = Number((await commentsLink.innerText()).replace(/\D/g, ''));
  await commentsLink.click();

  // Khung mở ngay trên Bảng tin: địa chỉ vẫn là bảng tin (kèm ?bai=), tiêu đề Bảng tin vẫn nằm phía sau.
  const dialog = page.getByRole('dialog', { name: /^Bài viết của / });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/minhquy\/bang-tin\?bai=[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Bảng tin' })).toBeAttached();
  await expect(dialog.getByRole('button', { name: 'Đóng' })).toBeVisible();

  const text = `Bình luận trong khung ${Date.now()}`;
  await dialog.getByPlaceholder('Viết bình luận…').fill(text);
  await dialog.getByRole('button', { name: 'Gửi bình luận' }).click();
  await expect(dialog.getByText(text)).toBeVisible();

  // Đóng bằng X: về đúng Bảng tin, số bình luận trên thẻ bài đã tăng.
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/minhquy\/bang-tin$/);
  await expect(page.locator('article').first().getByRole('link', { name: /bình luận$/ })).toHaveText(new RegExp(`^\\s*${before + 1} bình luận$`));

  // Mở lại bằng tiêu đề hoặc nội dung bài, đóng bằng Esc rồi bằng nút Quay lại của trình duyệt.
  await page.locator('article').first().getByRole('link', { name: /bình luận$/ }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.locator('article').first().getByRole('link', { name: /bình luận$/ }).click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/minhquy\/bang-tin$/);

  // Nút mở trang riêng trong khung dẫn tới trang bài viết đầy đủ.
  await page.locator('article').first().getByRole('link', { name: /bình luận$/ }).click();
  await dialog.getByRole('link', { name: 'Mở trang riêng của bài' }).click();
  await expect(page).toHaveURL(/\/minhquy\/bai-viet\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(text)).toBeVisible();
});

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('khung phủ kín màn hình, nút X luôn thấy, tải lại trang vẫn giữ khung', async ({ page }) => {
    await login(page, USERS.member2);
    await page.goto('/minhquy/bang-tin');
    await page.locator('article').first().getByRole('link', { name: /bình luận$/ }).click();
    const dialog = page.getByRole('dialog', { name: /^Bài viết của / });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.width).toBe(390);
    expect(box!.height).toBe(844);
    await expectNoSideScroll(page, 390);
    // Cuộn xuống cuối khung, nút X vẫn nằm trong màn hình.
    await dialog.getByPlaceholder('Viết bình luận…').scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('button', { name: 'Đóng' })).toBeInViewport();

    await page.reload();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/minhquy\/bang-tin$/);
  });
});
