// Helper e2e: đăng nhập qua giao diện, gọi API bằng token, giả lập webhook SePay, email ngẫu nhiên.
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = 'http://localhost:8787';
export const PASSWORD = 'hoiminh123';
export const USERS = { owner: 'minhquy@gmail.com', admin: 'admin@hoiminh.vn', affiliate: 'hoangvu@gmail.com', member: 'congtran@gmail.com', member2: 'duynguyen@gmail.com', trialOwner: 'vy.english@gmail.com' } as const;

/**
 * Đăng nhập qua màn Đăng nhập rồi chờ rời khỏi /dang-nhap.
 *
 * Thử lại một lần nếu vẫn còn ở trang đăng nhập mà không có thông báo lỗi nào: khi chạy cả bộ e2e,
 * thỉnh thoảng một lượt gọi tới API dev bị rớt (đã loại trừ rate limit và rò kết nối SSE, chưa tìm ra
 * nguyên nhân gốc). Một lần bấm lại rẻ hơn nhiều so với hỏng cả luồng, và nếu sai mật khẩu thật thì
 * lỗi vẫn hiện nên lần thử lại không che được lỗi thật.
 */
export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  const fillAndSubmit = async () => {
    await page.getByPlaceholder('ban@email.com').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
  };
  await page.goto('/dang-nhap');
  await fillAndSubmit();
  await page.waitForTimeout(1000);
  if (/dang-nhap/.test(page.url()) && !(await page.getByText(/Email hoặc mật khẩu|quá nhanh/).isVisible().catch(() => false))) {
    await fillAndSubmit();
  }
  await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 20_000 });
}

/** Lấy access token qua API (không qua giao diện) cho các bước chuẩn bị dữ liệu. */
export async function apiToken(request: APIRequestContext, email: string, password = PASSWORD): Promise<string> {
  const res = await request.post(`${API}/v1/auth/login`, { data: { email, password, remember: true } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  return ((await res.json()) as { accessToken: string }).accessToken;
}

/** Gọi API JSON với Bearer token. */
export async function apiJson<T>(request: APIRequestContext, token: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH', path: string, data?: unknown): Promise<T> {
  const res = await request.fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, data: data === undefined ? undefined : JSON.stringify(data) });
  expect(res.ok(), `${method} ${path} → ${res.status()} ${await res.text().catch(() => '')}`).toBeTruthy();
  return (await res.json()) as T;
}

/** Giả lập SePay báo có tiền: nội dung chuyển khoản chứa mã tham chiếu. */
export async function sepayWebhook(request: APIRequestContext, content: string, amountMinor: number, id = Date.now()): Promise<number> {
  const res = await request.post(`${API}/webhooks/sepay`, {
    headers: { Authorization: 'Apikey sepay-sandbox-key', 'Content-Type': 'application/json' },
    data: { id, gateway: 'Vietcombank', transactionDate: new Date().toISOString().slice(0, 19).replace('T', ' '), accountNumber: '0071000123456', code: null, content, transferType: 'in', transferAmount: amountMinor, accumulated: 0, subAccount: null, referenceCode: `FT${id}`, description: '' },
  });
  return res.status();
}

/** Email ngẫu nhiên cho tài khoản mới. */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}@example.com`;
}

/** Đọc số tiền "1.000.000đ" thành số. */
export function parseMoney(text: string): number {
  return Number(text.replace(/[^\d]/g, ''));
}

/** Đọc mã tham chiếu "HM XXXXX" và tổng tiền từ trang đơn hàng. */
export async function readOrder(page: Page): Promise<{ reference: string; amountMinor: number }> {
  await expect(page.getByText('Tổng thanh toán')).toBeVisible();
  const body = await page.locator('body').innerText();
  const ref = body.match(/HM ?[A-Z0-9]{5,8}/)?.[0] ?? '';
  expect(ref, 'mã tham chiếu trên trang đơn').toMatch(/^HM/);
  const amount = body.match(/Tổng thanh toán\s*([\d.]+)đ/)?.[1] ?? '0';
  return { reference: ref, amountMinor: parseMoney(amount) };
}
