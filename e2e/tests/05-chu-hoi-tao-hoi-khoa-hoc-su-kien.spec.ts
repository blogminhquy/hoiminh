// Luồng 5: chủ hội tạo hội thứ hai (chọn gói trả phí, thanh toán ngay khi tạo) → tạo khóa học → soạn module/bài (đổi tên module, nhập bài từ link YouTube) → đăng → tạo sự kiện lặp hằng tuần.
import { expect, test } from '@playwright/test';
import { USERS, login, readOrder, sepayWebhook } from '../helpers';

test('tạo hội, khóa học và sự kiện', async ({ page, request }) => {
  await login(page, USERS.owner);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Hội của tôi' })).toBeVisible();
  await page.getByRole('link', { name: /Tạo hội của bạn/ }).first().click();
  await expect(page.getByText('Tài khoản của bạn đã có một hội miễn phí')).toBeVisible();

  const slug = `hoi-e2e-${Date.now().toString(36)}`;
  await page.getByPlaceholder('Tên hội của bạn').fill('Hội E2E Playwright');
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByPlaceholder('ten-hoi').fill(slug);
  await expect(page.getByRole('button', { name: /Tiếp tục/ })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.locator('textarea').fill('Hội thử nghiệm tự động cho Playwright.');
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  // Bước Gói: chủ hội này đã dùng hội miễn phí của tài khoản, nên hội mới chọn gói trả phí và thanh toán ngay.
  await expect(page.getByRole('radio', { name: /^Khởi đầu/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: /^Chuyên nghiệp/ }).click();
  await page.getByRole('tab', { name: /1 năm/ }).click();
  await page.getByRole('button', { name: 'Tạo hội và thanh toán 2.990.000đ' }).click();
  // Sang thẳng màn thanh toán gói đã chọn, khung chọn cách trả mở sẵn.
  await expect(page).toHaveURL(new RegExp(`/admin/goi\\?hoi=${slug}&goi=pro&ky=yearly`));
  const pay = page.getByRole('dialog');
  await expect(pay.getByText('Gói Chuyên nghiệp, 1 năm')).toBeVisible();
  await pay.getByRole('button', { name: /^Thanh toán \d/ }).click();
  await expect(page).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  const order = await readOrder(page);
  expect(order.amountMinor).toBe(2_990_000);
  expect(await sepayWebhook(request, `MINH QUY ${order.reference}`, order.amountMinor)).toBe(200);
  await expect(page.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });
  await page.goto(`/${slug}/hom-nay`);
  // Chủ hội vào hội là thấy Bàn điều khiển, có danh sách việc để hoàn thiện hội mới.
  await expect(page).toHaveURL(new RegExp(`/${slug}/hom-nay`));
  await expect(page.getByRole('heading', { name: 'Hoàn thiện hội' })).toBeVisible();

  await page.goto(`/${slug}/khoa-hoc/moi`);
  await page.getByLabel(/Tên khóa học/).fill('Khóa học E2E');
  await page.getByRole('button', { name: /Tiếp tục: soạn nội dung/ }).click();
  await expect(page).toHaveURL(/\/soan$/);
  await page.getByRole('button', { name: 'Module' }).click();
  await expect(page.getByText('1. Module 1')).toBeVisible();
  // Đổi tên module ngay tại cột giáo trình.
  await page.getByRole('button', { name: 'Đổi tên module' }).click();
  await page.getByRole('textbox', { name: 'Tên module' }).fill('Bắt đầu');
  await page.getByRole('textbox', { name: 'Tên module' }).press('Enter');
  await expect(page.getByRole('button', { name: '1. Bắt đầu' })).toBeVisible();
  await page.getByRole('button', { name: 'Bài', exact: true }).click();
  await expect(page.getByText('Bài mới').first()).toBeVisible();
  // Nhập bài từ link YouTube: tên bài và thời lượng lấy theo video. YouTube được giả lập, e2e không gọi ra ngoài.
  await page.route('**/v1/video/meta', (route) => route.fulfill({ json: { embed: { provider: 'youtube', externalId: 'dQw4w9WgXcQ' }, meta: { title: 'Bài mở đầu từ YouTube', description: 'Mô tả lấy từ YouTube', durationSeconds: 754 } } }));
  await page.getByRole('button', { name: /nhập nhanh từ danh sách link YouTube/ }).click();
  await page.locator('.modal textarea').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Tạo bài' }).click();
  await expect(page.getByText('Bài mở đầu từ YouTube')).toBeVisible();
  await expect(page.getByText('12:34')).toBeVisible();
  await page.getByRole('button', { name: /Đăng khóa học/ }).click();
  await expect(page.getByText('Đã đăng').first()).toBeVisible();
  // Trang khóa học: tên khóa là tiêu đề trang, nút quay lại nằm trên bìa và dẫn về danh sách khóa.
  await page.getByRole('link', { name: /Xem như học viên/ }).click();
  await expect(page.getByRole('heading', { name: 'Khóa học E2E' })).toBeVisible();
  await expect(page.getByText('Bài mở đầu từ YouTube').first()).toBeVisible();
  await page.locator('a.course-back').click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/khoa-hoc$`));

  await page.goto(`/${slug}/su-kien/moi`);
  await page.getByPlaceholder(/Q&A tuần/).fill('Q&A tuần E2E');
  await page.getByRole('button', { name: 'Hằng tuần', exact: true }).click();
  await page.locator('input[placeholder^="https://zoom"]').fill('https://zoom.us/j/1234567890');
  await page.getByRole('button', { name: /Đăng sự kiện/ }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/su-kien/[0-9a-f-]{36}`));
  await expect(page.getByText('Q&A tuần E2E').first()).toBeVisible();

  // Link phòng phải thành nút vào phòng trỏ đúng địa chỉ đã nhập.
  const join = page.getByRole('link', { name: /Vào phòng/ });
  await expect(join).toBeVisible();
  await expect(join).toHaveAttribute('href', 'https://zoom.us/j/1234567890');
  await expect(page.getByText('Zoom').first()).toBeVisible();
});
