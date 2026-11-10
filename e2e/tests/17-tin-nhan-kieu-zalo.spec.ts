// Tin nhắn kiểu Zalo: khung ba cột lấp đầy màn hình; gửi (Enter), trả lời trích dẫn, thả cảm xúc, thu hồi, ghim;
// điện thoại vào thấy danh sách trước, mở hội thoại thì khung chat chiếm trọn màn (ẩn thanh tab dưới), có nút quay lại.
import { expect, test, type Page } from '@playwright/test';
import { USERS, login } from '../helpers';

/** Khung chat nằm sát đáy header, chạm đáy màn hình (hoặc đỉnh thanh tab dưới) và trang không cuộn dọc. */
async function expectFillsScreen(page: Page): Promise<void> {
  const m = await page.evaluate(() => {
    const r = document.querySelector('.chat-page')!.getBoundingClientRect();
    const tabs = document.querySelector<HTMLElement>('.mobile-tabs');
    const tabsTop = tabs && getComputedStyle(tabs).display !== 'none' ? tabs.getBoundingClientRect().top : window.innerHeight;
    return { top: r.top, bottom: r.bottom, right: r.right, floor: tabsTop, width: window.innerWidth, doc: document.documentElement.scrollHeight, height: window.innerHeight, scrollWidth: document.documentElement.scrollWidth };
  });
  expect(m.top).toBe(64);
  expect(Math.abs(m.bottom - m.floor)).toBeLessThanOrEqual(1);
  expect(m.right).toBe(m.width);
  expect(m.doc).toBeLessThanOrEqual(m.height);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.width);
}

test('máy tính: khung chat lấp đầy màn hình, gửi, trả lời, thả cảm xúc, thu hồi, ghim', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, USERS.owner);
  await page.goto('/tin-nhan');
  const list = page.getByRole('region', { name: 'Danh sách hội thoại' });
  await list.getByRole('button', { name: /Hồng Kim/ }).first().click();
  const thread = page.getByRole('region', { name: 'Hội thoại với Hồng Kim' });
  await expect(thread.locator('.chat-row')).toHaveCount(2);
  await expectFillsScreen(page);
  // Bảng thông tin hội thoại là cột thứ ba; tin mới nhất nằm sát ô nhập (luồng dồn về đáy).
  await expect(page.getByRole('complementary', { name: 'Thông tin hội thoại' })).toBeVisible();
  const gap = await page.evaluate(() => document.querySelector('.chat-composer')!.getBoundingClientRect().top - [...document.querySelectorAll('.chat-row')].at(-1)!.getBoundingClientRect().bottom);
  expect(gap).toBeLessThan(80);

  // Gửi bằng Enter; link trong tin bấm được; dòng xem trước có "Bạn: ".
  const input = thread.getByRole('textbox', { name: /Nhập tin nhắn tới/ });
  await input.fill('Bản ghi đây nhé: https://example.com/qa-tuan-nay');
  await input.press('Enter');
  await expect(thread.getByRole('link', { name: 'https://example.com/qa-tuan-nay' })).toHaveAttribute('target', '_blank');
  await expect(thread.getByText('Đã gửi')).toBeVisible();
  await expect(list.getByRole('button', { name: /Hồng Kim/ }).first()).toContainText('Bạn: Bản ghi đây nhé');

  // Trả lời trích dẫn tin của Hồng Kim.
  const theirs = thread.locator('.chat-row:not(.mine)').first();
  await theirs.hover();
  await theirs.getByRole('button', { name: 'Trả lời' }).click();
  await expect(thread.locator('.chat-replying')).toContainText('Trả lời Hồng Kim');
  await input.fill('Có rồi em nhé');
  await input.press('Enter');
  await expect(thread.locator('.chat-row.mine .chat-quote').last()).toContainText('Anh ơi bản ghi buổi Q&A');

  // Thả cảm xúc: rê vào nút thích để chọn; cảm xúc của mình hiện ngay trên tin.
  await theirs.hover();
  await theirs.locator('.chat-react-btn').hover();
  await theirs.getByRole('button', { name: 'Thả cảm xúc ❤️' }).click();
  await expect(theirs.getByRole('button', { name: 'Gỡ cảm xúc của bạn' }).first()).toHaveText('❤️');

  // Thu hồi tin vừa gửi: hai bên chỉ còn thấy "Tin nhắn đã được thu hồi", danh sách cũng không lộ nội dung.
  page.once('dialog', (d) => void d.accept());
  const mine = thread.locator('.chat-row.mine').last();
  await mine.hover();
  await mine.getByRole('button', { name: 'Thu hồi tin nhắn' }).click();
  await expect(mine).toContainText('Tin nhắn đã được thu hồi');
  await expect(thread.getByText('Có rồi em nhé')).toHaveCount(0);
  await expect(list.getByRole('button', { name: /Hồng Kim/ }).first()).toContainText('Tin nhắn đã được thu hồi');

  // Ghim từ menu của dòng hội thoại: lên đầu danh sách, khung chat vẫn ở hội thoại đang mở.
  const row = list.locator('.chat-convo', { hasText: 'Thu Lan' });
  await row.hover();
  await row.getByRole('button', { name: /Thao tác với hội thoại/ }).click();
  await page.getByRole('menuitem', { name: 'Ghim hội thoại' }).click();
  await expect(list.locator('.chat-convo').first()).toContainText('Thu Lan');
  await expect(thread).toBeVisible();
  await row.hover();
  await row.getByRole('button', { name: /Thao tác với hội thoại/ }).click();
  await page.getByRole('menuitem', { name: 'Bỏ ghim hội thoại' }).click();
  await expect(list.locator('.chat-convo').first()).not.toContainText('Thu Lan');
});

