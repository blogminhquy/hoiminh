// Luồng 27: thành viên tự chọn người giới thiệu (affiliate "người giới thiệu cố định"), và hội đổi đường dẫn thì
// link cũ vẫn dẫn về đúng trang (từng ra "Hội không tồn tại"). Đổi đường dẫn xong trả lại như cũ cho các lượt chạy sau.
import { expect, test } from '@playwright/test';
import { USERS, apiJson, apiToken, login } from '../helpers';

test('thành viên nhập người giới thiệu bằng mã, link hoặc email trên trang Affiliate của hội, mã lạ bị từ chối', async ({ page }) => {
  await login(page, USERS.member2);
  await page.goto('/minhquy/xep-hang');
  const card = page.locator('.card', { hasText: 'Người giới thiệu của bạn' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /Nhập người giới thiệu|Đổi người giới thiệu/ }).click();
  const input = card.getByLabel('Mã, link hoặc email người giới thiệu');
  await input.fill('ma-khong-co');
  await card.getByRole('button', { name: 'Lưu' }).click();
  await expect(card.getByText('Không tìm thấy mã giới thiệu này trong hội')).toBeVisible();
  // Dán cả link có ?ref= cũng nhận.
  await input.fill('https://hoiminh.com/minhquy?ref=HV8K2');
  await card.getByRole('button', { name: 'Lưu' }).click();
  await expect(card.getByText('Hoàng Vũ')).toBeVisible();
  await expect(card.getByText(/mã hv8k2/)).toBeVisible();
  // Email của một thành viên khác trong hội cũng nhận (ở đây là Công, mã ct4e8).
  await card.getByRole('button', { name: 'Đổi người giới thiệu' }).click();
  await input.fill('khong-co-ai@example.com');
  await card.getByRole('button', { name: 'Lưu' }).click();
  await expect(card.getByText('Không có thành viên nào trong hội dùng email này')).toBeVisible();
  await input.fill(' CongTran@gmail.com ');
  await card.getByRole('button', { name: 'Lưu' }).click();
  await expect(card.getByText(/mã ct4e8/)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Đổi người giới thiệu' })).toBeVisible();
});

test('hội đổi đường dẫn: link cũ tự chuyển sang đường dẫn mới, giữ trang con và mã ref', async ({ page, request }) => {
  const token = await apiToken(request, USERS.owner);
  const shell = await apiJson<{ community: { id: string } }>(request, token, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const id = shell.community.id;
  await apiJson(request, token, 'PATCH', `/v1/communities/${id}/general`, { slug: 'duong-dan-moi-e2e' });
  try {
    await login(page, USERS.owner);
    await page.goto('/minhquy/thanh-vien');
    await expect(page).toHaveURL(/\/duong-dan-moi-e2e\/thanh-vien$/);
    await expect(page.getByText('Hội không tồn tại')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Thành viên/ }).first()).toBeVisible();
    // Link affiliate cũ đã chia sẻ: sang đường dẫn mới và vẫn mang mã giới thiệu.
    await page.goto('/minhquy?ref=hv8k2');
    await expect(page).toHaveURL(/\/duong-dan-moi-e2e\?ref=hv8k2$/);
    expect(await page.evaluate(() => document.cookie)).toContain('hm_ref=hv8k2');
  } finally {
    await apiJson(request, token, 'PATCH', `/v1/communities/${id}/general`, { slug: 'minhquy' });
  }
  await page.goto('/duong-dan-moi-e2e/bang-tin');
  await expect(page).toHaveURL(/\/minhquy\/bang-tin$/);
});
