// Luồng 26: chủ hội cài cổng thanh toán của riêng mình. Ở Cài đặt, Nhận tiền, chủ hội cài MoMo (khóa thử của Hội Mình,
// đi qua trang mô phỏng), cài Stripe hai bước (khóa API rồi mới tới mã ký webhook), đặt MoMo làm mặc định. Người mua chỉ
// thấy các cách đã cài, MoMo được chọn sẵn; trả qua MoMo thì đơn tự xác nhận khi cổng của chủ hội báo về. Chủ hội tắt
// MoMo thì người mua không thấy MoMo nữa, và trả được bằng thẻ qua Stripe.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

const SLUG = 'ngoai-ngu-vy';

/** Trả ở trang mô phỏng của cổng rồi chờ trang đơn báo đã nhận thanh toán. */
async function payOnSimulator(buyer: Page, link: RegExp | string) {
  await expect(buyer).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  await buyer.getByRole('link', { name: link }).click();
  await expect(buyer).toHaveURL(/\/pay\/simulator\/hoi\/[a-f0-9]{40}\?/);
  await buyer.getByRole('button', { name: 'Thanh toán thành công' }).click();
  await expect(buyer.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });
}

test('chủ hội cài MoMo và Stripe của mình, chọn mặc định; người mua chỉ thấy cách đã cài và trả qua cổng của chủ hội', async ({ browser, page }) => {
  await login(page, USERS.freeOwner);
  await page.goto(`/${SLUG}/cai-dat/nhan-tien`);
  await expect(page.getByRole('heading', { name: 'Nhận tiền' })).toBeVisible();

  // MoMo: dán ba khóa, chọn chế độ thử, lưu là bật ngay.
  const momo = page.getByRole('group', { name: 'MoMo', exact: true });
  await expect(momo.getByText('Chưa cài')).toBeVisible();
  await momo.getByRole('button', { name: 'Cài đặt' }).click();
  await momo.getByLabel('Partner Code').fill('MOMOVYE2E');
  await momo.getByLabel('Access Key').fill('momo-sandbox-vy-e2e');
  await momo.getByLabel('Secret Key').fill('momo-sandbox-vy-e2e-secret');
  await momo.getByRole('combobox', { name: 'Chế độ MoMo' }).click();
  await page.getByRole('option', { name: /Thử nghiệm/ }).click();
  await momo.getByRole('button', { name: 'Lưu MoMo' }).click();
  await expect(momo.getByText('Đang bật')).toBeVisible();
  await expect(momo.getByText('Chưa nhận tín hiệu nào từ MoMo')).toBeVisible();
  // Khóa bí mật không hiện lại, chỉ 4 ký tự cuối.
  await expect(momo.getByLabel('Secret Key')).toHaveAttribute('placeholder', /Đã lưu ••••cret/);

  // Stripe hai bước: lưu khóa API thì có địa chỉ webhook, người mua chưa thấy cho tới khi có mã ký webhook.
  const stripe = page.getByRole('group', { name: 'Thẻ Visa, Mastercard (Stripe)' });
  await stripe.getByRole('button', { name: 'Cài đặt' }).click();
  await stripe.getByLabel('Secret key').fill('sk_test_hoiminh_vy_e2e');
  await stripe.getByRole('button', { name: 'Lưu Thẻ Visa, Mastercard (Stripe)' }).click();
  await expect(stripe.getByText('Còn một bước', { exact: true })).toBeVisible();
  await expect(stripe.getByText(/\/webhooks\/hoi\/[a-f0-9]{40}/)).toBeVisible();
  await stripe.getByLabel('Signing secret của webhook').fill('whsec_vy_e2e');
  await stripe.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(stripe.getByText('Đang bật')).toBeVisible();

  // Đặt MoMo làm mặc định.
  await momo.getByRole('button', { name: 'Đặt làm mặc định' }).click();
  await expect(momo.getByText('Mặc định', { exact: true })).toBeVisible();
  await expect(page.getByText('Người mua đang thấy: Chuyển khoản QR, MoMo (chọn sẵn), Thẻ Visa, Mastercard.')).toBeVisible();

  // Người mua: thấy đúng ba cách, MoMo được chọn sẵn; trả qua MoMo của chủ hội.
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await login(buyer, USERS.member2);
  await buyer.goto(`/${SLUG}/thanh-toan?tier=premium&cycle=monthly`);
  const options = buyer.getByRole('radiogroup', { name: 'Cách thanh toán' }).getByRole('button');
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toContainText('Chuyển khoản QR');
  await expect(options.nth(1)).toContainText('MoMo');
  await expect(options.nth(2)).toContainText('Thẻ Visa, Mastercard');
  await buyer.getByRole('button', { name: /^Thanh toán .* bằng MoMo$/ }).click();
  await payOnSimulator(buyer, 'Mở trang MoMo để thanh toán');

  // Chủ hội thấy MoMo đã nhận tín hiệu; tắt MoMo thì người mua không thấy MoMo nữa.
  await page.reload();
  await momo.getByRole('button', { name: 'Sửa' }).click();
  await expect(momo.getByText(/Đã nhận tín hiệu từ MoMo/)).toBeVisible();
  await momo.getByRole('switch', { name: 'Bật MoMo' }).click();
  await expect(momo.getByText('Đang tắt')).toBeVisible();
  await expect(page.getByText('Người mua đang thấy: Chuyển khoản QR (chọn sẵn), Thẻ Visa, Mastercard.')).toBeVisible();

  // Người mua trả bằng thẻ qua Stripe của chủ hội.
  await buyer.goto(`/${SLUG}/thanh-toan?tier=premium&cycle=monthly`);
  await expect(options).toHaveCount(2);
  await expect(buyer.getByRole('button', { name: 'Lấy mã QR chuyển khoản' })).toBeVisible();
  await options.nth(1).click();
  await buyer.getByRole('button', { name: /^Thanh toán .* bằng Thẻ Visa, Mastercard$/ }).click();
  await payOnSimulator(buyer, 'Mở trang thanh toán thẻ');
  await buyerCtx.close();
});
