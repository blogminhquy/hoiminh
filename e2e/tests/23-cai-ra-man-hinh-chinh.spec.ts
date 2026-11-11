// Luồng 23: màn "cài ra màn hình chính" (kế hoạch 11/11/2026, mục 7). Quản trị bật công tắc; thành viên đã đăng nhập,
// dùng điện thoại, từ lần vào thứ hai thì bị chặn kèm hướng dẫn theo thiết bị. Trong Zalo thì được đưa link đăng nhập
// một lần để mở bằng Safari hoặc Chrome. Máy tính, trang công khai, quản trị hệ thống và công tắc tắt thì không chặn.
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { API, USERS, apiJson, apiToken, login } from '../helpers';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ZALO = `${IPHONE} Zalo iOS/561`;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true } as const;

async function setGate(request: Parameters<typeof apiToken>[0], enabled: boolean): Promise<void> {
  const token = await apiToken(request, USERS.admin);
  await apiJson(request, token, 'PUT', '/v1/admin/flags/install_gate', { enabled });
}

/** Mở một "điện thoại" mới với user agent cho trước. */
async function phone(browser: Browser, userAgent: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ ...PHONE, userAgent, baseURL: 'http://localhost:5173' });
  return { ctx, page: await ctx.newPage() };
}

/** Giả lập "lần vào thứ hai": phiên trình duyệt mới (sessionStorage trống) nhưng vẫn là máy cũ (localStorage còn). */
async function secondVisit(page: Page, path: string): Promise<void> {
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(path);
}

test.afterAll(async ({ request }) => {
  await setGate(request, false);
});

