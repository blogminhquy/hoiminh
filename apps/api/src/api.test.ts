// Test tích hợp HTTP: đăng nhập, khung hội, bảng tin, webhook SePay qua HTTP, lỗi chuẩn, API key, Khu học tập.
import { readFileSync } from 'node:fs';
import { loadEnv } from '@hoiminh/config';
import { createApp, type App, type InMemoryQueue } from '@hoiminh/core';
import { openSeededTestDb } from '@hoiminh/db/testing';
import { fakeBucket, fakeImages } from '@hoiminh/media/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHonoApp } from './app';
import { resetMemoryLimits, TIERS } from './middleware/rate-limit';
import { MAX_SOCKETS, RealtimeHub } from './realtime-hub';

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
  const { handle, seed } = await openSeededTestDb({ encryptionKey: env.ENCRYPTION_KEY, appUrl: env.APP_URL });
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
    // Một phiên thứ hai trên "thiết bị khác", phải bị đẩy ra sau khi đổi mật khẩu.
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
  it('ảnh tải lên thành WebP: JPEG, PNG được máy chủ chuyển trước khi vào R2; WebP và GIF đi thẳng; không nhận video', async () => {
    const dbHandle = (app.ctx as { db: unknown }).db as never;
    const base = { APP_ENV: 'production' as const, DATABASE_URL: 'pglite://memory', API_URL: 'https://api.test', APP_URL: 'https://test', AUTH_JWT_SECRET: 'test-secret-test-secret-test-secret', ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' };
    const bucket = fakeBucket();
    const images = fakeImages();
    const h = createHonoApp(await createApp({ env: loadEnv(base), db: dbHandle, r2Bucket: bucket, images }));
    const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const ask = (fileName: string, mimeType: string, purpose = 'post_image') => h.request('/v1/files/upload-url', { method: 'POST', headers: auth, body: JSON.stringify({ fileName, mimeType, sizeBytes: 5, purpose, communityId }) });
    type Asked = { fileId: string; upload: { url: string; headers: Record<string, string> }; url: string };
    /** Tải một tệp 5 byte như trình duyệt: xin URL, PUT, xác nhận. Trả về URL công khai và kết quả PUT. */
    const upload = async (fileName: string, mimeType: string, purpose = 'post_image') => {
      const r = (await (await ask(fileName, mimeType, purpose)).json()) as Asked;
      const put = (await (await h.request(r.upload.url, { method: 'PUT', headers: r.upload.headers, body: new Uint8Array([1, 2, 3, 4, 5]) })).json()) as { contentType: string; bytes: number };
      const done = (await (await h.request(`/v1/files/${r.fileId}/complete`, { method: 'POST', headers: auth, body: JSON.stringify({ width: 10, height: 10 }) })).json()) as { url: string };
      return { url: done.url, put };
    };
    const served = async (url: string) => { const res = await h.request(url); return { type: res.headers.get('content-type'), text: new TextDecoder().decode(await res.arrayBuffer()) }; };

    // JPEG từ trình duyệt không xuất được WebP (Safari): key đuôi .webp, máy chủ chuyển rồi mới ghi vào R2.
    const jpeg = await upload('IMG_1.JPG', 'image/jpeg');
    expect(jpeg.url).toMatch(/^https:\/\/api\.test\/files\/public\/post_image\/.+\.webp$/);
    expect(jpeg.put).toEqual(expect.objectContaining({ contentType: 'image/webp', bytes: 6 }));
    expect(await served(jpeg.url)).toEqual({ type: 'image/webp', text: 'webp:5' });
    expect(images.calls[0]).toEqual({ transform: { width: 1200, height: 1200, fit: 'scale-down' }, output: { format: 'image/webp', quality: 80 }, inputBytes: 5 });

    // Avatar, logo: cạnh dài tối đa 512px.
    const avatar = await upload('me.png', 'image/png', 'avatar');
    expect(avatar.url).toMatch(/\/public\/avatar\/.+\.webp$/);
    expect(images.calls[1]?.transform).toEqual({ width: 512, height: 512, fit: 'scale-down' });

    // Trình duyệt đã nén sẵn thành WebP: đi thẳng vào kho, không tốn lượt chuyển đổi.
    const webp = await upload('san.webp', 'image/webp');
    expect(webp.url).toMatch(/\.webp$/);
    expect(webp.put.contentType).toBe('image/webp');
    expect((await served(webp.url)).text).not.toContain('webp:');
    // GIF giữ nguyên để không mất chuyển động.
    const gif = await upload('vui.gif', 'image/gif');
    expect(gif.url).toMatch(/\.gif$/);
    expect((await served(gif.url)).type).toBe('image/gif');
    expect(images.calls).toHaveLength(2);

    // Không nhận tệp video ở mục nào, kể cả tài liệu bài học và tệp số.
    for (const purpose of ['post_image', 'lesson_resource', 'digital_product']) {
      const video = await ask('clip.mp4', 'video/mp4', purpose);
      expect(video.status).toBeGreaterThanOrEqual(400);
      expect(((await video.json()) as { message: string }).message).toContain('Không nhận tệp video');
    }

    // Cloudflare từ chối chuyển (hết hạn mức): lượt tải lên vẫn thành công, ảnh lưu đúng dạng nhận được.
    const failing = createHonoApp(await createApp({ env: loadEnv(base), db: dbHandle, r2Bucket: bucket, images: fakeImages({ fail: true }) }));
    const r = (await (await failing.request('/v1/files/upload-url', { method: 'POST', headers: auth, body: JSON.stringify({ fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 5, purpose: 'post_image', communityId }) })).json()) as Asked;
    const put = await failing.request(r.upload.url, { method: 'PUT', headers: r.upload.headers, body: new Uint8Array([1, 2, 3, 4, 5]) });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { contentType: string }).contentType).toBe('image/jpeg');
    const back = await failing.request(r.url);
    expect(back.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]));

    // Không có binding Images (cấu hình cũ): JPEG giữ đuôi và định dạng như trước.
    const plain = createHonoApp(await createApp({ env: loadEnv(base), db: dbHandle, r2Bucket: bucket }));
    const old = (await (await plain.request('/v1/files/upload-url', { method: 'POST', headers: auth, body: JSON.stringify({ fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 5, purpose: 'post_image', communityId }) })).json()) as Asked;
    expect(old.url).toMatch(/\.jpg$/);
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

  describe('phiên đăng nhập bằng cookie httpOnly', () => {
    const web = 'http://localhost:5173';
    const cookieOf = (res: Response) => res.headers.getSetCookie();
    const jar = (setCookies: string[]) => setCookies.map((c) => c.split(';')[0] ?? '').filter((c) => !c.endsWith('=')).join('; ');
    const login = () => hono.request('/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HM-Auth': 'cookie', Origin: web, 'cf-connecting-ip': '9.9.9.1' }, body: JSON.stringify({ email: 'minhquy@gmail.com', password: 'hoiminh123' }) });

    it('web nhận cookie httpOnly, không thấy token trong JSON', async () => {
      resetMemoryLimits();
      const res = await login();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { accessToken: string; refreshToken: string | null; user: { handle: string } };
      expect(body.accessToken).toBe('');
      expect(body.refreshToken).toBeNull();
      expect(body.user.handle).toBe('minhquy');
      const set = cookieOf(res);
      expect(set.find((c) => c.startsWith('hm_at='))).toMatch(/HttpOnly/);
      expect(set.find((c) => c.startsWith('hm_rt='))).toMatch(/Path=\/v1\/auth;.*HttpOnly/);
      expect(set.find((c) => c.startsWith('hm_li=1'))).not.toMatch(/HttpOnly/);
      const me = await hono.request('/v1/me', { headers: { Cookie: jar(set) } });
      expect(me.status).toBe(200);
    });

    it('ứng dụng ngoài (không gửi X-HM-Auth) vẫn nhận token trong body, không có cookie', async () => {
      resetMemoryLimits();
      const res = await hono.request('/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'minhquy@gmail.com', password: 'hoiminh123' }) });
      expect(((await res.json()) as { accessToken: string }).accessToken.length).toBeGreaterThan(20);
      expect(cookieOf(res)).toHaveLength(0);
    });

    it('request ghi dùng cookie từ trang lạ bị chặn (CSRF), từ chính web thì qua', async () => {
      resetMemoryLimits();
      const cookies = jar(cookieOf(await login()));
      const evil = await hono.request('/v1/me/badges', { method: 'POST', headers: { Cookie: cookies, Origin: 'https://evil.example' } });
      expect(evil.status).toBe(403);
      const noOrigin = await hono.request('/v1/auth/logout', { method: 'POST', headers: { Cookie: cookies } });
      expect(noOrigin.status).toBe(403);
      const ok = await hono.request('/v1/auth/logout', { method: 'POST', headers: { Cookie: cookies, Origin: web } });
      expect(ok.status).toBe(200);
      expect(cookieOf(ok).every((c) => /Max-Age=0/.test(c))).toBe(true);
    });

    it('làm mới phiên bằng cookie hm_rt, phiên cũ trong localStorage đổi sang cookie được', async () => {
      resetMemoryLimits();
      const set = cookieOf(await login());
      const rt = set.find((c) => c.startsWith('hm_rt='))!.split(';')[0]!;
      const refreshed = await hono.request('/v1/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HM-Auth': 'cookie', Cookie: rt, Origin: web }, body: '{}' });
      expect(refreshed.status).toBe(200);
      expect(cookieOf(refreshed).some((c) => c.startsWith('hm_at=') && !c.startsWith('hm_at=;'))).toBe(true);
      // Phiên cũ: refresh token trong body (localStorage) đổi thành cookie.
      const legacy = (await (await hono.request('/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'minhquy@gmail.com', password: 'hoiminh123' }) })).json()) as { refreshToken: string };
      const migrated = await hono.request('/v1/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HM-Auth': 'cookie', Origin: web }, body: JSON.stringify({ refreshToken: legacy.refreshToken }) });
      expect(migrated.status).toBe(200);
      expect(cookieOf(migrated).some((c) => c.startsWith('hm_rt=') && /HttpOnly/.test(c))).toBe(true);
    });

    it('CORS cho phép header X-HM-Auth từ chính web (dev: web và API khác cổng)', async () => {
      const pre = await hono.request('/v1/auth/login', { method: 'OPTIONS', headers: { Origin: web, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-hm-auth' } });
      expect(pre.headers.get('access-control-allow-origin')).toBe(web);
      expect((pre.headers.get('access-control-allow-headers') ?? '').toLowerCase()).toContain('x-hm-auth');
      expect(pre.headers.get('access-control-allow-credentials')).toBe('true');
    });

    it('người đăng nhập bằng cookie không nhận bản cache của khách', async () => {
      resetMemoryLimits();
      const store = new Map<string, Response>();
      const g = globalThis as { caches?: unknown };
      g.caches = { default: { match: async (r: Request) => store.get(r.url)?.clone(), put: async (r: Request, res: Response) => void store.set(r.url, res) } };
      try {
        await hono.request('/v1/communities/discover');
        const cookies = jar(cookieOf(await login()));
        const mine = await hono.request('/v1/communities/discover', { headers: { Cookie: cookies } });
        expect(mine.headers.get('x-hm-cache')).toBeNull();
      } finally {
        delete g.caches;
      }
    });
  });

  describe('kênh thời gian thực', () => {
    const web = 'http://localhost:5173';
    const loginCookie = async () => {
      resetMemoryLimits();
      const res = await hono.request('/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HM-Auth': 'cookie', Origin: web }, body: JSON.stringify({ email: 'minhquy@gmail.com', password: 'hoiminh123' }) });
      lastUserId = ((await res.json()) as { user: { id: string } }).user.id;
      return res.headers.getSetCookie().map((c) => c.split(';')[0] ?? '').filter((c) => !c.endsWith('=')).join('; ');
    };
    let lastUserId = '';
    const ws = { Upgrade: 'websocket', Connection: 'Upgrade' };

    it('chưa đăng nhập 401, thiếu Upgrade 426, trang lạ 403, máy chủ không có Durable Object 501', async () => {
      expect((await hono.request('/v1/realtime', { headers: ws })).status).toBe(401);
      const cookies = await loginCookie();
      expect((await hono.request('/v1/realtime', { headers: { Cookie: cookies, Origin: web } })).status).toBe(426);
      expect((await hono.request('/v1/realtime', { headers: { ...ws, Cookie: cookies, Origin: 'https://evil.example' } })).status).toBe(403);
      expect((await hono.request('/v1/realtime', { headers: { ...ws, Cookie: cookies, Origin: web } })).status).toBe(501);
    });

    it('chuyển kết nối sang hub của đúng người dùng', async () => {
      const cookies = await loginCookie();
      const seen: string[] = [];
      const env = { REALTIME: { idFromName: (n: string) => n, get: (id: unknown) => ({ fetch: async () => { seen.push(String(id)); return new Response('hub', { status: 200 }); } }) } };
      const res = await hono.request('/v1/realtime', { headers: { ...ws, Cookie: cookies, Origin: web } }, env);
      expect(await res.text()).toBe('hub');
      expect(seen).toEqual([lastUserId]);
    });
  });

  describe('RealtimeHub (Durable Object)', () => {
    class FakeSocket {
      sent: string[] = [];
      closed: number | null = null;
      send(m: string) { this.sent.push(m); }
      close(code: number) { this.closed = code; }
    }
    function hub() {
      const sockets: FakeSocket[] = [];
      const state = { acceptWebSocket: (s: WebSocket) => void sockets.push(s as unknown as FakeSocket), getWebSockets: () => sockets as unknown as WebSocket[] };
      const runtime = { pair: () => ({ client: new FakeSocket() as unknown as WebSocket, server: new FakeSocket() as unknown as WebSocket }), upgrade: () => new Response(null, { status: 200 }) };
      return { h: new RealtimeHub(state, undefined, runtime), sockets };
    }
    const upgrade = () => new Request('https://hub/v1/realtime', { headers: { Upgrade: 'websocket' } });

    it('nhận kết nối và phát sự kiện tới mọi tab', async () => {
      const { h, sockets } = hub();
      await h.fetch(upgrade());
      await h.fetch(upgrade());
      const res = await h.fetch(new Request('https://hub/publish', { method: 'POST', body: '{"type":"notification"}' }));
      expect(await res.json()).toEqual({ sent: 2 });
      expect(sockets.every((s) => s.sent[0] === '{"type":"notification"}')).toBe(true);
    });

    it('quá số kết nối tối đa thì đóng kết nối cũ nhất; không phải WebSocket thì 426', async () => {
      const { h, sockets } = hub();
      for (let i = 0; i < MAX_SOCKETS + 1; i++) await h.fetch(upgrade());
      expect(sockets[0]!.closed).toBe(1013);
      expect((await h.fetch(new Request('https://hub/v1/realtime'))).status).toBe(426);
    });
  });
});
