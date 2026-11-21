// Luồng 22: chủ hội cài nhận tiền. Hội chưa cài thì nút mua bị khóa → chủ hội nhập tài khoản ngân hàng của mình ở hàng
// "Chuyển khoản QR" → người mua thấy mã QR tới đúng tài khoản đó, bấm "Tôi đã chuyển khoản" → chủ hội bấm "Đã nhận tiền"
// → người mua được mở quyền ngay. Tiền không đi qua Hội Mình. Cuối cùng chủ hội bật hàng "QR tự động qua SePay", thấy
// hướng dẫn nối SePay kèm địa chỉ báo có, và dòng trạng thái tự báo "Đã nối" khi SePay gửi thử.
import { expect, test } from '@playwright/test';
import { USERS, login } from '../helpers';

test('hội chưa cài nhận tiền thì khóa nút mua; cài xong, chủ hội bấm "Đã nhận tiền" là người mua được mở quyền', async ({ browser, page, request }) => {
  // Người mua: thành viên muốn nâng Premium ở hội của Vy.
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await login(buyer, USERS.member);
  await buyer.goto('/ngoai-ngu-vy/thanh-toan?tier=premium&cycle=monthly');
  await expect(buyer.getByRole('button', { name: 'Hội chưa mở thanh toán' })).toBeDisabled();
  await expect(buyer.getByText(/Chủ hội chưa cài cách nhận tiền/)).toBeVisible();

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
  await save.click();
  await expect(page.getByText('Hội đã mở thanh toán')).toBeVisible();
  await expect(page.getByText('Người mua đang thấy: Chuyển khoản QR.')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Bật Chuyển khoản QR' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/Chưa có đơn nào đang chờ/)).toBeVisible();

  // Người mua: nút mua đã mở, mã QR chuyển tới đúng tài khoản của chủ hội.
  await buyer.reload();
  await buyer.getByRole('button', { name: 'Lấy mã QR chuyển khoản' }).click();
  await expect(buyer).toHaveURL(/\/thanh-toan\/[0-9a-f-]{36}/);
  await expect(buyer.getByText('19039998887776').first()).toBeVisible();
  await expect(buyer.getByText(/NGUYEN THAO VY/).first()).toBeVisible();
  await buyer.getByRole('button', { name: 'Tôi đã chuyển khoản' }).click();
  // Bấm xong là sang màn cảm ơn và chờ xác nhận: nói rõ đang chờ chủ hội, có thẻ chủ hội để nhắn tin, mở lại được thông tin chuyển khoản.
  await expect(buyer.getByText('Đã báo cho chủ hội, đang chờ chủ hội kiểm tra tài khoản và xác nhận')).toBeVisible();
  await expect(buyer.getByRole('button', { name: 'Tôi đã chuyển khoản' })).toHaveCount(0);
  await expect(buyer.getByRole('button', { name: 'Nhắn tin cho chủ hội' })).toBeVisible();
  await buyer.getByText('Xem lại thông tin chuyển khoản').click();
  await expect(buyer.getByText('19039998887776')).toBeVisible();
  await expect(buyer.getByRole('link', { name: 'Về trang hội' })).toHaveAttribute('href', '/ngoai-ngu-vy');

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

  // Bật QR tự động qua SePay: hàng chuyển khoản thường tự tắt (dùng chung tài khoản), hiện địa chỉ báo có riêng của hội.
  await page.goto('/ngoai-ngu-vy/cai-dat/nhan-tien');
  await page.getByRole('switch', { name: 'Bật QR tự động qua SePay' }).click();
  await expect(page.getByRole('switch', { name: 'Bật QR tự động qua SePay' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: 'Bật Chuyển khoản QR' })).toHaveAttribute('aria-checked', 'false');
  const sepay = page.getByRole('region', { name: 'Nối SePay để đơn tự xác nhận' });
  await expect(sepay.getByText(/Chọn sự kiện/)).toBeVisible();
  const address = sepay.getByText(/\/webhooks\/bank\/[a-f0-9]{40}/);
  await expect(address).toBeVisible();
  await expect(sepay.getByRole('status')).toContainText('Đang chờ tín hiệu đầu tiên từ SePay');

  // Chủ hội bấm "Gửi thử" bên SePay (dữ liệu mẫu, mã giao dịch giả): dòng trạng thái tự chuyển sang "Đã nối",
  // không cần tải lại trang.
  const url = (await address.textContent())!.trim();
  const res = await request.post(url, { data: { id: 0, gateway: 'MBBank', transactionDate: '2026-11-12 10:00:00', accountNumber: '19039998887776', code: 'DH123456', content: 'Thanh toan don hang DH123456', transferType: 'in', transferAmount: 2000, accumulated: 0, subAccount: null, referenceCode: 'FT00000000', description: '' } });
  expect(res.status()).toBe(200);
  await expect(sepay.getByRole('status')).toContainText('Đã nối', { timeout: 20_000 });
});