test('quản trị bật công tắc; iPhone lần đầu vào bình thường, lần hai thấy hướng dẫn 3 bước', async ({ page, browser, request }) => {
  await setGate(request, false);
  await login(page, USERS.admin);
  await page.goto('/he-thong/goi');
  const sw = page.getByRole('switch', { name: 'Bắt cài ra màn hình chính trên điện thoại' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Đang bật', { exact: true })).toBeVisible();
  // Công tắc này không nằm lẫn trong danh sách tính năng của hội.
  await page.goto('/he-thong/tinh-nang');
  await expect(page.getByText('Cửa hàng trong hội')).toBeVisible();
  await expect(page.getByText('install_gate')).toHaveCount(0);

  const { ctx, page: ip } = await phone(browser, IPHONE);
  // Trang công khai không bị chặn, kể cả khi chưa đăng nhập.
  await ip.goto('/');
  await expect(ip.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' })).toHaveCount(0);
  await login(ip, USERS.member);
  // Lần vào đầu tiên: dùng bình thường.
  await ip.goto('/minhquy/bang-tin');
  await expect(ip.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await expect(ip.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' })).toHaveCount(0);
  // Lần vào thứ hai: bị chặn, có hướng dẫn 3 bước của iPhone, không có nút bỏ qua.
  await secondVisit(ip, '/minhquy/bang-tin');
  const gate = ip.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' });
  await expect(gate.getByRole('heading', { name: 'Thêm Hội Mình vào màn hình chính' })).toBeVisible();
  await expect(gate.getByText('Bấm nút Chia sẻ')).toBeVisible();
  await expect(gate.getByText('Kéo xuống, chọn "Thêm vào Màn hình chính"')).toBeVisible();
  await expect(gate.getByText('Mở Hội Mình từ biểu tượng vừa thêm')).toBeVisible();
  await expect(ip.getByRole('navigation', { name: 'Điều hướng chính' })).toHaveCount(0);
  await expect(gate.getByRole('button', { name: /Bỏ qua|Để sau/ })).toHaveCount(0);
  // Màn hướng dẫn vừa khít màn hình điện thoại, không tràn ngang.
  expect(await ip.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Trang công khai và trang thanh toán vẫn mở được dù đang ở lần vào thứ hai.
  await ip.goto('/kham-pha');
  await expect(ip.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' })).toHaveCount(0);
  // Quản trị tắt công tắc: người đang bị chặn tải lại là vào được.
  await setGate(request, false);
  await ip.goto('/minhquy/bang-tin');
  await expect(ip.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await expect(ip.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' })).toHaveCount(0);
  await ctx.close();
});

test('trong Zalo: hướng dẫn mở bằng Safari hoặc Chrome, link đăng nhập dùng đúng một lần', async ({ browser, request }) => {
  await setGate(request, true);
  const { ctx, page: zalo } = await phone(browser, ZALO);
  await login(zalo, USERS.member2);
  await zalo.goto('/minhquy/bang-tin');
  await secondVisit(zalo, '/minhquy/bang-tin');
  const gate = zalo.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' });
  await expect(gate.getByRole('heading', { name: 'Mở bằng Safari hoặc Chrome' })).toBeVisible();
  await expect(gate.getByText('Bạn đang mở Hội Mình trong Zalo.')).toBeVisible();
  await expect(gate.getByRole('button', { name: 'Sao chép link đăng nhập' })).toBeVisible();
  const field = gate.getByLabel('Link đăng nhập một lần');
  await expect(field).toHaveValue(/\/vao\?token=[0-9a-f]{48}$/);
  const link = new URL(await field.inputValue());

  // Dán link vào Safari (một trình duyệt khác, chưa đăng nhập): vào thẳng tài khoản, không gõ mật khẩu.
  const { ctx: safariCtx, page: safari } = await phone(browser, IPHONE);
  await safari.goto(link.pathname + link.search);
  await expect(safari).not.toHaveURL(/\/vao/);
  await expect(safari).not.toHaveURL(/dang-nhap/);
  expect(await safari.evaluate(() => document.cookie)).toContain('hm_li=1');
  const me = await safari.request.get(`${API}/v1/me`);
  expect(((await me.json()) as { user: { email: string } }).user.email).toBe(USERS.member2);
  await safariCtx.close();

  // Link đã dùng rồi thì không dùng lại được.
  const { ctx: otherCtx, page: other } = await phone(browser, IPHONE);
  await other.goto(link.pathname + link.search);
  await expect(other.getByRole('heading', { name: 'Link đăng nhập không dùng được' })).toBeVisible();
  await expect(other.getByRole('link', { name: 'Đăng nhập bằng mật khẩu' })).toBeVisible();
  await otherCtx.close();
  await ctx.close();
});

test('Android: cài một lần bấm rồi mời bật thông báo; trình duyệt không cài được thì cho vào', async ({ browser, request }) => {
  await setGate(request, true);
  // Trình duyệt Android không có hộp cài (hoặc đã cài rồi): sau vài giây chờ thì cho dùng bình thường.
  const plain = await phone(browser, ANDROID);
  await login(plain.page, USERS.affiliate);
  await plain.page.goto('/minhquy/bang-tin');
  await secondVisit(plain.page, '/minhquy/bang-tin');
  await expect(plain.page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible({ timeout: 10_000 });
  await expect(plain.page.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' })).toHaveCount(0);

  // Trình duyệt có hộp cài: giả lập sự kiện beforeinstallprompt mà Chrome trên Android phát ra.
  await plain.page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
      window.dispatchEvent(e);
    });
  });
  await secondVisit(plain.page, '/minhquy/bang-tin');
  const gate = plain.page.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' });
  await expect(gate.getByRole('heading', { name: 'Cài Hội Mình ra màn hình chính' })).toBeVisible();
  await gate.getByRole('button', { name: 'Cài ứng dụng' }).click();
  // Máy chủ test không có khóa thông báo đẩy nên cài xong là vào thẳng, không hỏi bật thông báo.
  await expect(plain.page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
  await expect(gate).toHaveCount(0);
  await plain.ctx.close();
});

test('máy tính và quản trị hệ thống không bị chặn dù công tắc đang bật', async ({ page, browser, request }) => {
  await setGate(request, true);
  await login(page, USERS.member);
  await page.goto('/minhquy/bang-tin');
  await secondVisit(page, '/minhquy/bang-tin');
  await expect(page.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' })).toHaveCount(0);
  await expect(page.getByText('Minh Quý').first()).toBeVisible();

  // Quản trị hệ thống dùng iPhone vẫn vào được để tắt công tắc.
  const { ctx, page: ip } = await phone(browser, IPHONE);
  await login(ip, USERS.admin);
  await ip.goto('/tai-khoan');
  await secondVisit(ip, '/tai-khoan');
  await expect(ip.getByRole('dialog', { name: 'Cài Hội Mình ra màn hình chính' })).toHaveCount(0);
  await ctx.close();
});
