// Luồng 20: trần thành viên theo gói và khóa tính năng trả phí.
// Hội gói Miễn phí đã đủ chỗ → người mới xin vào thì nằm ở hàng chờ → chủ hội thấy dải báo đủ chỗ, bấm Duyệt thì hiện
// màn nâng gói thay vì duyệt. Tính năng trả phí (tự động hóa, affiliate, tên miền riêng) vẫn hiện nhưng kèm ổ khóa và
// lời mời nâng gói.
import { expect, test } from '@playwright/test';
import { USERS, apiJson, apiToken, login, savePlans } from '../helpers';

test.afterAll(async ({ request }) => {
  await savePlans(request);
});

test('hội chạm trần: người mới vào hàng chờ, bấm Duyệt thì mời nâng gói', async ({ browser, page, request }) => {
  // Luồng 7 (quản trị) khóa hội Shopee 0 đồng để thử nút Khóa: mở lại để hội nhận người như bình thường.
  const admin = await apiToken(request, USERS.admin);
  const list = await apiJson<{ items: Array<{ id: string; slug: string; status: string }> }>(request, admin, 'GET', '/v1/admin/communities?q=Shopee');
  const shopee = list.items.find((c) => c.slug === 'shopee-0d')!;
  if (shopee.status !== 'active') await apiJson(request, admin, 'POST', `/v1/admin/communities/${shopee.id}/action`, { action: 'unlock', reason: '' });
  // Hạ trần gói Miễn phí xuống đúng số thành viên của hội Shopee 0 đồng (12) để hội này đủ chỗ.
  await savePlans(request, { free: { memberCap: 12 } });

  // Người mới xin vào: không bị từ chối, được báo là đang ở hàng chờ.
  const visitor = await browser.newContext();
  const vp = await visitor.newPage();
  await login(vp, USERS.member2);
  await vp.goto('/shopee-0d');
  await vp.getByRole('button', { name: /Tham gia/ }).first().click();
  await expect(vp.getByText(/Hội đang đủ chỗ. Yêu cầu của bạn đã vào hàng chờ/)).toBeVisible();
  await visitor.close();

  await login(page, USERS.freeOwner2);
  await page.goto('/shopee-0d/thanh-vien?trang-thai=pending');
  await expect(page.getByText('Hội đã đủ 12 trên 12 thành viên')).toBeVisible();
  await page.getByText('Duy Nguyễn').first().click();
  await page.locator('.modal').getByRole('button', { name: 'Duyệt', exact: true }).click();
  const card = page.getByRole('region', { name: /Nâng gói để duyệt/ });
  await expect(card).toBeVisible();
  await expect(card.getByText(/Gói Miễn phí tối đa 12 thành viên và hội đã đủ/)).toBeVisible();
  await expect(card.getByRole('link', { name: 'Nâng lên Khởi đầu' })).toHaveAttribute('href', /\/admin\/goi\?hoi=shopee-0d&goi=starter/);
  // Bàn điều khiển cũng nhắc việc này.
  await page.goto('/shopee-0d/hom-nay');
  await expect(page.getByRole('region', { name: 'Cần xử lý' }).getByText('Hội đã đủ 12 thành viên của gói Miễn phí')).toBeVisible();
});

test('tính năng trả phí hiện kèm ổ khóa và lời mời nâng gói', async ({ page }) => {
  await login(page, USERS.freeOwner2);
  await page.goto('/shopee-0d/cai-dat/quy-tac');
  const lock = page.getByRole('region', { name: 'Tự động hóa có từ gói Chuyên nghiệp' });
  await expect(lock).toBeVisible();
  await expect(lock.getByRole('link', { name: 'Nâng lên Chuyên nghiệp' })).toHaveAttribute('href', /goi=pro/);
  await page.goto('/shopee-0d/cai-dat/cong-su');
  await expect(page.getByRole('region', { name: 'Affiliate có từ gói Chuyên nghiệp' })).toBeVisible();
  // Tên miền riêng không thuộc gói nào: trang Thông tin hội ghi sắp ra mắt ở Gói bổ sung, không có ô nhập.
  await page.goto('/shopee-0d/cai-dat/chung');
  await expect(page.getByTestId('custom-domain-soon')).toContainText('Sắp ra mắt');
  await expect(page.getByRole('link', { name: 'Xem Gói bổ sung' })).toHaveAttribute('href', '/admin/goi-bo-sung?hoi=shopee-0d');
  await expect(page.getByPlaceholder('hoc.tenmien.vn')).toHaveCount(0);
  // Việc không thuộc gói trả phí vẫn mở bình thường.
  await page.goto('/shopee-0d/cai-dat/gia');
  await expect(page.getByRole('region', { name: /có từ gói/ })).toHaveCount(0);
});
