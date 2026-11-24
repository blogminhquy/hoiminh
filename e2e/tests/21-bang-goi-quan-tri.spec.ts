// Luồng 21: quản trị hệ thống sửa bảng bốn gói. Nhập giá riêng cho từng kỳ (1 tháng, 3 tháng, 6 tháng, 1 năm), trần
// thành viên và bật tắt tính năng. Kỳ nào để 0 thì không bán: trang mua gói không hiện kỳ đó. Lưu xong thì bảng giá
// công khai đổi theo.
import { expect, test } from '@playwright/test';
import { USERS, login, savePlans } from '../helpers';

test.afterAll(async ({ request }) => {
  await savePlans(request);
});

test('quản trị sửa giá từng kỳ và trần của một gói, bảng giá công khai đổi theo', async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto('/he-thong/goi');
  await expect(page.getByRole('heading', { name: 'Gói nền tảng' })).toBeVisible();
  for (const name of ['Miễn phí', 'Khởi đầu', 'Chuyên nghiệp', 'Không giới hạn']) {
    for (const cycle of ['1 tháng', '3 tháng', '6 tháng', '1 năm']) await expect(page.getByLabel(`Giá ${cycle}, gói ${name}`)).toBeVisible();
  }
  await expect(page.getByLabel('Giá 3 tháng, gói Miễn phí')).toBeDisabled();
  await expect(page.getByText('Không có dùng thử.', { exact: false })).toBeVisible();
  // Bảng mặc định chỉ bán 3 tháng và 1 năm: hai kỳ còn lại đang để 0.
  await expect(page.getByLabel('Giá 1 tháng, gói Khởi đầu')).toHaveValue('0');
  await expect(page.getByLabel('Giá 3 tháng, gói Khởi đầu')).toHaveValue('297000');
  await expect(page.getByLabel('Giá 1 năm, gói Khởi đầu')).toHaveValue('990000');
  const save = page.getByRole('button', { name: 'Lưu bảng gói' });
  await expect(save).toBeDisabled();

  // Giá từng kỳ nhập riêng. Giá 1 năm thấp hơn giá 3 tháng thì máy chủ từ chối (gõ thiếu một số 0).
  await page.getByLabel('Giá 3 tháng, gói Khởi đầu').fill('349000');
  await page.getByLabel('Giá 1 năm, gói Khởi đầu').fill('119000');
  await save.click();
  await expect(page.getByText('Gói Khởi đầu: giá 1 năm không được thấp hơn giá 3 tháng')).toBeVisible();
  await page.getByLabel('Giá 1 năm, gói Khởi đầu').fill('1190000');
  // Mở bán thêm 6 tháng cho Khởi đầu; 1 tháng vẫn để 0 nên không bán.
  await page.getByLabel('Giá 6 tháng, gói Khởi đầu').fill('649000');
  await expect(page.getByText('649.000đ, khoảng 108.167đ mỗi tháng')).toBeVisible();
  // Bảng không hợp lý thì máy chủ từ chối: trần Khởi đầu thấp hơn trần Miễn phí.
  await page.getByLabel('Trần thành viên, gói Khởi đầu').fill('50');
  await save.click();
  await expect(page.getByText('Trần thành viên của gói Khởi đầu không được thấp hơn gói Miễn phí')).toBeVisible();
  await page.getByLabel('Trần thành viên, gói Khởi đầu').fill('800');
  await page.getByRole('switch', { name: 'API, gói Khởi đầu' }).click();
  await save.click();
  await expect(page.getByText('Đã lưu bảng gói.')).toBeVisible();

  await page.goto('/tao-hoi/goi');
  // Chỉ kỳ có giá mới thành tab: 3 tháng, 6 tháng, 1 năm. Không gói nào bán 1 tháng nên không có tab 1 tháng.
  await expect(page.getByRole('tab')).toHaveText(['3 tháng', '6 tháng', '1 năm']);
  await page.getByRole('tab', { name: '3 tháng' }).click();
  await expect(page.getByText('Trả 349.000đ cho 3 tháng.')).toBeVisible();
  await expect(page.getByText('Giới hạn 800 thành viên')).toBeVisible();
  // Kỳ 6 tháng chỉ Khởi đầu bán: hai gói còn lại (giá 6 tháng là 0) không hiện ở kỳ này.
  await page.getByRole('tab', { name: '6 tháng' }).click();
  await expect(page.getByText('Trả 649.000đ cho 6 tháng, tiết kiệm 7%.')).toBeVisible();
  await expect(page.getByText('Khởi đầu', { exact: true })).toBeVisible();
  await expect(page.getByText('Chuyên nghiệp', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Không giới hạn', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/dùng thử 14 ngày/i)).toHaveCount(0);
});
