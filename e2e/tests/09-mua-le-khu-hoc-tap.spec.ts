// Luồng 9 (V2, mục 153): người ngoài hội mua lẻ một khóa → KHÔNG bị tự thêm vào hội →
// được đưa về Khu học tập /hoc → mở bài học ở đó mà không cần đi qua khung hội.
import { expect, test } from '@playwright/test';
import { readOrder, sepayWebhook, uniqueEmail } from '../helpers';

test('mua lẻ không vào hội, học ở Khu học tập', async ({ page, request }) => {
  const email = uniqueEmail('mualeh');

  // Tài khoản mới, cố tình không tham gia hội nào.
  await page.goto('/dang-ky');
  await page.getByPlaceholder('Nguyễn Minh Quý').fill('Người Mua Lẻ');
  await page.getByPlaceholder('ban@email.com').fill(email);
  await page.locator('input[type="password"]').fill('matkhau-e2e-123');
  await page.getByText(/Tôi đồng ý với/).click();
  // Máy chạy thử thỉnh thoảng làm hỏng một lượt fetch tới API dev; bấm lại một lần thay vì hỏng cả luồng.
  const submit = page.getByRole('button', { name: 'Tạo tài khoản' });
  await submit.click();
  if (await page.getByText('Failed to fetch').isVisible().catch(() => false)) await submit.click();
  await expect(page).toHaveURL(/xac-minh-email/, { timeout: 20_000 });
  await page.getByLabel('Số thứ 1').click();
  await page.keyboard.type('482913');
  await expect(page).not.toHaveURL(/xac-minh-email/, { timeout: 20_000 });

  // Trang thanh toán mở được cho người ngoài hội (đường vào từ link cộng sự hoặc trang bán hàng).
  await page.goto('/minhquy/thanh-toan?product=funnel-money-model-2026');
  await page.getByRole('button', { name: 'Chuyển khoản QR' }).click();
  await page.getByRole('button', { name: /Lấy mã QR chuyển khoản/ }).click();
  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/, { timeout: 20_000 });

  // Đọc mã tham chiếu trên trang đơn rồi giả lập ngân hàng báo có.
  const { reference, amountMinor } = await readOrder(page);
  expect(await sepayWebhook(request, `NGUOI MUA LE ck ${reference}`, amountMinor)).toBe(200);

  // Thanh toán xong tự chuyển về Khu học tập, không phải vào khung hội (họ không phải thành viên).
  await expect(page).toHaveURL(/\/hoc$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Khu học tập/ })).toBeVisible();
  await expect(page.getByText('Funnel Money Model 2026').first()).toBeVisible();
  await expect(page.getByText('Đã mua').first()).toBeVisible();

  // Vẫn không phải thành viên: khung hội đá về trang giới thiệu.
  await page.goto('/minhquy/bang-tin');
  await expect(page).toHaveURL(/\/minhquy$/, { timeout: 15_000 });

  // Nhưng học được ngay trong Khu học tập.
  await page.goto('/hoc');
  await page.getByRole('link', { name: /Bắt đầu học|Học tiếp/ }).first().click();
  await expect(page).toHaveURL(/\/hoc\/bai\/[0-9a-f-]{36}/);
  await expect(page.getByRole('link', { name: 'Khu học tập' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đánh dấu hoàn thành/ })).toBeVisible();
});
