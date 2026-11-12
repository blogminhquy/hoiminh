// Tin nhắn kiểu Zalo: khung ba cột lấp đầy màn hình; gửi (Enter), trả lời trích dẫn, thả cảm xúc, thu hồi, ghim;
// tệp đính kèm tối đa 5MB, ba trạng thái đã gửi / đã nhận / đã xem, tab Lưu trữ, chặn và báo cáo;
// điện thoại vào thấy danh sách trước, mở hội thoại thì khung chat chiếm trọn màn (ẩn thanh tab dưới), có nút quay lại.
import { expect, test, type Page } from '@playwright/test';
import { API, USERS, apiJson, apiToken, login } from '../helpers';

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
  await expectNoSideScrollInChat(page);
}

/** Luồng tin không kéo ngang được (từng bị: thanh cảm xúc ẩn vẫn chiếm chỗ làm khung chat trượt sang phải). */
async function expectNoSideScrollInChat(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => { const el = document.querySelector('.chat-scroll'); return el ? el.scrollWidth - el.clientWidth : 0; });
  expect(overflow).toBe(0);
}

test('máy tính: khung chat lấp đầy màn hình, gửi, trả lời, thả cảm xúc, thu hồi, ghim', async ({ page, request }) => {
  // 1600px: đủ rộng để bảng thông tin đứng thành cột thứ ba (từ 1536px); hẹp hơn thì bảng trượt đè lên khung chat và mặc định đóng.
  await page.setViewportSize({ width: 1600, height: 900 });
  // Dùng tài khoản thành viên, không dùng chủ hội: các test ngay trước đã đăng nhập chủ hội nhiều lần, thêm một lần nữa
  // trong cùng phút là chạm hạn mức 10 lần đăng nhập mỗi phút cho một email và bị giữ lại ở trang đăng nhập.
  // Thành viên mới chỉ có hội thoại với chủ hội, nên nhờ Hoàng Vũ nhắn một tin để có hội thoại thứ hai (thử ghim).
  const me = await apiJson<{ userId: string }>(request, await apiToken(request, USERS.member), 'GET', '/v1/me/id');
  await apiJson(request, await apiToken(request, USERS.affiliate), 'POST', '/v1/me/messages', { recipientUserId: me.userId, body: 'Chào Công, mình là Vũ bên nhóm affiliate' });
  await login(page, USERS.member);
  await page.goto('/tin-nhan');
  const list = page.getByRole('region', { name: 'Danh sách hội thoại' });
  await list.getByRole('button', { name: /Minh Quý/ }).first().click();
  const thread = page.getByRole('region', { name: 'Hội thoại với Minh Quý' });
  await expect(thread.locator('.chat-row')).toHaveCount(1);
  await expectFillsScreen(page);
  // Bảng thông tin hội thoại là cột thứ ba; tin mới nhất nằm sát ô nhập (luồng dồn về đáy).
  await expect(page.getByRole('complementary', { name: 'Thông tin hội thoại' })).toBeVisible();
  const gap = await page.evaluate(() => document.querySelector('.chat-composer')!.getBoundingClientRect().top - [...document.querySelectorAll('.chat-row')].at(-1)!.getBoundingClientRect().bottom);
  expect(gap).toBeLessThan(80);
  const theirs = thread.locator('.chat-row:not(.mine)').first();

  // Gửi bằng Enter; link trong tin bấm được, link ngoài mở tab mới; dòng xem trước có "Bạn: ".
  const input = thread.getByRole('textbox', { name: /Nhập tin nhắn tới/ });
  // Ô nhập không còn nút thích nhanh: góc phải luôn là nút Gửi, chưa gõ gì thì chưa bấm được.
  await expect(thread.getByRole('button', { name: /thích/i })).toHaveCount(0);
  await expect(thread.getByRole('button', { name: 'Gửi', exact: true })).toBeDisabled();
  await input.fill('Em cảm ơn anh, em gửi link nhé: https://example.com/qa-tuan-nay và http://localhost:5173/minhquy/bang-tin');
  await input.press('Enter');
  await expect(thread.getByRole('link', { name: 'https://example.com/qa-tuan-nay' })).toHaveAttribute('target', '_blank');
  // Link trong chính Hội Mình mở ngay tại chỗ, không mở tab mới.
  const inner = thread.getByRole('link', { name: 'http://localhost:5173/minhquy/bang-tin' });
  await expect(inner).toHaveAttribute('href', '/minhquy/bang-tin');
  await expect(inner).not.toHaveAttribute('target', '_blank');
  await expect(thread.getByText('Đã gửi')).toBeVisible();
  await expect(list.getByRole('button', { name: /Minh Quý/ }).first()).toContainText('Bạn: Em cảm ơn anh');

  // Trả lời trích dẫn tin của chủ hội.
  await theirs.hover();
  await theirs.getByRole('button', { name: 'Trả lời' }).click();
  await expect(thread.locator('.chat-replying')).toContainText('Trả lời Minh Quý');
  await input.fill('Em vào được rồi ạ');
  await input.press('Enter');
  await expect(thread.locator('.chat-row.mine .chat-quote').last()).toContainText('Chào Công, chào mừng bạn');

  // Hàng dưới bong bóng: giờ gửi luôn hiện; rê vào tin thì hiện nút thao tác cạnh giờ và thanh cảm xúc ở đầu bên kia.
  // Không còn nút thích ở góc bong bóng.
  await expect(theirs.locator('.chat-meta .chat-time')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(theirs.getByRole('button', { name: 'Thả cảm xúc ❤️' })).toBeHidden();
  await theirs.hover();
  await expect(theirs.getByRole('button', { name: /Thích tin nhắn này/ })).toHaveCount(0);
  const metaBox = (await theirs.locator('.chat-meta').boundingBox())!;
  const bubbleBox = (await theirs.locator('.chat-bubble').boundingBox())!;
  const replyBox = (await theirs.getByRole('button', { name: 'Trả lời' }).boundingBox())!;
  const barBox = (await theirs.locator('.chat-react-bar').boundingBox())!;
  expect(metaBox.y).toBeGreaterThanOrEqual(bubbleBox.y + bubbleBox.height);
  expect(replyBox.x).toBeLessThan(barBox.x);
  // Thả cảm xúc: bấm thẳng vào biểu tượng trên thanh; cảm xúc đã thả hiện cạnh giờ gửi, bấm lại để gỡ.
  await theirs.getByRole('button', { name: 'Thả cảm xúc ❤️' }).click();
  await expect(theirs.locator('.chat-react-sum')).toHaveText('❤️');
  await theirs.hover();
  await expect(theirs.getByRole('button', { name: 'Thả cảm xúc ❤️' })).toHaveAttribute('aria-pressed', 'true');
  await theirs.getByRole('button', { name: 'Gỡ cảm xúc của bạn' }).click();
  await expect(theirs.locator('.chat-react-sum')).toHaveCount(0);
  await theirs.hover();
  await theirs.getByRole('button', { name: 'Thả cảm xúc 👍' }).click();
  await expect(theirs.locator('.chat-react-sum')).toHaveText('👍');

  // Thu hồi tin vừa gửi: hai bên chỉ còn thấy "Tin nhắn đã được thu hồi", danh sách cũng không lộ nội dung.
  page.once('dialog', (d) => void d.accept());
  const mine = thread.locator('.chat-row.mine').last();
  await mine.hover();
  await mine.getByRole('button', { name: 'Thu hồi tin nhắn' }).click();
  await expect(mine).toContainText('Tin nhắn đã được thu hồi');
  await expect(thread.getByText('Em vào được rồi ạ')).toHaveCount(0);
  await expect(list.getByRole('button', { name: /Minh Quý/ }).first()).toContainText('Tin nhắn đã được thu hồi');

  // Ghim từ menu của dòng hội thoại: lên đầu danh sách, khung chat vẫn ở hội thoại đang mở.
  const row = list.locator('.chat-convo', { hasText: 'Hoàng Vũ' });
  await expect(list.locator('.chat-convo').first()).toContainText('Minh Quý');
  await row.hover();
  await row.getByRole('button', { name: /Thao tác với hội thoại/ }).click();
  await page.getByRole('menuitem', { name: 'Ghim hội thoại' }).click();
  await expect(list.locator('.chat-convo').first()).toContainText('Hoàng Vũ');
  await expect(thread).toBeVisible();
  await row.hover();
  await row.getByRole('button', { name: /Thao tác với hội thoại/ }).click();
  await page.getByRole('menuitem', { name: 'Bỏ ghim hội thoại' }).click();
  await expect(list.locator('.chat-convo').first()).toContainText('Minh Quý');
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

test('máy tính: tệp đính kèm 5MB, đã gửi / đã nhận / đã xem, tab Lưu trữ, báo cáo và chặn', async ({ page, request }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const me = await apiJson<{ userId: string }>(request, await apiToken(request, USERS.member), 'GET', '/v1/me/id');
  const vu = await apiToken(request, USERS.affiliate);
  await apiJson(request, vu, 'POST', '/v1/me/messages', { recipientUserId: me.userId, body: 'Anh gửi em bảng giá nhé' });
  await login(page, USERS.member);
  await page.goto('/tin-nhan');
  const list = page.getByRole('region', { name: 'Danh sách hội thoại' });
  await list.getByRole('button', { name: /Hoàng Vũ/ }).first().click();
  const thread = page.getByRole('region', { name: 'Hội thoại với Hoàng Vũ' });
  await expect(thread.locator('.chat-row').first()).toBeVisible();
  await expectNoSideScrollInChat(page);

  // Tệp đính kèm: quá 5MB và loại không hỗ trợ bị chặn ngay tại máy, có nói lý do.
  const attach = thread.locator('.chat-tools input[type="file"]').nth(1);
  await expect(thread.getByRole('button', { name: 'Đính kèm tệp (tối đa 5MB)' })).toBeVisible();
  await attach.setInputFiles({ name: 'qua-to.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(thread.locator('.chat-composer [role="status"]')).toContainText('vượt giới hạn 5MB');
  await attach.setInputFiles({ name: 'cai-dat.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
  await expect(thread.locator('.chat-composer [role="status"]')).toContainText('chưa gửi được');
  // Tệp hợp lệ: thẻ tệp có tên và dung lượng; bấm là tải về với đúng tên gốc, trang chat không bị rời đi.
  await thread.getByRole('textbox', { name: /Nhập tin nhắn tới/ }).fill('Em gửi lại bản em sửa');
  await attach.setInputFiles({ name: 'Bảng giá 2026.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 bang gia thu nghiem') });
  const card = thread.locator('.chat-row.mine .chat-file').last();
  await expect(card).toBeEnabled();
  await expect(card).toContainText('Bảng giá 2026.pdf');
  await expect(card).toContainText('28 B');
  // Kiểm tên tải về ở header máy chủ trả (tên trình duyệt gợi ý còn tùy locale của máy chạy test).
  const [served] = await Promise.all([page.waitForResponse((r) => r.url().includes('/files/private/message_file/')), page.waitForEvent('download'), card.click()]);
  expect(served.status()).toBe(200);
  expect(served.headers()['content-disposition']).toBe(`attachment; filename="Bang gia 2026.pdf"; filename*=UTF-8''${encodeURIComponent('Bảng giá 2026.pdf')}`);
  await expect(page).toHaveURL(/\/tin-nhan/);
  await expect(list.getByRole('button', { name: /Hoàng Vũ/ }).first()).toContainText('Bạn: Em gửi lại bản em sửa');
  await expectNoSideScrollInChat(page);
  // Bảng thông tin gom tệp đã gửi.
  await expect(page.getByRole('complementary', { name: 'Thông tin hội thoại' }).getByRole('button', { name: 'Tải tệp Bảng giá 2026.pdf' })).toBeVisible();

  // Ba trạng thái: đã gửi, đã nhận (ứng dụng của người nhận vừa hỏi số chưa đọc), đã xem (người nhận mở hội thoại).
  const status = thread.locator('.chat-row.mine').last().locator('.chat-status');
  await expect(status).toHaveText('Đã gửi');
  await apiJson(request, vu, 'GET', '/v1/me/badges');
  await page.reload();
  await expect(status).toHaveText('Đã nhận');
  const convs = await apiJson<{ items: Array<{ id: string; other: { name: string } }> }>(request, vu, 'GET', '/v1/me/conversations');
  const withCong = convs.items.find((c) => c.other.name === 'Công Trần')!;
  await apiJson(request, vu, 'GET', `/v1/me/conversations/${withCong.id}/messages`);
  await page.reload();
  await expect(status).toHaveText('Đã xem');

  // Lưu trữ: hội thoại rời danh sách chính, nằm ở tab "Lưu trữ", bỏ lưu trữ thì trở lại.
  const row = list.locator('.chat-convo', { hasText: 'Hoàng Vũ' });
  await row.hover();
  await row.getByRole('button', { name: /Thao tác với hội thoại/ }).click();
  await page.getByRole('menuitem', { name: 'Lưu trữ hội thoại' }).click();
  await expect(row).toHaveCount(0);
  await list.getByRole('tab', { name: 'Lưu trữ' }).click();
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByRole('button', { name: /Thao tác với hội thoại/ }).click();
  await page.getByRole('menuitem', { name: 'Bỏ lưu trữ' }).click();
  await expect(list.getByText('Chưa lưu trữ hội thoại nào')).toBeVisible();
  await list.getByRole('tab', { name: 'Tất cả' }).click();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Hoàng Vũ/ }).first().click();
  await expect(thread.locator('.chat-row').first()).toBeVisible();

  // Menu ba chấm: xem hồ sơ, chặn, báo cáo. Báo cáo tới được quản trị hệ thống.
  const more = thread.getByRole('button', { name: 'Thao tác với Hoàng Vũ' });
  await more.click();
  await expect(page.getByRole('menuitem', { name: 'Xem hồ sơ' })).toHaveAttribute('href', /\/u\//);
  await page.getByRole('menuitem', { name: 'Báo cáo Vũ' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Lừa đảo').check();
  await dialog.getByPlaceholder('Chuyện gì đã xảy ra?').fill('Đòi chuyển khoản trước khi gửi hàng');
  await dialog.getByRole('button', { name: 'Gửi báo cáo' }).click();
  await expect(dialog.getByText('Đã gửi báo cáo')).toBeVisible();
  await dialog.locator('button.btn-primary').click();
  const reports = await apiJson<{ items: Array<{ reason: string; detail: string; reported: { name: string }; reporter: { name: string } }> }>(request, await apiToken(request, USERS.admin), 'GET', '/v1/admin/user-reports?status=open');
  expect(reports.items).toContainEqual(expect.objectContaining({ reason: 'scam', detail: 'Đòi chuyển khoản trước khi gửi hàng', reported: expect.objectContaining({ name: 'Hoàng Vũ' }), reporter: expect.objectContaining({ name: 'Công Trần' }) }));

  // Chặn: ô nhập đổi thành dòng báo, người bị chặn gửi tin bị từ chối; bỏ chặn thì nhắn lại được.
  page.once('dialog', (d) => void d.accept());
  await more.click();
  await page.getByRole('menuitem', { name: 'Chặn Vũ' }).click();
  await expect(thread.locator('.chat-blocked')).toContainText('Bạn đã chặn Hoàng Vũ');
  await expect(thread.getByRole('textbox', { name: /Nhập tin nhắn tới/ })).toHaveCount(0);
  const refused = await request.post(`${API}/v1/me/messages`, { headers: { Authorization: `Bearer ${vu}` }, data: { recipientUserId: me.userId, body: 'Còn đó không?' } });
  expect(refused.status()).toBe(403);
  await thread.locator('.chat-blocked').getByRole('button', { name: 'Bỏ chặn' }).click();
  await expect(thread.getByRole('textbox', { name: /Nhập tin nhắn tới/ })).toBeVisible();
});
