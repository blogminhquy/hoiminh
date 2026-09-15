// Luồng 4: cộng sự xem ví + link, gửi yêu cầu rút; chủ hội xem xét (mở số tài khoản, QR), ghi mã tham chiếu, đánh dấu đã trả; bảng xếp hạng.
import { expect, test } from '@playwright/test';
import { USERS, login } from '../helpers';

test('cộng sự rút tiền và chủ hội chi trả thủ công', async ({ page }) => {
  await login(page, USERS.affiliate);
  await page.goto('/tai-khoan/cong-su');
  await expect(page.getByRole('heading', { name: 'Cộng sự' })).toBeVisible();
  await expect(page.getByText(/ref=hv8k2/).first()).toBeVisible();
  await expect(page.getByText('Có thể rút').first()).toBeVisible();

  const amount = page.locator('input[inputmode="numeric"]').first();
  await amount.fill('500000');
  await page.getByRole('button', { name: 'Gửi yêu cầu rút' }).click();
  await expect(page.getByText('Chờ duyệt').first()).toBeVisible();

  await page.goto('/minhquy/xep-hang');
  await expect(page.getByRole('heading', { name: 'Xếp hạng cộng sự' })).toBeVisible();
  await expect(page.getByText('Hoàng Vũ').first()).toBeVisible();

  await login(page, USERS.owner);
  await page.goto('/minhquy/cai-dat/cong-su/rut-tien');
  await expect(page.getByRole('heading', { name: 'Yêu cầu rút của cộng sự' })).toBeVisible();
  const row = page.locator('div', { hasText: 'hoangvu@gmail.com' }).filter({ has: page.getByRole('button', { name: 'Xem xét' }) }).last();
  await row.getByRole('button', { name: 'Xem xét' }).click();
  await expect(page.getByText('Chủ tài khoản')).toBeVisible();
  await expect(page.locator('img[alt*="QR"], img[src*="qr"]').first()).toBeVisible();
  await page.getByPlaceholder(/FT|tham chiếu/i).first().fill(`FT${Date.now()}`);
  await page.getByRole('button', { name: 'Đã chuyển khoản' }).click();
  await expect(page.getByText('Đã trả').first()).toBeVisible();
});
