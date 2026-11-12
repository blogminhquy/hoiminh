// Luồng 22: chủ hội cài nhận tiền. Hội chưa cài thì nút mua bị khóa → chủ hội nhập tài khoản ngân hàng của mình →
// người mua thấy mã QR tới đúng tài khoản đó, bấm "Tôi đã chuyển khoản" → chủ hội bấm "Đã nhận tiền" → người mua được
// mở quyền ngay. Tiền không đi qua Hội Mình. Cuối cùng chủ hội chuyển sang tự xác nhận và thấy địa chỉ báo có.
import { expect, test } from '@playwright/test';
import { USERS, login } from '../helpers';

test('hội chưa cài nhận tiền thì khóa nút mua; cài xong, chủ hội bấm "Đã nhận tiền" là người mua được mở quyền', async ({ browser, page }) => {
  // Người mua: thành viên muốn nâng Premium ở hội của Vy.
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await login(buyer, USERS.member);
  await buyer.goto('/ngoai-ngu-vy/thanh-toan?tier=premium&cycle=monthly');
  await expect(buyer.getByRole('button', { name: 'Hội chưa mở thanh toán' })).toBeDisabled();
  await expect(buyer.getByText(/Chủ hội chưa cài tài khoản nhận tiền/)).toBeVisible();

  // Chủ hội cài tài khoản nhận tiền.
  await login(page, USERS.freeOwner);
  await page.goto('/ngoai-ngu-vy/cai-dat/nhan-tien');
  await expect(page.getByRole('heading', { name: 'Nhận tiền' })).toBeVisible();
  await expect(page.getByText('Hội chưa cài nhận tiền')).toBeVisible();
  await expect(page.getByText('Hội chưa mở thanh toán')).toBeVisible();
  const save = page.getByRole('button', { name: 'Lưu và mở thanh toán' });
  await expect(save).toBeDisabled();
  await page.getByPlaceholder('Số tài khoản').fill('19039998887776');
  await page.getByPlaceholder('Viết đúng như trên tài khoản ngân hàng').fill('nguyen thao vy');
  await expect(page.getByRole('radio', { name: /Tôi tự bấm đã nhận tiền/ })).toHaveAttribute('aria-checked', 'true');
  await save.click();
  await expect(page.getByText('Hội đã mở thanh toán')).toBeVisible();
  await expect(page.getByText(/Chưa có đơn nào đang chờ/)).toBeVisible();

  // Người mua: nút mua đã mở, mã QR chuyển tới đúng tài khoản của chủ hội.
  await buyer.reload();
  await buyer.getByRole('button', { name: 'Lấy mã QR chuyển khoản' }).click();
  await expect(buyer).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  await expect(buyer.getByText('19039998887776').first()).toBeVisible();
  await expect(buyer.getByText(/NGUYEN THAO VY/).first()).toBeVisible();
  await buyer.getByRole('button', { name: 'Tôi đã chuyển khoản' }).click();
  await expect(buyer.getByRole('button', { name: 'Đã báo chủ hội, chờ xác nhận' })).toBeDisabled();

  // Chủ hội thấy đơn ở danh sách chờ và bấm "Đã nhận tiền".
  await page.reload();
  const pending = page.getByRole('region', { name: 'Đơn chờ bạn xác nhận' });
  await expect(pending.getByText('Người mua báo đã chuyển khoản')).toBeVisible();
  await expect(pending.getByText('149.000đ')).toBeVisible();
  await pending.getByRole('button', { name: /Đã nhận tiền/ }).click();
  await expect(pending.getByText('Đã xác nhận, người mua đã được mở quyền')).toBeVisible();

  // Người mua được mở quyền ngay, không cần tải lại trang.
  await expect(buyer.getByText('Đã nhận thanh toán')).toBeVisible({ timeout: 20_000 });
  await buyerCtx.close();

  // Trang Tiền của chủ hội: không còn "Có thể rút", có số đã thu.
  await page.goto('/ngoai-ngu-vy/tien');
  const money = page.getByRole('region', { name: 'Nhận tiền' });
  await expect(money.getByText('149.000đ').first()).toBeVisible();
  await expect(page.getByText('Có thể rút')).toHaveCount(0);

  // Chuyển sang tự xác nhận: hiện địa chỉ báo có riêng của hội.
  await page.goto('/ngoai-ngu-vy/cai-dat/nhan-tien');
  await page.getByRole('radio', { name: /Tự xác nhận/ }).click();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Nối dịch vụ báo có của bạn')).toBeVisible();
  await expect(page.getByText(/\/webhooks\/bank\/[a-f0-9]{40}/)).toBeVisible();
});
