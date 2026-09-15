// Luồng 3: mua sản phẩm lẻ qua MoMo (trang mô phỏng sandbox ký IPN thật) → đã sở hữu → yêu cầu hoàn tiền trong 7 ngày.
import { expect, test } from '@playwright/test';
import { USERS, login } from '../helpers';

test('mua khóa học trong Cửa hàng qua MoMo rồi hoàn tiền', async ({ page }) => {
  await login(page, USERS.member2);
  await page.goto('/minhquy/cua-hang');
  await expect(page.getByRole('heading', { name: 'Cửa hàng' })).toBeVisible();
  await page.getByRole('link', { name: 'Mua', exact: true }).first().click();

  await expect(page).toHaveURL(/\/minhquy\/thanh-toan\?product=/);
  await page.getByRole('button', { name: 'MoMo' }).click();
  await page.getByRole('button', { name: /Thanh toán qua MoMo/ }).click();
  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  const orderUrl = page.url();

  await page.getByRole('link', { name: /Mở trang MoMo/ }).click();
  await expect(page).toHaveURL(/pay\/simulator/);
  await page.getByRole('button', { name: 'Thanh toán thành công' }).click();

  await page.goto(orderUrl);
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
