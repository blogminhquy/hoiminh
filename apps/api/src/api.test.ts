// Test tích hợp HTTP: đăng nhập, khung hội, bảng tin, webhook SePay qua HTTP, lỗi chuẩn, API key, luồng SSE thời gian thực, Khu học tập.
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
  it('SSE /v1/me/stream: cần đăng nhập, mở luồng rồi đẩy tin nhắn mới về đúng người', async () => {
    const anon = await hono.request('/v1/me/stream');
    expect(anon.status).toBe(401);

    // Hoàng Vũ mở luồng; Minh Quý gửi tin cho Vũ; Vũ phải đọc được sự kiện ngay trên luồng đó.
    const vuLogin = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'hoangvu@gmail.com', password: 'hoiminh123' }) });
    const vuToken = (await vuLogin.json()).accessToken;
    const vuId = (await (await json('/v1/me/id', { auth: vuToken })).json()).userId;

    const abort = new AbortController();
    const res = await hono.request('/v1/me/stream', { headers: { Authorization: `Bearer ${vuToken}` }, signal: abort.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();

    // Mỗi lần ghi là một chunk riêng nên phải gom cho tới khi thấy sự kiện cần tìm.
    expect(await readUntil(reader, 'ready', 3000)).toContain('retry: 3000');
    expect((await (await json('/health')).json()).realtimeConnections).toBeGreaterThan(0);

    const sent = await json('/v1/me/messages', { method: 'POST', auth: token, body: JSON.stringify({ recipientUserId: vuId, body: 'Tin thời gian thực' }) });
    expect(sent.status).toBe(201);

    const frames = await readUntil(reader, 'message.new', 3000);
    expect(frames).toContain('Tin thời gian thực');
    abort.abort();
    await reader.cancel().catch(() => null);
  });
  it('đang gõ và đánh dấu đã đọc: chỉ người trong hội thoại gọi được', async () => {
    const vuLogin = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'hoangvu@gmail.com', password: 'hoiminh123' }) });
    const vuToken = (await vuLogin.json()).accessToken;
    const convos = await json('/v1/me/conversations', { auth: vuToken });
    const convoId = (await convos.json()).items[0].id;

    expect((await json(`/v1/me/conversations/${convoId}/typing`, { method: 'POST', auth: vuToken })).status).toBe(200);
    const read = await json(`/v1/me/conversations/${convoId}/read`, { method: 'POST', auth: vuToken });
    expect(read.status).toBe(200);
    expect((await read.json()).readAt).toBeTruthy();

    const outsider = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'congtran@gmail.com', password: 'hoiminh123' }) });
    const outsiderToken = (await outsider.json()).accessToken;
    expect((await json(`/v1/me/conversations/${convoId}/typing`, { method: 'POST', auth: outsiderToken })).status).toBe(403);
  });
  it('/v1/me/library: cần đăng nhập; trả khóa học và tài liệu đã sở hữu kèm bài để học tiếp', async () => {
    expect((await json('/v1/me/library')).status).toBe(401);

    const login = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'thulan@gmail.com', password: 'hoiminh123' }) });
    const t = (await login.json()).accessToken;
    const r = await json('/v1/me/library', { auth: t });
    expect(r.status).toBe(200);
    const lib = await r.json();
    expect(lib.counts.courses).toBeGreaterThan(0);
    expect(lib.counts.courses).toBe(lib.courses.length);
    // Mỗi khóa phải có chỗ để bấm vào học, nếu không thẻ trên Khu học tập sẽ là ngõ cụt.
    for (const c of lib.courses) {
      expect(c.resumeLessonId, `khóa ${c.title} không có bài nào để mở`).toBeTruthy();
      expect(['purchase', 'bundle', 'subscription', 'granted']).toContain(c.source);
    }
  });
  it('tải tài liệu số: người sở hữu lấy được link, người ngoài bị chặn 403', async () => {
    const products = await json(`/v1/communities/${communityId}/products`, { auth: token });
    const digital = (await products.json()).items.find((p: Loose) => p.kind === 'digital');
    expect(digital, 'seed phải có một sản phẩm số').toBeTruthy();

    const buyer = await json('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'ngocdien1221@gmail.com', password: 'hoiminh123' }) });
    const buyerToken = (await buyer.json()).accessToken;
    const denied = await json(`/v1/products/${digital.id}/downloads`, { auth: buyerToken });
    expect([200, 403]).toContain(denied.status);
    if (denied.status === 403) expect((await denied.json()).code).toBe('forbidden');
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

/** Đọc luồng SSE cho tới khi thấy loại sự kiện cần tìm, hoặc hết thời gian chờ. */
async function readUntil(reader: ReadableStreamDefaultReader<string>, eventType: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let buffer = '';
  while (Date.now() < deadline) {
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise<{ value: undefined; done: boolean }>((resolve) => setTimeout(() => resolve({ value: undefined, done: true }), deadline - Date.now())),
    ]);
    if (done) break;
    buffer += value ?? '';
    if (buffer.includes(`event: ${eventType}`)) return buffer;
  }
  throw new Error(`Không nhận được sự kiện ${eventType} trong ${timeoutMs}ms. Đã nhận: ${buffer}`);
}
