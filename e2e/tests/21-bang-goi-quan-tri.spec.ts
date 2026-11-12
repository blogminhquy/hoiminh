// Luồng 21: quản trị hệ thống sửa bảng bốn gói. Chỉ nhập giá mỗi tháng, trần thành viên và bật tắt tính năng; giá 3 tháng
// và 1 năm tự tính. Lưu xong thì bảng giá công khai đổi theo.
import { expect, test } from '@playwright/test';
import { USERS, login, savePlans } from '../helpers';

test.afterAll(async ({ request }) => {
  await savePlans(request);
});

test('quản trị sửa giá và trần của một gói, bảng giá công khai đổi theo', async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto('/he-thong/goi');
  await expect(page.getByRole('heading', { name: 'Gói nền tảng' })).toBeVisible();
  for (const name of ['Miễn phí', 'Khởi đầu', 'Chuyên nghiệp', 'Không giới hạn']) await expect(page.getByLabel(`Giá mỗi tháng, gói ${name}`)).toBeVisible();
  await expect(page.getByLabel('Giá mỗi tháng, gói Miễn phí')).toBeDisabled();
  await expect(page.getByText('Không có dùng thử.', { exact: false })).toBeVisible();
  const save = page.getByRole('button', { name: 'Lưu bảng gói' });
  await expect(save).toBeDisabled();

  // Đổi giá Khởi đầu: giá 3 tháng và 1 năm tính lại ngay trên thẻ.
  await page.getByLabel('Giá mỗi tháng, gói Khởi đầu').fill('129000');
  await expect(page.getByText('387.000đ')).toBeVisible();
  await expect(page.getByText('1.290.000đ')).toBeVisible();
  // Bảng không hợp lý thì máy chủ từ chối: trần Khởi đầu thấp hơn trần Miễn phí.
  await page.getByLabel('Trần thành viên, gói Khởi đầu').fill('50');
  await save.click();
  await expect(page.getByText('Trần thành viên của gói Khởi đầu không được thấp hơn gói Miễn phí')).toBeVisible();
  await page.getByLabel('Trần thành viên, gói Khởi đầu').fill('800');
  await page.getByRole('switch', { name: 'Tên miền riêng, gói Khởi đầu' }).click();
  await save.click();
  await expect(page.getByText('Đã lưu bảng gói.')).toBeVisible();

  await page.goto('/tao-hoi/goi');
  await page.getByRole('tab', { name: '3 tháng' }).click();
  await expect(page.getByText('129.000đ', { exact: true })).toBeVisible();
  await expect(page.getByText('Tối đa 800 thành viên')).toBeVisible();
  await expect(page.getByText(/dùng thử 14 ngày/i)).toHaveCount(0);
});