test('điện thoại: danh sách trước, mở hội thoại chiếm trọn màn hình, quay lại được', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await login(page, USERS.affiliate);
  await page.goto('/tin-nhan');
  const list = page.getByRole('region', { name: 'Danh sách hội thoại' });
  await expect(list.getByRole('button', { name: /Minh Quý/ })).toBeVisible();
  // Chưa chọn thì chưa mở khung chat nào (không tự đánh dấu đã đọc), thanh tab dưới vẫn còn.
  await expect(page.locator('.chat-main')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await expectFillsScreen(page);

  await list.getByRole('button', { name: /Minh Quý/ }).tap();
  const thread = page.getByRole('region', { name: 'Hội thoại với Minh Quý' });
  await expect(thread.locator('.chat-row').first()).toBeVisible();
  await expect(list).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toHaveCount(0);
  await expectFillsScreen(page);

  // Điện thoại gửi bằng nút; chạm vào tin để hiện thao tác.
  await thread.getByRole('textbox', { name: /Nhập tin nhắn tới/ }).fill('Em cảm ơn anh');
  await thread.getByRole('button', { name: 'Gửi', exact: true }).tap();
  const sent = thread.locator('.chat-row.mine').last();
  await expect(sent).toContainText('Em cảm ơn anh');
  await expect(thread.getByText('Đã gửi')).toBeVisible();
  await sent.locator('.chat-bubble').tap();
  await expect(sent.getByRole('button', { name: 'Trả lời' })).toBeVisible();
  // Thanh cảm xúc hiện theo phải nằm trọn trong màn hình, dù tin nằm sát mép phải.
  await expect(sent.getByRole('button', { name: 'Thả cảm xúc 😡' })).toBeVisible();
  const bar = (await sent.locator('.chat-react-bar').boundingBox())!;
  expect(bar.x).toBeGreaterThanOrEqual(0);
  expect(bar.x + bar.width).toBeLessThanOrEqual(390);

  await thread.getByRole('button', { name: 'Về danh sách hội thoại' }).tap();
  await expect(list).toBeVisible();
  await expect(page).toHaveURL(/\/tin-nhan$/);
  await context.close();
});
