// Bảng tin: bấm vào bài (tiêu đề, ảnh, nút Bình luận) thì bài mở trong khung bật lên có nút X, bố cục như Facebook:
// ô viết bình luận ghim ở đáy khung, bài viết và bình luận cuộn phía trên. Cảm xúc có sáu loại, rê chuột để chọn.
// Đóng lại là vẫn ở Bảng tin. Trang riêng của bài vẫn mở được bằng link.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

async function expectNoSideScroll(page: Page, width: number): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

const openFirst = (page: Page) => page.locator('article').first().getByRole('link', { name: 'Bình luận', exact: true }).click();

test('máy tính: mở bài trong khung, bình luận ở ô ghim đáy, đóng bằng X, Esc và nút Quay lại', async ({ page }) => {
  await login(page, USERS.member2);
  await page.goto('/minhquy/bang-tin');
  const firstPost = page.locator('article').first();
  // count() không tự chờ: phải đợi thẻ bài hiện ra rồi mới đọc số bình luận.
  await expect(firstPost.getByRole('link', { name: 'Bình luận', exact: true })).toBeVisible();
  const countLink = firstPost.getByRole('link', { name: /^\d+ bình luận$/ });
  const before = (await countLink.count()) ? Number((await countLink.innerText()).replace(/\D/g, '')) : 0;
  await openFirst(page);

  // Khung mở ngay trên Bảng tin: địa chỉ vẫn là bảng tin (kèm ?bai=), tiêu đề Bảng tin vẫn nằm phía sau.
  const dialog = page.getByRole('dialog', { name: /^Bài viết của / });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/minhquy\/bang-tin\?bai=[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Bảng tin' })).toBeAttached();
  await expect(dialog.getByRole('button', { name: 'Đóng' })).toBeVisible();

  // Ô viết bình luận nằm ở đáy khung, đứng yên kể cả khi cuộn phần nội dung lên đầu hay xuống cuối.
  const box = dialog.getByPlaceholder(/^Bình luận dưới tên /);
  await expect(box).toBeInViewport();
  const dialogBox = (await dialog.boundingBox())!;
  const inputBox = (await box.boundingBox())!;
  expect(dialogBox.y + dialogBox.height - (inputBox.y + inputBox.height)).toBeLessThan(40);
  await dialog.locator('.post-popup-body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(box).toBeInViewport();
  expect(Math.round((await box.boundingBox())!.y)).toBe(Math.round(inputBox.y));

  const text = `Bình luận trong khung ${Date.now()}`;
  await box.fill(text);
  await box.press('Enter');
  await expect(dialog.getByText(text)).toBeInViewport();
  await expect(box).toHaveValue('');

  // Đóng bằng X: về đúng Bảng tin, số bình luận trên thẻ bài đã tăng.
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/minhquy\/bang-tin$/);
  await expect(page.locator('article').first().getByRole('link', { name: `${before + 1} bình luận`, exact: true })).toBeVisible();

  // Mở lại, đóng bằng Esc rồi bằng nút Quay lại của trình duyệt.
  await openFirst(page);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await openFirst(page);
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/minhquy\/bang-tin$/);

  // Nút mở trang riêng trong khung dẫn tới trang bài viết đầy đủ.
  await openFirst(page);
  await dialog.getByRole('link', { name: 'Mở trang riêng của bài' }).click();
  await expect(page).toHaveURL(/\/minhquy\/bai-viet\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(text)).toBeVisible();
});

test('cảm xúc sáu loại: bấm là Thích, rê chuột để chọn loại khác, bấm lại để gỡ', async ({ page }) => {
  await login(page, USERS.member2);
  await page.goto('/minhquy/bang-tin');
  // Bài cuối trong lượt tải đầu: ít khả năng tài khoản thử đã thả cảm xúc sẵn.
  const post = page.locator('article').nth(2);
  const main = post.getByRole('button', { name: /^(Thích|.+, bấm để gỡ)$/ });
  if ((await main.getAttribute('aria-pressed')) === 'true') { await main.click(); await expect(main).toHaveAttribute('aria-pressed', 'false'); }

  await main.click();
  await expect(main).toHaveAttribute('aria-pressed', 'true');
  await expect(main).toHaveText(/Thích/);

  // Rê chuột: thanh cảm xúc bật ra, chọn Haha thì nút đổi theo, tổng số không cộng thêm.
  const summary = post.getByRole('img', { name: /lượt cảm xúc/ });
  const total = (await summary.getAttribute('aria-label'))!.match(/^\d+/)![0];
  // Chuột đang nằm sẵn trên nút sau lượt bấm: đưa ra ngoài rồi rê lại vào như người dùng thật.
  await page.mouse.move(0, 0);
  await main.hover();
  const picker = post.getByRole('group', { name: 'Chọn cảm xúc' });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('button')).toHaveCount(6);
  await picker.getByRole('button', { name: 'Haha' }).click();
  await expect(picker).toHaveCount(0);
  await expect(main).toHaveText(/Haha/);
  await expect(summary).toHaveAttribute('aria-label', new RegExp(`^${total} lượt cảm xúc: .*Haha`));

  // Mở bài trong khung: cảm xúc đã chọn hiện đúng, bấm lần nữa là gỡ.
  await post.getByRole('link', { name: 'Bình luận', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^Bài viết của / });
  const inDialog = dialog.getByRole('button', { name: 'Haha, bấm để gỡ' });
  await expect(inDialog).toBeVisible();
  await inDialog.click();
  await expect(dialog.getByRole('button', { name: 'Thích', exact: true }).first()).toHaveAttribute('aria-pressed', 'false');
});

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('khung phủ kín màn hình, nút X và ô bình luận luôn thấy, tải lại trang vẫn giữ khung', async ({ page }) => {
    await login(page, USERS.member2);
    await page.goto('/minhquy/bang-tin');
    await openFirst(page);
    const dialog = page.getByRole('dialog', { name: /^Bài viết của / });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.width).toBe(390);
    expect(box!.height).toBe(844);
    await expectNoSideScroll(page, 390);
    // Cuộn xuống cuối phần nội dung: nút X ở trên và ô bình luận ở dưới vẫn nằm trong màn hình.
    await dialog.locator('.post-popup-body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(dialog.getByRole('button', { name: 'Đóng' })).toBeInViewport();
    await expect(dialog.getByPlaceholder(/^Bình luận dưới tên /)).toBeInViewport();

    await page.reload();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/minhquy\/bang-tin$/);
  });
});
