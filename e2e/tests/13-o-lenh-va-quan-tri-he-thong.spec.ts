// Ô lệnh "Bạn muốn làm gì?" của chủ hội và quản trị hệ thống, và khu quản trị hệ thống gom về 5 nhóm có tab con.
import { expect, test } from '@playwright/test';
import { USERS, login } from '../helpers';

test.describe('máy tính', () => {
  test.use({ viewport: { width: 1360, height: 860 } });

  test('chủ hội: mở ô lệnh bằng Ctrl K, gõ không dấu, Enter tới đúng màn', async ({ page }) => {
    await login(page, USERS.owner);
    await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
    // Phím tắt chỉ có sau khi khung hội tải xong và biết người xem có quyền quản lý: chờ nút ô lệnh hiện ra rồi mới bấm.
    await expect(page.getByRole('button', { name: /Bạn muốn làm gì/ })).toBeVisible();
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Bạn muốn làm gì?' });
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('option', { name: /Viết bài/ })).toBeVisible();

    const box = palette.getByRole('combobox');
    await box.fill('hoa hong');
    await expect(palette.getByRole('option').first()).toContainText('Trả hoa hồng cho cộng sự');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/minhquy\/cong-su$/);
    await expect(palette).toHaveCount(0);

    // Nút ở đầu trang mở cùng ô lệnh. Gõ tên người: dòng "Tìm thành viên" dẫn tới danh sách đã lọc.
    await page.getByRole('button', { name: /Bạn muốn làm gì/ }).click();
    await palette.getByRole('combobox').fill('Hoàng');
    await palette.getByRole('option', { name: /Tìm thành viên "Hoàng"/ }).click();
    await expect(page).toHaveURL(/\/minhquy\/thanh-vien\?q=/);
    await expect(page.getByPlaceholder(/Tìm theo tên/)).toHaveValue('Hoàng');
    await expect(page.getByText('Hoàng Vũ').first()).toBeVisible();

    // Esc đóng ô lệnh, không đổi trang.
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);
  });

  test('thành viên thường không có ô lệnh, vẫn có ô tìm trong bảng tin', async ({ page }) => {
    await login(page, USERS.member2);
    await expect(page.getByRole('textbox', { name: 'Tìm trong bảng tin' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bạn muốn làm gì/ })).toHaveCount(0);
  });

  test('quản trị hệ thống: 5 nhóm, tab con, ô lệnh tìm hội', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/he-thong');
    const side = page.getByRole('navigation', { name: 'Quản trị hệ thống' });
    await expect(side.getByRole('link')).toHaveCount(5);

    await side.getByRole('link', { name: 'Hội và người dùng' }).click();
    await expect(page).toHaveURL(/\/he-thong\/hoi$/);
    const tabs = page.getByRole('navigation', { name: 'Hội và người dùng' });
    await expect(tabs.getByRole('link')).toHaveCount(3);
    await tabs.getByRole('link', { name: 'Người dùng' }).click();
    await expect(page).toHaveURL(/\/he-thong\/nguoi-dung$/);
    await expect(page.getByRole('heading', { name: 'Người dùng' })).toBeVisible();
    await expect(side.getByRole('link', { name: 'Hội và người dùng' })).toHaveAttribute('aria-current', 'page');

    // Đường dẫn cũ vẫn mở đúng trang và đúng nhóm.
    await page.goto('/he-thong/nhat-ky');
    await expect(page.getByRole('heading', { name: 'Nhật ký và webhook' })).toBeVisible();
    await expect(side.getByRole('link', { name: 'Hệ thống', exact: true })).toHaveAttribute('aria-current', 'page');

    // Tab Tính năng không còn 3 cờ chưa có tác dụng.
    await page.goto('/he-thong/tinh-nang');
    await expect(page.getByText('Cửa hàng trong hội')).toBeVisible();
    await expect(page.getByText('Phát trực tiếp trong hội')).toHaveCount(0);
    await expect(page.getByText('Điểm và cấp độ hoạt động')).toHaveCount(0);

    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Bạn muốn làm gì?' });
    await palette.getByRole('combobox').fill('yoga');
    await expect(palette.getByRole('option').first()).toContainText('Tìm hội "yoga"');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/he-thong\/hoi\?q=yoga$/);
    await expect(page.getByText('Yoga sáng 6 giờ').first()).toBeVisible();
  });
});

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('quản trị hệ thống: hàng 5 nhóm, ô lệnh mở bằng nút, không tràn ngang', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/he-thong/thanh-toan');
    await expect(page.getByRole('navigation', { name: 'Nhóm quản trị' }).getByRole('link')).toHaveCount(5);
    await expect(page.getByRole('navigation', { name: 'Tiền' }).getByRole('link')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.getByRole('button', { name: 'Bạn muốn làm gì?' }).click();
    const palette = page.getByRole('dialog', { name: 'Bạn muốn làm gì?' });
    await palette.getByRole('combobox').fill('phien ban');
    await palette.getByRole('option', { name: /Phiên bản/ }).click();
    await expect(page).toHaveURL(/\/he-thong\/phien-ban$/);
    await expect(page.getByRole('heading', { name: 'Phiên bản', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('chủ hội: nút kính lúp mở ô lệnh', async ({ page }) => {
    await login(page, USERS.owner);
    await page.getByRole('button', { name: 'Bạn muốn làm gì?' }).click();
    const palette = page.getByRole('dialog', { name: 'Bạn muốn làm gì?' });
    await palette.getByRole('combobox').fill('rut tien');
    await palette.getByRole('option', { name: /Rút tiền về tài khoản/ }).click();
    await expect(page).toHaveURL(/\/minhquy\/tien$/);
  });
});
