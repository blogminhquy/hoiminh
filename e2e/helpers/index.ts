// Helper e2e: đăng nhập qua giao diện, gọi API bằng token, giả lập webhook SePay, email ngẫu nhiên.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

export const API = 'http://localhost:8787';
export const PASSWORD = 'hoiminh123';
export const USERS = { owner: 'minhquy@gmail.com', admin: 'admin@hoiminh.vn', affiliate: 'hoangvu@gmail.com', member: 'congtran@gmail.com', member2: 'duynguyen@gmail.com', freeOwner: 'vy.english@gmail.com', freeOwner2: 'phamduc@gmail.com' } as const;

/** Đăng nhập qua màn Đăng nhập rồi chờ rời khỏi /dang-nhap. */
export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/dang-nhap');
  await page.getByPlaceholder('ban@email.com').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  // API giới hạn 10 lần đăng nhập mỗi phút cho một email. Cả bộ test đăng nhập tài khoản chủ hội rất nhiều lần, nên khi
  // máy chạy nhanh thì lần thứ 11 rơi vào đúng phút đó và bị từ chối. Gặp vậy thì chờ hết cửa sổ một phút rồi bấm lại,
  // thay vì để bài test trượt vì một giới hạn đang làm đúng việc của nó.
  const limited = page.getByText('Bạn thao tác quá nhanh');
  const outcome = await Promise.race([
    page.waitForURL((u) => !u.pathname.startsWith('/dang-nhap'), { timeout: 15_000 }).then(() => 'in' as const, () => 'stuck' as const),
    limited.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'limited' as const, () => 'stuck' as const),
  ]);
  if (outcome === 'limited') {
    test.info().setTimeout(test.info().timeout + 70_000);
    await page.waitForTimeout(61_000);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
  }
  await expect(page).not.toHaveURL(/dang-nhap/);
  // Phiên nằm trong cookie httpOnly: JavaScript không thấy token, chỉ thấy cờ đăng nhập.
  const seen = await page.evaluate(() => ({ stored: localStorage.getItem('hm_access'), cookies: document.cookie }));
  expect(seen.stored).toBeNull();
  expect(seen.cookies).toContain('hm_li=1');
  expect(seen.cookies).not.toContain('hm_at=');
}

/** Lấy access token qua API (không qua giao diện) cho các bước chuẩn bị dữ liệu. */
export async function apiToken(request: APIRequestContext, email: string, password = PASSWORD): Promise<string> {
  let res = await request.post(`${API}/v1/auth/login`, { data: { email, password, remember: true } });
  // Cùng lý do như `login` ở trên: chạm giới hạn 10 lần đăng nhập mỗi phút thì chờ hết cửa sổ rồi thử lại một lần.
  if (res.status() === 429) {
    try { test.info().setTimeout(test.info().timeout + 70_000); } catch { /* gọi ngoài một bài test (afterAll): không có hạn để nới */ }
    await new Promise((r) => setTimeout(r, 61_000));
    res = await request.post(`${API}/v1/auth/login`, { data: { email, password, remember: true } });
  }
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

export type PlanPricesInput = { monthly: number; quarterly: number; semiannual: number; yearly: number };
const prices = (p: Partial<PlanPricesInput>): PlanPricesInput => ({ monthly: 0, quarterly: 0, semiannual: 0, yearly: 0, ...p });

/**
 * Bảng bốn gói mặc định (giá từng kỳ, trần, tính năng đã chốt), dùng để trả bảng gói về như cũ sau khi một bài test đổi nó.
 * Mặc định chỉ bán 3 tháng và 1 năm; 1 tháng và 6 tháng để 0 (không bán) cho tới khi quản trị nhập giá.
 */
export const DEFAULT_PLANS = [
  { key: 'free', prices: prices({}), memberCap: 100, features: [] },
  { key: 'starter', prices: prices({ quarterly: 297_000, yearly: 990_000 }), memberCap: 500, features: [] },
  { key: 'pro', prices: prices({ quarterly: 897_000, yearly: 2_990_000 }), memberCap: 5_000, features: ['automation', 'custom_domain', 'affiliate', 'api'] },
  { key: 'unlimited', prices: prices({ quarterly: 2_397_000, yearly: 7_990_000 }), memberCap: null, features: ['automation', 'custom_domain', 'affiliate', 'api'] },
] as const;

/** Quản trị lưu bảng gói qua API; `change` sửa riêng vài gói so với bảng mặc định. */
export async function savePlans(request: APIRequestContext, change: Partial<Record<(typeof DEFAULT_PLANS)[number]['key'], { prices?: PlanPricesInput; memberCap?: number | null; features?: string[] }>> = {}): Promise<void> {
  const token = await apiToken(request, USERS.admin);
  await apiJson(request, token, 'PUT', '/v1/admin/plans', { plans: DEFAULT_PLANS.map((p) => ({ ...p, ...(change[p.key] ?? {}) })) });
}

/** Mã bí mật của địa chỉ báo có của hội chính trong dữ liệu mẫu (khớp SEED_BANK_WEBHOOK_TOKEN ở packages/db/src/seed). */
export const OWNER_BANK_TOKEN = '5eed'.repeat(10);

/**
 * Giả lập ngân hàng của CHỦ HỘI báo có tiền vào (đơn của hội trả thẳng vào tài khoản chủ hội, không qua Hội Mình).
 * `sepayWebhook` ở trên là tài khoản của Hội Mình, chỉ dùng cho đơn mua gói.
 */
export async function ownerBankWebhook(request: APIRequestContext, content: string, amountMinor: number, token = OWNER_BANK_TOKEN, id = Date.now()): Promise<number> {
  const res = await request.post(`${API}/webhooks/bank/${token}`, {
    headers: { 'Content-Type': 'application/json' },
    data: { id, gateway: 'Vietcombank', transactionDate: new Date().toISOString().slice(0, 19).replace('T', ' '), accountNumber: '0071000999888', code: null, content, transferType: 'in', transferAmount: amountMinor, accumulated: 0, subAccount: null, referenceCode: `FT${id}`, description: '' },
  });
  return res.status();
}
