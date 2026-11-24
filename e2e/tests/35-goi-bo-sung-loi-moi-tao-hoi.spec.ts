// Luồng 35: chủ hội vào trang Gói bổ sung từ thanh bên của hội và thấy hai mục sắp ra mắt; thành viên chưa làm chủ hội
// nào thấy lời mời "Tạo hội của bạn, miễn phí", chủ hội thì không.
import { expect, test } from '@playwright/test';
import { login, USERS } from '../helpers';

test('chủ hội mở Gói bổ sung từ thanh bên: tên miền riêng và email marketing đều sắp ra mắt', async ({ page }) => {
  await login(page, USERS.owner);
  await page.goto('/minhquy/hom-nay');
  await expect(page.getByTestId('create-hoi-side')).toHaveCount(0);
  await page.getByRole('link', { name: 'Gói bổ sung' }).first().click();
  await expect(page).toHaveURL(/\/admin\/goi-bo-sung\?hoi=minhquy$/);
  await expect(page.getByRole('heading', { name: 'Gói bổ sung', level: 1 })).toBeVisible();
  for (const id of ['addon-custom_domain', 'addon-email_marketing']) await expect(page.getByTestId(id)).toContainText('Sắp ra mắt');
  await page.getByRole('link', { name: 'Về hội' }).click();
  await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
});

test('thành viên chưa làm chủ hội thấy lời mời tạo hội ở thanh bên và Khu học tập; đóng thì không hiện lại', async ({ page }) => {
  await login(page, USERS.member);
  await page.goto('/minhquy/bang-tin');
  await expect(page.getByRole('link', { name: 'Gói bổ sung' })).toHaveCount(0);
  await expect(page.getByTestId('create-hoi-side')).toHaveAttribute('href', '/tao-hoi');
  await page.goto('/hoc');
  const invite = page.getByTestId('create-hoi-invite');
  await expect(invite.getByRole('heading', { name: 'Tạo hội của bạn, miễn phí' })).toBeVisible();
  await page.getByRole('button', { name: 'Ẩn lời mời tạo hội' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Khu học tập/ })).toBeVisible();
  await expect(invite).toHaveCount(0);
});
