// Test tích hợp HTTP: đăng nhập, khung hội, bảng tin, webhook SePay qua HTTP, lỗi chuẩn, API key.
import { readFileSync } from 'node:fs';
import { loadEnv } from '@hoiminh/config';
import { createApp, InMemoryQueue, type App } from '@hoiminh/core';
import { connect, runMigrations } from '@hoiminh/db';
import { seedAll } from '@hoiminh/db/seed';
import { fakeBucket } from '@hoiminh/media/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHonoApp } from './app';
import { resetMemoryLimits, TIERS } from './middleware/rate-limit';

let app: App;
let hono: ReturnType<typeof createHonoApp>;
let token = '';
let communityId = '';

type Loose = ReturnType<JSON['parse']>;
const json = async (path: string, init: RequestInit & { auth?: string } = {}) => {
  const res = await hono.request(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init.auth ? { Authorization: `Bearer ${init.auth}` } : {}), ...(init.headers ?? {}) } });
  return { status: res.status, headers: res.headers, json: (): Promise<Loose> => res.json() as Promise<Loose> };
};

beforeAll(async () => {
  const env = loadEnv({ APP_ENV: 'test', DATABASE_URL: 'pglite://memory', AUTH_JWT_SECRET: 'test-secret-test-secret-test-secret', ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' });
  const handle = await connect(env.DATABASE_URL);
  await runMigrations(handle);
  const seed = await seedAll(handle.db, { encryptionKey: env.ENCRYPTION_KEY, appUrl: env.APP_URL });
  communityId = seed.communityId;
  app = await createApp({ env, db: handle.db });
  hono = createHonoApp(app);
}, 180_000);
afterAll(async () => app.close());

describe('API', () => {
  it('/health trả ok', async () => {
    const r = await json('/health');
    expect(r.status).toBe(200);
    expect((await r.json()).db).toBe('ok');
  });
  it('đăng nhập sai → 401 { code, message }; đúng → phiên', async () => {
    const bad = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'minhquy@gmail.com', password: 'sai' }) });
    expect(bad.status).toBe(401);
    expect((await bad.json()).code).toBe('unauthorized');
    const ok = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'minhquy@gmail.com', password: 'hoiminh123' }) });
    expect(ok.status).toBe(200);
    const data = await ok.json();
    token = data.accessToken;
    expect(data.user.handle).toBe('minhquy');
  });
  it('validation lỗi → 422', async () => {
    const r = await json('/v1/auth/register', { method: 'POST', body: JSON.stringify({ email: 'x' }) });
    expect(r.status).toBe(422);
    expect((await r.json()).code).toBe('validation_error');
  });
  it('khung hội và bảng tin có dữ liệu seed', async () => {
    const shell = await json('/v1/communities/by-slug/minhquy/shell', { auth: token });
    expect(shell.status).toBe(200);
    const s = await shell.json();
    expect(s.community.name).toBe('Kinh Doanh Online Cùng AI');
    expect(s.viewer.role).toBe('owner');
    const feed = await json(`/v1/communities/${communityId}/feed`, { auth: token });
    const f = await feed.json();
    expect(f.items.length).toBeGreaterThan(3);
    expect(f.items[0].pinned).toBe(true);
    expect(f.items.some((p: { statusBgKey: string | null }) => p.statusBgKey === 'ngoc')).toBe(true);
    expect(f.items.some((p: { images: unknown[] }) => p.images.length === 6)).toBe(true);
  });
  it('khách chưa đăng nhập không xem được bảng tin nhưng xem được trang giới thiệu', async () => {
    const feed = await json(`/v1/communities/${communityId}/feed`);
    expect(feed.status).toBe(403);
    const about = await json('/v1/communities/by-slug/minhquy?ref=hv8k2');
    expect(about.status).toBe(200);
    expect((await about.json()).referrer.name).toBe('Hoàng Vũ');
  });
  it('checkout SePay rồi webhook HTTP báo có → đơn paid', async () => {
    const login = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'congtran@gmail.com', password: 'hoiminh123' }) });
    const t = (await login.json()).accessToken;
    const co = await json('/v1/checkout', { method: 'POST', auth: t, body: JSON.stringify({ target: { type: 'tier', communityId, tierKey: 'premium', cycle: 'yearly' }, provider: 'sepay' }) });
    expect(co.status).toBe(201);
    const session = await co.json();
    expect(session.instruction.kind).toBe('bank_qr');
    const wh = await json('/webhooks/sepay', { method: 'POST', headers: { Authorization: `Apikey ${app.ctx.env.SEPAY_API_KEY}` }, body: JSON.stringify({ id: 777001, gateway: 'Vietcombank', transactionDate: '2026-09-14 09:03:11', accountNumber: '0071000123456', code: null, content: `CONG TRAN ck ${session.reference}`, transferType: 'in', transferAmount: session.amountMinor, accumulated: 0, subAccount: null, referenceCode: 'X1', description: '' }) });
    expect(wh.status).toBe(200);
    const order = await json(`/v1/orders/${session.orderId}`, { auth: t });
    expect((await order.json()).status).toBe('paid');
    const courses = await json(`/v1/communities/${communityId}/courses`, { auth: t });
    const list = await courses.json();
    expect(list.items.find((c: { title: string }) => c.title === 'Funnel Money Model 2026').locked).toBe(false);
  });
  it('API key: tạo, gọi bằng key, thu hồi', async () => {
    const me = await json('/v1/me/workspace', { auth: token });
    const wsId = (await me.json()).workspace.id;
    const created = await json(`/v1/workspaces/${wsId}/api-keys`, { method: 'POST', auth: token, body: JSON.stringify({ name: 'Zapier', scopes: ['communities:read', 'members:read'] }) });
    expect(created.status).toBe(201);
    const key = (await created.json()).raw as string;
    expect(key.startsWith('hm_test_')).toBe(true);
    const r = await json(`/v1/communities/${communityId}/members?status=active`, { auth: key });
    expect(r.status).toBe(200);
    const denied = await json(`/v1/communities/${communityId}/posts`, { method: 'POST', auth: key, body: JSON.stringify({ spaceId: crypto.randomUUID(), contentMd: 'x' }) });
    expect(denied.status).toBe(403);
    const list = await json(`/v1/workspaces/${wsId}/api-keys`, { auth: token });
    const id = (await list.json())[0].id;
    await json(`/v1/workspaces/${wsId}/api-keys/${id}`, { method: 'DELETE', auth: token });
    const after = await json(`/v1/communities/${communityId}/members`, { auth: key });
    expect(after.status).toBe(401);
  });
  it('/r/:code đặt cookie attribution và chuyển hướng', async () => {
    const r = await json('/r/hv8k2');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toContain('/minhquy?ref=hv8k2');
    expect(r.headers.get('set-cookie')).toContain('hm_ref=hv8k2');
  });
  it('đổi mật khẩu: sai mật khẩu hiện tại bị chặn, đúng thì mật khẩu cũ hết hiệu lực và phiên khác bị thu hồi', async () => {
    const login = async (password: string) => json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'congtran@gmail.com', password }) });
    const first = await login('hoiminh123');
    const mine = (await first.json()).accessToken;
    // Một phiên thứ hai trên "thiết bị khác" — phải bị đẩy ra sau khi đổi mật khẩu.
    const other = (await (await login('hoiminh123')).json()).accessToken;

    const wrong = await json('/v1/me/password', { method: 'POST', auth: mine, body: JSON.stringify({ currentPassword: 'sai-roi', newPassword: 'mat-khau-moi-123' }) });
    expect(wrong.status).toBe(422);

    const same = await json('/v1/me/password', { method: 'POST', auth: mine, body: JSON.stringify({ currentPassword: 'hoiminh123', newPassword: 'hoiminh123' }) });
    expect(same.status).toBe(422);

    const ok = await json('/v1/me/password', { method: 'POST', auth: mine, body: JSON.stringify({ currentPassword: 'hoiminh123', newPassword: 'mat-khau-moi-123' }) });
    expect(ok.status).toBe(200);

    expect((await login('hoiminh123')).status).toBe(401);
    expect((await login('mat-khau-moi-123')).status).toBe(200);
    // Phiên đang dùng để đổi vẫn sống, phiên còn lại đã bị thu hồi.
    expect((await json('/v1/me', { auth: mine })).status).toBe(200);
    expect((await json('/v1/me', { auth: other })).status).toBe(401);
  });
  it('super admin: tổng quan và đối soát; thành viên thường bị chặn', async () => {
    const login = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hoiminh.vn', password: 'hoiminh123' }) });
    const t = (await login.json()).accessToken;
    const ov = await json('/v1/admin/overview', { auth: t });
    expect(ov.status).toBe(200);
    const denied = await json('/v1/admin/overview', { auth: token });
    expect(denied.status).toBe(403);
    const recon = await json('/v1/admin/reconciliation?status=unmatched', { auth: t });
    expect((await recon.json()).items.length).toBeGreaterThan(0);
  });
  it('email thử: không có RESEND_API_KEY thì trả logged, có dòng trong nhật ký email; /health báo provider', async () => {
    const login = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@hoiminh.vn', password: 'hoiminh123' }) });
    const t = (await login.json()).accessToken;
    const ov = await (await json('/v1/admin/overview', { auth: t })).json();
    expect(ov.infra.email).toBe('log');
    expect(ov.infra.media).toBe('đĩa local');
    const r = await json('/v1/admin/email/test', { method: 'POST', auth: t });
    expect(r.status).toBe(200);
    const res = await r.json();
    expect(res.status).toBe('logged');
    expect(res.to).toBe('admin@hoiminh.vn');
    const logs = await (await json('/v1/admin/logs?kind=email&limit=5', { auth: t })).json();
    expect(logs.emails[0].template).toBe('test_email');
    expect(logs.emails[0].status).toBe('logged');
    expect((await json('/v1/admin/email/test', { method: 'POST', auth: token })).status).toBe(403);
    const health = await (await json('/health')).json();
    expect(health.email).toBe('log');
    expect(health.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it('tệp: production mà chưa nối R2 → 503 nói rõ nguyên nhân; có binding R2 → tải lên và phát lại qua API', async () => {
    const dbHandle = (app.ctx as { db: unknown }).db as never;
    const base = { APP_ENV: 'production' as const, DATABASE_URL: 'pglite://memory', API_URL: 'https://api.test', APP_URL: 'https://test', AUTH_JWT_SECRET: 'test-secret-test-secret-test-secret', ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' };
    const body = JSON.stringify({ fileName: 'anh.png', mimeType: 'image/png', sizeBytes: 5, purpose: 'post_image', communityId });

    const noR2 = await createApp({ env: loadEnv(base), db: dbHandle });
    const h0 = createHonoApp(noR2);
    const blocked = await h0.request('/v1/files/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body });
    expect(blocked.status).toBe(503);
    expect(((await blocked.json()) as { message: string }).message).toContain('R2');

    const bucket = fakeBucket();
    const withR2 = await createApp({ env: loadEnv(base), db: dbHandle, r2Bucket: bucket });
    const h1 = createHonoApp(withR2);
    const ask = await h1.request('/v1/files/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body });
    expect(ask.status).toBe(201);
    const r = (await ask.json()) as { fileId: string; upload: { url: string; headers: Record<string, string> }; url: string };
    expect(r.upload.url.startsWith('https://api.test/files/upload/public/post_image/')).toBe(true);
    expect(r.url.startsWith('https://api.test/files/public/post_image/')).toBe(true);

    const put = await h1.request(r.upload.url, { method: 'PUT', headers: r.upload.headers, body: new Uint8Array([1, 2, 3, 4, 5]) });
    expect(put.status).toBe(200);
    expect(bucket.objects.size).toBe(1);

    const forged = await h1.request(r.upload.url.replace(/sig=[0-9a-f]+/, 'sig=0000'), { method: 'PUT', headers: r.upload.headers, body: new Uint8Array([9]) });
    expect(forged.status).toBe(403);

    const get = await h1.request(r.url);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]));

    const done = await h1.request(`/v1/files/${r.fileId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ width: 1, height: 1 }) });
    expect(done.status).toBe(200);

    // Tệp riêng: không có chữ ký thì bị chặn, dù tệp có trong bucket.
    await bucket.put('private/digital_product/x.pdf', new Uint8Array([1]), { httpMetadata: { contentType: 'application/pdf' } });
    expect((await h1.request('/files/private/digital_product/x.pdf')).status).toBe(403);
    const signed = await withR2.ctx.media.getSignedUrl('private/digital_product/x.pdf', 60);
    expect((await h1.request(signed)).status).toBe(200);
    });
  it('đổi avatar qua HTTP dọn tệp cũ trên R2; DELETE /v1/files/:id chỉ hủy được ảnh chưa dùng của chính mình', async () => {
    const dbHandle = (app.ctx as { db: unknown }).db as never;
    const base = { APP_ENV: 'production' as const, DATABASE_URL: 'pglite://memory', API_URL: 'https://api.test', APP_URL: 'https://test', AUTH_JWT_SECRET: 'test-secret-test-secret-test-secret', ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' };
    const bucket = fakeBucket();
    const withR2 = await createApp({ env: loadEnv(base), db: dbHandle, r2Bucket: bucket });
    const h = createHonoApp(withR2);
    const call = (path: string, init: RequestInit = {}, auth: string | null = token) => h.request(path, { ...init, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(init.headers ?? {}) } });
    /** Tải một ảnh avatar như trình duyệt: xin URL, PUT, xác nhận. */
    const uploadAvatar = async () => {
      const ask = await call('/v1/files/upload-url', { method: 'POST', body: JSON.stringify({ fileName: 'me.jpg', mimeType: 'image/jpeg', sizeBytes: 3, purpose: 'avatar' }) });
      const r = (await ask.json()) as { fileId: string; upload: { url: string; headers: Record<string, string> } };
      await h.request(r.upload.url, { method: 'PUT', headers: r.upload.headers, body: new Uint8Array([1, 2, 3]) });
      await call(`/v1/files/${r.fileId}/complete`, { method: 'POST', body: JSON.stringify({ width: 10, height: 10 }) });
      return { fileId: r.fileId, key: new URL(r.upload.url).pathname.replace('/files/upload/', '') };
    };
    const settle = () => (withR2.ctx.queue as InMemoryQueue).drain();
    const setAvatar = (avatarFileId: string | null) => call('/v1/me', { method: 'PATCH', body: JSON.stringify({ avatarFileId }) });

    const first = await uploadAvatar();
    expect((await setAvatar(first.fileId)).status).toBe(200);
    const second = await uploadAvatar();
    expect((await setAvatar(second.fileId)).status).toBe(200);
    // Việc xóa R2 vào hàng đợi sau khi request commit; consumer xóa ngay, không chờ cron.
    await settle();
    expect(bucket.objects.has(first.key)).toBe(false);
    expect(bucket.objects.has(second.key)).toBe(true);

    // Hủy ảnh tải dở: chủ tệp được, hủy lần hai thì không còn, tệp đang dùng bị từ chối, người lạ không hủy được.
    const spare = await uploadAvatar();
    expect((await call(`/v1/files/${spare.fileId}`, { method: 'DELETE' }, null)).status).toBe(401);
    expect((await call(`/v1/files/${spare.fileId}`, { method: 'DELETE' })).status).toBe(200);
    expect((await call(`/v1/files/${spare.fileId}`, { method: 'DELETE' })).status).toBe(404);
    expect((await call(`/v1/files/${second.fileId}`, { method: 'DELETE' })).status).toBe(409);
    expect((await call('/v1/files/khong-phai-uuid', { method: 'DELETE' })).status).toBe(404);
    await settle();
    expect(bucket.objects.has(spare.key)).toBe(false);
    expect(bucket.objects.has(second.key)).toBe(true);

    // Gỡ avatar thì tệp cuối cùng cũng được dọn.
    expect((await setAvatar(null)).status).toBe(200);
    await settle();
    expect(bucket.objects.size).toBe(0);
  });
  it('trang mô phỏng thanh toán thoát HTML và không chuyển hướng ra ngoài', async () => {
    const page = await hono.request('/pay/simulator?provider=%3Cscript%3Ealert(1)%3C%2Fscript%3E&orderId=%22%3E%3Cimg&amount=1&return=https%3A%2F%2Fevil.example%2Fx');
    const html = await page.text();
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;SCRIPT&gt;');
    expect(html).not.toContain('evil.example');
    const form = new URLSearchParams({ provider: 'none', orderId: 'x', amount: '1', result: 'fail', return: 'https://evil.example/x' });
    const res = await hono.request('/pay/simulator/confirm', { method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).not.toContain('evil.example');
  });
  it('trang công khai được cache cho khách, người đăng nhập đi thẳng', async () => {
    const store = new Map<string, Response>();
    const g = globalThis as { caches?: unknown };
    g.caches = { default: { match: async (r: Request) => store.get(r.url)?.clone(), put: async (r: Request, res: Response) => void store.set(r.url, res) } };
    try {
      const first = await hono.request('/v1/communities/discover');
      expect(first.status).toBe(200);
      expect(first.headers.get('cache-control')).toContain('public');
      expect(first.headers.get('x-hm-cache')).toBe('MISS');
      const second = await hono.request('/v1/communities/discover');
      expect(second.headers.get('x-hm-cache')).toBe('HIT');
      expect(await second.json()).toEqual(await first.json());
      const authed = await hono.request('/v1/communities/discover', { headers: { Authorization: `Bearer ${token}` } });
      expect(authed.headers.get('x-hm-cache')).toBeNull();
      const withRef = await hono.request('/v1/communities/discover?ref=abc');
      expect(withRef.headers.get('x-hm-cache')).toBeNull();
    } finally {
      delete g.caches;
    }
  });
  it('đăng nhập sai liên tục bị chặn theo email, người khác cùng IP vẫn vào được', async () => {
    resetMemoryLimits();
    const attempt = (email: string) => hono.request('/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' }, body: JSON.stringify({ email, password: 'sai-mat-khau' }) });
    for (let i = 0; i < TIERS.auth.limit; i++) expect((await attempt('minhquy@gmail.com')).status).toBe(401);
    const blocked = await attempt('minhquy@gmail.com');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('60');
    expect((await attempt('duynguyen@gmail.com')).status).toBe(401);
    resetMemoryLimits();
  });

  it('dùng binding Rate Limiting của Cloudflare khi có', async () => {
    const keys: string[] = [];
    const env = { RL_API: { limit: async ({ key }: { key: string }) => { keys.push(key); return { success: false }; } } };
    const res = await hono.request('/v1/plans', { headers: { 'cf-connecting-ip': '5.6.7.8' } }, env);
    expect(res.status).toBe(429);
    expect(keys[0]).toContain('ip:5.6.7.8');
    const authed = await hono.request('/v1/plans', { headers: { Authorization: 'Bearer abc' } }, env);
    expect(authed.status).toBe(429);
    expect(keys[1]).toMatch(/^api:t:/);
  });
  it('hạn mức trong code khớp binding trong wrangler.toml', () => {
    const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    for (const t of Object.values(TIERS)) {
      expect(toml).toMatch(new RegExp(`name = "${t.binding}"\\s*\\nnamespace_id = "\\d+"\\s*\\nsimple = \\{ limit = ${t.limit}, period = ${t.period} \\}`));
    }
  });
});
