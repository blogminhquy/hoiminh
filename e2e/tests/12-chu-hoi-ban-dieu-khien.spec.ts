// Chủ hội: đăng nhập là vào Bàn điều khiển (thay trang Hôm nay), đi tới Tiền, Affiliate và Cài đặt 4 nhóm
// trên điện thoại lẫn máy tính. Đường dẫn cũ (Doanh thu, Thanh toán) phải tự chuyển sang trang mới.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

async function expectNoSideScroll(page: Page, width: number): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('chủ hội: Bàn điều khiển, Đơn hàng, Cài đặt hội 4 nhóm, chuyển hội', async ({ page }) => {
    await login(page, USERS.owner);
    await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
    await expect(page.getByRole('heading', { name: /^Chào / })).toBeVisible();
    // Danh sách "Cần xử lý" luôn có nội dung: hoặc việc cần làm, hoặc dòng báo đã xong hết.
    const todo = page.getByRole('region', { name: 'Cần xử lý' });
    await expect(todo.getByText(/yêu cầu rút của affiliate|chờ duyệt|hết hạn|Hội đã đủ|Mọi việc đã xong/).first()).toBeVisible();
    // Tiền bán hàng về thẳng tài khoản chủ hội: không còn "Có thể rút" hay "Đang giữ 14 ngày".
    await expect(page.getByText('Đã thu 30 ngày')).toBeVisible();
    await expect(page.getByText('Có thể rút')).toHaveCount(0);
    await expect(page.getByText('Ghé hội hôm nay')).toHaveCount(0);
    await expectNoSideScroll(page, 390);

    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(nav.getByRole('link', { name: 'Quản lý', exact: true })).toHaveAttribute('aria-current', 'page');

    // Ô lối tắt: Đơn hàng gom phần nhận tiền, thống kê và mọi đơn của hội về một trang, vẫn thuộc tab Quản lý.
    const tiles = page.getByRole('navigation', { name: 'Quản lý hội' });
    for (const label of ['Đơn hàng', 'Quản lý affiliate', 'Cài đặt hội']) await expect(tiles.getByRole('link', { name: label, exact: true })).toBeVisible();
    await tiles.getByRole('link', { name: 'Đơn hàng' }).click();
    await expect(page).toHaveURL(/\/minhquy\/tien$/);
    await expect(page.getByRole('heading', { name: 'Quản lý đơn hàng', exact: true })).toBeVisible();
    const money = page.getByRole('region', { name: 'Nhận tiền' });
    await expect(money.getByText('Đã thu 30 ngày')).toBeVisible();
    await expect(money.getByText(/chuyển khoản thẳng tới Vietcombank 0071000999888/)).toBeVisible();
    await expect(money.getByRole('link', { name: 'Cách nhận tiền' })).toHaveAttribute('href', '/minhquy/cai-dat/nhan-tien');
    // Hai tab: Thống kê mở sẵn; Tất cả đơn hàng nằm trên địa chỉ để tải lại vẫn đúng tab.
    const tabs = page.getByRole('tablist', { name: 'Quản lý đơn hàng' });
    await expect(tabs.getByRole('tab', { name: 'Thống kê' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Doanh thu', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Khoảng ngày: 30 ngày qua/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Đơn đặt trong kỳ' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Quản lý', exact: true })).toHaveAttribute('aria-current', 'page');
    await expectNoSideScroll(page, 390);
    await tabs.getByRole('tab', { name: 'Tất cả đơn hàng' }).click();
    await expect(page).toHaveURL(/\/minhquy\/tien\?tab=don-hang$/);
    const orders = page.getByRole('list', { name: 'Đơn hàng' });
    await expect(orders.getByRole('listitem').first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /đơn · tổng giá trị/ })).toBeVisible();
    // Lọc theo trạng thái và theo affiliate: mọi đơn còn lại đều đã thanh toán và có người giới thiệu.
    await page.getByRole('combobox', { name: 'Lọc theo trạng thái' }).click();
    await page.getByRole('option', { name: 'Đã thanh toán' }).click();
    await page.getByRole('combobox', { name: 'Lọc theo affiliate' }).click();
    await page.getByRole('option', { name: 'Có người giới thiệu', exact: true }).click();
    await expect(orders.getByRole('listitem').first()).toContainText('Đã thanh toán');
    await expect(orders.getByRole('listitem').first()).toContainText('hoa hồng');
    await expect(orders.getByText('Chờ xác nhận')).toHaveCount(0);
    await expect(orders.getByText('Không có', { exact: true })).toHaveCount(0);
    await expectNoSideScroll(page, 390);
    await page.reload();
    await expect(page.getByRole('tablist', { name: 'Quản lý đơn hàng' }).getByRole('tab', { name: 'Tất cả đơn hàng' })).toHaveAttribute('aria-selected', 'true');

    // Đường dẫn cũ vẫn chạy.
    await page.goto('/minhquy/doanh-thu');
    await expect(page).toHaveURL(/\/minhquy\/tien$/);
    await page.goto('/minhquy/cai-dat/thanh-toan');
    await expect(page).toHaveURL(/\/minhquy\/tien$/);

    // Cài đặt: danh sách 4 nhóm, vào nhóm rồi quay lại bằng nút ở đầu trang.
    await page.goto('/minhquy/cai-dat');
    await expect(page.getByRole('heading', { name: 'Cài đặt hội', exact: true })).toBeVisible();
    const groups = page.getByRole('navigation', { name: 'Nhóm cài đặt' });
    await expect(groups.getByRole('link')).toHaveCount(4);
    await groups.getByRole('link', { name: /Bán hàng/ }).click();
    await expect(page).toHaveURL(/\/minhquy\/cai-dat\/gia$/);
    await expect(page.getByRole('heading', { name: 'Giá và gói' })).toBeVisible();
    await expectNoSideScroll(page, 390);
    await page.getByRole('link', { name: 'Cài đặt hội', exact: true }).click();
    await expect(page).toHaveURL(/\/minhquy\/cai-dat$/);

    // Mở menu bên trái, chạm tên hội ở đầu menu để chuyển hội. Chủ hội thấy cả nhóm Quản lý trong menu.
    await page.getByRole('button', { name: 'Mở menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu hội' });
    for (const label of ['Bàn điều khiển', 'Đơn hàng', 'Quản lý affiliate', 'Cài đặt hội']) await expect(drawer.getByRole('link', { name: label, exact: true })).toBeVisible();
    // Menu của chủ hội dài hơn màn hình: danh sách mục cuộn được, còn nút Viết bài ghim ở đáy nên luôn thấy.
    const write = drawer.getByRole('link', { name: 'Viết bài' });
    await expect(write).toBeInViewport({ ratio: 1 });
    await drawer.getByRole('link', { name: 'Cài đặt hội', exact: true }).scrollIntoViewIfNeeded();
    await expect(write).toBeInViewport({ ratio: 1 });
    await expect(drawer.getByRole('button', { name: 'Mời thành viên' })).toBeVisible();
    await drawer.getByRole('button', { name: /chuyển hội$/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /Tất cả hội/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Kinh Doanh Online/ })).toHaveAttribute('href', '/minhquy/hom-nay');
  });
});

