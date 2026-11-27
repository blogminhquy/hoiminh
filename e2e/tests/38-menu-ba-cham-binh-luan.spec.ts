// Bình luận: nút ba chấm cạnh mỗi bình luận. Ai cũng thấy: Chép nội dung. Người viết thấy thêm: Sửa, Xóa.
// Quản trị viên thấy thêm: Ghim / Bỏ ghim, Xóa. Dưới bình luận chỉ còn Thích và Trả lời.
// Máy tính: nút chỉ hiện khi rê chuột vào bình luận. Điện thoại: nút luôn hiện, menu trượt từ đáy.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API, USERS, apiJson, apiToken, login } from '../helpers';

async function setup(request: APIRequestContext, text: string): Promise<{ postId: string; commentId: string }> {
  const token = await apiToken(request, USERS.member2);
  const shell = await apiJson<{ community: { id: string } }>(request, token, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const feed = await apiJson<{ spaces: Array<{ id: string }> }>(request, token, 'GET', `/v1/communities/${shell.community.id}/feed`);
  let postId = '';
  // Không phải chuyên mục nào thành viên cũng đăng được (vd Thông báo): thử lần lượt.
  for (const s of feed.spaces) {
    const res = await request.post(`${API}/v1/communities/${shell.community.id}/posts`, { headers: { authorization: `Bearer ${token}` }, data: { spaceId: s.id, contentMd: `Bài để thử bình luận ${Date.now()}` } });
    if (res.ok()) { postId = ((await res.json()) as { id: string }).id; break; }
  }
  expect(postId, 'đăng được bài thử').not.toBe('');
  const c = await apiJson<{ id: string }>(request, token, 'POST', '/v1/comments', { targetType: 'post', targetId: postId, contentMd: text });
  return { postId, commentId: c.id };
}

const row = (page: Page, id: string) => page.locator(`#binh-luan-${id} .comment-row`).first();
const moreBtn = (page: Page, id: string) => row(page, id).locator('.comment-more');
const menu = (page: Page) => page.getByRole('menu', { name: 'Tùy chọn bình luận' });

test('người viết: nút hiện khi rê chuột, chép, sửa (Esc để hủy), xóa bình luận', async ({ page, request, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' });
  const text = `Bình luận thử menu ${Date.now()}`;
  const { postId, commentId } = await setup(request, text);
  await login(page, USERS.member2);
  await page.goto(`/minhquy/bai-viet/${postId}`);
  await expect(row(page, commentId)).toContainText(text);

  // Dưới bình luận không còn nút Ghim / Xóa rời.
  const box = page.locator(`#binh-luan-${commentId}`);
  await expect(box.getByRole('button', { name: 'Xóa', exact: true })).toHaveCount(0);
  await expect(box.getByRole('button', { name: 'Trả lời', exact: true })).toBeVisible();

  // Máy tính: nút ẩn, rê chuột vào bình luận thì hiện.
  await expect(moreBtn(page, commentId)).toHaveCSS('opacity', '0');
  await row(page, commentId).hover();
  await expect(moreBtn(page, commentId)).toHaveCSS('opacity', '1');

  await moreBtn(page, commentId).click();
  await expect(menu(page).getByRole('menuitem', { name: 'Sửa bình luận' })).toBeVisible();
  await expect(menu(page).getByRole('menuitem', { name: 'Xóa bình luận' })).toBeVisible();
  await expect(menu(page).getByRole('menuitem', { name: /Ghim/ })).toHaveCount(0);
  await menu(page).getByRole('menuitem', { name: 'Chép nội dung' }).click();
  await expect(menu(page)).toHaveCount(0);
  await expect(box.getByRole('status')).toHaveText('Đã chép nội dung');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);

  // Sửa rồi Esc: không đổi gì.
  await row(page, commentId).hover();
  await moreBtn(page, commentId).click();
  await menu(page).getByRole('menuitem', { name: 'Sửa bình luận' }).click();
  const editor = box.getByRole('textbox', { name: 'Sửa bình luận' });
  await expect(editor).toBeFocused();
  await editor.fill('không lưu cái này');
  await editor.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(row(page, commentId)).toContainText(text);

  // Sửa và lưu.
  const edited = `${text} (đã sửa)`;
  await row(page, commentId).hover();
  await moreBtn(page, commentId).click();
  await menu(page).getByRole('menuitem', { name: 'Sửa bình luận' }).click();
  await editor.fill(edited);
  await box.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(row(page, commentId)).toContainText(edited);
  await page.reload();
  await expect(row(page, commentId)).toContainText(edited);

  // Xóa: hỏi lại, đồng ý thì bình luận biến mất.
  page.once('dialog', (d) => void d.accept());
  await row(page, commentId).hover();
  await moreBtn(page, commentId).click();
  await menu(page).getByRole('menuitem', { name: 'Xóa bình luận' }).click();
  await expect(page.locator(`#binh-luan-${commentId}`)).toHaveCount(0);
});

test('người khác chỉ chép được; chủ hội ghim, bỏ ghim, xóa nhưng không sửa', async ({ page, request }) => {
  const text = `Bình luận của người khác ${Date.now()}`;
  const { postId, commentId } = await setup(request, text);

  await login(page, USERS.member);
  await page.goto(`/minhquy/bai-viet/${postId}`);
  await row(page, commentId).hover();
  await moreBtn(page, commentId).click();
  await expect(menu(page).getByRole('menuitem', { name: 'Chép nội dung' })).toBeVisible();
  await expect(menu(page).getByRole('menuitem')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, USERS.owner);
  await page.goto(`/minhquy/bai-viet/${postId}`);
  await row(page, commentId).hover();
  await moreBtn(page, commentId).click();
  await expect(menu(page).getByRole('menuitem', { name: 'Sửa bình luận' })).toHaveCount(0);
  await expect(menu(page).getByRole('menuitem', { name: 'Xóa bình luận' })).toBeVisible();
  await menu(page).getByRole('menuitem', { name: 'Ghim bình luận' }).click();
  const box = page.locator(`#binh-luan-${commentId}`);
  await expect(box.getByText('Tác giả ghim bình luận này')).toBeVisible();
  await row(page, commentId).hover();
  await moreBtn(page, commentId).click();
  await menu(page).getByRole('menuitem', { name: 'Bỏ ghim' }).click();
  await expect(box.getByText('Tác giả ghim bình luận này')).toHaveCount(0);
});

test('trong khung bật lên ở Bảng tin: Esc chỉ đóng menu bình luận, không đóng khung bài', async ({ page, request }) => {
  const text = `Bình luận trong khung ${Date.now()}`;
  const { postId, commentId } = await setup(request, text);
  await login(page, USERS.member2);
  await page.goto(`/minhquy/bang-tin?bai=${postId}`);
  const dialog = page.getByRole('dialog', { name: /^Bài viết của / });
  await expect(row(page, commentId)).toContainText(text);
  await row(page, commentId).hover();
  await moreBtn(page, commentId).click();
  await expect(menu(page).getByRole('menuitem', { name: 'Sửa bình luận' })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  // Esc lần nữa (không còn menu) thì đóng khung như trước.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('bài học và sự kiện dùng chung khung bình luận: menu ba chấm sửa được ở cả hai', async ({ page, request }) => {
  // Chủ hội dựng một khóa có một bài; lấy một sự kiện sắp tới của hội.
  const owner = await apiToken(request, USERS.owner);
  const shell = await apiJson<{ community: { id: string }; upcomingEvents: Array<{ id: string }> }>(request, owner, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const course = await apiJson<{ id: string }>(request, owner, 'POST', `/v1/communities/${shell.community.id}/courses`, { title: `Khóa thử bình luận ${Date.now().toString(36)}`, accessMode: 'all_members' });
  const mod = await apiJson<{ id: string }>(request, owner, 'POST', `/v1/courses/${course.id}/modules`, { title: 'Chương 1' });
  const lesson = await apiJson<{ id: string }>(request, owner, 'POST', `/v1/courses/${course.id}/lessons`, { moduleId: mod.id, title: 'Bài thử', kind: 'text', contentMd: 'Nội dung', durationSeconds: 60 });
  await apiJson(request, owner, 'PATCH', `/v1/courses/${course.id}`, { status: 'published' });
  const eventId = shell.upcomingEvents[0]?.id;
  expect(eventId, 'hội mẫu có sự kiện sắp tới').toBeTruthy();

  const member = await apiToken(request, USERS.member2);
  const targets = [
    { url: `/minhquy/bai/${lesson.id}`, type: 'lesson', id: lesson.id },
    { url: `/minhquy/su-kien/${eventId}`, type: 'event', id: eventId! },
  ];
  await login(page, USERS.member2);
  for (const t of targets) {
    const text = `Bình luận ở ${t.type} ${Date.now()}`;
    const c = await apiJson<{ id: string }>(request, member, 'POST', '/v1/comments', { targetType: t.type, targetId: t.id, contentMd: text });
    await page.goto(t.url);
    await expect(row(page, c.id)).toContainText(text);
    await row(page, c.id).hover();
    await moreBtn(page, c.id).click();
    await menu(page).getByRole('menuitem', { name: 'Sửa bình luận' }).click();
    const editor = page.locator(`#binh-luan-${c.id}`).getByRole('textbox', { name: 'Sửa bình luận' });
    await editor.fill(`${text} (đã sửa)`);
    await editor.press('Control+Enter');
    await expect(row(page, c.id)).toContainText(`${text} (đã sửa)`);
  }
});

test.describe('điện thoại', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });

  test('nút ba chấm luôn hiện, menu trượt từ đáy màn hình', async ({ page, request }) => {
    const text = `Bình luận trên điện thoại ${Date.now()}`;
    const { postId, commentId } = await setup(request, text);
    await login(page, USERS.member2);
    await page.goto(`/minhquy/bai-viet/${postId}`);
    await expect(moreBtn(page, commentId)).toHaveCSS('opacity', '1');
    await moreBtn(page, commentId).tap();
    const m = menu(page);
    await expect(m.getByRole('menuitem', { name: 'Sửa bình luận' })).toBeVisible();
    const b = (await m.boundingBox())!;
    expect(Math.round(b.y + b.height)).toBe(800);
    expect(Math.round(b.width)).toBe(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
