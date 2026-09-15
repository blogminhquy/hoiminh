// Luồng 8 (V2): hai người mở Tin nhắn cùng lúc → tin nhắn hiện ngay không cần tải lại,
// chỉ báo "đang gõ" bật lên, và biên nhận "Đã xem" đổi khi người kia mở hội thoại.
import { expect, test, type Page } from '@playwright/test';
import { login, USERS } from '../helpers';

/** Mở màn Tin nhắn và chọn hội thoại với người có tên chứa `name`. */
async function openThreadWith(page: Page, name: string) {
  await page.goto('/tin-nhan');
  const row = page.getByRole('button', { name: new RegExp(name) }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByPlaceholder(/^Nhắn cho /)).toBeVisible();
}

test('tin nhắn hiện ngay ở cả hai phía, có đang gõ và đã xem', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const affiliateCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const affiliate = await affiliateCtx.newPage();

  await login(owner, USERS.owner);
  await login(affiliate, USERS.affiliate);

  // Chủ hội nhắn trước để chắc chắn hai bên đã có hội thoại chung.
  await owner.goto('/u/hoangvu');
  await openThreadWith(owner, 'Hoàng Vũ');
  await openThreadWith(affiliate, 'Minh Quý');

  // Cộng sự gõ → chủ hội thấy "đang gõ" mà không tải lại trang.
  await affiliate.getByPlaceholder(/^Nhắn cho /).fill('Em đang xem đơn');
  await expect(owner.getByText(/đang gõ…/)).toBeVisible({ timeout: 15_000 });

  // Cộng sự gửi → tin hiện ngay bên chủ hội (polling dự phòng chậm hơn nhiều so với timeout này).
  const noiDung = `Realtime ${Date.now().toString(36)}`;
  await affiliate.getByPlaceholder(/^Nhắn cho /).fill(noiDung);
  await affiliate.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(owner.getByText(noiDung)).toBeVisible({ timeout: 15_000 });

  // Chủ hội đang mở hội thoại nên tự đánh dấu đã đọc → cộng sự thấy "Đã xem".
  await expect(affiliate.getByText('Đã xem').last()).toBeVisible({ timeout: 15_000 });

  await ownerCtx.close();
  await affiliateCtx.close();
});
