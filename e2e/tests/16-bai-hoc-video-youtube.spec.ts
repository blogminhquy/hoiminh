// Luồng 16: video YouTube trong bài học chạy bằng trình phát riêng. Người học không bấm sang YouTube được và không thấy
// video gợi ý, kể cả lúc tạm dừng và lúc hết video. YouTube được thay bằng bản giả (helpers/youtube.ts): trang nhúng giả
// có sẵn link "Xem trên YouTube" ở mép trên và dải "Video khác" ở mép dưới, đúng chỗ YouTube thật đặt chúng.
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { apiJson, apiToken, login, USERS } from '../helpers';
import { mockYouTube, youtubeLog } from '../helpers/youtube';

interface Box { x: number; y: number; width: number; height: number }
const VIDEO_ID = 'dQw4w9WgXcQ';
let lessonId = '';
let shortsLessonId = '';

/** Chủ hội tạo một khóa nháp có hai bài video YouTube: một video ngang, một video dọc (/shorts/). */
async function seedLessons(request: APIRequestContext): Promise<void> {
  if (lessonId) return;
  const token = await apiToken(request, USERS.owner);
  const shell = await apiJson<{ community: { id: string } }>(request, token, 'GET', '/v1/communities/by-slug/minhquy/shell');
  const course = await apiJson<{ id: string }>(request, token, 'POST', `/v1/communities/${shell.community.id}/courses`, { title: `Khóa thử trình phát ${Date.now().toString(36)}` });
  const mod = await apiJson<{ id: string }>(request, token, 'POST', `/v1/courses/${course.id}/modules`, { title: 'Chương 1' });
  const lesson = await apiJson<{ id: string }>(request, token, 'POST', `/v1/courses/${course.id}/lessons`, { moduleId: mod.id, title: 'Bài video ngang', videoUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}` });
  const shorts = await apiJson<{ id: string }>(request, token, 'POST', `/v1/courses/${course.id}/lessons`, { moduleId: mod.id, title: 'Bài video dọc', videoUrl: `https://www.youtube.com/shorts/${VIDEO_ID}` });
  lessonId = lesson.id;
  shortsLessonId = shorts.id;
}

async function openLesson(page: Page, request: APIRequestContext, opts: { duration?: number; blockSound?: boolean; id?: 'ngang' | 'doc' } = {}): Promise<Locator> {
  await seedLessons(request);
  await mockYouTube(page, opts);
  await login(page, USERS.owner);
  await page.goto(`/minhquy/bai/${opts.id === 'doc' ? shortsLessonId : lessonId}`);
  const player = page.locator('.ytl');
  await expect(player).toHaveAttribute('data-phase', 'ready');
  return player;
}

const box = async (l: Locator): Promise<Box> => {
  const b = await l.boundingBox();
  expect(b, 'phần tử phải có trên trang').not.toBeNull();
  return b as Box;
};
/** Hai khung có đè lên nhau không (tính theo tọa độ trang). */
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('bài học YouTube: không bấm sang YouTube được, tên video và dải "Video khác" nằm ngoài vùng nhìn', async ({ page, request, context }) => {
  const player = await openLesson(page, request);

  // Nhúng qua tên miền không cookie, tắt hết điều khiển của YouTube và không gợi ý video kênh khác.
  const log = await youtubeLog(page);
  expect(log.options?.host).toBe('https://www.youtube-nocookie.com');
  expect(log.options?.videoId).toBe(VIDEO_ID);
  expect(log.options?.playerVars).toMatchObject({ controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1 });

  // Trang bài học chỉ có đúng một khung YouTube, và nó nằm trong trình phát riêng.
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('.ytl-frame iframe')).toHaveCount(1);

  // Link sang YouTube và dải "Video khác" có trong khung nhúng, nhưng không phần nào lọt vào vùng nhìn thấy của trình phát.
  const frame = page.frameLocator('.ytl-frame iframe');
  const visible = await box(player);
  for (const id of ['#title', '#more', '#logo']) expect(overlaps(await box(frame.locator(id)), visible), `${id} phải nằm ngoài vùng nhìn`).toBe(false);
  // Còn khung hình video thì nằm trọn trong vùng nhìn.
  const video = await box(frame.locator('#video'));
  expect(Math.abs(video.y - visible.y)).toBeLessThan(2);
  expect(Math.abs(video.height - visible.height)).toBeLessThan(2);

  // Bấm khắp mặt trình phát (bốn góc và giữa): không lượt nào lọt vào khung YouTube, không tab mới nào mở ra.
  const pages = context.pages().length;
  for (const [fx, fy] of [[0.5, 0.5], [0.04, 0.06], [0.96, 0.06], [0.04, 0.8], [0.96, 0.8], [0.5, 0.5]] as const) {
    await page.mouse.click(visible.x + visible.width * fx, visible.y + visible.height * fy);
    await page.waitForTimeout(120);
  }
  const after = await youtubeLog(page);
  expect(after.iframeClicks).toBe(0);
  expect(context.pages().length).toBe(pages);
  expect(page.url()).toContain(`/minhquy/bai/${lessonId}`);
  // Các lượt bấm đó được trang nhận và đổi thành lệnh phát, tạm dừng.
  expect(after.calls.filter((c) => c === 'playVideo').length).toBeGreaterThanOrEqual(1);
  expect(after.calls).toContain('pauseVideo');

  // Bàn phím cũng không vào được khung YouTube: Tab đi hết các nút mà tiêu điểm không lần nào rơi vào iframe.
  await player.locator('.ytl-surface').focus();
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('IFRAME');
  }

  // Đối chứng: gửi thẳng một lượt bấm vào trong khung (bỏ qua lớp chắn) thì bộ đếm phải tăng, tức phép đo ở trên có nghĩa.
  await frame.locator('#title').dispatchEvent('click');
  await expect.poll(async () => (await youtubeLog(page)).iframeClicks).toBe(1);
});

