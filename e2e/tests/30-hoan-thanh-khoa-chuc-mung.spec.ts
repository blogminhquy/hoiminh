// Luồng 30: học viên bấm hoàn thành bài cuối cùng của khóa thì ứng dụng tự chuyển sang màn chúc mừng.
// Khóa có cấp chứng nhận: tới trang chứng nhận ở chế độ chúc mừng, tải được tấm chứng chỉ thành ảnh PNG,
// tải lại trang thì không chúc mừng lại. Khóa tắt chứng nhận: bảng chúc mừng mở tại chỗ, không dẫn tới chứng nhận.
import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiJson, apiToken, login, USERS } from '../helpers';

interface Seeded { courseId: string; title: string; lessons: string[] }

/** Chủ hội tạo một khóa đã đăng, mở cho mọi thành viên, có hai bài trong cùng một chương. */
async function seedCourse(request: APIRequestContext, certificateEnabled: boolean): Promise<Seeded> {
  const token = await apiToken(request, USERS.owner);
  const shell = await apiJson<{ community: { id: string } }>(request, token, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const title = `Khóa thử chúc mừng ${Date.now().toString(36)}`;
  const course = await apiJson<{ id: string }>(request, token, 'POST', `/v1/communities/${shell.community.id}/courses`, { title, certificateEnabled, accessMode: 'all_members' });
  const mod = await apiJson<{ id: string }>(request, token, 'POST', `/v1/courses/${course.id}/modules`, { title: 'Chương 1' });
  const lessons: string[] = [];
  for (const name of ['Bài mở đầu', 'Bài kết thúc']) {
    const l = await apiJson<{ id: string }>(request, token, 'POST', `/v1/courses/${course.id}/lessons`, { moduleId: mod.id, title: name, kind: 'text', contentMd: `Nội dung ${name}`, durationSeconds: 600 });
    lessons.push(l.id);
  }
  await apiJson(request, token, 'PATCH', `/v1/courses/${course.id}`, { status: 'published' });
  return { courseId: course.id, title, lessons };
}

/** Học bài đầu (ứng dụng tự sang bài kế), rồi bấm hoàn thành bài cuối. */
async function finishCourse(page: Page, seeded: Seeded): Promise<void> {
  await page.goto(`/minhquy/bai/${seeded.lessons[0]}`);
  await page.getByRole('button', { name: /Đánh dấu hoàn thành/ }).click();
  await expect(page).toHaveURL(new RegExp(`/minhquy/bai/${seeded.lessons[1]}`));
  await expect(page.getByRole('heading', { name: 'Bài kết thúc' })).toBeVisible();
  await page.getByRole('button', { name: /Đánh dấu hoàn thành/ }).click();
}

test('hoàn thành bài cuối của khóa có chứng nhận: tới màn chúc mừng, tải được ảnh chứng chỉ', async ({ page, request, browser }) => {
  const seeded = await seedCourse(request, true);
  await login(page, USERS.member);
  await finishCourse(page, seeded);

  // Tự chuyển sang trang chứng nhận; tham số chúc mừng được gỡ khỏi địa chỉ ngay sau khi đọc.
  await expect(page).toHaveURL(new RegExp(`/chung-nhan/${seeded.courseId}/[0-9a-f-]{36}$`));
  const celebration = page.getByTestId('celebration');
  await expect(celebration.getByRole('heading', { name: /Chúc mừng .+, bạn đã hoàn thành khóa học!/ })).toBeVisible();
  await expect(celebration).toContainText(seeded.title);
  await expect(celebration).toContainText('2 bài đã học xong');
  await expect(page.getByTestId('confetti')).toHaveCount(1);

  // Tấm chứng chỉ vẽ xong, mang tên khóa và dòng chứng nhận.
  const sheet = page.locator('[data-testid="certificate"][data-ready="true"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('svg')).toHaveAttribute('aria-label', new RegExp(seeded.title));
  await expect(sheet.locator('svg text', { hasText: 'CHỨNG NHẬN HOÀN THÀNH' })).toHaveCount(1);
  const box = await sheet.boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(2000 / 1414, 1);

  // Tải ảnh: tệp PNG thật, đúng kích thước 2000 x 1414.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('cert-download').click()]);
  expect(download.suggestedFilename()).toMatch(/^chung-chi-[a-z0-9-]+\.png$/);
  const png = readFileSync((await download.path())!);
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2000, 1414]);
  expect(png.byteLength).toBeGreaterThan(50_000);
  await expect(page.getByRole('status')).toHaveText('Đã tải ảnh chứng chỉ về máy.');
  await expect(page.getByTestId('cert-print')).toBeVisible();
  await expect(page.getByTestId('cert-share')).toBeVisible();

  // Tải lại trang: không chúc mừng lại, còn lại là trang kiểm tra bình thường.
  const certificateUrl = page.url();
  await page.reload();
  await expect(page.locator('[data-testid="certificate"][data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chứng nhận hợp lệ' })).toBeVisible();
  await expect(page.getByTestId('celebration')).toHaveCount(0);
  await expect(page.getByTestId('confetti')).toHaveCount(0);

  // Người khác mở link, kể cả link có tham số chúc mừng: thấy tấm chứng chỉ để kiểm tra, không thấy lời chúc.
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(`${certificateUrl}?chuc-mung=1`);
  await expect(guestPage.getByRole('heading', { name: 'Chứng nhận hợp lệ' })).toBeVisible();
  await expect(guestPage.locator('[data-testid="certificate"][data-ready="true"]')).toBeVisible();
  await expect(guestPage.getByTestId('celebration')).toHaveCount(0);
  await expect(guestPage).toHaveURL(certificateUrl);
  await guest.close();

  // Trang tổng quan và trang học của khóa đã xong đều có lối vào "Xem chứng chỉ".
  await page.goto(`/minhquy/bai/${seeded.lessons[1]}`);
  await expect(page.getByRole('link', { name: /Xem chứng chỉ/ }).first()).toBeVisible();
  // Mở lại một bài của khóa đã xong thì không bị đẩy sang màn chúc mừng lần nữa.
  await expect(page.getByRole('button', { name: /Đã hoàn thành/ })).toBeDisabled();
  await expect(page).toHaveURL(new RegExp(`/minhquy/bai/${seeded.lessons[1]}`));
  await page.goto(`/minhquy/khoa-hoc/${seeded.courseId}`);
  await page.getByRole('link', { name: 'Xem chứng chỉ', exact: true }).click();
  await expect(page).toHaveURL(certificateUrl);
  await expect(page.getByTestId('celebration')).toHaveCount(0);
});

test('hoàn thành bài cuối của khóa tắt chứng nhận: bảng chúc mừng tại chỗ, không dẫn tới chứng nhận', async ({ page, request }) => {
  const seeded = await seedCourse(request, false);
  await login(page, USERS.member);
  await finishCourse(page, seeded);

  const done = page.getByTestId('course-done');
  await expect(done.getByRole('heading', { name: 'Chúc mừng, bạn đã học xong!' })).toBeVisible();
  await expect(done).toContainText(seeded.title);
  await expect(done).toContainText('2 bài đã học xong');
  await expect(done.getByRole('link', { name: /chứng chỉ|chứng nhận/i })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/minhquy/bai/${seeded.lessons[1]}`));
  await expect(page.getByRole('link', { name: /Xem chứng chỉ/ })).toHaveCount(0);

  // Về trang khóa học từ bảng chúc mừng; khóa này không có lối vào chứng chỉ.
  await done.getByRole('link', { name: 'Về trang khóa học' }).click();
  await expect(page).toHaveURL(new RegExp(`/minhquy/khoa-hoc/${seeded.courseId}`));
  await expect(page.getByText('Đã hoàn thành').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Xem chứng chỉ/ })).toHaveCount(0);
});
