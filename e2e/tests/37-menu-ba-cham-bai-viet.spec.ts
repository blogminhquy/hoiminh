// Bảng tin: mỗi thẻ bài có nút ba chấm. Ai cũng thấy: xem bài, mở tab mới, chép link. Tác giả thấy thêm sửa, xóa.
// Người kiểm duyệt thấy thêm ghim. Bấm vào mốc thời gian ("3 ngày trước") thì mở bài, rê chuột thì thấy ngày giờ đầy đủ.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { USERS, apiJson, apiToken, login } from '../helpers';

async function createPost(request: APIRequestContext, email: string, contentMd: string): Promise<string> {
  const token = await apiToken(request, email);
  const shell = await apiJson<{ community: { id: string } }>(request, token, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const feed = await apiJson<{ spaces: Array<{ id: string }> }>(request, token, 'GET', `/v1/communities/${shell.community.id}/feed`);
  // Không phải chuyên mục nào thành viên cũng đăng được (vd Thông báo): thử lần lượt.
  for (const s of feed.spaces) {
    const res = await request.post(`http://localhost:8787/v1/communities/${shell.community.id}/posts`, { headers: { authorization: `Bearer ${token}` }, data: { spaceId: s.id, contentMd } });
    if (res.ok()) return ((await res.json()) as { id: string }).id;
  }
  throw new Error('Không đăng được bài thử');
}

test('tác giả: chép link, bấm mốc thời gian mở bài, sửa và xóa bài từ menu ba chấm', async ({ page, request, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' });
  const text = `Bài thử menu ba chấm ${Date.now()}`;
  const id = await createPost(request, USERS.member2, text);
  await login(page, USERS.member2);
  await page.goto('/minhquy/bang-tin');
  const card = page.locator('article').filter({ hasText: text });
  await expect(card).toBeVisible();

  // Mốc thời gian là link tới bài, có ngày giờ đầy đủ khi rê chuột; bấm vào thì mở khung bài viết.
  const time = card.locator('a.post-time');
  await expect(time).toHaveAttribute('href', `/minhquy/bai-viet/${id}`);
  await expect(time).toHaveAttribute('title', /lúc \d{2}:\d{2}$/);
  await time.click();
  const dialog = page.getByRole('dialog', { name: /^Bài viết của / });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`\\?bai=${id}$`));
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(dialog).toHaveCount(0);

  // Menu: tác giả thấy sửa, xóa; thành viên thường không thấy ghim.
  const more = card.getByRole('button', { name: 'Tùy chọn bài viết' });
  await more.click();
  const menu = page.getByRole('menu', { name: 'Tùy chọn bài viết' });
  await expect(menu.getByRole('menuitem', { name: 'Xem bài viết' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Mở trong tab mới' })).toHaveAttribute('target', '_blank');
  await expect(menu.getByRole('menuitem', { name: 'Sửa bài' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Xóa bài' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Ghim/ })).toHaveCount(0);

  // Chép link: báo đã chép, trong bộ nhớ tạm là địa chỉ trang riêng của bài.
  await menu.getByRole('menuitem', { name: 'Chép link bài viết' }).click();
  await expect(menu).toHaveCount(0);
  await expect(card.getByRole('status')).toHaveText('Đã chép link');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:5173/minhquy/bai-viet/${id}`);

  // Esc đóng menu.
  await more.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  // Xem bài viết: mở khung bài viết như bấm vào bài.
  await more.click();
  await menu.getByRole('menuitem', { name: 'Xem bài viết' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // Sửa bài ngay trên Bảng tin.
  const edited = `${text} (đã sửa)`;
  await more.click();
  await menu.getByRole('menuitem', { name: 'Sửa bài' }).click();
  const editor = page.getByRole('dialog').filter({ hasText: 'Sửa bài viết' });
  await editor.locator('textarea').fill(edited);
  await editor.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(editor).toHaveCount(0);
  const editedCard = page.locator('article').filter({ hasText: edited });
  await expect(editedCard).toBeVisible();

  // Xóa bài: hỏi lại, đồng ý thì thẻ bài biến mất.
  page.once('dialog', (d) => void d.accept());
  await editedCard.getByRole('button', { name: 'Tùy chọn bài viết' }).click();
  await menu.getByRole('menuitem', { name: 'Xóa bài' }).click();
  await expect(page.locator('article').filter({ hasText: text })).toHaveCount(0);
});

test('người khác thấy menu không có sửa, xóa; chủ hội thấy thêm ghim', async ({ page, request }) => {
  const text = `Bài của người khác ${Date.now()}`;
  await createPost(request, USERS.member2, text);

  await login(page, USERS.member);
  await page.goto('/minhquy/bang-tin');
  let card = page.locator('article').filter({ hasText: text });
  await card.getByRole('button', { name: 'Tùy chọn bài viết' }).click();
  const menu = page.getByRole('menu', { name: 'Tùy chọn bài viết' });
  await expect(menu.getByRole('menuitem', { name: 'Chép link bài viết' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Sửa bài' })).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: 'Xóa bài' })).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: /Ghim/ })).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, USERS.owner);
  await page.goto('/minhquy/bang-tin');
  card = page.locator('article').filter({ hasText: text });
  await card.getByRole('button', { name: 'Tùy chọn bài viết' }).click();
  await expect(menu.getByRole('menuitem', { name: 'Sửa bài' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Ghim lên đầu Bảng tin' }).click();
  await expect(card.getByText('Đã ghim', { exact: true })).toBeVisible();
  // Bỏ ghim để không làm lệch các bài kiểm thử khác.
  await card.getByRole('button', { name: 'Tùy chọn bài viết' }).click();
  await menu.getByRole('menuitem', { name: 'Bỏ ghim' }).click();
  await expect(card.getByText('Đã ghim', { exact: true })).toHaveCount(0);
});
