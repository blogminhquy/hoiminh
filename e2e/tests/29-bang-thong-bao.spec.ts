// Luồng 29: bấm chuông thì bảng thông báo mở ngay tại chỗ (không nhảy sang /thong-bao). Chuông hiện số chưa đọc; đánh dấu
// một cái đã đọc thì số giảm ngay; nút "Cài đặt" của bảng dẫn tới phần cài đặt của trang Thông báo. Điện thoại: bảng trượt
// từ đáy, rộng hết màn hình, có nút đóng, không tràn ngang.
// Dựa vào dữ liệu mẫu: chủ hội có sẵn thông báo chưa đọc và không luồng nào trước đó đánh dấu đã đọc hộ.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

const bellOf = (page: Page) => page.locator('.notif-wrap > button[aria-haspopup="dialog"]');
const panelOf = (page: Page) => page.getByRole('dialog', { name: 'Thông báo' });

/** Số chưa đọc đọc từ nhãn của chuông ("Thông báo, 5 chưa đọc"); không còn gì thì 0. */
async function unreadOnBell(page: Page): Promise<number> {
  const label = (await bellOf(page).getAttribute('aria-label')) ?? '';
  return Number(label.match(/(\d+) chưa đọc/)?.[1] ?? 0);
}

test('chuông mở bảng thông báo tại chỗ, đánh dấu đã đọc, vào phần cài đặt', async ({ page }) => {
  await login(page, USERS.owner);
  const bell = bellOf(page);
  await expect(bell).toHaveAttribute('aria-label', /^Thông báo, \d+ chưa đọc$/);
  const before = await unreadOnBell(page);
  expect(before, 'dữ liệu mẫu phải có thông báo chưa đọc cho chủ hội').toBeGreaterThan(0);
  // Chuông hiện số, quá 9 thì "9+".
  await expect(page.locator('.notif-count')).toHaveText(before > 9 ? '9+' : String(before));

  // Bấm chuông: bảng mở, vẫn ở trang đang xem, mở sẵn mục "Chưa đọc".
  const url = page.url();
  await expect(bell).toHaveAttribute('aria-expanded', 'false');
  await bell.click();
  const panel = panelOf(page);
  await expect(panel).toBeVisible();
  await expect(bell).toHaveAttribute('aria-expanded', 'true');
  expect(page.url()).toBe(url);
  await expect(panel.getByRole('button', { name: /^Chưa đọc/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('.notif-row').first()).toBeVisible();
  expect(await panel.locator('.notif-row:not(.unread)').count()).toBe(0);

  // Mục "Tất cả": cái chưa đọc đứng trước mọi cái đã đọc.
  await panel.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await expect(panel.locator('.notif-row.unread').first()).toBeVisible();
  const order = await panel.locator('.notif-row').evaluateAll((rows) => rows.map((r) => (r.classList.contains('unread') ? 'U' : 'R')).join(''));
  expect(order).toMatch(/^U+R*$/);

  // Đánh dấu một cái đã đọc mà không mở: số trên chuông giảm 1, bảng vẫn mở.
  await panel.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).first().click();
  await expect.poll(() => unreadOnBell(page)).toBe(before - 1);
  await expect(panel).toBeVisible();
  expect(page.url()).toBe(url);

  // Esc đóng bảng và trả tiêu điểm về chuông; bấm ra ngoài cũng đóng.
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(bell).toBeFocused();
  await bell.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(8, 400);
  await expect(panel).toHaveCount(0);

  // Nút "Cài đặt" dẫn tới phần cài đặt của trang Thông báo, bảng tự đóng khi chuyển trang.
  await bell.click();
  await panel.getByRole('link', { name: 'Cài đặt thông báo' }).click();
  await expect(page).toHaveURL(/\/thong-bao#cai-dat$/);
  await expect(panel).toHaveCount(0);
  await expect(page.locator('#cai-dat')).toContainText('Cài đặt nhanh');
  await expect(page.locator('#cai-dat')).toBeInViewport();
  // Trang Thông báo cũng xếp cái chưa đọc lên đầu.
  const pageOrder = await page.locator('.main .notif-row').evaluateAll((rows) => rows.map((r) => (r.classList.contains('unread') ? 'U' : 'R')).join(''));
  expect(pageOrder).toMatch(/^U*R*$/);

  // Nhãn hành động của dòng ("Trả lời", "Xem"): chữ nằm giữa nút, nút nằm giữa dòng theo chiều dọc và không xuống dòng.
  // (Trước đây lớp hide-mobile đè mất display của .btn nên chữ dính mép trên.)
  const action = page.locator('.main .notif-action').first();
  await expect(action).toBeVisible();
  const m = await action.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const t = range.getBoundingClientRect();
    const row = el.closest('.notif-row')!.getBoundingClientRect();
    return { height: b.height, textOff: Math.abs(t.top + t.height / 2 - (b.top + b.height / 2)), rowOff: Math.abs(b.top + b.height / 2 - (row.top + row.height / 2)), oneLine: t.height < b.height };
  });
  expect(m.height).toBe(36);
  expect(m.textOff).toBeLessThanOrEqual(1.5);
  expect(m.rowOff).toBeLessThanOrEqual(1.5);
  expect(m.oneLine).toBe(true);
});

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('bảng thông báo trượt từ đáy, rộng hết màn hình, đóng bằng nút X', async ({ page }) => {
    await login(page, USERS.owner);
    const url = page.url();
    await bellOf(page).click();
    const panel = panelOf(page);
    await expect(panel).toBeVisible();
    expect(page.url()).toBe(url);
    // Bảng trượt lên trong chốc lát, nên chờ tới khi đáy bảng chạm đáy màn hình rồi mới đo.
    await expect.poll(async () => { const b = (await panel.boundingBox())!; return Math.round(b.y + b.height); }).toBe(844);
    const box = (await panel.boundingBox())!;
    expect(box.x).toBe(0);
    expect(Math.round(box.width)).toBe(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // Dòng thông báo và các nút đủ cao để bấm bằng ngón tay.
    for (const sel of ['.notif-row', '.notif-row-read', '.chip', '.notif-link-btn', '.notif-foot a']) {
      const h = await panel.locator(sel).first().evaluate((el) => el.getBoundingClientRect().height);
      expect(h, `${sel} cao tối thiểu 44px`).toBeGreaterThanOrEqual(44);
    }
    // Chỗ hẹp: nhãn hành động nằm dưới dòng chữ, căn trái theo dòng chữ, không ép chữ thành cột hẹp.
    // Xem ở mục "Tất cả" để có cả thông báo đã đọc mang nhãn hành động.
    await panel.getByRole('button', { name: 'Tất cả', exact: true }).click();
    await expect(panel.locator('.notif-action').first()).toBeVisible();
    const stacked = await panel.locator('.notif-row:has(.notif-action)').first().evaluate((row) => {
      const a = row.querySelector('.notif-action')!.getBoundingClientRect();
      const t = row.querySelector('.notif-title')!.getBoundingClientRect();
      return { below: a.top >= t.bottom, left: Math.abs(a.left - t.left), height: a.height, titleWidth: t.width };
    });
    expect(stacked.below).toBe(true);
    expect(stacked.left).toBeLessThanOrEqual(1);
    expect(stacked.height).toBeGreaterThanOrEqual(44);
    expect(stacked.titleWidth).toBeGreaterThan(200);
    await panel.getByRole('button', { name: 'Đóng thông báo' }).click();
    await expect(panel).toHaveCount(0);

    // Trang Thông báo trên điện thoại: phần cài đặt nằm dưới danh sách, vào bằng #cai-dat thì cuộn tới nơi.
    await page.goto('/thong-bao#cai-dat');
    await expect(page.locator('#cai-dat')).toContainText('Theo cộng đồng');
    await expect(page.locator('#cai-dat')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
