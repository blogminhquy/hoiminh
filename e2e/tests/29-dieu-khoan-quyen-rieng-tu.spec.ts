// Hai trang pháp lý công khai: /dieu-khoan (Điều khoản sử dụng) và /quyen-rieng-tu (Chính sách quyền riêng tư).
// Trước đây hai địa chỉ này rơi vào route /:slug của hội và hiện "Hội không tồn tại".
import { expect, test } from '@playwright/test';

const PAGES = [
  { path: '/dieu-khoan', title: 'Điều khoản sử dụng', jump: 'Hoàn tiền', anchor: 'hoan-tien', other: { path: '/quyen-rieng-tu', title: 'Chính sách quyền riêng tư' } },
  { path: '/quyen-rieng-tu', title: 'Chính sách quyền riêng tư', jump: 'Xóa tài khoản', anchor: 'xoa-tai-khoan', other: { path: '/dieu-khoan', title: 'Điều khoản sử dụng' } },
];

for (const p of PAGES) {
  test(`khách mở ${p.path}: thấy ${p.title}, mục lục nhảy được, có link sang trang còn lại`, async ({ page }) => {
    await page.goto(p.path);
    await expect(page.getByRole('heading', { level: 1, name: p.title })).toBeVisible();
    await expect(page.getByText('Cập nhật lần cuối: 22/11/2026')).toBeVisible();
    await expect(page.getByText('Hội không tồn tại')).toHaveCount(0);
    await expect(page.getByText('Có lỗi xảy ra')).toHaveCount(0);
    await expect(page).toHaveTitle(`${p.title} · Hội Mình`);
    // Mục lục: bấm một mục thì địa chỉ mang neo và phần đó cuộn vào tầm nhìn.
    const heading = page.getByRole('heading', { level: 2, name: new RegExp(`^\\d+\\. ${p.jump}`) });
    await expect(heading).not.toBeInViewport();
    await page.getByRole('navigation', { name: 'Mục lục' }).getByRole('link', { name: new RegExp(p.jump) }).click();
    await expect(page).toHaveURL(new RegExp(`${p.path}#${p.anchor}$`));
    await expect(heading).toBeInViewport();
    // Mục Liên hệ là phần cuối, không để lộ chữ giữ chỗ.
    await expect(page.getByRole('heading', { level: 2, name: /^\d+\. Liên hệ$/ })).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/\[[^\]]+\]/);
    // Cuối trang có link sang trang pháp lý còn lại.
    await page.getByRole('navigation', { name: 'Trang liên quan' }).getByRole('link', { name: p.other.title }).click();
    await expect(page).toHaveURL(new RegExp(`${p.other.path}$`));
    await expect(page.getByRole('heading', { level: 1, name: p.other.title })).toBeVisible();
  });

  test(`${p.path} mở thẳng tới neo thì cuộn đúng phần, và không tràn ngang trên điện thoại`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${p.path}#${p.anchor}`);
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^\\d+\\. ${p.jump}`) })).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('trang đăng ký: hai link ở ô đồng ý mở đúng hai trang ở thẻ mới, ô đang gõ không mất', async ({ page, context }) => {
  await page.goto('/dang-ky');
  await page.getByPlaceholder('ban@email.com').fill('nguoi-moi@example.com');
  const agree = page.getByRole('checkbox', { name: /Tôi đồng ý với/ });
  await expect(agree).toHaveAttribute('aria-checked', 'false');
  for (const link of [{ title: 'Điều khoản sử dụng', path: '/dieu-khoan' }, { title: 'Chính sách quyền riêng tư', path: '/quyen-rieng-tu' }]) {
    const [opened] = await Promise.all([context.waitForEvent('page'), page.locator(`form a[href="${link.path}"]`).click()]);
    await expect(opened).toHaveURL(new RegExp(`${link.path}$`));
    await expect(opened.getByRole('heading', { level: 1, name: link.title })).toBeVisible();
    await opened.close();
  }
  // Bấm link không được tính là đánh dấu đồng ý, và trang đăng ký vẫn giữ nguyên chữ đã gõ.
  await expect(agree).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByPlaceholder('ban@email.com')).toHaveValue('nguoi-moi@example.com');
});
