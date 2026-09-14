// Test tích hợp HTTP: đăng nhập, khung hội, bảng tin, webhook SePay qua HTTP, lỗi chuẩn, API key.
import { loadEnv } from '@hoiminh/config';
import { createApp, type App } from '@hoiminh/core';
import { connect, runMigrations } from '@hoiminh/db';
import { seedAll } from '@hoiminh/db/seed';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHonoApp } from './app';

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
});
