// Test HTTP cho thẻ và quy tắc tự động: địa chỉ nhận /webhooks/in (JSON, form, tham số trên địa chỉ), trang kích hoạt
// đặt cookie phiên, link ngừng nhận email, và quyền vào màn quản trị.
import { loadEnv } from '@hoiminh/config';
import { createApp, type App } from '@hoiminh/core';
import { connect, runMigrations } from '@hoiminh/db';
import { seedAll } from '@hoiminh/db/seed';
import type { EmailMessage } from '@hoiminh/email';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHonoApp } from './app';

let app: App;
let hono: ReturnType<typeof createHonoApp>;
let owner = '';
let communityId = '';
let inbound = '';
const emails: EmailMessage[] = [];

type Loose = ReturnType<JSON['parse']>;
const call = async (path: string, init: RequestInit & { auth?: string } = {}) => {
  const res = await hono.request(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init.auth ? { Authorization: `Bearer ${init.auth}` } : {}), ...(init.headers ?? {}) } });
  return { status: res.status, headers: res.headers, text: () => res.text(), json: (): Promise<Loose> => res.json() as Promise<Loose> };
};
const login = async (email: string) => (await (await call('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'hoiminh123' }) })).json()).accessToken as string;
const A = () => `/v1/communities/${communityId}/automation`;

beforeAll(async () => {
  const env = loadEnv({ APP_ENV: 'test', DATABASE_URL: 'pglite://memory', AUTH_JWT_SECRET: 'test-secret-test-secret-test-secret', ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' });
  const handle = await connect(env.DATABASE_URL);
  await runMigrations(handle);
  const seed = await seedAll(handle.db, { encryptionKey: env.ENCRYPTION_KEY, appUrl: env.APP_URL });
  communityId = seed.communityId;
  app = await createApp({ env, db: handle.db, onEmail: (m) => emails.push(m) });
  hono = createHonoApp(app);
  owner = await login('minhquy@gmail.com');
}, 180_000);
afterAll(async () => app.close());

describe('thẻ và quy tắc tự động qua HTTP', () => {
  it('màn quản trị cần đăng nhập và quyền cài đặt', async () => {
    expect((await call(`${A()}/sources`)).status).toBe(401);
    expect((await call(`${A()}/sources`, { auth: await login('congtran@gmail.com') })).status).toBe(403);
    expect((await call(`${A()}/sources`, { auth: owner })).status).toBe(200);
  });

  it('tạo nguồn, tạo quy tắc, xem được hội và khóa học để chọn', async () => {
    const src = await call(`${A()}/sources`, { method: 'POST', auth: owner, body: JSON.stringify({ name: 'Landing Webcake' }) });
    expect(src.status).toBe(201);
    inbound = new URL((await src.json()).url).pathname;
    expect(inbound).toMatch(/^\/webhooks\/in\/[a-f0-9]{40}$/);
    const options = await (await call(`${A()}/options`, { auth: owner })).json();
    expect(options.communities.map((c: Loose) => c.slug)).toContain('minhquy');
    const course = options.courses.find((c: Loose) => c.title.startsWith('Facebook Ads'));
    const rule = await call(`${A()}/rules`, { method: 'POST', auth: owner, body: JSON.stringify({ name: 'Mua khóa', tag: 'paid', actions: [{ type: 'grant_course', courseId: course.id }] }) });
    expect(rule.status).toBe(201);
    const bad = await call(`${A()}/rules`, { method: 'POST', auth: owner, body: JSON.stringify({ name: 'Thiếu việc', tag: 'paid', actions: [] }) });
    expect(bad.status).toBe(422);
  });

  it('mở địa chỉ nhận bằng trình duyệt chỉ báo đang hoạt động, khóa sai thì 404', async () => {
    const ping = await call(inbound);
    expect(ping.status).toBe(200);
    expect((await ping.json()).status).toBe('ready');
    expect((await call('/webhooks/in/khong-ton-tai', { method: 'POST', body: '{}' })).status).toBe(404);
  });

  it('nhận JSON, form và thẻ trên địa chỉ; không cần đăng nhập', async () => {
    const a = await call(inbound, { method: 'POST', body: JSON.stringify({ full_name: 'Khách A', email: 'khach.a@example.com', tag: 'paid' }) });
    expect(await a.json()).toMatchObject({ ok: true, status: 'processed', email: 'khach.a@example.com', tagsAdded: ['paid'] });
    const b = await call(`${inbound}?tag=order_placed`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'full_name=Kh%C3%A1ch+B&email=khach.b%40example.com&phone_number=0900000002' });
    expect(await b.json()).toMatchObject({ status: 'processed', email: 'khach.b@example.com', tagsAdded: ['order_placed'] });
    const c = await call(inbound, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'không phải dữ liệu' });
    expect((await c.json()).status).toBe('failed');
    const big = await call(inbound, { method: 'POST', body: JSON.stringify({ email: 'x@example.com', note: 'x'.repeat(70_000) }) });
    expect(big.status).toBe(413);
    const contacts = await (await call(`${A()}/contacts`, { auth: owner })).json();
    expect(contacts.items.map((x: Loose) => x.email).sort()).toEqual(['khach.a@example.com', 'khach.b@example.com']);
    expect(contacts.items.find((x: Loose) => x.email === 'khach.b@example.com')).toMatchObject({ name: 'Khách B', phone: '0900000002' });
  });

  it('kích hoạt từ link trong email: đặt mật khẩu là có phiên bằng cookie và học được', async () => {
    const mail = emails.find((m) => m.to === 'khach.a@example.com' && m.template === 'activation_invite');
    const token = /kich-hoat\?token=([a-f0-9]+)/.exec(mail!.html)![1]!;
    const info = await (await call(`/v1/activation/${token}`)).json();
    expect(info).toMatchObject({ email: 'khach.a@example.com', hasAccount: false, items: ['Khóa học Facebook Ads chuyển đổi 2026'] });
    expect((await call('/v1/activation/sai-ma')).status).toBe(422);
    const res = await call(`/v1/activation/${token}`, { method: 'POST', headers: { 'X-HM-Auth': 'cookie' }, body: JSON.stringify({ password: 'matkhau-moi-123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ needsLogin: false, redirect: '/hoc', email: 'khach.a@example.com' });
    // Web không nhận token trong thân phản hồi: phiên nằm ở cookie httpOnly.
    expect(body.session.accessToken).toBe('');
    expect(res.headers.get('set-cookie')).toContain('hm_at=');
    expect((await call('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'khach.a@example.com', password: 'sai-mat-khau' }) })).status).toBe(401);
    const ok = await call('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'khach.a@example.com', password: 'matkhau-moi-123' }) });
    expect(ok.status).toBe(200);
    const library = await call('/v1/me/library', { auth: (await ok.json()).accessToken });
    expect(JSON.stringify(await library.json())).toContain('Facebook Ads chuyển đổi 2026');
  });

  it('link ngừng nhận email: GET chỉ hỏi lại, POST mới ngừng', async () => {
    const mail = emails.find((m) => m.to === 'khach.a@example.com');
    const path = new URL(/href="([^"]*\/webhooks\/unsubscribe\/[a-f0-9]+)"/.exec(mail!.html)![1]!).pathname;
    const page = await call(path);
    expect(await page.text()).toContain('Ngừng nhận email?');
    let row = (await (await call(`${A()}/contacts?q=khach.a`, { auth: owner })).json()).items[0];
    expect(row.unsubscribed).toBe(false);
    expect(await (await call(path, { method: 'POST' })).text()).toContain('Đã ngừng nhận email');
    row = (await (await call(`${A()}/contacts?q=khach.a`, { auth: owner })).json()).items[0];
    expect(row).toMatchObject({ unsubscribed: true, hasAccount: true });
    expect((await call('/webhooks/unsubscribe/khong-co', { method: 'POST' })).status).toBe(404);
  });

  it('gỡ thẻ bằng tay, nhật ký nhận và nhật ký chạy đều xem được', async () => {
    const row = (await (await call(`${A()}/contacts?q=khach.a`, { auth: owner })).json()).items[0];
    const r = await call(`${A()}/contacts/${row.id}/tags/paid`, { method: 'DELETE', auth: owner });
    expect(await r.json()).toMatchObject({ removed: true, revoked: 1 });
    const sources = await (await call(`${A()}/sources`, { auth: owner })).json();
    expect(sources[0].receivedCount).toBe(3);
    const events = await (await call(`${A()}/sources/${sources[0].id}/events`, { auth: owner })).json();
    expect(events.map((e: Loose) => e.status)).toEqual(['failed', 'processed', 'processed']);
    const runs = await (await call(`${A()}/runs`, { auth: owner })).json();
    expect(runs.map((x: Loose) => x.trigger)).toEqual(['tag_removed', 'tag_added']);
  });
});
