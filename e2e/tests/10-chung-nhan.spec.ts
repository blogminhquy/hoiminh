// Luồng 10: học xong khóa → nhận chứng nhận → mở trang tra cứu công khai bằng mã, không cần đăng nhập.
import { expect, test } from '@playwright/test';
import { apiJson, apiToken, USERS, login } from '../helpers';

test('học xong thì có chứng nhận, ai cầm mã cũng tra được', async ({ page, request }) => {
  // Chủ hội dựng một khóa đúng một bài để hoàn thành nhanh.
  const ownerToken = await apiToken(request, USERS.owner);
  const shell = await apiJson<{ community: { id: string; slug: string } }>(request, ownerToken, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const communityId = shell.community.id;
  const course = await apiJson<{ id: string }>(request, ownerToken, 'POST', `/v1/communities/${communityId}/courses`, {
    title: 'Khóa nhận chứng nhận E2E', shortDescription: 'x', descriptionMd: '', accessMode: 'all_members',
    previewFirstModule: false, affiliateEnabled: false, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: true,
  });
  const mod = await apiJson<{ id: string }>(request, ownerToken, 'POST', `/v1/courses/${course.id}/modules`, { title: 'Phần 1' });
  const lesson = await apiJson<{ id: string }>(request, ownerToken, 'POST', `/v1/courses/${course.id}/lessons`, { moduleId: mod.id, title: 'Bài duy nhất', kind: 'text', contentMd: 'Nội dung bài học.' });
  await apiJson(request, ownerToken, 'PATCH', `/v1/courses/${course.id}`, { status: 'published' });

  // Thành viên học xong bài cuối trên giao diện.
  await login(page, USERS.member);
  await page.goto(`/minhquy/bai/${lesson.id}`);
  await page.getByRole('button', { name: /Đánh dấu hoàn thành/ }).click();

  // Trang khóa học thay lời hứa bằng đường dẫn tới tờ chứng nhận thật.
  await page.goto(`/minhquy/khoa-hoc/${course.id}`);
  const link = page.getByRole('link', { name: /Xem chứng nhận/ });
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^\/chung-nhan\/HM-CN-[A-Z0-9]{5}$/);
  const code = href!.split('/').pop()!;

  // Mở tờ chứng nhận: có tên người học, tên khóa và mã tra cứu.
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/chung-nhan/${code}$`));
  await expect(page.getByRole('heading', { name: 'Công Trần' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Khóa nhận chứng nhận E2E' })).toBeVisible();
  await expect(page.getByText(code).first()).toBeVisible();
  await expect(page.getByText('Kinh Doanh Online Cùng AI')).toBeVisible();
  await expect(page.getByRole('button', { name: /In hoặc lưu PDF/ })).toBeVisible();

  // Khách chưa đăng nhập cũng xem được đúng tờ đó.
  const guest = await page.context().browser()!.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(`/chung-nhan/${code}`);
  await expect(guestPage.getByRole('heading', { name: 'Công Trần' })).toBeVisible();
  await expect(guestPage.getByText(code).first()).toBeVisible();

  // Mã sai thì báo rõ, không hiện tờ giả.
  await guestPage.goto('/chung-nhan/HM-CN-SAISO');
  await expect(guestPage.getByText(/Kiểm tra lại mã in trên chứng nhận/)).toBeVisible();
  await guest.close();
});
