// Luồng 36: đối tác chính thức của affiliate nền tảng. Quản trị thêm đối tác bằng email với 50% trọn đời, sửa sang
// 24 tháng; đối tác mở Affiliate của tôi (chương trình nền tảng) thấy nhãn đối tác và điều khoản riêng. Cuối bài kết
// thúc hợp tác để các luồng khác thấy lại mức chung.
import { expect, test } from '@playwright/test';
import { login, USERS } from '../helpers';

test('quản trị thêm và sửa đối tác; đối tác thấy điều khoản riêng ở trang ví', async ({ page, browser }) => {
  await login(page, USERS.admin);
  await page.goto('/he-thong/doi-tac');
  await expect(page.getByRole('heading', { name: 'Đối tác chính thức', level: 1 })).toBeVisible();

  // Thêm đối tác: email có sẵn tài khoản, 50%, trọn đời, kèm ghi chú.
  await page.getByLabel('Email đối tác').fill(USERS.affiliate);
  await page.getByLabel('Hoa hồng riêng (%)').fill('95');
  await expect(page.getByText('Nhập từ 0 đến 90 (%)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm đối tác' })).toBeDisabled();
  await page.getByLabel('Hoa hồng riêng (%)').fill('50');
  await page.getByRole('combobox', { name: 'Thời hạn nhận hoa hồng' }).click();
  await page.getByRole('option', { name: 'Trọn đời', exact: true }).click();
  await page.getByLabel('Ghi chú').fill('Coach kinh doanh online');
  await page.getByRole('button', { name: 'Thêm đối tác' }).click();
  const card = page.getByTestId('partner-card').filter({ hasText: USERS.affiliate });
  await expect(card).toContainText('50% · trọn đời');
  await expect(card).toContainText('Coach kinh doanh online');

  // Sửa sang 45% trong 24 tháng.
  await card.getByRole('button', { name: 'Sửa điều khoản' }).click();
  await card.getByLabel('Hoa hồng riêng (%)').fill('45');
  await card.getByRole('combobox', { name: 'Thời hạn nhận hoa hồng' }).click();
  await page.getByRole('option', { name: '24 tháng đầu', exact: true }).click();
  await card.getByRole('button', { name: 'Lưu điều khoản' }).click();
  await expect(page.getByTestId('partner-card').filter({ hasText: USERS.affiliate })).toContainText('45% · 24 tháng đầu');

  // Đối tác mở ví của chương trình nền tảng.
  const partner = await browser.newPage();
  await login(partner, USERS.affiliate);
  await partner.goto('/tai-khoan/cong-su');
  await partner.getByRole('radio', { name: /Nền tảng Hội Mình/ }).click();
  await expect(partner.getByTestId('partner-badge')).toContainText('Hoa hồng riêng của bạn: 45%');
  await expect(partner.getByTestId('partner-badge')).toContainText('24 tháng đầu');
  await partner.close();

  // Kết thúc hợp tác: thẻ chuyển xuống nhóm đã kết thúc.
  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('partner-card').filter({ hasText: USERS.affiliate }).getByRole('button', { name: 'Kết thúc hợp tác' }).click();
  await expect(page.getByRole('button', { name: /Đã kết thúc \(1\)/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đang hợp tác (0)' })).toBeVisible();
});
