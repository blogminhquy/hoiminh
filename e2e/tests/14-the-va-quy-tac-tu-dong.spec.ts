// Thẻ và quy tắc tự động: chủ hội tạo nguồn đồng bộ và quy tắc trên giao diện, landing bắn đơn về địa chỉ nhận,
// khách chưa có tài khoản bấm link kích hoạt, đặt mật khẩu một lần là vào học được. Gỡ thẻ thì mất quyền.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login, uniqueEmail } from '../helpers';

async function expectNoSideScroll(page: Page, width: number): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

const COURSE = 'Facebook Ads chuyển đổi 2026';

test.describe.serial('thẻ và quy tắc tự động', () => {
  const customer = uniqueEmail('landing');
  let inboundUrl = '';
  let claim = '';

  test('chủ hội tạo nguồn và quy tắc trong Cài đặt; landing bắn đơn về thì liên hệ có thẻ, quyền được giữ chờ kích hoạt', async ({ page, request }) => {
    await login(page, USERS.owner);
    await page.goto('/minhquy/cai-dat/nguon-dong-bo');
    await expect(page.getByRole('heading', { name: 'Nguồn đồng bộ' })).toBeVisible();
    // Nhóm "Tự động và kết nối" có đủ tab mới.
    const tabs = page.getByRole('navigation', { name: 'Tự động và kết nối' });
    for (const name of ['Tiện ích', 'Nguồn đồng bộ', 'Quy tắc tự động', 'Liên hệ và thẻ']) await expect(tabs.getByRole('link', { name, exact: true })).toBeVisible();

    await page.getByLabel('Tên nguồn mới').fill('Landing khóa Facebook Ads');
    await page.getByRole('button', { name: 'Tạo nguồn' }).click();
    const card = page.getByRole('region', { name: 'Nguồn Landing khóa Facebook Ads' });
    await expect(card.getByText('Chưa nhận lượt nào').first()).toBeVisible();
    inboundUrl = (await card.getByLabel('Địa chỉ nhận', { exact: true }).innerText()).trim();
    expect(inboundUrl).toMatch(/\/webhooks\/in\/[a-f0-9]{40}$/);

    await tabs.getByRole('link', { name: 'Quy tắc tự động', exact: true }).click();
    await expect(page).toHaveURL(/\/minhquy\/cai-dat\/quy-tac$/);
    await page.getByRole('button', { name: 'Quy tắc mới' }).click();
    const modal = page.getByRole('dialog');
    await modal.getByPlaceholder('Ví dụ: Mua khóa Facebook Ads').fill('Mua khóa Facebook Ads');
    await modal.getByLabel('Thẻ kích hoạt').fill('Paid FBAds');
    await expect(modal.getByText('Sẽ lưu thành')).toContainText('paid_fbads');
    await modal.getByRole('button', { name: 'Mở khóa học' }).click();
    await modal.getByLabel('Khóa học', { exact: true }).click();
    await page.getByRole('option', { name: COURSE, exact: true }).click();
    await modal.getByRole('button', { name: 'Gửi email' }).click();
    await modal.getByRole('button', { name: 'Lưu quy tắc' }).click();
    const rule = page.getByRole('region', { name: 'Quy tắc Mua khóa Facebook Ads' });
    await expect(rule.getByText('paid_fbads')).toBeVisible();
    await expect(rule.getByText(`Mở khóa học ${COURSE}`)).toBeVisible();
    await expect(rule.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    // Nút sửa và xóa chỉ còn icon nhưng vẫn có tên cho trình đọc màn hình.
    await expect(rule.getByRole('button', { name: 'Sửa quy tắc Mua khóa Facebook Ads' })).toBeVisible();

    // Landing bắn đơn về: form thường, tên trường kiểu Webcake.
    const res = await request.post(inboundUrl, { form: { full_name: 'Khách Landing', phone_number: '0900123456', email: customer, tag: 'paid_fbads' } });
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ status: 'processed', email: customer, tagsAdded: ['paid_fbads'] });

    await page.goto('/minhquy/cai-dat/nguon-dong-bo');
    await expect(card.getByText(/Đã nhận 1 lượt/)).toBeVisible();
    await card.getByRole('button', { name: 'Lượt nhận gần đây và ghép trường' }).click();
    await expect(card.getByText(customer, { exact: true })).toBeVisible();
    await expect(card.getByText('Gắn thẻ: paid_fbads')).toBeVisible();
    await expect(card.getByLabel('Trường Email')).toBeVisible();

    await page.goto('/minhquy/cai-dat/lien-he');
    await page.getByLabel('Tìm liên hệ').fill(customer);
    await expect(page.getByText(customer, { exact: true })).toBeVisible();
    await expect(page.getByText('Chưa có tài khoản')).toBeVisible();
    await expect(page.getByText(`Chờ khách kích hoạt: Khóa học ${COURSE}`)).toBeVisible();

    // Gửi lại link kích hoạt. Môi trường test trả luôn khóa trong phản hồi để không phải đọc hộp thư.
    const resent = page.waitForResponse((r) => r.url().endsWith('/resend-activation') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Gửi lại link kích hoạt' }).click();
    claim = ((await (await resent).json()) as { token: string }).token;
    expect(claim).toMatch(/^[a-f0-9]{48}$/);
    await expect(page.getByRole('button', { name: 'Đã gửi lại link' })).toBeVisible();

    await page.goto('/minhquy/cai-dat/quy-tac');
    const log = page.getByRole('region', { name: 'Nhật ký chạy' });
    await expect(log.getByText(customer, { exact: true })).toBeVisible();
    await expect(log.getByText(/Giữ theo email, chờ khách bấm link kích hoạt/)).toBeVisible();
    await expect(log.getByRole('img', { name: 'Chờ kích hoạt' })).toBeVisible();
  });

  test('khách bấm link kích hoạt trên điện thoại, đặt mật khẩu là vào học được; gỡ thẻ thì mất quyền', async ({ browser, request }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'vi-VN' });
    const phone = await context.newPage();
    await phone.goto(`/kich-hoat?token=${claim}`);
    await expect(phone.getByRole('heading', { name: 'Kích hoạt quyền truy cập' })).toBeVisible();
    await expect(phone.getByText(customer, { exact: true })).toBeVisible();
    await expect(phone.getByText(`Khóa học ${COURSE}`)).toBeVisible();
    await expectNoSideScroll(phone, 390);
    const submit = phone.getByRole('button', { name: 'Kích hoạt và vào xem' });
    await expect(submit).toBeDisabled();
    await phone.locator('input[type="password"]').fill('matkhau-moi-123');
    await submit.click();
    await expect(phone).toHaveURL(/\/hoc$/);
    await expect(phone.getByText(COURSE).first()).toBeVisible();

    // Link đã dùng: mở lại chỉ mời đăng nhập, không đặt được mật khẩu khác.
    await phone.goto(`/kich-hoat?token=${claim}`);
    await expect(phone.getByRole('heading', { name: 'Bạn đã kích hoạt rồi' })).toBeVisible();
    await expect(phone.locator('input[type="password"]')).toHaveCount(0);

    // Hoàn tiền: landing gửi remove_tag, khóa học biến mất khỏi Khu học tập.
    const res = await request.post(inboundUrl, { data: { email: customer, remove_tag: 'paid_fbads' } });
    expect(await res.json()).toMatchObject({ tagsRemoved: ['paid_fbads'] });
    await phone.goto('/hoc');
    await expect(phone.getByText(COURSE)).toHaveCount(0);
    await context.close();
  });

  test('link kích hoạt sai thì báo rõ và mời đăng nhập', async ({ page }) => {
    await page.goto('/kich-hoat?token=khong-co-that');
    await expect(page.getByRole('heading', { name: 'Link kích hoạt không còn dùng được' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  });
});
