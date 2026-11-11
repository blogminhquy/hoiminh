// Tài khoản · Hồ sơ: ảnh bìa kiểu Facebook (nút "Chỉnh sửa ảnh bìa" ngay trên ảnh), hàng Liên kết không tràn khung.
// Thông báo: tên hội hiện đủ, ô chọn nằm dòng dưới. Ô chọn (Select) là danh sách do app tự vẽ, đọc được ở giao diện tối.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

async function png(page: Page, name: string, color: string, width = 1200, height = 400) {
  const p = await page.context().newPage();
  await p.setViewportSize({ width, height });
  await p.setContent(`<body style="margin:0;background:${color}"></body>`);
  const buffer = await p.screenshot();
  await p.close();
  return { name, mimeType: 'image/png', buffer };
}

/** Phần tử nằm trọn trong khung chứa nó theo chiều ngang (không thò ra ngoài thẻ). */
async function expectInside(page: Page, inner: string, outer: string): Promise<void> {
  const [a, b] = await Promise.all([page.locator(inner).first().boundingBox(), page.locator(outer).first().boundingBox()]);
  expect(a && b).toBeTruthy();
  expect(a!.x).toBeGreaterThanOrEqual(b!.x);
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + b!.width + 1);
}

test('hồ sơ: tải ảnh bìa bằng nút trên ảnh, hồ sơ công khai hiện ảnh; gỡ ảnh thì về nền màu', async ({ page }) => {
  await login(page, USERS.member2);
  await page.goto('/tai-khoan/ho-so');
  const editCover = page.getByRole('button', { name: 'Chỉnh sửa ảnh bìa' });
  await expect(editCover).toBeVisible();
  await expect(page.getByRole('img', { name: 'Nền màu của hồ sơ, chưa có ảnh bìa' })).toBeVisible();

  await editCover.click();
  await expect(page.getByRole('menuitem', { name: 'Tải ảnh lên' })).toBeVisible();
  await page.getByLabel('Tệp ảnh bìa').setInputFiles(await png(page, 'bia.png', '#3aa0d8'));
  await expect(page.getByRole('img', { name: 'Ảnh bìa hồ sơ' })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu')).toBeVisible();

  // Người khác mở hồ sơ công khai thấy ảnh bìa.
  await page.getByRole('link', { name: 'Xem như người khác' }).click();
  await expect(page.getByRole('img', { name: /^Ảnh bìa của / })).toBeVisible();

  // Gỡ ảnh bìa: hồ sơ quay về nền màu.
  await page.goto('/tai-khoan/ho-so');
  await page.getByRole('button', { name: 'Chỉnh sửa ảnh bìa' }).click();
  await page.getByRole('menuitem', { name: 'Gỡ ảnh bìa' }).click();
  await expect(page.getByRole('img', { name: 'Nền màu của hồ sơ, chưa có ảnh bìa' })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu')).toBeVisible();
});

test('hồ sơ: hàng Liên kết nằm trọn trong thẻ ở máy tính lẫn điện thoại, ô chọn loại là danh sách của app', async ({ page }) => {
  await login(page, USERS.member2);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/tai-khoan/ho-so');
    await page.getByRole('button', { name: 'Thêm liên kết' }).click();
    const url = page.getByLabel('Địa chỉ liên kết').last();
    await expect(url).toBeVisible();
    const card = page.locator('.card', { has: page.getByRole('button', { name: 'Thêm liên kết' }) });
    const [inner, outer] = [await url.boundingBox(), await card.boundingBox()];
    expect(inner!.x + inner!.width).toBeLessThanOrEqual(outer!.x + outer!.width);
    expect(inner!.width).toBeGreaterThan(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  // Ô chọn loại liên kết: bấm mở danh sách, chọn bằng chuột; mở lại và chọn bằng bàn phím.
  const kind = page.getByRole('combobox', { name: 'Loại liên kết' }).last();
  await kind.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('option', { name: 'YouTube', exact: true }).click();
  await expect(kind).toHaveText('YouTube');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await kind.press('ArrowDown');
  await kind.press('ArrowDown');
  await kind.press('Enter');
  await expect(kind).toHaveText('Zalo');
  await kind.click();
  await kind.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('thông báo: tên hội hiện đủ, ô chọn ở dòng dưới và đọc được ở giao diện tối', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await login(page, USERS.owner);
  await page.goto('/thong-bao');
  const select = page.getByRole('combobox', { name: 'Thông báo từ Kinh Doanh Online Cùng AI' });
  await expect(select).toBeVisible();
  // Tên hội không bị cắt bằng dấu ba chấm và nằm phía trên ô chọn.
  const name = page.getByText('Kinh Doanh Online Cùng AI', { exact: true }).last();
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect((await name.boundingBox())!.y).toBeLessThan((await select.boundingBox())!.y);

  await select.click();
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  await expectInside(page, '[role="listbox"]', 'body');
  // Danh sách theo màu chủ đề: nền tối, chữ sáng (trước đây nền trắng, chữ nhạt nên không đọc được).
  const colors = await list.evaluate((el) => {
    const lum = (c: string) => { const [r, g, b] = (c.match(/[\d.]+/g) ?? []).map(Number); return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0); };
    const option = el.querySelector('[role="option"]:not([aria-selected="true"])')!;
    return { bg: lum(getComputedStyle(el).backgroundColor), text: lum(getComputedStyle(option).color) };
  });
  expect(colors.bg).toBeLessThan(80);
  expect(colors.text).toBeGreaterThan(170);
  await page.getByRole('option', { name: 'Chỉ khi nhắc đến tôi' }).click();
  await expect(select).toHaveText('Chỉ khi nhắc đến tôi');
  await select.click();
  await page.getByRole('option', { name: 'Tất cả thông báo' }).click();
  await expect(select).toHaveText('Tất cả thông báo');
});
