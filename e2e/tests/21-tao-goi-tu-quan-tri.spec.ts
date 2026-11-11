// Luồng 21: database chưa có gói nào (database thật từng như vậy) → trang Hệ thống, Gói nền tảng mở sẵn ô tạo gói
// → bấm "Tạo gói" → hiện thẻ gói với giá vừa lưu, có nút "Sửa gói".
// Dữ liệu mẫu luôn có sẵn gói, nên lượt hỏi đầu tiên được sửa thành "chưa có gói"; lệnh lưu thì đi thật tới máy chủ.
import { expect, test } from '@playwright/test';
import { USERS, login } from '../helpers';

test('chưa có gói nào thì tạo gói ngay trong quản trị', async ({ page }) => {
  let emptied = false;
  await page.route('**/v1/admin/plans', async (route) => {
    if (route.request().method() !== 'GET' || emptied) return route.continue();
    emptied = true;
    const response = await route.fetch();
    const stats = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...stats, plan: null } });
  });

  await login(page, USERS.admin);
  await page.goto('/he-thong/goi');
  await expect(page.getByText('Chưa có gói nào')).toBeVisible();
  await expect(page.getByText('Tạo gói Hội Mình')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sửa gói' })).toHaveCount(0);

  // Ô tạo gói điền sẵn tên, giá, ngày dùng thử và có cả phần chọn cách thu tiền.
  await expect(page.getByLabel('Tên gói')).toHaveValue('Hội Mình');
  await expect(page.getByLabel('Giá tháng (đ)')).toHaveValue('499000');
  await expect(page.getByLabel('Giá năm (đ)')).toHaveValue('4990000');
  await expect(page.getByLabel('Ngày dùng thử')).toHaveValue('14');
  await expect(page.getByRole('button', { name: /Link thanh toán ngoài/ })).toBeVisible();

  // Giá không hợp lệ thì máy chủ từ chối, ô vẫn mở để sửa.
  await page.getByLabel('Giá tháng (đ)').fill('0');
  await page.getByRole('button', { name: 'Tạo gói' }).click();
  await expect(page.getByText(/Giá tháng phải là số nguyên lớn hơn 0/)).toBeVisible();

  await page.getByLabel('Giá tháng (đ)').fill('499000');
  await page.getByRole('button', { name: 'Tạo gói' }).click();
  await expect(page.getByRole('button', { name: 'Sửa gói' })).toBeVisible();
  await expect(page.getByText('Chưa có gói nào')).toHaveCount(0);
  await expect(page.getByText('499.000đ', { exact: true })).toBeVisible();
  await expect(page.getByText('Thu tiền: thanh toán trong Hội Mình')).toBeVisible();
});
