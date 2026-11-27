// Ô bình luận và ô chat: emoji 2D, ảnh đính kèm, nhãn dán động (bộ Mèo Mình có sẵn), gợi ý nhãn khi gõ từ khóa
// (như Zalo), mục Gần đây; tab GIF ẩn khi chưa có khóa GIPHY. Quản trị tạo bộ nhãn, tải GIF lên, đặt từ khóa.
// Điện thoại: khung chọn trượt từ đáy màn hình.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API, USERS, apiJson, apiToken, login } from '../helpers';

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const GIF_1PX = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

async function newPost(request: APIRequestContext): Promise<string> {
  const token = await apiToken(request, USERS.member2);
  const shell = await apiJson<{ community: { id: string } }>(request, token, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const feed = await apiJson<{ spaces: Array<{ id: string }> }>(request, token, 'GET', `/v1/communities/${shell.community.id}/feed`);
  for (const s of feed.spaces) {
    const res = await request.post(`${API}/v1/communities/${shell.community.id}/posts`, { headers: { authorization: `Bearer ${token}` }, data: { spaceId: s.id, contentMd: `Bài thử nhãn dán ${Date.now()}` } });
    if (res.ok()) return ((await res.json()) as { id: string }).id;
  }
  throw new Error('Không đăng được bài thử');
}

const picker = (page: Page) => page.getByRole('dialog', { name: 'Chọn nhãn dán, emoji hoặc GIF' });
/** Bình luận theo nội dung (danh sách xếp theo tương tác nên bình luận mới chưa chắc đứng đầu). */
const commentWith = (page: Page, text: string) => page.locator('[id^="binh-luan-"]').filter({ hasText: text });
const stickerIn = (page: Page, file: string) => page.locator(`[id^="binh-luan-"] img.media-sticker[src="/stickers/meo-minh/${file}"]`);

test('bình luận: nhãn dán, Gần đây, emoji, gợi ý nhãn khi gõ, ảnh đính kèm; chưa có khóa GIPHY thì không có GIF', async ({ page, request }) => {
  const postId = await newPost(request);
  await login(page, USERS.member2);
  await page.goto(`/minhquy/bai-viet/${postId}`);
  const box = page.getByPlaceholder('Viết bình luận…');
  await expect(box).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi GIF' })).toHaveCount(0);

  // Nhãn dán: mở tab, có bộ Mèo Mình 16 nhãn động, chọn là gửi ngay.
  await page.getByRole('button', { name: 'Gửi nhãn dán' }).first().click();
  await expect(picker(page).getByRole('tab', { name: 'Nhãn dán' })).toHaveAttribute('aria-selected', 'true');
  await expect(picker(page).getByRole('tab', { name: 'GIF' })).toHaveCount(0);
  await expect(picker(page).getByText('Mèo Mình', { exact: true })).toBeVisible();
  await expect(picker(page).locator('.sticker-grid button')).toHaveCount(16);
  await picker(page).getByRole('button', { name: 'Gửi nhãn chào' }).click();
  await expect(picker(page)).toHaveCount(0);
  await expect(stickerIn(page, 'chao.svg')).toBeVisible();

  // Mở lại: có mục Gần đây với nhãn vừa dùng.
  await page.getByRole('button', { name: 'Gửi nhãn dán' }).first().click();
  await expect(picker(page).getByText('Gần đây', { exact: true })).toBeVisible();

  // Emoji: chèn vào chỗ con trỏ, bảng vẫn mở để chèn tiếp; gửi như chữ thường.
  await picker(page).getByRole('tab', { name: 'Emoji' }).click();
  await picker(page).getByRole('button', { name: 'Chèn 😂', exact: true }).first().click();
  await picker(page).getByRole('button', { name: 'Chèn ❤️', exact: true }).first().click();
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
  await expect(box).toHaveValue('😂❤️');
  await box.press('Enter');
  await expect(commentWith(page, '😂❤️')).toHaveCount(1);

  // Gợi ý nhãn: gõ "cam on" (không dấu) là hiện nhãn cảm ơn; chạm là gửi nhãn thay cho chữ.
  await box.fill('cam on');
  const suggest = page.getByRole('group', { name: 'Nhãn dán gợi ý' });
  await expect(suggest).toBeVisible();
  await suggest.getByRole('button', { name: 'Gửi nhãn cảm ơn' }).click();
  await expect(box).toHaveValue('');
  await expect(stickerIn(page, 'cam-on.svg')).toBeVisible();
  // Gõ câu bình thường thì không hiện gợi ý.
  await box.fill('ok để mình xem lại nhé');
  await expect(suggest).toHaveCount(0);
  await box.fill('');

  // Ảnh đính kèm: có xem trước, gửi kèm chữ.
  await page.locator('.comment-tools input[type="file"]').first().setInputFiles({ name: 'anh.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.getByAltText('Ảnh sẽ gửi kèm')).toBeVisible();
  await box.fill('Ảnh minh họa');
  await box.press('Enter');
  await expect(commentWith(page, 'Ảnh minh họa').locator('img.media-photo')).toBeVisible();
});

test('chat: gửi nhãn dán từ bảng chọn và từ gợi ý; danh sách hội thoại ghi [Nhãn dán]', async ({ page, request }) => {
  const me = await apiJson<{ userId: string }>(request, await apiToken(request, USERS.member2), 'GET', '/v1/me/id');
  await apiJson(request, await apiToken(request, USERS.affiliate), 'POST', '/v1/me/messages', { recipientUserId: me.userId, body: 'Chào bạn, thử nhãn dán nhé' });
  await login(page, USERS.member2);
  await page.goto('/tin-nhan');
  await page.getByRole('region', { name: 'Danh sách hội thoại' }).getByRole('button', { name: /Hoàng Vũ/ }).first().click();
  const thread = page.getByRole('region', { name: /^Hội thoại với / });
  await thread.getByRole('button', { name: 'Gửi nhãn dán' }).click();
  await picker(page).getByRole('button', { name: 'Gửi nhãn haha' }).click();
  const last = thread.locator('.chat-row').last();
  await expect(last.locator('img.media-sticker')).toHaveAttribute('src', '/stickers/meo-minh/haha.svg');
  await expect(last.locator('.chat-bubble')).toHaveClass(/big/);

  const input = thread.getByRole('textbox', { name: /^Nhập tin nhắn tới / });
  await input.fill('Yêu quá');
  await page.getByRole('group', { name: 'Nhãn dán gợi ý' }).getByRole('button', { name: 'Gửi nhãn yêu' }).click();
  await expect(input).toHaveValue('');
  await expect(thread.locator('.chat-row').last().locator('img.media-sticker')).toHaveAttribute('src', '/stickers/meo-minh/yeu.svg');
  await expect(page.getByRole('region', { name: 'Danh sách hội thoại' }).getByText('[Nhãn dán]').first()).toBeVisible();
});

test('quản trị: tạo bộ nhãn, tải GIF lên, đặt từ khóa; thành viên gõ từ khóa là thấy nhãn; tắt bộ thì ẩn', async ({ page, request, browser }) => {
  await login(page, USERS.admin);
  await page.goto('/he-thong/nhan-dan');
  await expect(page.getByRole('heading', { name: 'Nhãn dán' })).toBeVisible();
  // Bộ Mèo Mình có sẵn.
  await expect(page.getByRole('textbox', { name: 'Tên bộ nhãn', exact: true }).first()).toHaveValue('Mèo Mình');
  const name = `Bộ thử ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Tên bộ nhãn mới' }).fill(name);
  await page.getByRole('button', { name: 'Tạo bộ nhãn' }).click();
  const card = page.locator('section.card').filter({ has: page.locator(`input[value="${name}"]`) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: `Mở bộ ${name}` }).click();
  await card.locator('input[type="file"]').setInputFiles({ name: 'vay-tay.gif', mimeType: 'image/gif', buffer: GIF_1PX });
  await expect(card.getByText('1 nhãn')).toBeVisible();
  const kw = card.getByRole('textbox', { name: 'Từ khóa gợi ý của nhãn thứ 1' });
  const word = `thunghiem${Date.now() % 100000}`;
  await kw.fill(word);
  await kw.press('Enter');
  await expect(card.getByText('Đã lưu')).toBeVisible();

  // Thành viên gõ đúng từ khóa thì thấy nhãn mới trong dải gợi ý.
  const postId = await newPost(request);
  const ctx = await browser.newContext();
  const member = await ctx.newPage();
  await login(member, USERS.member2);
  await member.goto(`/minhquy/bai-viet/${postId}`);
  await member.getByPlaceholder('Viết bình luận…').fill(word);
  await expect(member.getByRole('group', { name: 'Nhãn dán gợi ý' }).getByRole('button', { name: `Gửi nhãn ${word}` })).toBeVisible();

  // Tắt bộ: thành viên không còn thấy (tải lại để lấy danh sách mới).
  await card.getByRole('button', { name: 'Tắt bộ' }).click();
  await expect(card.getByText('Đang tắt')).toBeVisible();
  await member.reload();
  await member.getByPlaceholder('Viết bình luận…').fill(word);
  await expect(member.getByRole('group', { name: 'Nhãn dán gợi ý' })).toHaveCount(0);
  await ctx.close();

  // Dọn: xóa bộ thử.
  page.once('dialog', (d) => void d.accept());
  await card.getByRole('button', { name: 'Xóa bộ' }).click();
  await expect(page.locator(`input[value="${name}"]`)).toHaveCount(0);
});

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });

  test('khung chọn trượt từ đáy màn hình, không tràn ngang', async ({ page, request }) => {
    const postId = await newPost(request);
    await login(page, USERS.member2);
    await page.goto(`/minhquy/bai-viet/${postId}`);
    await page.getByRole('button', { name: 'Gửi nhãn dán' }).first().tap();
    const b = (await picker(page).boundingBox())!;
    expect(Math.round(b.y + b.height)).toBe(800);
    expect(Math.round(b.width)).toBe(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await picker(page).getByRole('tab', { name: 'Emoji' }).tap();
    await expect(picker(page).getByRole('button', { name: 'Chèn 😀', exact: true }).first()).toBeVisible();
  });
});
