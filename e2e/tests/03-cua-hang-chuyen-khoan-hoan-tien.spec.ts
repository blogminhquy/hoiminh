// Luồng 3: mua sản phẩm lẻ bằng chuyển khoản tới tài khoản của chủ hội (ngân hàng của chủ hội báo có) → đã sở hữu
// → yêu cầu hoàn tiền trong 7 ngày.
import { expect, test } from '@playwright/test';
import { USERS, login, ownerBankWebhook, readOrder } from '../helpers';

test('mua khóa học trong Cửa hàng bằng chuyển khoản tới chủ hội rồi hoàn tiền', async ({ page, request }) => {
  await login(page, USERS.member2);
  await page.goto('/minhquy/cua-hang');
  await expect(page.getByRole('heading', { name: 'Cửa hàng' })).toBeVisible();
  await page.getByRole('link', { name: 'Mua', exact: true }).first().click();

  await expect(page).toHaveURL(/\/minhquy\/thanh-toan\?product=/);
  // Đơn của hội chỉ trả bằng chuyển khoản tới tài khoản của chủ hội: không còn MoMo, VNPAY, PayPal ở đây.
  await expect(page.getByRole('radiogroup', { name: 'Cách thanh toán' }).getByRole('radio')).toHaveText([/Chuyển khoản QR/]);
  await expect(page.getByRole('radio', { name: /MoMo/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Lấy mã QR chuyển khoản/ }).click();
  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  const { reference, amountMinor } = await readOrder(page);
  expect(await ownerBankWebhook(request, `DUY NGUYEN ck ${reference}`, amountMinor)).toBe(200);
  await expect(page.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });

  await page.goto('/minhquy/cua-hang');
  await expect(page.getByText('Đã sở hữu').first()).toBeVisible();

  await page.goto('/tai-khoan/goi');
  await page.getByRole('button', { name: 'Yêu cầu hoàn tiền' }).first().click();
  const modal = page.locator('.modal');
  await modal.locator('textarea').fill('Chưa phù hợp với mình');
  await modal.getByRole('button', { name: 'Gửi yêu cầu' }).click();
  await expect(page.getByRole('button', { name: 'Yêu cầu hoàn tiền' })).toHaveCount(0);
  await expect(page.getByText('Hoàn tiền').first()).toBeVisible();
});
