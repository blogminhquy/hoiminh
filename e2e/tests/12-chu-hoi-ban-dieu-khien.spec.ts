// Chủ hội: đăng nhập là vào Bàn điều khiển (thay trang Hôm nay), đi tới Tiền, Cộng sự và Cài đặt 4 nhóm
// trên điện thoại lẫn máy tính. Đường dẫn cũ (Doanh thu, Thanh toán) phải tự chuyển sang trang mới.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

async function expectNoSideScroll(page: Page, width: number): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('chủ hội: Bàn điều khiển, Tiền, Cài đặt 4 nhóm, chuyển hội', async ({ page }) => {
    await login(page, USERS.owner);
    await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
    await expect(page.getByRole('heading', { name: /^Chào / })).toBeVisible();
    // Danh sách "Cần xử lý" luôn có nội dung: hoặc việc cần làm, hoặc dòng báo đã xong hết.
    const todo = page.getByRole('region', { name: 'Cần xử lý' });
    await expect(todo.getByText(/yêu cầu rút của cộng sự|chờ duyệt|Gói Hội Mình|Dùng thử|Mọi việc đã xong/).first()).toBeVisible();
    await expect(page.getByText('Có thể rút')).toBeVisible();
    await expect(page.getByText('Ghé hội hôm nay')).toHaveCount(0);
    await expectNoSideScroll(page, 390);

    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(nav.getByRole('link', { name: 'Quản lý', exact: true })).toHaveAttribute('aria-current', 'page');

    // Ô lối tắt: Tiền gom số dư và giao dịch về một trang, vẫn thuộc tab Quản lý.
    await page.getByRole('navigation', { name: 'Quản lý hội' }).getByRole('link', { name: 'Tiền' }).click();
    await expect(page).toHaveURL(/\/minhquy\/tien$/);
    await expect(page.getByRole('heading', { name: 'Tiền', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Số dư' }).getByText('Có thể rút')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Doanh thu' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Quản lý', exact: true })).toHaveAttribute('aria-current', 'page');
    await expectNoSideScroll(page, 390);

    // Đường dẫn cũ vẫn chạy.
    await page.goto('/minhquy/doanh-thu');
    await expect(page).toHaveURL(/\/minhquy\/tien$/);
    await page.goto('/minhquy/cai-dat/thanh-toan');
    await expect(page).toHaveURL(/\/minhquy\/tien$/);

    // Cài đặt: danh sách 4 nhóm, vào nhóm rồi quay lại bằng nút ở đầu trang.
    await page.goto('/minhquy/cai-dat');
    await expect(page.getByRole('heading', { name: 'Cài đặt', exact: true })).toBeVisible();
    const groups = page.getByRole('navigation', { name: 'Nhóm cài đặt' });
    await expect(groups.getByRole('link')).toHaveCount(4);
    await groups.getByRole('link', { name: /Bán hàng/ }).click();
    await expect(page).toHaveURL(/\/minhquy\/cai-dat\/gia$/);
    await expect(page.getByRole('heading', { name: 'Giá và gói' })).toBeVisible();
    await expectNoSideScroll(page, 390);
    await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
    await expect(page).toHaveURL(/\/minhquy\/cai-dat$/);

    // Mở menu bên trái, chạm tên hội ở đầu menu để chuyển hội. Chủ hội thấy cả nhóm Quản lý trong menu.
    await page.getByRole('button', { name: 'Mở menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu hội' });
    for (const label of ['Bàn điều khiển', 'Tiền', 'Cộng sự', 'Cài đặt']) await expect(drawer.getByRole('link', { name: label, exact: true })).toBeVisible();
    await drawer.getByRole('button', { name: /chuyển hội$/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /Tất cả hội/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Kinh Doanh Online/ })).toHaveAttribute('href', '/minhquy/hom-nay');
  });
});

test.describe('máy tính', () => {
  test.use({ viewport: { width: 1360, height: 860 } });

  test('chủ hội: thanh bên có nhóm Quản lý, Cài đặt còn 4 nhóm', async ({ page }) => {
    await login(page, USERS.owner);
    await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
    const side = page.locator('aside.app-sidebar');
    await expect(side.getByRole('link', { name: 'Bàn điều khiển' })).toBeVisible();
    await expect(side.getByRole('link', { name: 'Hôm nay' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Hội đang chạy thế nào' })).toBeVisible();
    await expectNoSideScroll(page, 1360);

    await side.getByRole('link', { name: 'Cộng sự', exact: true }).click();
    await expect(page).toHaveURL(/\/minhquy\/cong-su$/);
    await expect(page.getByRole('heading', { name: 'Cộng sự', exact: true })).toBeVisible();

    await side.getByRole('link', { name: 'Cài đặt' }).click();
    await expect(page).toHaveURL(/\/minhquy\/cai-dat\/chung$/);
    const settings = page.getByRole('navigation', { name: 'Cài đặt' });
    for (const label of ['Hội', 'Bán hàng', 'Cộng sự', 'Tự động và kết nối']) await expect(settings.getByRole('link', { name: label, exact: true })).toBeVisible();
    await expect(settings.getByRole('link')).toHaveCount(5); // 4 nhóm và lối ra trang giới thiệu
    await settings.getByRole('link', { name: 'Tự động và kết nối' }).click();
    await expect(page).toHaveURL(/\/minhquy\/cai-dat\/tien-ich$/);
    await page.getByRole('navigation', { name: 'Tự động và kết nối' }).getByRole('link', { name: 'Nhà phát triển' }).click();
    await expect(page.getByRole('heading', { name: 'Nhà phát triển' })).toBeVisible();
    await expectNoSideScroll(page, 1360);
  });

  test('thành viên thường vẫn thấy trang Hôm nay, không thấy mục quản lý', async ({ page }) => {
    await login(page, USERS.member2);
    await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
    await expect(page.getByText('Ghé hội hôm nay')).toBeVisible();
    const side = page.locator('aside.app-sidebar');
    await expect(side.getByRole('link', { name: 'Hôm nay' })).toBeVisible();
    await expect(side.getByRole('link', { name: 'Tiền' })).toHaveCount(0);
    await page.goto('/minhquy/tien');
    await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
  });
});
