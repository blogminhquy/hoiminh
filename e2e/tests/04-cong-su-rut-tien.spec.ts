// Luồng 4: affiliate xem ví, lấy link của hội, của sản phẩm và của nền tảng, gửi yêu cầu rút; chủ hội xem xét (mở số tài khoản, QR), ghi mã tham chiếu, đánh dấu đã trả; bảng xếp hạng.
import { expect, test } from '@playwright/test';
import { USERS, login } from '../helpers';

test('affiliate rút tiền và chủ hội chi trả thủ công', async ({ page }) => {
  await login(page, USERS.affiliate);
  await page.goto('/tai-khoan/cong-su');
  await expect(page.getByRole('heading', { name: 'Affiliate của tôi' })).toBeVisible();
  await expect(page.getByText(/ref=hv8k2/).first()).toBeVisible();

  // Lấy link theo ba bước: chọn chương trình (nền tảng hoặc hội), chọn trang (trang hội hoặc sản phẩm), sao chép.
  const link = page.getByTestId('affiliate-link');
  await expect(link).toHaveText(/\/minhquy\?ref=hv8k2$/);
  await page.getByRole('radio', { name: /Funnel Money Model 2026/ }).click();
  await expect(link).toHaveText(/\/minhquy\/cua-hang\/funnel-money-model-2026\?ref=hv8k2$/);
  await page.getByRole('radio', { name: /Nền tảng Hội Mình/ }).click();
  await expect(link).toHaveText(/\/tao-hoi\?ref=[a-z0-9]+$/);
  await expect(page.getByText(/Nhận 40% hoa hồng mỗi lần người bạn mời trả tiền gói Hội Mình/)).toBeVisible();
  await page.getByRole('radio', { name: /Kinh Doanh Online Cùng AI/ }).click();
  await expect(link).toHaveText(/\/minhquy\?ref=hv8k2$/);
  await expect(page.getByText('Có thể rút').first()).toBeVisible();

  const amount = page.locator('input[inputmode="numeric"]').first();
  await amount.fill('500000');
  await page.getByRole('button', { name: 'Gửi yêu cầu rút' }).click();
  await expect(page.getByText('Chờ duyệt').first()).toBeVisible();

  // Trang Affiliate của hội: vào từ mục "Affiliate" (kèm phần trăm hoa hồng) ở nhóm Hội trên thanh bên, địa chỉ cũ giữ nguyên.
  // Tab "Link của tôi" mở sẵn với link của đúng hội này, tab "Xếp hạng" là bảng xếp hạng.
  await page.goto('/minhquy/bang-tin');
  await page.locator('aside.app-sidebar').getByRole('link', { name: /^Affiliate\s*\d+(,\d+)?%$/ }).click();
  await expect(page).toHaveURL(/\/minhquy\/xep-hang$/);
  await expect(page.getByRole('heading', { name: 'Affiliate', exact: true })).toBeVisible();
  await expect(page.getByText(/Giới thiệu người vào Kinh Doanh Online Cùng AI, nhận \d+(,\d+)?% hoa hồng mỗi lần họ trả phí/)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Link của tôi' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('affiliate-link')).toHaveText(/\/minhquy\?ref=hv8k2$/);
  await expect(page.getByRole('link', { name: 'Xem ví và rút tiền' })).toHaveAttribute('href', /^\/tai-khoan\/cong-su\/[0-9a-f-]{36}$/);
  await page.getByRole('tab', { name: 'Xếp hạng' }).click();
  await expect(page).toHaveURL(/\/minhquy\/xep-hang\?tab=xep-hang$/);
  await expect(page.getByText('Hoàng Vũ').first()).toBeVisible();
  await expect(page.getByTestId('affiliate-link')).toHaveCount(0);

  await login(page, USERS.owner);
  // Đường dẫn cũ (trong thông báo đã gửi) phải tự chuyển sang trang Affiliate mới.
  await page.goto('/minhquy/cai-dat/cong-su/rut-tien');
  await expect(page).toHaveURL(/\/minhquy\/cong-su$/);
  await expect(page.getByRole('heading', { name: 'Affiliate', exact: true })).toBeVisible();
  const row = page.locator('div', { hasText: 'hoangvu@gmail.com' }).filter({ has: page.getByRole('button', { name: 'Xem xét' }) }).last();
  await row.getByRole('button', { name: 'Xem xét' }).click();
  // exact: bảng "Đã xử lý gần đây" có dòng từ chối "Sai tên chủ tài khoản…" cũng chứa chuỗi này.
  await expect(page.getByText('Chủ tài khoản', { exact: true })).toBeVisible();
  await expect(page.locator('img[alt*="QR"], img[src*="qr"]').first()).toBeVisible();
  await page.getByPlaceholder(/FT|tham chiếu/i).first().fill(`FT${Date.now()}`);
  await page.getByRole('button', { name: 'Đã chuyển khoản' }).click();
  await expect(page.getByText('Đã trả').first()).toBeVisible();
});