test.describe('máy tính', () => {
  test.use({ viewport: { width: 1360, height: 860 } });

  test('chủ hội: thanh bên có nhóm Quản lý, Cài đặt hội còn 4 nhóm', async ({ page }) => {
    await login(page, USERS.owner);
    await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
    const side = page.locator('aside.app-sidebar');
    await expect(side.getByRole('link', { name: 'Bàn điều khiển' })).toBeVisible();
    await expect(side.getByRole('link', { name: 'Hôm nay' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Hội đang chạy thế nào' })).toBeVisible();
    await expectNoSideScroll(page, 1360);

    await side.getByRole('link', { name: 'Quản lý affiliate', exact: true }).click();
    await expect(page).toHaveURL(/\/minhquy\/cong-su$/);
    await expect(page.getByRole('heading', { name: 'Quản lý affiliate', exact: true })).toBeVisible();

    await side.getByRole('link', { name: 'Đơn hàng', exact: true }).click();
    await expect(page).toHaveURL(/\/minhquy\/tien$/);
    await expect(page.getByRole('heading', { name: 'Quản lý đơn hàng', exact: true })).toBeVisible();

    await side.getByRole('link', { name: 'Cài đặt hội' }).click();
    await expect(page).toHaveURL(/\/minhquy\/cai-dat\/chung$/);
    const settings = page.getByRole('navigation', { name: 'Cài đặt hội' });
    for (const label of ['Hội', 'Bán hàng', 'Affiliate', 'Tự động và kết nối']) await expect(settings.getByRole('link', { name: label, exact: true })).toBeVisible();
    await expect(settings.getByRole('link', { name: /Gói của hội/ })).toHaveAttribute('href', '/admin/goi?hoi=minhquy');
    await expect(settings.getByRole('link')).toHaveCount(6); // 4 nhóm, gói của hội và lối ra trang giới thiệu
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
    for (const label of ['Đơn hàng', 'Quản lý affiliate', 'Cài đặt hội']) await expect(side.getByRole('link', { name: label })).toHaveCount(0);
    await page.goto('/minhquy/tien');
    await expect(page).toHaveURL(/\/minhquy\/hom-nay$/);
  });
});
