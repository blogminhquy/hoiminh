// Luồng 20: quản trị hệ thống cài gói thu tiền bằng link ngoài → chủ hội bấm thanh toán thì khung bật lên chỉ còn nút
// dẫn sang link đó (đã điền mã hội và email) → quản trị trả về thanh toán trong Hội Mình.
import { expect, test } from '@playwright/test';
import { USERS, apiJson, apiToken, login } from '../helpers';

const MONTHLY = 'https://pay.example.com/hoi-minh-thang?ref={workspace_id}&email={email}';

// Dù test dừng giữa chừng, gói vẫn phải về thanh toán trong Hội Mình để không ảnh hưởng lượt chạy khác.
test.afterAll(async ({ request }) => {
  const token = await apiToken(request, USERS.admin);
  await apiJson(request, token, 'PATCH', '/v1/admin/plans/hoiminh', { paymentMode: 'gateway', monthlyPayUrl: null, yearlyPayUrl: null });
});

test('gói thu tiền bằng link thanh toán ngoài', async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto('/he-thong/goi');
  await expect(page.getByText('Thu tiền: thanh toán trong Hội Mình')).toBeVisible();
  await page.getByRole('button', { name: 'Sửa gói' }).click();
  await page.getByRole('button', { name: /Link thanh toán ngoài/ }).click();

  // Chưa có link nào thì không lưu được: chủ hội sẽ không còn đường trả tiền.
  await page.getByRole('button', { name: 'Lưu gói' }).click();
  await expect(page.getByText(/ít nhất một link/)).toBeVisible();
  await page.getByLabel('Link gói tháng').fill('http://pay.example.com/khong-ma-hoa');
  await page.getByRole('button', { name: 'Lưu gói' }).click();
  await expect(page.getByText(/phải bắt đầu bằng https/)).toBeVisible();

  await page.getByLabel('Link gói tháng').fill(MONTHLY);
  await page.getByRole('button', { name: 'Lưu gói' }).click();
  await expect(page.getByText('Thu tiền: link thanh toán ngoài (tháng)')).toBeVisible();

  // Chủ hội: chỉ có link tháng nên không còn tab chu kỳ; khung bật lên không hỏi cách thanh toán.
  await page.context().clearCookies();
  await login(page, USERS.trialOwner);
  await page.goto('/admin/goi');
  await expect(page.getByRole('heading', { name: 'Gói Hội Mình' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await page.getByRole('button', { name: /gói tháng$/ }).click();
  const pay = page.getByRole('dialog');
  await expect(pay.getByText('Cách thanh toán')).toHaveCount(0);
  await expect(pay.getByRole('link', { name: /Tới trang thanh toán/ })).toHaveAttribute('href', /^https:\/\/pay\.example\.com\/hoi-minh-thang\?ref=[0-9a-f-]{36}&email=vy\.english%40gmail\.com$/);

  // Quản trị trả về thanh toán trong Hội Mình: chủ hội lại thấy hai tab và các cách thanh toán.
  await page.context().clearCookies();
  await login(page, USERS.admin);
  await page.goto('/he-thong/goi');
  await page.getByRole('button', { name: 'Sửa gói' }).click();
  await page.getByRole('button', { name: /Thanh toán trong Hội Mình/ }).click();
  await page.getByRole('button', { name: 'Lưu gói' }).click();
  await expect(page.getByText('Thu tiền: thanh toán trong Hội Mình')).toBeVisible();

  await page.context().clearCookies();
  await login(page, USERS.trialOwner);
  await page.goto('/admin/goi');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await page.getByRole('button', { name: /gói tháng$/ }).click();
  await expect(page.getByRole('dialog').getByText('Cách thanh toán')).toBeVisible();
});
