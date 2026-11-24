// Luồng 6: chủ hội gói Miễn phí mở trang "Gói cho hội" → xem số thành viên so với trần, đổi tab chu kỳ → chọn gói Khởi đầu
// 3 tháng → khung thanh toán bật lên → trả qua QR → webhook → hội lên gói Khởi đầu. Rồi nâng lên Chuyên nghiệp: số ngày
// còn lại của gói cũ được tặng sang gói mới. Gói thấp hơn gói đang còn hạn thì không mua được.
import { expect, test } from '@playwright/test';
import { USERS, login, readOrder, sepayWebhook } from '../helpers';

test('hội Miễn phí mua gói, rồi nâng gói được tặng ngày còn lại', async ({ page, request }) => {
  await login(page, USERS.freeOwner);
  await page.goto('/admin');
  await expect(page.getByText('Gói của các hội')).toBeVisible();
  await expect(page.getByText(/dùng thử/i)).toHaveCount(0);
  await page.getByRole('link', { name: /Gói Miễn phí.*Nâng gói/ }).first().click();

  await expect(page).toHaveURL(/\/admin\/goi\?hoi=ngoai-ngu-vy/);
  await expect(page.getByRole('heading', { name: 'Gói cho hội của bạn' })).toBeVisible();
  await expect(page.getByText('41 trên 100')).toBeVisible();
  await expect(page.getByText('Dùng vĩnh viễn', { exact: true })).toBeVisible();
  // Chưa trả lần nào thì mặc định tab 1 năm: giá quy ra mỗi tháng rẻ hơn giá niêm yết.
  await expect(page.getByRole('tab', { name: '1 năm' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Trả 990.000đ cho 1 năm, tiết kiệm 17%.')).toBeVisible();
  await page.getByRole('tab', { name: '3 tháng' }).click();
  await expect(page.getByText('Trả 297.000đ cho 3 tháng.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gói đang dùng' })).toBeDisabled();
  await expect(page.getByText('Có từ gói Chuyên nghiệp: tự động hóa').first()).toBeVisible();

  await page.getByRole('link', { name: 'Chọn gói Khởi đầu' }).click();
  await expect(page.getByRole('heading', { name: 'Chọn gói Khởi đầu cho hội' })).toBeVisible();
  await expect(page.getByText('Thanh toán hôm nay')).toBeVisible();
  await page.getByRole('button', { name: 'Thanh toán 297.000đ' }).click();
  const pay = page.getByRole('dialog');
  await expect(pay.getByText('Gói Khởi đầu, 3 tháng')).toBeVisible();
  // Chỉ hiện cổng quản trị đang bật và đã cài: PayPal đang tắt, Stripe chưa có khóa nên không hiện.
  await expect(pay.getByRole('radiogroup', { name: 'Cách thanh toán' }).getByRole('button')).toHaveText(['Chuyển khoản QR', 'MoMo', 'VNPAY']);
  await pay.getByRole('button', { name: 'MoMo' }).click();
  await pay.getByRole('button', { name: 'Chuyển khoản QR' }).click();
  await pay.getByRole('button', { name: /^Thanh toán \d/ }).click();

  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  const { reference, amountMinor } = await readOrder(page);
  expect(amountMinor).toBe(297_000);
  expect(await sepayWebhook(request, `VY ENGLISH ${reference}`, amountMinor)).toBe(200);
  await expect(page.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });

  // Hội đã lên Khởi đầu: trần 500, gói Miễn phí không còn là gói đang dùng.
  await page.goto('/admin/goi?hoi=ngoai-ngu-vy&ky=quarterly');
  await expect(page.getByText('Gói Khởi đầu', { exact: true })).toBeVisible();
  await expect(page.getByText('41 trên 500')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Gia hạn gói Khởi đầu' })).toBeVisible();

  // Nâng lên Chuyên nghiệp 3 tháng: 90 ngày mua + 90 ngày còn lại của Khởi đầu được tặng = 180 ngày.
  await page.getByRole('link', { name: 'Nâng lên Chuyên nghiệp' }).click();
  await expect(page.getByRole('heading', { name: 'Nâng hội lên gói Chuyên nghiệp' })).toBeVisible();
  await expect(page.getByText('Tặng: số ngày còn lại của gói Khởi đầu')).toBeVisible();
  await expect(page.getByText('+ 90 ngày')).toBeVisible();
  await expect(page.getByText('180 ngày')).toBeVisible();
  await page.getByRole('button', { name: 'Thanh toán 897.000đ' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Thanh toán \d/ }).click();
  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  const up = await readOrder(page);
  expect(await sepayWebhook(request, `VY ENGLISH ${up.reference}`, up.amountMinor, Date.now() + 1)).toBe(200);
  await expect(page.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });

  await page.goto('/admin/goi?hoi=ngoai-ngu-vy&ky=quarterly');
  await expect(page.getByText('Gói Chuyên nghiệp', { exact: true })).toBeVisible();
  await expect(page.getByText('41 trên 5.000')).toBeVisible();
  // Đang ở Chuyên nghiệp và còn hạn: gói Khởi đầu không mua được.
  await expect(page.getByText(/Hội đang ở gói Chuyên nghiệp và còn hạn/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Khởi đầu/ })).toHaveCount(0);
});
