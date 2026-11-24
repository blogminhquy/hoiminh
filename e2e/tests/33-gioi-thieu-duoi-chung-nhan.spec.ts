// Luồng 33: dưới tấm chứng nhận. Chính người học thấy khối "Khóa học giúp ích cho bạn? Giới thiệu cho bạn bè" với link
// kèm mã của họ, và link chứng nhận họ chép đi cũng kèm mã (cùng tên hội, để mã tính cho hội). Người khác mở cùng trang
// thì không thấy gì về hoa hồng, chỉ thấy lời mời học khóa.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiJson, apiToken, login, USERS } from '../helpers';

/** Chủ hội tạo một khóa có cấp chứng nhận, một bài; thành viên học xong qua API. Trả về đường dẫn trang chứng nhận. */
async function finishedCourse(request: APIRequestContext): Promise<string> {
  const owner = await apiToken(request, USERS.owner);
  const shell = await apiJson<{ community: { id: string } }>(request, owner, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const course = await apiJson<{ id: string }>(request, owner, 'POST', `/v1/communities/${shell.community.id}/courses`, { title: `Khóa thử giới thiệu ${Date.now().toString(36)}`, certificateEnabled: true, accessMode: 'all_members' });
  const mod = await apiJson<{ id: string }>(request, owner, 'POST', `/v1/courses/${course.id}/modules`, { title: 'Chương 1' });
  const lesson = await apiJson<{ id: string }>(request, owner, 'POST', `/v1/courses/${course.id}/lessons`, { moduleId: mod.id, title: 'Bài duy nhất', kind: 'text', contentMd: 'Nội dung', durationSeconds: 300 });
  await apiJson(request, owner, 'PATCH', `/v1/courses/${course.id}`, { status: 'published' });
  const member = await apiToken(request, USERS.member);
  const me = (await apiJson<{ user: { id: string } }>(request, member, 'GET', '/v1/me')).user;
  await apiJson(request, member, 'GET', `/v1/lessons/${lesson.id}`);
  await apiJson(request, member, 'POST', `/v1/lessons/${lesson.id}/complete`, {});
  return `/chung-nhan/${course.id}/${me.id}`;
}

test('người học thấy khối giới thiệu và link chứng nhận kèm mã; người khác chỉ thấy lời mời học khóa', async ({ page, request, browser }) => {
  const path = await finishedCourse(request);
  await login(page, USERS.member);
  await page.goto(path);

  const block = page.getByTestId('cert-referral');
  await expect(block.getByRole('heading', { name: 'Khóa học giúp ích cho bạn? Giới thiệu cho bạn bè' })).toBeVisible();
  await expect(block.getByRole('heading', { name: 'Giới thiệu vào hội' })).toBeVisible();
  const communityUrl = (await block.getByTestId('share-url-community').textContent()) ?? '';
  expect(communityUrl).toMatch(/\/minhquy\?ref=[a-z0-9]+$/);
  const code = communityUrl.split('?ref=')[1]!;
  // Link chứng nhận ở ô kiểm tra kèm mã và tên hội.
  await expect(page.getByTestId('cert-link')).toHaveAttribute('title', new RegExp(`${path}\\?ref=${code}&hoi=minhquy$`));
  await expect(page.getByTestId('cert-invite')).toHaveCount(0);

  // Người khác (chưa đăng nhập) mở cùng trang.
  const guest = await browser.newPage();
  await guest.goto(path);
  await expect(guest.getByTestId('cert-invite').getByRole('heading', { name: 'Bạn cũng muốn học khóa này?' })).toBeVisible();
  await expect(guest.getByTestId('cert-referral')).toHaveCount(0);
  await expect(guest.getByText('khi chia sẻ')).toHaveCount(0);
  await guest.close();
});