test('bài học YouTube: phát, tạm dừng, tua, chọn chất lượng và tốc độ bằng nút của trang; hết video hiện "Xem lại" thay cho gợi ý', async ({ page, request }) => {
  const player = await openLesson(page, request, { duration: 6 });
  const surface = player.locator('.ytl-surface');

  // Chưa phát: chỉ có ảnh bìa và nút phát, chưa có thanh điều khiển.
  await expect(player.locator('.ytl-bar')).toHaveCount(0);
  await surface.click();
  await expect(player).toHaveAttribute('data-phase', 'playing');
  await expect(player.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible();
  await expect(player.locator('.ytl-time')).toContainText('/ 0:06');

  // Tạm dừng: khung hình giữ nguyên, không có gì đè lên giữa, dải "Video khác" vẫn nằm ngoài vùng nhìn.
  await player.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(player).toHaveAttribute('data-phase', 'paused');
  await expect(player.locator('.ytl-center > *')).toHaveCount(0);
  expect(overlaps(await box(page.frameLocator('.ytl-frame iframe').locator('#more')), await box(player))).toBe(false);

  // Nút Cài đặt mở bảng hai mục. Chất lượng đang để Tự động và hiện kèm mức YouTube đang phát.
  const settings = player.getByRole('button', { name: 'Cài đặt video' });
  const menu = player.getByRole('menu');
  await settings.click();
  await expect(menu.getByRole('menuitem', { name: /Chất lượng/ })).toContainText('Tự động (720p)');
  await expect(menu.getByRole('menuitem', { name: /Tốc độ/ })).toContainText('1x');

  // Chọn 360p: trang xin YouTube đúng mức đó, bảng đóng lại, mở lại thấy 360p đã được chọn.
  await menu.getByRole('menuitem', { name: /Chất lượng/ }).click();
  await expect(menu.getByRole('menuitemradio')).toHaveText(['Tự động', '1080p', '720p', '480p', '360p', '240p', '144p'], { useInnerText: true });
  await expect(menu.getByRole('menuitemradio', { name: 'Tự động' })).toHaveAttribute('aria-checked', 'true');
  await menu.getByRole('menuitemradio', { name: '360p' }).click();
  await expect(menu).toHaveCount(0);
  await settings.click();
  await expect(menu.getByRole('menuitem', { name: /Chất lượng/ })).toContainText('360p');
  await expect(menu.getByRole('menuitem', { name: /Chất lượng/ })).not.toContainText('Tự động');
  expect(await page.evaluate(() => localStorage.getItem('hm_video_quality'))).toBe('medium');

  // Tốc độ 1,25x. Bấm ra ngoài bảng chỉ đóng bảng, video vẫn đang tạm dừng như trước.
  await menu.getByRole('menuitem', { name: /Tốc độ/ }).click();
  await menu.getByRole('menuitemradio', { name: '1,25x' }).click();
  await settings.click();
  await expect(menu.getByRole('menuitem', { name: /Tốc độ/ })).toContainText('1,25x');
  await surface.click({ position: { x: 20, y: 20 } });
  await expect(menu).toHaveCount(0);
  await expect(player).toHaveAttribute('data-phase', 'paused');

  // Phím M tắt tiếng; kéo thanh tua về đầu.
  await surface.focus();
  await page.keyboard.press('m');
  await expect(player.getByRole('button', { name: 'Bật tiếng' })).toBeVisible();
  await player.getByLabel('Vị trí phát').focus();
  await page.keyboard.press('Home');
  const mid = await youtubeLog(page);
  expect(mid.calls).toContain('quality:medium:medium');
  expect(mid.calls).toContain('rate:1.25');
  expect(mid.calls).toContain('mute');
  expect(mid.calls).toContain('seekTo:0:true');

  // Phát tới hết: trang tự dừng ngay trước giây cuối (YouTube không kịp bật màn hình gợi ý) và hiện "Xem lại".
  await surface.click();
  await expect(player).toHaveAttribute('data-phase', 'ended', { timeout: 12_000 });
  await expect(player.getByText('Xem lại')).toBeVisible();
  await expect(player.locator('.ytl-bar')).toHaveCount(0);
  await expect(player.locator('.ytl-cover')).toBeVisible();
  expect((await youtubeLog(page)).calls.at(-1)).toBe('pauseVideo');

  // Bấm "Xem lại": tua về đầu rồi phát tiếp, vẫn trong trang.
  await surface.click();
  await expect(player).toHaveAttribute('data-phase', 'playing');
  const end = await youtubeLog(page);
  expect(end.calls.slice(-2)).toEqual(['seekTo:0:true', 'playVideo']);
  expect(end.iframeClicks).toBe(0);
  expect(end.created).toBe(1);
});

test('bài học YouTube trên điện thoại: nút đủ to, không tràn ngang; trình duyệt chặn tiếng thì phát tắt tiếng và mời bật', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  const player = await openLesson(page, request, { blockSound: true });

  await player.locator('.ytl-surface').click();
  // Lượt phát có tiếng bị chặn: sau 4 giây trang phát tắt tiếng và hiện nút bật tiếng.
  const unmute = player.getByRole('button', { name: 'Chạm để bật tiếng' });
  await expect(unmute).toBeVisible({ timeout: 10_000 });
  await expect(player).toHaveAttribute('data-phase', 'playing');
  await unmute.click();
  await expect(unmute).toHaveCount(0);
  expect((await youtubeLog(page)).calls).toContain('unMute');

  // Thanh điều khiển nằm gọn trong trình phát, mỗi nút cao và rộng từ 44px.
  const row = player.locator('.ytl-row');
  expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  for (const name of ['Tạm dừng', 'Tắt tiếng', 'Cài đặt video', 'Toàn màn hình']) {
    const b = await box(player.getByRole('button', { name, exact: true }));
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  await expect(player.getByRole('button', { name: 'Lùi 10 giây' })).toBeHidden();

  // Bảng Cài đặt nằm gọn trong trình phát thấp của điện thoại; 7 mức chất lượng xếp đúng một hàng ngang, thấy hết không phải vuốt.
  await player.getByRole('button', { name: 'Cài đặt video' }).click();
  await player.getByRole('menuitem', { name: /Chất lượng/ }).click();
  const menu = player.getByRole('menu');
  const [m, p] = [await box(menu), await box(player)];
  expect(m.x).toBeGreaterThanOrEqual(p.x);
  expect(m.y).toBeGreaterThanOrEqual(p.y);
  expect(m.x + m.width).toBeLessThanOrEqual(p.x + p.width);
  expect(m.y + m.height).toBeLessThanOrEqual(p.y + p.height);
  expect(await menu.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  const options = await Promise.all((await menu.getByRole('menuitemradio').all()).map(box));
  expect(options).toHaveLength(7);
  expect(new Set(options.map((o) => Math.round(o.y))).size, 'mọi mức nằm trên cùng một hàng').toBe(1);
  expect(await menu.locator('.ytl-menu-grid').evaluate((el) => el.scrollWidth <= el.clientWidth), 'hàng không phải vuốt ngang ở 390px').toBe(true);
  expect(m.height).toBeLessThan(110);
  // Trong hàng ngang, ô "Tự động" ghi gọn là "Auto" để bảy mức vừa cả màn hình 360px.
  await expect(menu.getByRole('menuitemradio').first()).toHaveText('Auto', { useInnerText: true });
  await page.setViewportSize({ width: 360, height: 780 });
  expect(await menu.locator('.ytl-menu-grid').evaluate((el) => el.scrollWidth <= el.clientWidth), 'hàng không phải vuốt ngang ở 360px').toBe(true);
  await page.setViewportSize({ width: 390, height: 780 });
  const last = menu.getByRole('menuitemradio', { name: '144p' });
  expect((await box(last)).height).toBeGreaterThanOrEqual(44);
  await last.click();
  expect((await youtubeLog(page)).calls).toContain('quality:tiny:tiny');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('bài học YouTube: video dọc (/shorts/) dùng khung 9:16 và vẫn che tên video, dải "Video khác"', async ({ page, request }) => {
  const player = await openLesson(page, request, { id: 'doc' });
  const stage = await box(player.locator('.ytl-stage'));
  expect(stage.height / stage.width).toBeCloseTo(16 / 9, 1);
  const frame = page.frameLocator('.ytl-frame iframe');
  for (const id of ['#title', '#more', '#logo']) expect(overlaps(await box(frame.locator(id)), stage), `${id} phải nằm ngoài vùng nhìn`).toBe(false);
});
