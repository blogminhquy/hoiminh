// Cài đặt · Chung: chủ hội tải logo vuông, ảnh bìa, rồi thêm, xếp lại, sửa và xóa ảnh, video của trang giới thiệu.
// Người lạ mở link hội thấy đúng bộ ảnh và video đó, ảnh bìa ở thẻ hội, và không thấy nút sửa.
import { devices, expect, test, type Page } from '@playwright/test';
import { API, USERS, login } from '../helpers';

const SLUG = 'ai-agent-shop';

/** Một ảnh PNG thật (chụp một trang màu trơn) để trình duyệt nén và tải lên như ảnh người dùng chọn. */
async function png(page: Page, name: string, color: string, width = 640, height = 360) {
  const p = await page.context().newPage();
  await p.setViewportSize({ width, height });
  await p.setContent(`<body style="margin:0;background:${color}"></body>`);
  const buffer = await p.screenshot();
  await p.close();
  return { name, mimeType: 'image/png', buffer };
}

/** Đưa hội về trạng thái chưa có ảnh nào, để lần chạy lại (retry) không vướng dữ liệu của lần trước. */
async function resetMedia(page: Page): Promise<void> {
  const status = await page.evaluate(async ({ api, slug }) => {
    const headers = { 'X-HM-Auth': 'cookie', 'Content-Type': 'application/json' };
    const about = await (await fetch(`${api}/v1/communities/by-slug/${slug}`, { headers, credentials: 'include' })).json() as { community: { id: string } };
    const a = await fetch(`${api}/v1/communities/${about.community.id}/about-media`, { method: 'PUT', headers, credentials: 'include', body: JSON.stringify({ items: [] }) });
    const b = await fetch(`${api}/v1/communities/${about.community.id}/general`, { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify({ coverFileId: null, logoFileId: null }) });
    return [a.status, b.status];
  }, { api: API, slug: SLUG });
  expect(status).toEqual([200, 200]);
}

test('chủ hội sửa logo, ảnh bìa, ảnh và video trang giới thiệu; người lạ thấy đúng như vậy', async ({ page, browser }) => {
  page.on('dialog', (d) => void d.accept());
  await login(page, USERS.owner);
  await resetMedia(page);

  // Chưa có ảnh nào: chủ hội thấy lời nhắc ngay trên trang giới thiệu, bấm vào là tới đúng mục trong Cài đặt.
  await page.goto(`/${SLUG}`);
  await page.getByRole('link', { name: 'Thêm ảnh và video' }).click();
  await expect(page).toHaveURL(new RegExp(`/${SLUG}/cai-dat/chung#anh-video$`));
  const card = page.locator('#anh-video');
  await expect(card.getByText('0/12')).toBeVisible();

  // Logo vuông và ảnh bìa nằm trong form chung, lưu bằng nút "Lưu thay đổi".
  await page.locator('input[type=file]').nth(0).setInputFiles(await png(page, 'logo.png', '#f0b429', 512, 512));
  await page.locator('input[type=file]').nth(1).setInputFiles(await png(page, 'bia.png', '#3aa0d8'));
  await expect(page.getByRole('button', { name: 'Đổi ảnh', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu').first()).toBeVisible();

  // Thêm hai ảnh một lượt, rồi một video. Link không phải video thì báo lỗi, không thêm.
  await card.locator('input[type=file]').nth(0).setInputFiles([await png(page, 'a.png', '#0b6f75'), await png(page, 'b.png', '#d4593a')]);
  await expect(card.getByText('2/12')).toBeVisible();
  const link = card.getByRole('textbox', { name: 'Link video' });
  await link.fill('https://example.com/khong-phai-video');
  await card.getByRole('button', { name: 'Thêm video' }).click();
  await expect(card.getByText('Link này chưa nhận diện được')).toBeVisible();
  await link.fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await card.getByRole('button', { name: 'Thêm video' }).click();
  await expect(card.getByText('3/12')).toBeVisible();

  // Đưa video lên đầu, sửa link của nó, rồi xóa ảnh cuối.
  await card.getByRole('button', { name: 'Đưa video số 3 lên trước' }).click();
  await card.getByRole('button', { name: 'Đưa video số 2 lên trước' }).click();
  await expect(card.getByRole('button', { name: 'Sửa link video số 1' })).toBeEnabled();
  await card.getByRole('button', { name: 'Sửa link video số 1' }).click();
  await expect(link).toHaveValue('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await link.fill('https://youtu.be/dQw4w9WgXcQ');
  await card.getByRole('button', { name: 'Cập nhật link' }).click();
  await expect(card.getByRole('button', { name: 'Thêm video' })).toBeVisible();
  await card.getByRole('button', { name: 'Xóa ảnh số 3' }).click();
  await expect(card.getByText('2/12')).toBeVisible();

  // Tải lại trang: mọi thay đổi đã được lưu.
  await page.reload();
  await expect(page.locator('#anh-video').getByText('2/12')).toBeVisible();
  await expect(page.locator('#anh-video').getByRole('button', { name: 'Sửa link video số 1' })).toBeVisible();

  // Người lạ trên điện thoại: video đứng đầu, bấm phát là nhúng đúng video; có ảnh bìa ở thẻ hội; không có nút sửa.
  const phone = await browser.newContext({ ...devices['iPhone 13'], locale: 'vi-VN' });
  const guest = await phone.newPage();
  await guest.goto(`/${SLUG}`);
  await expect(guest.getByRole('button', { name: 'Phát video giới thiệu' })).toBeVisible();
  await expect(guest.getByText('Sửa ảnh và video')).toHaveCount(0);
  await expect(guest.getByRole('img', { name: /^Ảnh bìa / })).toBeVisible();
  expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await guest.getByRole('button', { name: 'Xem mục sau' }).click();
  await expect(guest.getByRole('img', { name: /^Ảnh giới thiệu / })).toBeVisible();
  await guest.getByRole('button', { name: 'Video 1' }).click();
  await guest.getByRole('button', { name: 'Phát video giới thiệu' }).click();
  await expect(guest.locator('iframe[title="Video giới thiệu"]')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1$/);
  await phone.close();
});
